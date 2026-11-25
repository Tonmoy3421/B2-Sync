-- =====================================================================
-- StudySync — complete database schema
-- Paste this WHOLE file into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- It is safe to run on a fresh project. (Running twice will show "already exists"
-- errors for tables; that is harmless, but a fresh project is cleanest.)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
-- The whole app lives in Bangladesh time. "Today" is always Dhaka's today.
create or replace function public.app_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- ---------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  full_name text not null default '',
  avatar_url text,
  university text not null default '',
  department text not null default '',
  semester text not null default '',
  phone text not null default '',
  address text not null default '',
  blood_group text not null default '',
  auth_provider text not null default 'email',
  email_verified boolean not null default false,
  updated_at timestamptz not null default now(),
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0,
  longest_streak integer not null default 0,
  last_study_date date,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  notify_prefs jsonb not null default '{"reminders":true,"group_activity":true,"dares":true}'::jsonb,
  privacy_prefs jsonb not null default '{"show_progress_to_groups":true}'::jsonb,
  created_at timestamptz not null default now()
);

-- Compatibility for databases created before the newer profile columns existed.
-- CREATE TABLE IF NOT EXISTS does not add missing columns, so do this before any
-- GRANT/RLS statement references them.
alter table public.profiles
  add column if not exists username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  add column if not exists full_name text not null default '',
  add column if not exists avatar_url text,
  add column if not exists university text not null default '',
  add column if not exists department text not null default '',
  add column if not exists semester text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists address text not null default '',
  add column if not exists blood_group text not null default '',
  add column if not exists auth_provider text not null default 'email',
  add column if not exists email_verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists xp integer not null default 0 check (xp >= 0),
  add column if not exists streak integer not null default 0 check (streak >= 0),
  add column if not exists longest_streak integer not null default 0 check (longest_streak >= 0),
  add column if not exists last_study_date date,
  add column if not exists theme text not null default 'dark' check (theme in ('dark','light','system')),
  add column if not exists notify_prefs jsonb not null default '{"reminders":true,"group_activity":true,"dares":true}'::jsonb,
  add column if not exists privacy_prefs jsonb not null default '{"show_progress_to_groups":true}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

-- Users may NOT write xp / streak directly. Only the columns below.
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, username, full_name, avatar_url, university, department, semester, phone, address, blood_group, auth_provider, email_verified)
  on public.profiles to authenticated;
grant update (full_name, avatar_url, university, department, semester, phone, address, blood_group, auth_provider, email_verified, updated_at, theme, notify_prefs, privacy_prefs)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Groups
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '',
  invite_code text not null unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    check (invite_code ~ '^[A-Z0-9]{6,12}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  max_members integer not null default 50 check (max_members between 2 and 200),
  max_warnings integer not null default 3 check (max_warnings between 1 and 10),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  warnings integer not null default 0 check (warnings >= 0),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_group_members_user on public.group_members(user_id);

create table if not exists public.kicked_users (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kicked_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- membership helpers (SECURITY DEFINER so policies don't recurse)
create or replace function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.is_group_admin(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members
                 where group_id = gid and user_id = auth.uid() and role in ('owner','admin'));
$$;

create or replace function public.shares_group(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid);
$$;

create or replace function public.progress_visible(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid() or coalesce(
    (select (privacy_prefs ->> 'show_progress_to_groups')::boolean from profiles where id = uid), true);
$$;

-- ---------------------------------------------------------------------
-- 3. Activity feed + XP (internal helpers, NOT callable by the browser)
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_group on public.activities(group_id, created_at desc);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_events_user on public.xp_events(user_id, created_at desc);

create or replace function public.log_activity(p_group uuid, p_user uuid, p_type text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into activities (group_id, user_id, type, message) values (p_group, p_user, p_type, p_message);
end $$;

create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set xp = greatest(0, xp + p_amount) where id = p_user;
  insert into xp_events (user_id, amount, reason) values (p_user, p_amount, p_reason);
end $$;

revoke all on function public.log_activity(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.award_xp(uuid, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Courses, topics, progress, notes
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  code text not null default '',
  instructor text not null default '',
  description text not null default '',
  semester text not null default '',
  color text not null default '#22d3ee',
  created_at timestamptz not null default now()
);
create index if not exists idx_courses_owner on public.courses(owner_id);
create index if not exists idx_courses_group on public.courses(group_id);

create or replace function public.can_see_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses c where c.id = cid
    and (c.owner_id = auth.uid() or (c.group_id is not null and public.is_member(c.group_id))));
$$;

create or replace function public.can_manage_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses c where c.id = cid
    and (c.owner_id = auth.uid() or (c.group_id is not null and public.is_group_admin(c.group_id))));
$$;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  parent_id uuid references public.topics(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  deadline date,
  assigned_to uuid references public.profiles(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_topics_course on public.topics(course_id);

create or replace function public.can_see_topic(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from topics t where t.id = tid and public.can_see_course(t.course_id));
$$;

create table if not exists public.topic_progress (
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  xp_awarded boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);
-- Progress can only be changed through set_topic_status() below (so XP can't be faked).
revoke insert, update, delete on public.topic_progress from authenticated, anon;

create table if not exists public.topic_notes (
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  is_shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

create or replace function public.trg_topic_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; v_group uuid;
begin
  new.updated_at := now();
  if new.status = 'completed' then
    if new.completed_at is null then new.completed_at := now(); end if;
    if not new.xp_awarded then
      new.xp_awarded := true;
      perform award_xp(new.user_id, 20, 'topic_completed');
      select t.title, c.group_id into v_title, v_group
        from topics t join courses c on c.id = t.course_id where t.id = new.topic_id;
      if v_group is not null then
        perform log_activity(v_group, new.user_id, 'topic_done', format('completed "%s"', v_title));
      end if;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists topic_progress_biu on public.topic_progress;
create trigger topic_progress_biu before insert or update on public.topic_progress
  for each row execute function public.trg_topic_progress();

create or replace function public.set_topic_status(p_topic uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_status not in ('not_started','in_progress','completed') then
    raise exception 'Invalid status';
  end if;
  if not public.can_see_topic(p_topic) then raise exception 'No access to this topic'; end if;
  insert into topic_progress (topic_id, user_id, status) values (p_topic, auth.uid(), p_status)
  on conflict (topic_id, user_id) do update set status = excluded.status;
end $$;
grant execute on function public.set_topic_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Study sessions (+ streak + XP)
-- ---------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  mode text not null check (mode in ('stopwatch','countdown','pomodoro','custom','focus','break')),
  planned_seconds integer not null default 0 check (planned_seconds >= 0),
  duration_seconds integer not null check (duration_seconds between 0 and 28800),
  completed boolean not null default false,
  distractions integer not null default 0 check (distractions >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on public.study_sessions(user_id, created_at desc);

create or replace function public.trg_session_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_xp integer; v_today date := public.app_today(); p profiles; g record;
begin
  if new.mode = 'break' or new.duration_seconds < 60 then return new; end if;

  v_xp := least(new.duration_seconds / 60, 180);
  if new.completed and new.mode = 'pomodoro' then v_xp := v_xp + 10; end if;
  if new.completed and new.mode = 'focus' then v_xp := v_xp + 15 - least(new.distractions, 10); end if;
  perform award_xp(new.user_id, greatest(v_xp, 1), 'study_session');

  select * into p from profiles where id = new.user_id;
  if p.last_study_date is distinct from v_today then
    if p.last_study_date = v_today - 1 then
      update profiles set streak = streak + 1, longest_streak = greatest(longest_streak, streak + 1),
        last_study_date = v_today where id = new.user_id;
    else
      update profiles set streak = 1, longest_streak = greatest(longest_streak, 1),
        last_study_date = v_today where id = new.user_id;
    end if;
    perform award_xp(new.user_id, 10, 'daily_streak');
  end if;

  if new.duration_seconds >= 600 then
    for g in select group_id from group_members where user_id = new.user_id loop
      perform log_activity(g.group_id, new.user_id, 'session',
        format('studied for %s min', new.duration_seconds / 60));
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists session_ai on public.study_sessions;
create trigger session_ai after insert on public.study_sessions
  for each row execute function public.trg_session_after_insert();

-- ---------------------------------------------------------------------
-- 6. Pledges (commitments), dares and the Wall of Shame
-- ---------------------------------------------------------------------
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  target_minutes integer not null check (target_minutes between 5 and 3000),
  starts_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'active' check (status in ('active','completed','failed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (due_at > starts_at)
);
create index if not exists idx_commitments_group on public.commitments(group_id, status);
revoke insert, update on public.commitments from authenticated, anon;
grant insert (user_id, group_id, title, target_minutes, due_at) on public.commitments to authenticated;

create table if not exists public.dares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  commitment_id uuid not null unique references public.commitments(id) on delete cascade,
  dare_text text not null,
  missed_minutes integer not null default 0,
  status text not null default 'pending' check (status in ('pending','done','shamed')),
  proof_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_dares_group on public.dares(group_id, created_at desc);

create table if not exists public.dare_reactions (
  dare_id uuid not null references public.dares(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('😂','👏','🔥','😈','💪')),
  primary key (dare_id, user_id)
);

create or replace function public.resolve_commitment(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  c commitments; g groups; mins integer; w integer;
  dare_list text[] := array[
    'Record a 30-second pep talk voice note for the whole group',
    'Teach the group any topic from your course in a 2-minute explanation',
    'Do 20 push-ups (or 30 squats) and send a photo as proof',
    'Write a funny 4-line poem about procrastination and post it',
    'Send a voice note singing one verse of any song you like',
    'Share the most useful study tip you know and explain why it works',
    'Make everyone in the group a cup of tea (or send a virtual one with a meme)',
    'Stand up and explain your hardest topic out loud to a wall for 3 minutes',
    'Post a throwback photo and tell the story behind it',
    'Let the group choose your profile status for the next 24 hours'
  ];
begin
  select * into c from commitments where id = p_id and status = 'active' for update;
  if not found then return 'skip'; end if;

  select coalesce(sum(duration_seconds), 0) / 60 into mins from study_sessions
   where user_id = c.user_id and mode <> 'break' and created_at >= c.starts_at and created_at <= c.due_at;

  if mins >= c.target_minutes then
    update commitments set status = 'completed', resolved_at = now() where id = c.id;
    perform award_xp(c.user_id, 40, 'pledge_completed');
    perform log_activity(c.group_id, c.user_id, 'pledge_done',
      format('kept the pledge "%s" (%s min)', c.title, mins));
    return 'completed';
  elsif c.due_at <= now() then
    update commitments set status = 'failed', resolved_at = now() where id = c.id;
    insert into dares (user_id, group_id, commitment_id, dare_text, missed_minutes)
      values (c.user_id, c.group_id, c.id,
              dare_list[1 + floor(random() * array_length(dare_list, 1))::int],
              greatest(c.target_minutes - mins, 0));
    update group_members set warnings = warnings + 1
      where group_id = c.group_id and user_id = c.user_id returning warnings into w;
    select * into g from groups where id = c.group_id;
    perform log_activity(c.group_id, c.user_id, 'pledge_failed',
      format('missed the pledge "%s" (%s of %s min)', c.title, mins, c.target_minutes));
    if w is not null and w >= g.max_warnings then
      delete from group_members where group_id = c.group_id and user_id = c.user_id and role <> 'owner';
      if found then
        insert into kicked_users (group_id, user_id) values (c.group_id, c.user_id) on conflict do nothing;
        perform log_activity(c.group_id, c.user_id, 'kicked', 'was removed after reaching the warning limit');
      end if;
    end if;
    return 'failed';
  end if;
  return 'active';
end $$;

revoke all on function public.resolve_commitment(uuid) from public, anon, authenticated;

-- Called by the app every time someone opens it: settles any pledge in MY groups.
create or replace function public.evaluate_my_commitments() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; changed integer := 0; res text;
begin
  if auth.uid() is null then return 0; end if;
  for r in select c.id from commitments c
           where c.status = 'active' and public.is_member(c.group_id) loop
    res := resolve_commitment(r.id);
    if res in ('completed','failed') then changed := changed + 1; end if;
  end loop;
  return changed;
end $$;
grant execute on function public.evaluate_my_commitments() to authenticated;

-- Called once a day by the scheduler for EVERYONE (see README, step "daily check").
create or replace function public.evaluate_all_commitments() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; changed integer := 0; res text;
begin
  for r in select id from commitments where status = 'active' loop
    res := resolve_commitment(r.id);
    if res in ('completed','failed') then changed := changed + 1; end if;
  end loop;
  return changed;
end $$;
revoke all on function public.evaluate_all_commitments() from public, anon, authenticated;
grant execute on function public.evaluate_all_commitments() to service_role;

-- Choose what to do about a failed pledge: do the dare, or take the shame.
create or replace function public.resolve_dare(p_id uuid, p_choice text, p_proof text default '')
returns void language plpgsql security definer set search_path = public as $$
declare d dares; c commitments;
begin
  select * into d from dares where id = p_id and user_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Dare not found or already settled'; end if;
  select * into c from commitments where id = d.commitment_id;

  if p_choice = 'dare' then
    if char_length(coalesce(trim(p_proof), '')) < 3 then
      raise exception 'Write a short proof note (what you did) to finish the dare';
    end if;
    update dares set status = 'done', proof_note = left(trim(p_proof), 500), resolved_at = now() where id = d.id;
    update group_members set warnings = greatest(warnings - 1, 0)
      where group_id = d.group_id and user_id = d.user_id;
    perform award_xp(d.user_id, 15, 'dare_done');
    perform log_activity(d.group_id, d.user_id, 'dare_done',
      format('completed the dare: %s', d.dare_text));
  elsif p_choice = 'shame' then
    update dares set status = 'shamed', resolved_at = now() where id = d.id;
    perform award_xp(d.user_id, -30, 'shame_taken');
    perform log_activity(d.group_id, d.user_id, 'shamed',
      format('took the shame for missing "%s"', c.title));
  else
    raise exception 'Choice must be dare or shame';
  end if;
end $$;
grant execute on function public.resolve_dare(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Goals, missions, habits
-- ---------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '',
  deadline date,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active','completed')),
  xp_awarded boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_goals_user on public.goals(user_id);
revoke insert, update on public.goals from authenticated, anon;
grant insert (user_id, title, description, deadline, priority, progress) on public.goals to authenticated;
grant update (title, description, deadline, priority, progress, status) on public.goals to authenticated;

create or replace function public.trg_goal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.progress >= 100 then new.status := 'completed'; end if;
  if new.status = 'completed' then
    new.progress := 100;
    if new.completed_at is null then new.completed_at := now(); end if;
    if not new.xp_awarded then
      new.xp_awarded := true;
      perform award_xp(new.user_id, 50, 'goal_completed');
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;
drop trigger if exists goal_biu on public.goals;
create trigger goal_biu before insert or update on public.goals
  for each row execute function public.trg_goal();

create table if not exists public.mission_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_key text not null,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mission_key, period_key)
);

create or replace function public.claim_mission(p_key text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); today date := public.app_today();
  wk date := date_trunc('week', public.app_today())::date;
  pkey text; reward integer; mins integer; cnt integer; ok boolean := false;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  pkey := case when p_key like 'd\_%' then today::text else wk::text end;
  if exists (select 1 from mission_claims where user_id = uid and mission_key = p_key and period_key = pkey) then
    raise exception 'Already claimed';
  end if;

  if p_key = 'd_study_45' then
    reward := 30;
    select coalesce(sum(duration_seconds), 0) / 60 into mins from study_sessions
      where user_id = uid and mode <> 'break' and (created_at at time zone 'Asia/Dhaka')::date = today;
    ok := mins >= 45;
  elsif p_key = 'd_topic_1' then
    reward := 25;
    select count(*) into cnt from topic_progress
      where user_id = uid and status = 'completed' and (completed_at at time zone 'Asia/Dhaka')::date = today;
    ok := cnt >= 1;
  elsif p_key = 'd_habit_1' then
    reward := 10;
    select count(*) into cnt from habit_logs where user_id = uid and log_date = today;
    ok := cnt >= 1;
  elsif p_key = 'w_study_600' then
    reward := 150;
    select coalesce(sum(duration_seconds), 0) / 60 into mins from study_sessions
      where user_id = uid and mode <> 'break' and (created_at at time zone 'Asia/Dhaka')::date >= wk;
    ok := mins >= 600;
  elsif p_key = 'w_topics_5' then
    reward := 120;
    select count(*) into cnt from topic_progress
      where user_id = uid and status = 'completed' and (completed_at at time zone 'Asia/Dhaka')::date >= wk;
    ok := cnt >= 5;
  elsif p_key = 'w_days_5' then
    reward := 100;
    select count(distinct (created_at at time zone 'Asia/Dhaka')::date) into cnt from study_sessions
      where user_id = uid and mode <> 'break' and (created_at at time zone 'Asia/Dhaka')::date >= wk;
    ok := cnt >= 5;
  else
    raise exception 'Unknown mission';
  end if;

  if not ok then raise exception 'Mission not finished yet'; end if;
  insert into mission_claims (user_id, mission_key, period_key) values (uid, p_key, pkey);
  perform award_xp(uid, reward, 'mission_' || p_key);
  return reward;
end $$;
grant execute on function public.claim_mission(text) to authenticated;

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  icon text not null default '📚',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  primary key (habit_id, log_date)
);
create index if not exists idx_habit_logs_user on public.habit_logs(user_id, log_date);

create or replace function public.trg_habit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.log_date > public.app_today() or new.log_date < public.app_today() - 7 then
    raise exception 'You can only log habits for today or the last 7 days';
  end if;
  -- XP only once per habit per day, so un-ticking and re-ticking can't farm XP
  if new.log_date = public.app_today()
     and not exists (select 1 from xp_events where user_id = new.user_id
                       and reason = 'habit_logged:' || new.habit_id || ':' || new.log_date) then
    perform award_xp(new.user_id, 5, 'habit_logged:' || new.habit_id || ':' || new.log_date);
  end if;
  return new;
end $$;
drop trigger if exists habit_log_bi on public.habit_logs;
create trigger habit_log_bi before insert on public.habit_logs
  for each row execute function public.trg_habit_log();

-- ---------------------------------------------------------------------
-- 8. Calendar events
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  kind text not null default 'reminder'
    check (kind in ('class','exam','assignment','study','reminder','group')),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  remind_minutes integer not null default 30 check (remind_minutes between 0 and 10080),
  created_at timestamptz not null default now()
);
create index if not exists idx_events_user on public.events(user_id, starts_at);
create index if not exists idx_events_group on public.events(group_id, starts_at);

-- ---------------------------------------------------------------------
-- 9. Learning vault (resources)
-- ---------------------------------------------------------------------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'link'
    check (kind in ('pdf','note','doc','image','audio','video','link','assignment','past_paper')),
  description text not null default '',
  url text,
  storage_path text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);
create index if not exists idx_resources_owner on public.resources(owner_id);
create index if not exists idx_resources_group on public.resources(group_id);

create or replace function public.trg_resource_ai() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnt integer;
begin
  if new.group_id is not null then
    select count(*) into cnt from resources
      where owner_id = new.owner_id and group_id is not null
        and (created_at at time zone 'Asia/Dhaka')::date = public.app_today();
    if cnt <= 3 then perform award_xp(new.owner_id, 5, 'resource_shared'); end if;
    perform log_activity(new.group_id, new.owner_id, 'resource', format('shared "%s"', new.title));
  end if;
  return new;
end $$;
drop trigger if exists resource_ai on public.resources;
create trigger resource_ai after insert on public.resources
  for each row execute function public.trg_resource_ai();

-- ---------------------------------------------------------------------
-- 10. Achievements
-- ---------------------------------------------------------------------
create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

create or replace function public.evaluate_achievements() returns text[]
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p profiles; mins integer; n integer; k text;
  unlocked text[] := '{}'; wanted text[] := '{}';
begin
  if uid is null then return unlocked; end if;
  select * into p from profiles where id = uid;
  if not found then return unlocked; end if;

  select count(*), coalesce(sum(duration_seconds), 0) / 60 into n, mins
    from study_sessions where user_id = uid and mode <> 'break';
  if n >= 1 then wanted := array_append(wanted, 'first_session'); end if;
  if mins >= 600 then wanted := array_append(wanted, 'hours_10'); end if;
  if mins >= 3000 then wanted := array_append(wanted, 'hours_50'); end if;

  if p.longest_streak >= 3 then wanted := array_append(wanted, 'streak_3'); end if;
  if p.longest_streak >= 7 then wanted := array_append(wanted, 'streak_7'); end if;
  if p.longest_streak >= 30 then wanted := array_append(wanted, 'streak_30'); end if;

  select count(*) into n from topic_progress where user_id = uid and status = 'completed';
  if n >= 10 then wanted := array_append(wanted, 'topics_10'); end if;
  if n >= 50 then wanted := array_append(wanted, 'topics_50'); end if;

  select count(*) into n from goals where user_id = uid and status = 'completed';
  if n >= 1 then wanted := array_append(wanted, 'goal_first'); end if;
  if n >= 5 then wanted := array_append(wanted, 'goals_5'); end if;

  select count(*) into n from habit_logs where user_id = uid;
  if n >= 30 then wanted := array_append(wanted, 'habit_30'); end if;

  select count(*) into n from resources where owner_id = uid and group_id is not null;
  if n >= 5 then wanted := array_append(wanted, 'helper'); end if;

  select count(*) into n from group_members where user_id = uid;
  if n >= 1 then wanted := array_append(wanted, 'team_player'); end if;

  if p.xp >= 1600 then wanted := array_append(wanted, 'level_5'); end if;

  select count(*) into n from commitments where user_id = uid and status = 'completed';
  if n >= 3 then wanted := array_append(wanted, 'clean_record'); end if;

  select count(*) into n from dares where user_id = uid and status = 'done';
  if n >= 1 then wanted := array_append(wanted, 'dare_devil'); end if;

  select count(*) into n from study_sessions where user_id = uid and mode = 'focus' and completed;
  if n >= 5 then wanted := array_append(wanted, 'focus_master'); end if;

  foreach k in array wanted loop
    insert into user_achievements (user_id, key) values (uid, k) on conflict do nothing;
    if found then
      unlocked := unlocked || k;
      perform award_xp(uid, 25, 'achievement_' || k);
    end if;
  end loop;
  return unlocked;
end $$;
grant execute on function public.evaluate_achievements() to authenticated;

-- ---------------------------------------------------------------------
-- 11. RPCs the app calls
-- ---------------------------------------------------------------------
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(p_username)));
$$;
grant execute on function public.username_available(text) to authenticated;

create or replace function public.create_group(p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into groups (name, description, owner_id)
    values (trim(p_name), coalesce(p_description, ''), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  perform log_activity(gid, auth.uid(), 'join', 'created the group');
  return gid;
end $$;
grant execute on function public.create_group(text, text) to authenticated;

create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g groups; cnt integer; w integer := 0;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'Invalid invite code'; end if;
  if exists (select 1 from group_members where group_id = g.id and user_id = auth.uid()) then
    return g.id;
  end if;
  select count(*) into cnt from group_members where group_id = g.id;
  if cnt >= g.max_members then raise exception 'This group is full'; end if;
  if exists (select 1 from kicked_users where group_id = g.id and user_id = auth.uid()) then
    w := greatest(g.max_warnings - 1, 0);
    delete from kicked_users where group_id = g.id and user_id = auth.uid();
  end if;
  insert into group_members (group_id, user_id, role, warnings) values (g.id, auth.uid(), 'member', w);
  perform log_activity(g.id, auth.uid(), 'join', 'joined the group');
  return g.id;
end $$;
grant execute on function public.join_group(text) to authenticated;

create or replace function public.group_leaderboard(p_group uuid)
returns table (user_id uuid, username text, full_name text, avatar_url text, xp integer,
               streak integer, warnings integer, role text, week_minutes integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_group) then raise exception 'Not a member'; end if;
  return query
    select m.user_id, p.username, p.full_name, p.avatar_url, p.xp, p.streak, m.warnings, m.role,
      (select coalesce(sum(s.duration_seconds), 0) / 60 from study_sessions s
        where s.user_id = m.user_id and s.mode <> 'break'
          and (s.created_at at time zone 'Asia/Dhaka')::date >= date_trunc('week', public.app_today())::date)::integer
    from group_members m join profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by p.xp desc;
end $$;
grant execute on function public.group_leaderboard(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.kicked_users enable row level security;
alter table public.activities enable row level security;
alter table public.xp_events enable row level security;
alter table public.courses enable row level security;
alter table public.topics enable row level security;
alter table public.topic_progress enable row level security;
alter table public.topic_notes enable row level security;
alter table public.study_sessions enable row level security;
alter table public.commitments enable row level security;
alter table public.dares enable row level security;
alter table public.dare_reactions enable row level security;
alter table public.goals enable row level security;
alter table public.mission_claims enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.events enable row level security;
alter table public.resources enable row level security;
alter table public.user_achievements enable row level security;

-- profiles: you and people who share a group with you
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (public.shares_group(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- groups
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated using (public.is_member(id));
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated using (owner_id = auth.uid());

-- group_members
drop policy if exists gm_select on public.group_members;
create policy gm_select on public.group_members for select to authenticated using (public.is_member(group_id));
drop policy if exists gm_update on public.group_members;
create policy gm_update on public.group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id) and role <> 'owner');
drop policy if exists gm_delete on public.group_members;
create policy gm_delete on public.group_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or public.is_group_admin(group_id)));

drop policy if exists kicked_select on public.kicked_users;
create policy kicked_select on public.kicked_users for select to authenticated using (public.is_group_admin(group_id));

-- activities & xp
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated using (public.is_member(group_id));
drop policy if exists xp_select on public.xp_events;
create policy xp_select on public.xp_events for select to authenticated using (user_id = auth.uid());

-- courses
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (owner_id = auth.uid() or (group_id is not null and public.is_member(group_id)));
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check (owner_id = auth.uid() and (group_id is null or public.is_member(group_id)));
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update to authenticated
  using (public.can_manage_course(id))
  with check (group_id is null or public.is_member(group_id));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete to authenticated using (public.can_manage_course(id));

-- topics
drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics for select to authenticated using (public.can_see_course(course_id));
drop policy if exists topics_insert on public.topics;
create policy topics_insert on public.topics for insert to authenticated with check (public.can_see_course(course_id));
drop policy if exists topics_update on public.topics;
create policy topics_update on public.topics for update to authenticated using (public.can_see_course(course_id)) with check (public.can_see_course(course_id));
drop policy if exists topics_delete on public.topics;
create policy topics_delete on public.topics for delete to authenticated using (public.can_manage_course(course_id));

-- topic progress (everyone in the course's group can see status, unless the person hid it)
drop policy if exists tp_select on public.topic_progress;
create policy tp_select on public.topic_progress for select to authenticated
  using (user_id = auth.uid() or (public.can_see_topic(topic_id) and public.progress_visible(user_id)));

-- topic notes (private unless shared)
drop policy if exists tn_select on public.topic_notes;
create policy tn_select on public.topic_notes for select to authenticated
  using (user_id = auth.uid() or (is_shared and public.can_see_topic(topic_id)));
drop policy if exists tn_insert on public.topic_notes;
create policy tn_insert on public.topic_notes for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_topic(topic_id));
drop policy if exists tn_update on public.topic_notes;
create policy tn_update on public.topic_notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tn_delete on public.topic_notes;
create policy tn_delete on public.topic_notes for delete to authenticated using (user_id = auth.uid());

-- study sessions (private; group-mates only see activity feed + leaderboard totals)
drop policy if exists ss_select on public.study_sessions;
create policy ss_select on public.study_sessions for select to authenticated using (user_id = auth.uid());
drop policy if exists ss_insert on public.study_sessions;
create policy ss_insert on public.study_sessions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ss_delete on public.study_sessions;
create policy ss_delete on public.study_sessions for delete to authenticated using (user_id = auth.uid());

-- commitments / dares
drop policy if exists cm_select on public.commitments;
create policy cm_select on public.commitments for select to authenticated using (public.is_member(group_id));
drop policy if exists cm_insert on public.commitments;
create policy cm_insert on public.commitments for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(group_id) and due_at > now());
-- A pledge can only be withdrawn in the first 10 minutes (fixes typos) - otherwise people could
-- dodge the penalty by deleting a pledge they are about to miss.
drop policy if exists cm_delete on public.commitments;
create policy cm_delete on public.commitments for delete to authenticated
  using (user_id = auth.uid() and status = 'active' and created_at > now() - interval '10 minutes');

drop policy if exists dares_select on public.dares;
create policy dares_select on public.dares for select to authenticated
  using (user_id = auth.uid() or public.is_member(group_id));

drop policy if exists dr_select on public.dare_reactions;
create policy dr_select on public.dare_reactions for select to authenticated
  using (exists (select 1 from dares d where d.id = dare_id and public.is_member(d.group_id)));
drop policy if exists dr_insert on public.dare_reactions;
create policy dr_insert on public.dare_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from dares d where d.id = dare_id and public.is_member(d.group_id)));
drop policy if exists dr_update on public.dare_reactions;
create policy dr_update on public.dare_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists dr_delete on public.dare_reactions;
create policy dr_delete on public.dare_reactions for delete to authenticated using (user_id = auth.uid());

-- goals / missions / habits (private)
drop policy if exists goals_all_select on public.goals;
create policy goals_all_select on public.goals for select to authenticated using (user_id = auth.uid());
drop policy if exists goals_insert on public.goals;
create policy goals_insert on public.goals for insert to authenticated with check (user_id = auth.uid());
drop policy if exists goals_update on public.goals;
create policy goals_update on public.goals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists goals_delete on public.goals;
create policy goals_delete on public.goals for delete to authenticated using (user_id = auth.uid());

drop policy if exists mc_select on public.mission_claims;
create policy mc_select on public.mission_claims for select to authenticated using (user_id = auth.uid());

drop policy if exists habits_select on public.habits;
create policy habits_select on public.habits for select to authenticated using (user_id = auth.uid());
drop policy if exists habits_insert on public.habits;
create policy habits_insert on public.habits for insert to authenticated with check (user_id = auth.uid());
drop policy if exists habits_update on public.habits;
create policy habits_update on public.habits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists habits_delete on public.habits;
create policy habits_delete on public.habits for delete to authenticated using (user_id = auth.uid());

drop policy if exists hl_select on public.habit_logs;
create policy hl_select on public.habit_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists hl_insert on public.habit_logs;
create policy hl_insert on public.habit_logs for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));
drop policy if exists hl_delete on public.habit_logs;
create policy hl_delete on public.habit_logs for delete to authenticated using (user_id = auth.uid());

-- events
drop policy if exists ev_select on public.events;
create policy ev_select on public.events for select to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_member(group_id)));
drop policy if exists ev_insert on public.events;
create policy ev_insert on public.events for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or public.is_member(group_id)));
drop policy if exists ev_update on public.events;
create policy ev_update on public.events for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (group_id is null or public.is_member(group_id)));
drop policy if exists ev_delete on public.events;
create policy ev_delete on public.events for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_group_admin(group_id)));

-- resources
drop policy if exists res_select on public.resources;
create policy res_select on public.resources for select to authenticated
  using (owner_id = auth.uid() or (group_id is not null and public.is_member(group_id)));
drop policy if exists res_insert on public.resources;
create policy res_insert on public.resources for insert to authenticated
  with check (owner_id = auth.uid() and (group_id is null or public.is_member(group_id)));
drop policy if exists res_update on public.resources;
create policy res_update on public.resources for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (group_id is null or public.is_member(group_id)));
drop policy if exists res_delete on public.resources;
create policy res_delete on public.resources for delete to authenticated
  using (owner_id = auth.uid() or (group_id is not null and public.is_group_admin(group_id)));

drop policy if exists ua_select on public.user_achievements;
create policy ua_select on public.user_achievements for select to authenticated using (public.shares_group(user_id));

-- ---------------------------------------------------------------------
-- 13. Storage (files)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault', 'vault', false, 20971520)          -- private, 20 MB per file
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists vault_insert on storage.objects;
create policy vault_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists vault_delete on storage.objects;
create policy vault_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists vault_select on storage.objects;
create policy vault_select on storage.objects for select to authenticated
  using (bucket_id = 'vault' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.resources r
               where r.storage_path = storage.objects.name
                 and r.group_id is not null and public.is_member(r.group_id))));

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 14. Optional: daily penalty check inside the database (recommended, free)
-- Enable "pg_cron" first: Dashboard -> Database -> Extensions -> search "pg_cron" -> enable.
-- Then un-comment and run the next two lines. 18:00 UTC = midnight in Dhaka.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule('studysync-daily-check', '0 18 * * *', $$ select public.evaluate_all_commitments(); $$);

-- ---------------------------------------------------------------------
-- 15. B2 Sync admin, join requests and approvals
-- Run this section once in the Supabase SQL editor; it is safe to re-run.
-- ---------------------------------------------------------------------

alter table public.profiles add column if not exists approved boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists blood_group text not null default '';
alter table public.profiles add column if not exists auth_provider text not null default 'email';
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
grant update (full_name, avatar_url, university, department, semester, phone, address, blood_group, auth_provider, email_verified, updated_at, theme, notify_prefs, privacy_prefs)
  on public.profiles to authenticated;

-- Keep auth fields in sync with Supabase Auth and stamp updates server-side.
update public.profiles p
   set email_verified = u.email_confirmed_at is not null,
       auth_provider = coalesce(nullif(u.raw_app_meta_data ->> 'provider', ''), p.auth_provider, 'email')
  from auth.users u
 where p.id = u.id;

create or replace function public.touch_profile_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Keep existing members working; only new signups need approval.
create table if not exists public.schema_meta (
  key text primary key,
  value text not null default ''
);
do $$
begin
  if not exists (select 1 from public.schema_meta where key = 'approval-grant-existing-v1') then
    update public.profiles set approved = true;
    insert into public.schema_meta (key, value) values ('approval-grant-existing-v1', now()::text);
  end if;
end $$;

update public.profiles p
   set email = u.email
  from auth.users u
 where p.id = u.id and (p.email is null or p.email = '');

create index if not exists idx_profiles_approved on public.profiles(approved);
create index if not exists idx_profiles_is_admin on public.profiles(is_admin);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  full_name text not null,
  university text not null default '',
  department text not null default '',
  semester text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_join_requests_status on public.join_requests(status, created_at desc);

alter table public.join_requests enable row level security;
drop policy if exists join_requests_select_own on public.join_requests;
create policy join_requests_select_own on public.join_requests
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists join_requests_insert_own on public.join_requests;
create policy join_requests_insert_own on public.join_requests
  for insert to authenticated with check (auth.uid() = user_id);

-- Server-side audit trail for every admin action.
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_actions_created on public.admin_actions(created_at desc);
alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------------
-- 16. Exclusive owner-admin RBAC, website content and admin security logs
-- Run this section once. It is safe to re-run.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin')),
  add column if not exists suspended boolean not null default false;

-- Privileged columns are never writable through the browser/PostgREST role.
-- Revoke everything instead of naming the reserved "role" column in a
-- privilege list, then restore only the safe column-level grants.
revoke all on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant insert (id, username, full_name, avatar_url, university, department, semester, phone, address, blood_group, auth_provider, email_verified)
  on public.profiles to authenticated;
grant update (full_name, avatar_url, university, department, semester, phone, address, blood_group, auth_provider, email_verified, updated_at, theme, notify_prefs, privacy_prefs)
  on public.profiles to authenticated;

-- Exactly one admin row can ever exist.
create unique index if not exists profiles_one_admin on public.profiles ((role)) where role = 'admin';
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_suspended on public.profiles(suspended);

create or replace function public.is_owner_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
grant execute on function public.is_owner_admin() to authenticated;

-- Owner row cannot be deleted, demoted or suspended. Nobody else can be promoted
-- except by the trusted provisioning script using the service role key.
create or replace function public.enforce_owner_admin_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' then
      raise exception 'The owner admin account cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.role = 'admin' and (new.role <> 'admin' or new.id <> old.id) then
      raise exception 'The owner admin account cannot be demoted or transferred';
    end if;
    if new.role = 'admin' and old.role <> 'admin' then
      if exists (select 1 from public.profiles where role = 'admin' and id <> new.id) then
        raise exception 'Only one owner admin is allowed';
      end if;
    end if;
  end if;

  if new.role = 'admin' then
    new.approved := true;
    new.suspended := false;
    new.is_admin := true;
  else
    new.is_admin := false;
  end if;
  return new;
end $$;

drop trigger if exists profiles_owner_admin_guard on public.profiles;
create trigger profiles_owner_admin_guard
  before insert or update or delete on public.profiles
  for each row execute function public.enforce_owner_admin_profile();

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  body text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_active on public.announcements(active, created_at desc);

create table if not exists public.admin_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_login_history_created on public.admin_login_history(created_at desc);

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null default '',
  ip text not null default '',
  reason text not null default 'invalid_credentials',
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_attempts_created on public.admin_login_attempts(created_at desc);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  jti text not null unique,
  user_id uuid not null,
  email text not null,
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_admin_sessions_active on public.admin_sessions(revoked_at, expires_at desc);

alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_login_history enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.admin_sessions enable row level security;

drop policy if exists settings_owner_all on public.site_settings;
create policy settings_owner_all on public.site_settings for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated using (active);
drop policy if exists announcements_owner_write on public.announcements;
create policy announcements_owner_write on public.announcements for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());

drop policy if exists admin_history_owner on public.admin_login_history;
create policy admin_history_owner on public.admin_login_history for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());
drop policy if exists admin_attempts_owner on public.admin_login_attempts;
create policy admin_attempts_owner on public.admin_login_attempts for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());
drop policy if exists admin_sessions_owner on public.admin_sessions;
create policy admin_sessions_owner on public.admin_sessions for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());

-- Persistent "signed in before" marker so onboarding is shown only once per email.
create table if not exists public.signin_history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_sign_in_at timestamptz not null default now(),
  last_sign_in_at timestamptz not null default now(),
  sign_in_count integer not null default 1
);
alter table public.signin_history enable row level security;
drop policy if exists signin_history_own on public.signin_history;
create policy signin_history_own on public.signin_history for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 17. Explicit Data API grants
-- ---------------------------------------------------------------------
-- New Supabase projects no longer grant table privileges to anon/authenticated
-- automatically. RLS policies do not replace grants: both are required.
-- Re-run this whole file after updating; these grants are safe to repeat.
-- Privileged columns (xp/streak/role/approved/suspended, goal and pledge
-- columns) keep the tighter column-level grants defined earlier.

-- service_role bypasses RLS but still needs table/sequence privileges.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Read access for signed-in users.
grant select on
  public.profiles, public.groups, public.group_members, public.kicked_users,
  public.activities, public.xp_events, public.courses, public.topics,
  public.topic_progress, public.topic_notes, public.study_sessions,
  public.commitments, public.dares, public.dare_reactions, public.goals,
  public.mission_claims, public.habits, public.habit_logs, public.events,
  public.resources, public.user_achievements, public.join_requests,
  public.site_settings, public.announcements, public.admin_login_history,
  public.admin_login_attempts, public.admin_sessions, public.signin_history
to authenticated;

-- Writes allowed by the RLS policies above.
grant update, delete on public.groups to authenticated;
grant update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.topics to authenticated;
grant select, insert, update, delete on public.topic_notes to authenticated;
grant select, insert, delete on public.study_sessions to authenticated;
grant delete on public.commitments to authenticated;
grant select, insert, update, delete on public.dare_reactions to authenticated;
grant delete on public.goals to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, delete on public.habit_logs to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert on public.join_requests to authenticated;
grant select, insert, update, delete on
  public.site_settings, public.announcements, public.admin_login_history,
  public.admin_login_attempts, public.admin_sessions
to authenticated;

-- Helper functions used inside RLS policies must be callable by signed-in users.
grant execute on function public.app_today() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.shares_group(uuid) to authenticated;
grant execute on function public.progress_visible(uuid) to authenticated;
grant execute on function public.can_see_course(uuid) to authenticated;
grant execute on function public.can_manage_course(uuid) to authenticated;
grant execute on function public.can_see_topic(uuid) to authenticated;

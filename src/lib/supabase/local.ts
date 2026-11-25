/* eslint-disable @typescript-eslint/no-explicit-any */
// Self-contained local database for when Supabase isn't configured.
// It implements the small slice of the Supabase JS API that B2 Sync uses,
// backed by localStorage, so login + every page work without any setup.

import { localRequestReset, localResetPassword, localSignIn, localSignUp, localUpdatePassword } from "../auth/local-credentials";

const NS = "studysync:local:";
const SESSION_KEY = NS + "session";
const FILES_KEY = NS + "files:";

type Row = Record<string, any>;
type Filter = { col: string; op: string; value: any };

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  const d = new Date();
  // Asia/Dhaka is UTC+6; shift before reading the calendar date.
  return new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

function weekStart(): string {
  const d = new Date(today() + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function readTable<T extends Row = Row>(table: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NS + table);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeTable(table: string, rows: Row[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NS + table, JSON.stringify(rows));
  } catch {
    /* storage full / disabled — keep the app responsive */
  }
}

function currentUser(): Row | null {
  return readSession()?.user ?? null;
}

function readSession(): { user: Row; access_token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session: { user: Row; access_token: string } | null): void {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

function addXp(userId: string, amount: number, reason: string): void {
  const profiles = readTable("profiles");
  const p = profiles.find((r) => r.id === userId);
  if (p) p.xp = Math.max(0, (Number(p.xp) || 0) + amount);
  writeTable("profiles", profiles);
  const events = readTable("xp_events");
  events.push({ id: uuid(), user_id: userId, amount, reason, created_at: now() });
  writeTable("xp_events", events);
}

function addActivity(groupId: string, userId: string, type: string, message: string): void {
  const rows = readTable("activities");
  rows.push({ id: uuid(), group_id: groupId, user_id: userId, type, message, created_at: now() });
  writeTable("activities", rows);
}

function defaultsFor(table: string, row: Row): Row {
  const out: Row = { ...row };
  if (out.id === undefined && table !== "group_members" && table !== "habit_logs" && table !== "mission_claims" && table !== "dare_reactions" && table !== "kicked_users") {
    out.id = uuid();
  }
  if (out.created_at === undefined) out.created_at = now();
  const d: Record<string, Row> = {
    profiles: { xp: 0, streak: 0, longest_streak: 0, theme: "dark", approved: true, is_admin: false, role: "user", suspended: false, email: "", notify_prefs: { reminders: true, group_activity: true, dares: true }, privacy_prefs: { show_progress_to_groups: true }, full_name: "", university: "", department: "", semester: "", phone: "", address: "", blood_group: "", auth_provider: "email", email_verified: true, avatar_url: null, last_study_date: null },
    groups: { description: "", max_members: 50, max_warnings: 3, invite_code: randomCode() },
    group_members: { role: "member", warnings: 0, joined_at: now() },
    goals: { user_id: currentUser()?.id, description: "", deadline: null, priority: "medium", progress: 0, status: "active", xp_awarded: false, completed_at: null },
    habits: { user_id: currentUser()?.id, icon: "📚", archived: false },
    habit_logs: { user_id: currentUser()?.id },
    commitments: { user_id: currentUser()?.id, starts_at: now(), status: "active", resolved_at: null },
    dares: { user_id: currentUser()?.id, status: "pending", proof_note: "", missed_minutes: 0, resolved_at: null },
    courses: { owner_id: currentUser()?.id, group_id: null },
    topics: {},
    topic_progress: { user_id: currentUser()?.id, status: "not_started", completed_at: null },
    topic_notes: { user_id: currentUser()?.id },
    events: { user_id: currentUser()?.id, group_id: null, course_id: null, kind: "reminder", description: "", remind_minutes: 30, ends_at: null },
    resources: { owner_id: currentUser()?.id, group_id: null, course_id: null, topic_id: null, kind: "link", description: "", url: null, storage_path: null, size_bytes: null },
    study_sessions: { user_id: currentUser()?.id, course_id: null, planned_seconds: 0, duration_seconds: 0, completed: false, distractions: 0, note: "" },
    dare_reactions: { user_id: currentUser()?.id },
    mission_claims: { user_id: currentUser()?.id, claimed_at: now() },
    user_achievements: { user_id: currentUser()?.id },
    activities: { user_id: currentUser()?.id },
  };
  const defaults = d[table] ?? {};
  for (const [k, v] of Object.entries(defaults)) if (out[k] === undefined) out[k] = v;
  return out;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Mirror Supabase's ON DELETE CASCADE behaviour for locally stored data. */
function cascadeLocalDelete(table: string, ids: Set<string>): void {
  if (!ids.size) return;
  const has = (value: unknown) => typeof value === "string" && ids.has(value);

  if (table === "courses") {
    const topicIds = new Set(readTable("topics").filter((t) => has(t.course_id)).map((t) => String(t.id)));
    cascadeLocalDelete("topics", topicIds);
    for (const name of ["resources", "events"]) {
      writeTable(name, readTable(name).filter((r) => !has(r.course_id)));
    }
    return;
  }

  if (table === "topics") {
    const all = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of readTable("topics")) {
        if (typeof t.parent_id === "string" && all.has(t.parent_id) && !all.has(String(t.id))) {
          all.add(String(t.id));
          grew = true;
        }
      }
    }
    const hasTopic = (value: unknown) => typeof value === "string" && all.has(value);
    for (const name of ["topic_progress", "topic_notes", "resources"]) {
      writeTable(name, readTable(name).filter((r) => !hasTopic(r.topic_id)));
    }
    writeTable("topics", readTable("topics").filter((t) => !hasTopic(String(t.id))));
  }
}

function afterWrite(table: string, rows: Row[], op: string): void {
  if (op !== "insert" && op !== "upsert" && op !== "update") return;
  for (const r of rows) {
    if (table === "study_sessions" && op === "insert") {
      if (r.mode === "break" || Number(r.duration_seconds) < 60) continue;
      let xp = Math.min(Math.floor(Number(r.duration_seconds) / 60), 180);
      if (r.completed && r.mode === "pomodoro") xp += 10;
      if (r.completed && r.mode === "focus") xp += 15 - Math.min(Number(r.distractions) || 0, 10);
      addXp(r.user_id, Math.max(xp, 1), "study_session");
      const profiles = readTable("profiles");
      const p = profiles.find((x) => x.id === r.user_id);
      if (p && p.last_study_date !== today()) {
        const y = new Date(today() + "T00:00:00Z");
        y.setUTCDate(y.getUTCDate() - 1);
        p.streak = p.last_study_date === y.toISOString().slice(0, 10) ? (Number(p.streak) || 0) + 1 : 1;
        p.longest_streak = Math.max(Number(p.longest_streak) || 0, p.streak);
        p.last_study_date = today();
        writeTable("profiles", profiles);
        addXp(r.user_id, 10, "daily_streak");
      }
      if (Number(r.duration_seconds) >= 600) {
        for (const m of readTable("group_members").filter((m) => m.user_id === r.user_id)) {
          addActivity(m.group_id, r.user_id, "session", `studied for ${Math.floor(Number(r.duration_seconds) / 60)} min`);
        }
      }
    } else if (table === "habit_logs" && op === "insert") {
      addXp(r.user_id, 5, `habit_logged:${r.habit_id}:${r.log_date}`);
    } else if (table === "topic_progress" && (r.status === "completed")) {
      const events = readTable("xp_events");
      const key = `topic_done:${r.topic_id}:${r.user_id}`;
      if (!events.some((e) => e.reason === key)) addXp(r.user_id, 5, key);
    } else if (table === "goals" && r.status === "completed" && !r.xp_awarded) {
      r.xp_awarded = true;
      r.progress = 100;
      r.completed_at = r.completed_at || now();
      writeTable("goals", readTable("goals").map((g) => (g.id === r.id ? r : g)));
      addXp(r.user_id, 50, "goal_completed");
    }
  }
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ col, op, value }) => {
    const v = row[col];
    switch (op) {
      case "eq": return v === value;
      case "neq": return v !== value;
      case "gt": return v > value;
      case "gte": return v >= value;
      case "lt": return v < value;
      case "lte": return v <= value;
      case "in": return Array.isArray(value) && value.includes(v);
      case "is": return value === null ? v === null || v === undefined : v === value;
      case "like":
      case "ilike": {
        const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
        return new RegExp("^" + pattern + "$", op === "ilike" ? "i" : "").test(String(v ?? ""));
      }
      default: return true;
    }
  });
}

class LocalQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private ordering: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rangeFrom = 0;
  private rangeTo: number | null = null;
  private singleRow = false;
  private maybeSingleRow = false;
  private wantReturn = false;
  private selectCols = "*";
  private headOnly = false;

  constructor(private table: string, private op: string, private payload: any) {}

  eq(col: string, value: any) { this.filters.push({ col, op: "eq", value }); return this; }
  neq(col: string, value: any) { this.filters.push({ col, op: "neq", value }); return this; }
  gt(col: string, value: any) { this.filters.push({ col, op: "gt", value }); return this; }
  gte(col: string, value: any) { this.filters.push({ col, op: "gte", value }); return this; }
  lt(col: string, value: any) { this.filters.push({ col, op: "lt", value }); return this; }
  lte(col: string, value: any) { this.filters.push({ col, op: "lte", value }); return this; }
  in(col: string, value: any[]) { this.filters.push({ col, op: "in", value }); return this; }
  is(col: string, value: any) { this.filters.push({ col, op: "is", value }); return this; }
  like(col: string, value: string) { this.filters.push({ col, op: "like", value }); return this; }
  ilike(col: string, value: string) { this.filters.push({ col, op: "ilike", value }); return this; }
  contains(col: string, value: any) { this.filters.push({ col, op: "contains", value }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.ordering.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleRow = true; this.wantReturn = true; return this; }
  maybeSingle() { this.maybeSingleRow = true; this.wantReturn = true; return this; }
  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.selectCols = cols ?? "*";
    this.headOnly = opts?.head === true;
    this.wantReturn = !this.headOnly;
    return this;
  }

  private expand(row: Row): Row {
    const out: Row = { ...row };
    const spec = this.selectCols;
    const re = /([a-zA-Z_][a-zA-Z0-9_]*):([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(spec))) {
      const alias = m[1];
      const table = m[2];
      const fields = m[3].trim();
      const fk = alias === "group" ? "group_id" : alias === "profile" ? "user_id" : alias === "reactions" ? "dare_id" : `${alias}_id`;
      const value = row[fk];
      const pick = (r: Row) => {
        if (fields === "*") return r;
        const chosen: Row = {};
        fields.split(",").map((s) => s.trim()).filter(Boolean).forEach((k) => { chosen[k] = r[k]; });
        return chosen;
      };
      if (alias === "reactions") out[alias] = readTable(table).filter((r: Row) => r[fk] === value).map(pick);
      else {
        const found = readTable(table).find((r: Row) => r.id === value);
        out[alias] = found ? pick(found) : null;
      }
    }
    return out;
  }

  private shape(rows: Row[]): any {
    if (this.singleRow) return rows[0] ?? null;
    if (this.maybeSingleRow) return rows[0] ?? null;
    return rows;
  }

  private execute(): { data: any; error: any; count: number | null; status: number } {
    let rows = readTable(this.table);

    if (this.op === "insert" || this.op === "upsert") {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => defaultsFor(this.table, r));
      if (this.op === "upsert") {
        const byId = new Map(rows.map((r) => [r.id, r]));
        incoming.forEach((r: Row) => byId.set(r.id, { ...(byId.get(r.id) ?? {}), ...r }));
        rows = Array.from(byId.values());
      } else {
        rows = rows.concat(incoming);
      }
      writeTable(this.table, rows);
      afterWrite(this.table, incoming, this.op);
      const result = this.wantReturn ? this.shape(incoming) : null;
      return { data: result, error: null, count: incoming.length, status: 201 };
    }

    const matched = rows.filter((r) => matches(r, this.filters));

    if (this.op === "update") {
      const ids = new Set(matched.map((r) => r.id));
      const updated: Row[] = [];
      rows = rows.map((r) => {
        if (!ids.has(r.id)) return r;
        const next = defaultsFor(this.table, { ...r, ...this.payload });
        updated.push(next);
        return next;
      });
      writeTable(this.table, rows);
      afterWrite(this.table, updated, "update");
      return { data: this.wantReturn ? this.shape(updated) : null, error: null, count: updated.length, status: 200 };
    }

    if (this.op === "delete") {
      const ids = new Set(matched.map((r) => String(r.id)));
      cascadeLocalDelete(this.table, ids);
      writeTable(this.table, rows.filter((r) => !ids.has(String(r.id))));
      return { data: this.wantReturn ? this.shape(matched) : null, error: null, count: ids.size, status: 200 };
    }

    // select
    let out = matched.slice();
    for (const { col, asc } of this.ordering.slice().reverse()) {
      out.sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * (asc ? 1 : -1);
      });
    }
    if (this.rangeTo !== null) out = out.slice(this.rangeFrom, this.rangeTo + 1);
    else if (this.limitN !== null) out = out.slice(0, this.limitN);
    const count = out.length;
    const expanded = out.map((r) => this.expand(r));
    if (this.headOnly) return { data: null, error: null, count, status: 200 };
    if (this.singleRow) {
      if (!expanded.length) return { data: null, error: { message: "No rows returned", code: "PGRST116" }, count: 0, status: 406 };
      return { data: expanded[0], error: null, count: 1, status: 200 };
    }
    if (this.maybeSingleRow) return { data: expanded[0] ?? null, error: null, count: expanded.length ? 1 : 0, status: 200 };
    return { data: expanded, error: null, count, status: 200 };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }
}

function rpc(name: string, args: Row = {}): Promise<{ data: any; error: any }> {
  return Promise.resolve().then(() => {
    const uid = currentUser()?.id;
    const fail = (message: string) => ({ data: null, error: { message } });

    switch (name) {
      case "username_available": {
        const u = String(args.p_username ?? "").trim().toLowerCase();
        return { data: !readTable("profiles").some((p) => p.username === u), error: null };
      }
      case "create_group": {
        if (!uid) return fail("Not signed in");
        const id = uuid();
        const name2 = String(args.p_name ?? "").trim();
        if (name2.length < 2) return fail("Give your group a name");
        let code = randomCode();
        while (readTable("groups").some((g) => g.invite_code === code)) code = randomCode();
        const groups = readTable("groups");
        groups.push(defaultsFor("groups", { id, name: name2, description: args.p_description ?? "", owner_id: uid, invite_code: code }));
        writeTable("groups", groups);
        const members = readTable("group_members");
        members.push(defaultsFor("group_members", { group_id: id, user_id: uid, role: "owner" }));
        writeTable("group_members", members);
        addActivity(id, uid, "join", "created the group");
        return { data: id, error: null };
      }
      case "join_group": {
        if (!uid) return fail("Not signed in");
        const code = String(args.p_code ?? "").trim().toUpperCase();
        const group = readTable("groups").find((g) => g.invite_code === code);
        if (!group) return fail("Invalid invite code");
        const members = readTable("group_members");
        if (members.some((m) => m.group_id === group.id && m.user_id === uid)) return { data: group.id, error: null };
        if (members.filter((m) => m.group_id === group.id).length >= (group.max_members || 50)) return fail("This group is full");
        members.push(defaultsFor("group_members", { group_id: group.id, user_id: uid }));
        writeTable("group_members", members);
        addActivity(group.id, uid, "join", "joined the group");
        return { data: group.id, error: null };
      }
      case "group_leaderboard": {
        if (!uid) return { data: [], error: null };
        const gid = args.p_group;
        const memberRows = readTable("group_members").filter((m) => m.group_id === gid);
        const profiles = readTable("profiles");
        const sessions = readTable("study_sessions");
        const rows = memberRows.map((m) => {
          const p = profiles.find((x) => x.id === m.user_id) ?? {};
          const mins = sessions
            .filter((s) => s.user_id === m.user_id && s.mode !== "break" && String(s.created_at).slice(0, 10) >= weekStart())
            .reduce((sum, s) => sum + Number(s.duration_seconds || 0), 0) / 60;
          return { user_id: m.user_id, username: p.username ?? "", full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? null, xp: p.xp ?? 0, streak: p.streak ?? 0, warnings: m.warnings ?? 0, role: m.role ?? "member", week_minutes: Math.floor(mins) };
        }).sort((a, b) => b.xp - a.xp);
        return { data: rows, error: null };
      }
      case "username_available_2":
        return { data: true, error: null };
      case "set_topic_status": {
        if (!uid) return fail("Not signed in");
        const status = args.p_status;
        if (!["not_started", "in_progress", "completed"].includes(status)) return fail("Invalid status");
        const rows = readTable("topic_progress");
        const idx = rows.findIndex((r) => r.topic_id === args.p_topic && r.user_id === uid);
        const record = defaultsFor("topic_progress", { topic_id: args.p_topic, user_id: uid, status, completed_at: status === "completed" ? now() : null });
        if (idx >= 0) rows[idx] = { ...rows[idx], ...record }; else rows.push(record);
        writeTable("topic_progress", rows);
        return { data: null, error: null };
      }
      case "evaluate_my_commitments":
      case "evaluate_all_commitments":
        return { data: 0, error: null };
      case "resolve_dare": {
        if (!uid) return fail("Not signed in");
        const rows = readTable("dares");
        const d = rows.find((r) => r.id === args.p_id && r.user_id === uid && r.status === "pending");
        if (!d) return fail("Dare not found or already settled");
        if (args.p_choice === "dare") {
          if (String(args.p_proof ?? "").trim().length < 3) return fail("Write a short proof note (what you did) to finish the dare");
          d.status = "done";
          d.proof_note = String(args.p_proof).trim().slice(0, 500);
          d.resolved_at = now();
          const members = readTable("group_members");
          const m = members.find((x) => x.group_id === d.group_id && x.user_id === uid);
          if (m) m.warnings = Math.max(0, Number(m.warnings || 0) - 1);
          writeTable("group_members", members);
          addXp(uid, 15, "dare_done");
          addActivity(d.group_id, uid, "dare_done", `completed the dare: ${d.dare_text}`);
        } else if (args.p_choice === "shame") {
          d.status = "shamed";
          d.resolved_at = now();
          addXp(uid, -30, "shame_taken");
        } else return fail("Choice must be dare or shame");
        writeTable("dares", rows);
        return { data: null, error: null };
      }
      case "claim_mission": {
        if (!uid) return fail("Not signed in");
        const key = String(args.p_key ?? "");
        const rewardMap: Record<string, number> = { d_study_45: 30, d_topic_1: 25, d_habit_1: 10, w_study_600: 150, w_topics_5: 120, w_days_5: 100 };
        const reward = rewardMap[key];
        if (!reward) return fail("Unknown mission");
        const period = key.startsWith("d_") ? today() : weekStart();
        const claims = readTable("mission_claims");
        if (claims.some((c) => c.user_id === uid && c.mission_key === key && c.period_key === period)) return fail("Already claimed");
        const sessions = readTable("study_sessions").filter((s) => s.user_id === uid && s.mode !== "break");
        const mins = sessions.reduce((n, s) => n + Number(s.duration_seconds || 0), 0) / 60;
        let ok = false;
        if (key === "d_study_45") ok = sessions.filter((s) => String(s.created_at).slice(0, 10) === today()).reduce((n, s) => n + Number(s.duration_seconds || 0), 0) / 60 >= 45;
        else if (key === "d_topic_1") ok = readTable("topic_progress").some((p) => p.user_id === uid && p.status === "completed" && String(p.completed_at).slice(0, 10) === today());
        else if (key === "d_habit_1") ok = readTable("habit_logs").some((l) => l.user_id === uid && l.log_date === today());
        else if (key === "w_study_600") ok = mins >= 600;
        else if (key === "w_topics_5") ok = readTable("topic_progress").filter((p) => p.user_id === uid && p.status === "completed").length >= 5;
        else if (key === "w_days_5") ok = new Set(sessions.filter((s) => String(s.created_at).slice(0, 10) >= weekStart()).map((s) => String(s.created_at).slice(0, 10))).size >= 5;
        if (!ok) return fail("Mission not finished yet");
        claims.push(defaultsFor("mission_claims", { user_id: uid, mission_key: key, period_key: period }));
        writeTable("mission_claims", claims);
        addXp(uid, reward, "mission_" + key);
        return { data: reward, error: null };
      }
      case "evaluate_achievements": {
        if (!uid) return { data: [], error: null };
        const profile = readTable("profiles").find((p) => p.id === uid) ?? {};
        const sessions = readTable("study_sessions").filter((s) => s.user_id === uid && s.mode !== "break");
        const mins = sessions.reduce((n, s) => n + Number(s.duration_seconds || 0), 0) / 60;
        const count = (t: string, f: (r: Row) => boolean) => readTable(t).filter(f).length;
        const wanted: string[] = [];
        if (sessions.length) wanted.push("first_session");
        if (mins >= 600) wanted.push("hours_10");
        if (mins >= 3000) wanted.push("hours_50");
        if ((profile.longest_streak ?? 0) >= 3) wanted.push("streak_3");
        if ((profile.longest_streak ?? 0) >= 7) wanted.push("streak_7");
        if ((profile.longest_streak ?? 0) >= 30) wanted.push("streak_30");
        if (count("topic_progress", (r) => r.user_id === uid && r.status === "completed") >= 10) wanted.push("topics_10");
        if (count("topic_progress", (r) => r.user_id === uid && r.status === "completed") >= 50) wanted.push("topics_50");
        if (count("goals", (r) => r.user_id === uid && r.status === "completed") >= 1) wanted.push("goal_first");
        if (count("goals", (r) => r.user_id === uid && r.status === "completed") >= 5) wanted.push("goals_5");
        if (count("habit_logs", (r) => r.user_id === uid) >= 30) wanted.push("habit_30");
        if (count("resources", (r) => r.owner_id === uid && r.group_id) >= 5) wanted.push("helper");
        if (count("group_members", (r) => r.user_id === uid) >= 1) wanted.push("team_player");
        if ((profile.xp ?? 0) >= 1600) wanted.push("level_5");
        if (count("commitments", (r) => r.user_id === uid && r.status === "completed") >= 3) wanted.push("clean_record");
        if (count("dares", (r) => r.user_id === uid && r.status === "done") >= 1) wanted.push("dare_devil");
        if (count("study_sessions", (r) => r.user_id === uid && r.mode === "focus" && r.completed) >= 5) wanted.push("focus_master");
        const achieved = readTable("user_achievements");
        const fresh: string[] = [];
        for (const key of wanted) {
          if (!achieved.some((a) => a.user_id === uid && a.key === key)) {
            achieved.push(defaultsFor("user_achievements", { user_id: uid, key }));
            fresh.push(key);
            addXp(uid, 25, "achievement_" + key);
          }
        }
        writeTable("user_achievements", achieved);
        return { data: fresh, error: null };
      }
      default:
        return { data: null, error: { message: `Unknown function: ${name}` } };
    }
  });
}

function storageBucket(bucket: string) {
  return {
    async upload(path: string, file: File | Blob, _opts?: any) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (typeof window !== "undefined") window.localStorage.setItem(FILES_KEY + bucket + ":" + path, dataUrl);
      return { data: { path }, error: null };
    },
    getPublicUrl(path: string) {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(FILES_KEY + bucket + ":" + path) : null;
      const fallback = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#22d3ee"/><text x="32" y="42" text-anchor="middle" font-size="30" fill="white">📚</text></svg>');
      return { data: { publicUrl: stored || fallback } };
    },
    async createSignedUrl(path: string, _expires: number) {
      return this.getPublicUrl(path);
    },
    async remove(paths: string[]) {
      if (typeof window !== "undefined") paths.forEach((p) => window.localStorage.removeItem(FILES_KEY + bucket + ":" + p));
      return { data: [], error: null };
    },
  };
}

export function createLocalClient(): any {
  return {
    auth: {
      async getSession() {
        const session = readSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = readSession();
        return { data: { user: session?.user ?? null }, error: null };
      },
      async getClaims() {
        return { data: { claims: {} }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        try { callback("INITIAL_SESSION", readSession()); } catch { /* ignore */ }
        return { data: { subscription: { unsubscribe() { /* noop */ } } } };
      },
      async signInWithOAuth({ options }: { provider?: string; options?: { redirectTo?: string; provider?: string } }) {
        let user: Row | undefined;
        const session = readSession();
        if (session?.user?.email) {
          user = readTable("profiles").find((p) => p.id === session.user.id);
          if (!user) user = session.user;
        }
        if (!user) {
          user = {
            id: uuid(),
            email: "demo@b2sync.local",
            aud: "authenticated",
            role: "authenticated",
            user_metadata: { full_name: "B2 Sync Demo", provider: "google" },
            created_at: now(),
          };
        }
        writeSession({ user, access_token: uuid() });
        // The caller issues the JWT cookie and redirects, so middleware never
        // sees a Supabase-only session and bounces the user back to /login.
        return { data: { provider: options?.provider || "google", user, url: options?.redirectTo || "" }, error: null };
      },
      async signUp({ email, password, options }: { email?: string; password?: string; options?: { data?: Record<string, unknown> } }) {
        if (!email || !password) return { data: null, error: { message: "Email and password are required." } };
        try {
          const fullName = String(options?.data?.full_name ?? email.split("@")[0]);
          const user = await localSignUp(email, password, fullName);
          writeSession({ user, access_token: uuid() });
          return { data: { user, session: readSession() }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : "Could not create account." } };
        }
      },
      async signInWithPassword({ email, password }: { email?: string; password?: string }) {
        if (!email || !password) return { data: null, error: { message: "Email and password are required." } };
        try {
          const user = await localSignIn(email, password);
          writeSession({ user, access_token: uuid() });
          return { data: { user, session: readSession() }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : "Could not sign in." } };
        }
      },
      async resetPasswordForEmail(email?: string) {
        const token = email ? await localRequestReset(email) : null;
        return { data: { devToken: token }, error: null };
      },
      async updateUser({ password, token }: { password?: string; token?: string }) {
        if (!password) return { data: null, error: { message: "Enter a new password." } };
        try {
          if (token) await localResetPassword(token, password);
          else {
            const session = readSession();
            if (!session?.user?.email) throw new Error("Your session expired. Request a new reset link.");
            await localUpdatePassword(session.user.email, password);
          }
          return { data: { user: readSession()?.user ?? null }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : "Could not update password." } };
        }
      },
      async signInWithOtp({ email }: { email?: string }) {
        // Local mode verification happens on the server; this keeps the API shape.
        return { data: { email: email ?? null }, error: null };
      },
      async verifyOtp({ email }: { email?: string; token?: string; token_hash?: string; type?: string }) {
        const normalized = (email ?? "demo@b2sync.local").trim().toLowerCase() || "demo@b2sync.local";
        const existing = readTable("profiles").find((p) => p.email === normalized);
        const user: Row = existing
          ? { ...existing, aud: "authenticated", role: "authenticated" }
          : {
              id: uuid(),
              email: normalized,
              aud: "authenticated",
              role: "authenticated",
              user_metadata: { full_name: normalized.split("@")[0], provider: "otp" },
              created_at: now(),
            };
        writeSession({ user, access_token: uuid() });
        return { data: { user, session: readSession() }, error: null };
      },
      async signOut() {
        writeSession(null);
        return { error: null };
      },
    },
    from(table: string) {
      return {
        select: (cols?: string, opts?: { count?: string; head?: boolean }) => new LocalQuery(table, "select", null).select(cols, opts),
        insert: (rows: any) => new LocalQuery(table, "insert", rows),
        upsert: (rows: any) => new LocalQuery(table, "upsert", rows),
        update: (patch: Row) => new LocalQuery(table, "update", patch),
        delete: () => new LocalQuery(table, "delete", null),
      };
    },
    rpc,
    storage: {
      from: storageBucket,
    },
    channel() {
      return { on() { return this; }, subscribe() { return this; }, unsubscribe() { /* noop */ } };
    },
  };
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Activity as ActivityIcon, BookOpen, Copy, Crown, Flame, LogOut, Settings, Share2, ShieldAlert, ShieldCheck, Trash2, UserMinus, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, PageHeader, PageSkeleton, Progress, Tabs, Textarea } from "@/components/ui";
import { useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { invalidate } from "@/lib/actions";
import { levelFromXp } from "@/lib/xp";
import { errMsg, formatDuration, randomInviteCode, timeAgo } from "@/lib/utils";
import type { Activity, Course, LeaderRow, Topic } from "@/lib/types";

const ACTIVITY_ICON: Record<string, string> = {
  join: "👋",
  topic_done: "✅",
  session: "⏱️",
  resource: "📎",
  pledge_done: "🤞",
  pledge_failed: "⚠️",
  dare_done: "😈",
  shamed: "🙈",
  kicked: "🚪",
};

type Tab = "overview" | "members" | "courses" | "settings";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const { memberships, isLoading: loadingGroups } = useGroups();
  const [tab, setTab] = useState<Tab>("overview");
  const [kick, setKick] = useState<LeaderRow | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const membership = memberships.find((m) => m.group.id === id);
  const group = membership?.group;
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const isOwner = membership?.role === "owner";

  const { data: board } = useSWR(group ? `leaderboard:${id}` : null, async () => {
    const { data, error } = await supabaseBrowser().rpc("group_leaderboard", { p_group: id });
    if (error) throw error;
    return (data ?? []) as LeaderRow[];
  });

  const { data: activity } = useSWR(group ? `activities:${id}` : null, async () => {
    const { data } = await supabaseBrowser()
      .from("activities")
      .select("*, profile:profiles(username, full_name, avatar_url)")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as unknown as Activity[];
  });

  const { data: progress } = useSWR(group ? `group-progress:${id}` : null, async () => {
    const sb = supabaseBrowser();
    const { data: courses } = await sb.from("courses").select("*").eq("group_id", id).order("created_at");
    const list = (courses ?? []) as Course[];
    if (!list.length) return { courses: list, topics: [] as Topic[], done: [] as { topic_id: string; user_id: string }[] };
    const { data: topics } = await sb.from("topics").select("*").in("course_id", list.map((c) => c.id));
    const tl = (topics ?? []) as Topic[];
    if (!tl.length) return { courses: list, topics: tl, done: [] };
    const { data: done } = await sb.from("topic_progress").select("topic_id, user_id").eq("status", "completed").in("topic_id", tl.map((t) => t.id));
    return { courses: list, topics: tl, done: (done ?? []) as { topic_id: string; user_id: string }[] };
  });

  const stats = useMemo(() => {
    if (!progress || !board) return null;
    const perCourse = progress.courses.map((c) => {
      const topics = progress.topics.filter((t) => t.course_id === c.id);
      const ids = new Set(topics.map((t) => t.id));
      const members = board.map((m) => {
        const n = progress.done.filter((d) => d.user_id === m.user_id && ids.has(d.topic_id)).length;
        return { member: m, pct: topics.length ? Math.round((n / topics.length) * 100) : 0 };
      });
      const avg = members.length ? Math.round(members.reduce((a, b) => a + b.pct, 0) / members.length) : 0;
      return { course: c, total: topics.length, members, avg };
    });
    const overall = perCourse.length ? Math.round(perCourse.reduce((a, b) => a + b.avg, 0) / perCourse.length) : 0;
    return { perCourse, overall };
  }, [progress, board]);

  // settings form
  const [name, setName] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [maxWarn, setMaxWarn] = useState<number | null>(null);

  if (loadingGroups) return <PageSkeleton />;
  if (!group || !membership) {
    return (
      <EmptyState
        icon={Users}
        title="Group not found"
        description="You may not be a member of this group anymore."
        action={
          <Link href="/groups">
            <Button>Back to groups</Button>
          </Link>
        }
      />
    );
  }

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${group.invite_code}` : "";

  async function copy(text: string, msg = "Copied!") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Couldn't copy automatically");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${group!.name} on B2 Sync`, text: `Join my study group! Code: ${group!.invite_code}`, url: inviteLink });
        return;
      } catch {
        /* user cancelled */
      }
    }
    void copy(inviteLink, "Invite link copied!");
  }

  async function setRole(m: LeaderRow, role: "admin" | "member") {
    const { error } = await supabaseBrowser().from("group_members").update({ role }).eq("group_id", id).eq("user_id", m.user_id);
    if (error) return toast.error(errMsg(error));
    toast.success(role === "admin" ? `${m.username} is now an admin` : `${m.username} is now a member`);
    await invalidate("leaderboard", "groups");
  }

  async function pardon(m: LeaderRow) {
    const { error } = await supabaseBrowser().from("group_members").update({ warnings: 0 }).eq("group_id", id).eq("user_id", m.user_id);
    if (error) return toast.error(errMsg(error));
    toast.success(`Warnings cleared for ${m.username}`);
    await invalidate("leaderboard", "groups");
  }

  async function removeMember(m: LeaderRow) {
    const { error } = await supabaseBrowser().from("group_members").delete().eq("group_id", id).eq("user_id", m.user_id);
    if (error) return toast.error(errMsg(error));
    toast.success(`${m.username} was removed`);
    await invalidate("leaderboard", "groups");
  }

  async function saveSettings() {
    const patch: Record<string, string | number> = {};
    if (name !== null && name.trim().length >= 2) patch.name = name.trim();
    if (desc !== null) patch.description = desc;
    if (maxWarn !== null) patch.max_warnings = maxWarn;
    if (!Object.keys(patch).length) return;
    const { error } = await supabaseBrowser().from("groups").update(patch).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Group updated");
    await invalidate("groups");
  }

  async function newCode() {
    const { error } = await supabaseBrowser().from("groups").update({ invite_code: randomInviteCode() }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("New invite code generated — the old one no longer works");
    await invalidate("groups");
  }

  async function leave() {
    const { error } = await supabaseBrowser().from("group_members").delete().eq("group_id", id).eq("user_id", profile!.id);
    if (error) return toast.error(errMsg(error));
    toast.success("You left the group");
    await invalidate("groups");
    router.replace("/groups");
  }

  async function deleteGroup() {
    const { error } = await supabaseBrowser().from("groups").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Group deleted");
    await invalidate("groups");
    router.replace("/groups");
  }

  const myWarnings = membership.warnings;

  return (
    <>
      <PageHeader
        icon={Users}
        title={group.name}
        description={group.description || "Your study workspace"}
        actions={
          <>
            <button onClick={() => copy(group.invite_code, "Invite code copied!")} className="glass flex h-10 items-center gap-2 rounded-xl px-3.5 font-mono text-sm font-bold tracking-widest transition hover:border-brand/50">
              {group.invite_code} <Copy className="h-3.5 w-3.5 text-muted" />
            </button>
            <Button icon={Share2} onClick={share}>
              Invite friends
            </Button>
          </>
        }
      />

      {myWarnings > 0 && (
        <Card className="mb-5 border-danger/40 bg-danger/10">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="text-sm">
              <p className="font-semibold text-danger">
                You have {myWarnings} of {group.max_warnings} warnings in this group
              </p>
              <p className="text-muted">
                {myWarnings >= group.max_warnings - 1 ? "One more missed pledge and you'll be removed from the group. " : ""}
                Complete a dare in <Link href="/arena" className="font-semibold text-brand hover:underline">Pledges &amp; Dares</Link> to remove a warning.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Tabs
        id="group-tabs"
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: "overview", label: "Overview", icon: ActivityIcon },
          { value: "members", label: "Members", icon: Users, count: board?.length },
          { value: "courses", label: "Courses", icon: BookOpen },
          { value: "settings", label: "Settings", icon: Settings },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle icon={ActivityIcon}>Recent activity</CardTitle>
            {!activity ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : activity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="Nothing yet" description="Study, finish a topic or share a resource — it shows up here for the whole group." />
            ) : (
              <ul className="space-y-1">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-brand/5">
                    <Avatar name={a.profile?.full_name || a.profile?.username || "?"} src={a.profile?.avatar_url} size={34} />
                    <p className="min-w-0 flex-1 text-sm">
                      <b>@{a.profile?.username ?? "someone"}</b> <span className="text-muted">{a.message}</span>
                    </p>
                    <span className="text-lg" aria-hidden>
                      {ACTIVITY_ICON[a.type] ?? "•"}
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-muted">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-5">
            <Card>
              <CardTitle icon={ShieldCheck}>Group progress</CardTitle>
              <p className="text-4xl font-extrabold">{stats?.overall ?? 0}%</p>
              <p className="mb-3 text-xs text-muted">average syllabus completion across members</p>
              <Progress value={stats?.overall ?? 0} height="h-2.5" />
            </Card>
            <Card>
              <CardTitle icon={Flame}>This week&apos;s top studiers</CardTitle>
              <ul className="space-y-3">
                {[...(board ?? [])]
                  .sort((a, b) => b.week_minutes - a.week_minutes)
                  .slice(0, 5)
                  .map((m, i) => (
                    <li key={m.user_id} className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm font-bold text-muted">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                      <Avatar name={m.full_name || m.username} src={m.avatar_url} size={30} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">@{m.username}</span>
                      <span className="text-sm font-semibold text-brand">{formatDuration(m.week_minutes * 60)}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "members" && (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line/10">
            {(board ?? []).map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar name={m.full_name || m.username} src={m.avatar_url} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {m.full_name || m.username}
                    {m.role !== "member" && (
                      <Badge tone="warn">
                        <Crown className="h-3 w-3" /> {m.role}
                      </Badge>
                    )}
                    {m.user_id === profile?.id && <Badge tone="muted">you</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    @{m.username} · Level {levelFromXp(m.xp)} · {m.xp} XP
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge tone={m.streak > 0 ? "warn" : "muted"}>
                    <Flame className="h-3 w-3" /> {m.streak}d
                  </Badge>
                  <Badge tone={m.warnings > 0 ? "danger" : "success"}>
                    <ShieldAlert className="h-3 w-3" /> {m.warnings}/{group.max_warnings}
                  </Badge>
                </div>
                {isAdmin && m.user_id !== profile?.id && m.role !== "owner" && (
                  <div className="flex gap-1">
                    {m.warnings > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => pardon(m)}>
                        Pardon
                      </Button>
                    )}
                    {isOwner && (
                      <Button size="sm" variant="ghost" onClick={() => setRole(m, m.role === "admin" ? "member" : "admin")}>
                        {m.role === "admin" ? "Demote" : "Make admin"}
                      </Button>
                    )}
                    <Button size="sm" variant="danger" icon={UserMinus} onClick={() => setKick(m)}>
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "courses" && (
        <div className="space-y-4">
          {!stats || stats.perCourse.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses assigned to this group"
              description="Create a course and choose this group in the “Share with group” field — everyone can then track topics together."
              action={
                <Link href="/courses">
                  <Button>Go to courses</Button>
                </Link>
              }
            />
          ) : (
            stats.perCourse.map(({ course, total, members, avg }) => (
              <Card key={course.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Link href={`/courses/${course.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="h-3 w-3 rounded-full" style={{ background: course.color }} />
                    <span className="font-bold">{course.name}</span>
                    {course.code && <Badge tone="muted">{course.code}</Badge>}
                  </Link>
                  <span className="text-sm text-muted">
                    {total} topics · <b className="text-fg">{avg}%</b> avg
                  </span>
                </div>
                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {members.map(({ member, pct }) => (
                    <div key={member.user_id} className="flex items-center gap-3">
                      <Avatar name={member.full_name || member.username} src={member.avatar_url} size={26} />
                      <span className="w-24 shrink-0 truncate text-sm">@{member.username}</span>
                      <Progress value={pct} color={course.color} showLabel />
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {isAdmin && (
            <Card>
              <CardTitle icon={Settings}>Group settings</CardTitle>
              <div className="space-y-4">
                <Input label="Name" value={name ?? group.name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                <Textarea label="Description" value={desc ?? group.description} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
                <div>
                  <label className="label">Warnings before removal: {maxWarn ?? group.max_warnings}</label>
                  <input type="range" min={1} max={6} value={maxWarn ?? group.max_warnings} onChange={(e) => setMaxWarn(Number(e.target.value))} className="w-full" />
                  <p className="mt-1 text-xs text-muted">Each missed study pledge = 1 warning. At the limit the member is removed (they can rejoin on their last warning).</p>
                </div>
                <Button onClick={saveSettings}>Save changes</Button>
              </div>
            </Card>
          )}

          <div className="space-y-5">
            {isAdmin && (
              <Card>
                <CardTitle>Invite link</CardTitle>
                <p className="break-all rounded-xl bg-line/10 px-3 py-2 font-mono text-xs">{inviteLink}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={Copy} onClick={() => copy(inviteLink, "Invite link copied!")}>
                    Copy link
                  </Button>
                  <Button variant="ghost" onClick={newCode}>
                    Generate new code
                  </Button>
                </div>
              </Card>
            )}
            <Card>
              <CardTitle>Danger zone</CardTitle>
              <div className="flex flex-wrap gap-2">
                {!isOwner && (
                  <Button variant="danger" icon={LogOut} onClick={() => setLeaveOpen(true)}>
                    Leave group
                  </Button>
                )}
                {isOwner && (
                  <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                    Delete group
                  </Button>
                )}
              </div>
              {isOwner && <p className="mt-2 text-xs text-muted">Deleting removes the group, its activity and pledges for everyone. Courses stay with their owners.</p>}
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!kick} onClose={() => setKick(null)} danger title={`Remove @${kick?.username}?`} description="They lose access to this group's shared courses, resources and feed. They can rejoin with the invite code." confirmLabel="Remove" onConfirm={() => kick && removeMember(kick)} />
      <ConfirmDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} danger title="Leave this group?" description="You'll lose access to shared courses and resources." confirmLabel="Leave" onConfirm={leave} />
      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} danger title="Delete this group forever?" description="This cannot be undone." confirmLabel="Delete group" onConfirm={deleteGroup} />
    </>
  );
}

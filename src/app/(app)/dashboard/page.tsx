"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Circle, Clock, Flame, FolderOpen, Headphones, Lightbulb, Swords, Target, Timer, Users, Zap } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, PageHeader, PageSkeleton, Progress, Reveal, StatCard } from "@/components/ui";
import { useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DAILY_CHALLENGES, EVENT_KINDS } from "@/lib/constants";
import { levelProgress, rankForLevel } from "@/lib/xp";
import { addDays, dhakaDate, formatDateTime, hoursFromSeconds, timeAgo, timeLeft } from "@/lib/utils";
import type { Activity, CalEvent, Commitment } from "@/lib/types";

const ICON: Record<string, string> = { join: "👋", topic_done: "✅", session: "⏱️", resource: "📎", pledge_done: "🤞", pledge_failed: "⚠️", dare_done: "😈", shamed: "🙈", kicked: "🚪" };

export default function DashboardPage() {
  const { profile } = useProfile();
  const { memberships } = useGroups();

  const { data, isLoading } = useSWR(profile ? `dashboard:${profile.id}` : null, async () => {
    const sb = supabaseBrowser();
    const uid = profile!.id;
    const now = new Date();
    const dayStart = new Date(dhakaDate() + "T00:00:00+06:00");
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const [courses, topics, done, sessions, today, upcoming, activity, pledges] = await Promise.all([
      sb.from("courses").select("id", { count: "exact", head: true }),
      sb.from("topics").select("id"),
      sb.from("topic_progress").select("topic_id").eq("user_id", uid).eq("status", "completed"),
      sb.from("study_sessions").select("duration_seconds, created_at").neq("mode", "break"),
      sb.from("events").select("*").gte("starts_at", dayStart.toISOString()).lt("starts_at", dayEnd.toISOString()).order("starts_at"),
      sb.from("events").select("*").in("kind", ["exam", "assignment"]).gte("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 21 * 86400000).toISOString()).order("starts_at").limit(5),
      sb.from("activities").select("*, profile:profiles(username, full_name, avatar_url)").order("created_at", { ascending: false }).limit(8),
      sb.from("commitments").select("*").eq("user_id", uid).eq("status", "active").order("due_at"),
    ]);
    // Only count progress for topics that still exist — deleted courses/topics
    // must never leave a course stuck at "pending"/"incomplete".
    const topicIds = new Set((topics.data ?? []).map((t: { id: string }) => t.id));
    const doneTopics = ((done.data ?? []) as { topic_id: string }[]).filter((p) => topicIds.has(p.topic_id)).length;
    const secs = (sessions.data ?? []) as { duration_seconds: number; created_at: string }[];
    const byDay: Record<string, number> = {};
    let total = 0;
    secs.forEach((x) => {
      total += x.duration_seconds;
      const d = dhakaDate(x.created_at);
      byDay[d] = (byDay[d] ?? 0) + x.duration_seconds;
    });
    const t = dhakaDate();
    const chart = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(t, i - 6);
      return { day: new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" }), hours: hoursFromSeconds(byDay[d] ?? 0, 2) };
    });
    return {
      courses: courses.count ?? 0,
      totalTopics: topicIds.size,
      doneTopics,
      totalSeconds: total,
      todaySeconds: byDay[t] ?? 0,
      chart,
      today: (today.data ?? []) as CalEvent[],
      upcoming: (upcoming.data ?? []) as CalEvent[],
      activity: (activity.data ?? []) as unknown as Activity[],
      pledges: (pledges.data ?? []) as Commitment[],
    };
  });

  const challenge = useMemo(() => {
    const day = Math.floor(Date.now() / 86400000);
    return DAILY_CHALLENGES[day % DAILY_CHALLENGES.length];
  }, []);

  if (!profile || isLoading || !data) return <PageSkeleton />;
  const lp = levelProgress(profile.xp);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const pending = Math.max(0, data.totalTopics - data.doneTopics);
  const pct = data.totalTopics ? Math.round((data.doneTopics / data.totalTopics) * 100) : 0;

  return (
    <>
      <Reveal>
        <div className="glass relative mb-6 overflow-hidden rounded-xl2 p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted">{greet} 👋</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {(profile.full_name || profile.username).split(" ")[0]}, <span className="text-gradient">let&apos;s study.</span>
              </h1>
              <p className="mt-2 text-sm text-muted">
                {data.todaySeconds > 0 ? `You've studied ${Math.round(data.todaySeconds / 60)} min today — keep the streak alive.` : "No study logged yet today. A single 25-minute session keeps your streak."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/timer">
                  <Button icon={Timer}>Start studying</Button>
                </Link>
                <Link href="/focus">
                  <Button variant="secondary" icon={Headphones}>
                    Focus mode
                  </Button>
                </Link>
              </div>
            </div>
            <div className="w-full max-w-xs rounded-2xl border border-line/15 bg-surface/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Level {lp.level}</p>
                  <p className="font-bold">{rankForLevel(lp.level)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-xl font-black text-white shadow-glow">{lp.level}</div>
              </div>
              <Progress value={lp.pct} className="mt-3" />
              <p className="mt-1.5 text-xs text-muted">
                {profile.xp} XP · {lp.toNext} to level {lp.level + 1}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {data.pledges.length > 0 && (
        <Reveal delay={0.05}>
          <Link href="/arena" className="mb-6 flex items-center justify-between gap-3 rounded-xl2 border border-warn/30 bg-warn/10 px-5 py-3.5 transition hover:bg-warn/15">
            <div className="flex items-center gap-3">
              <Swords className="h-5 w-5 text-warn" />
              <div className="text-sm">
                <p className="font-semibold">
                  You have {data.pledges.length} active pledge{data.pledges.length > 1 ? "s" : ""}
                </p>
                <p className="text-muted">
                  &ldquo;{data.pledges[0].title}&rdquo; · {timeLeft(data.pledges[0].due_at)}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-warn" />
          </Link>
        </Reveal>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={BookOpen} label="Courses" value={data.courses} tone="brand" />
        <StatCard icon={Clock} label="Study hours" value={hoursFromSeconds(data.totalSeconds, 1)} decimals={1} suffix="h" tone="violet" />
        <StatCard icon={CheckCircle2} label="Completed" value={data.doneTopics} suffix="topics" tone="success" />
        <StatCard icon={Circle} label="Pending" value={pending} suffix="topics" tone="warn" />
        <StatCard icon={Flame} label="Streak" value={profile.streak} suffix="days" tone="warn" hint={`Best: ${profile.longest_streak}`} />
        <StatCard icon={Zap} label="XP" value={profile.xp} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={Clock} action={<Badge tone="muted">Last 7 days</Badge>}>
            Weekly study activity
          </CardTitle>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <defs>
                  <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--brand))" />
                    <stop offset="100%" stopColor="rgb(var(--brand2))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line) / 0.15)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={30} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "rgb(var(--brand) / 0.08)" }} formatter={(v) => [`${v} h`, "Studied"]} contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / 0.2)", borderRadius: 12 }} />
                <Bar dataKey="hours" fill="url(#bar)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet/20 blur-2xl" />
            <CardTitle icon={Lightbulb}>Daily challenge</CardTitle>
            <p className="relative text-sm leading-relaxed">{challenge}</p>
            <p className="relative mt-3 text-xs text-muted">Do it today, then tick off “Habit check” in Goals &amp; Missions.</p>
          </Card>
          <Card>
            <CardTitle icon={BookOpen}>Syllabus progress</CardTitle>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold">{pct}%</span>
              <span className="text-xs text-muted">
                {data.doneTopics} of {data.totalTopics} topics
              </span>
            </div>
            <Progress value={pct} className="mt-3" height="h-2.5" />
          </Card>
        </div>

        <Card>
          <CardTitle icon={CalendarDays} action={<Link href="/calendar" className="text-xs font-semibold text-brand hover:underline">Calendar</Link>}>
            Today&apos;s schedule
          </CardTitle>
          {data.today.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Add classes or study blocks in the calendar." className="py-8" />
          ) : (
            <ul className="space-y-2">
              {data.today.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-line/5 px-3 py-2.5">
                  <span className="text-lg">{EVENT_KINDS[e.kind].emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">{formatDateTime(e.starts_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={Target}>Upcoming exams &amp; deadlines</CardTitle>
          {data.upcoming.length === 0 ? (
            <EmptyState icon={Target} title="All clear" description="No exams or assignments in the next 3 weeks." className="py-8" />
          ) : (
            <ul className="space-y-2">
              {data.upcoming.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-line/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {EVENT_KINDS[e.kind].emoji} {e.title}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(e.starts_at)}</p>
                  </div>
                  <Badge tone={e.kind === "exam" ? "danger" : "warn"}>{timeLeft(e.starts_at)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={Users} action={<Link href="/groups" className="text-xs font-semibold text-brand hover:underline">Groups</Link>}>
            Recent group activity
          </CardTitle>
          {memberships.length === 0 ? (
            <EmptyState icon={Users} title="No group yet" description="Join your friends to see their progress." className="py-8" action={<Link href="/groups"><Button size="sm">Find a group</Button></Link>} />
          ) : data.activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Quiet so far. Be the first to study!</p>
          ) : (
            <ul className="space-y-3">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start gap-2.5 text-sm">
                  <Avatar name={a.profile?.full_name || a.profile?.username || "?"} src={a.profile?.avatar_url} size={28} />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">@{a.profile?.username}</span> <span className="text-muted">{a.message}</span> {ICON[a.type] ?? ""}
                    <span className="block text-xs text-muted/80">{timeAgo(a.created_at)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Quick access</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/courses", label: "Courses", icon: BookOpen },
          { href: "/vault", label: "Vault", icon: FolderOpen },
          { href: "/goals", label: "Goals", icon: Target },
          { href: "/arena", label: "Pledges", icon: Swords },
        ].map((q, i) => (
          <motion.div key={q.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <Link href={q.href} className="glass glass-hover flex items-center gap-3 rounded-xl2 p-4 font-semibold">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <q.icon className="h-5 w-5" />
              </span>
              {q.label}
            </Link>
          </motion.div>
        ))}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Clock, Flame, Repeat, Target } from "lucide-react";
import { Card, CardTitle, EmptyState, PageHeader, PageSkeleton, StatCard, Tabs } from "@/components/ui";
import { useActiveGroup, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDays, dhakaDate, hoursFromSeconds, weekStart } from "@/lib/utils";
import type { Course, Goal, Habit, HabitLog, LeaderRow, StudySession, TopicStatus } from "@/lib/types";

const tip = { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / 0.2)", borderRadius: 12 };
const axis = { fill: "rgb(var(--muted))", fontSize: 12 };
const grid = "rgb(var(--line) / 0.15)";
const PIE = ["rgb(52 211 153)", "rgb(34 211 238)", "rgb(148 163 184)"];

export default function AnalyticsPage() {
  const { profile } = useProfile();
  const { active } = useActiveGroup();
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const today = dhakaDate();

  const { data } = useSWR(profile ? `analytics:${profile.id}` : null, async () => {
    const sb = supabaseBrowser();
    const since = new Date(Date.now() - 200 * 86400000).toISOString();
    const [ses, courses, topics, prog, goals, habits, logs] = await Promise.all([
      sb.from("study_sessions").select("*").neq("mode", "break").gte("created_at", since),
      sb.from("courses").select("id, name, color"),
      sb.from("topics").select("id, course_id"),
      sb.from("topic_progress").select("topic_id, status").eq("user_id", profile!.id),
      sb.from("goals").select("status"),
      sb.from("habits").select("*").eq("archived", false),
      sb.from("habit_logs").select("habit_id, log_date").gte("log_date", addDays(today, -30)),
    ]);
    return {
      sessions: (ses.data ?? []) as StudySession[],
      courses: (courses.data ?? []) as Pick<Course, "id" | "name" | "color">[],
      topics: (topics.data ?? []) as { id: string; course_id: string }[],
      prog: (prog.data ?? []) as { topic_id: string; status: TopicStatus }[],
      goals: (goals.data ?? []) as Pick<Goal, "status">[],
      habits: (habits.data ?? []) as Habit[],
      logs: (logs.data ?? []) as HabitLog[],
    };
  });

  const { data: board } = useSWR(active ? `leaderboard:${active.group.id}` : null, async () => {
    const { data } = await supabaseBrowser().rpc("group_leaderboard", { p_group: active!.group.id });
    return (data ?? []) as LeaderRow[];
  });

  const v = useMemo(() => {
    if (!data) return null;
    const byDay: Record<string, number> = {};
    data.sessions.forEach((s) => {
      const d = dhakaDate(s.created_at);
      byDay[d] = (byDay[d] ?? 0) + s.duration_seconds;
    });
    const sumRange = (from: string, to: string) => {
      let t = 0;
      for (let d = from; d <= to; d = addDays(d, 1)) t += byDay[d] ?? 0;
      return t;
    };
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29);
      return { label: d.slice(5), hours: hoursFromSeconds(byDay[d] ?? 0, 2) };
    });
    const weekly = Array.from({ length: 12 }, (_, i) => {
      const ws = addDays(weekStart(today), (i - 11) * 7);
      return { label: ws.slice(5), hours: hoursFromSeconds(sumRange(ws, addDays(ws, 6)), 1) };
    });
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() - (5 - i), 1);
      const key = d.toISOString().slice(0, 7);
      const secs = Object.entries(byDay).filter(([k]) => k.startsWith(key)).reduce((a, [, s]) => a + s, 0);
      return { label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), hours: hoursFromSeconds(secs, 1) };
    });

    const status = new Map(data.prog.map((p) => [p.topic_id, p.status]));
    const perCourse = data.courses.map((c) => {
      const ts = data.topics.filter((t) => t.course_id === c.id);
      const done = ts.filter((t) => status.get(t.id) === "completed").length;
      return { name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name, percent: ts.length ? Math.round((done / ts.length) * 100) : 0, color: c.color };
    });
    const completed = data.topics.filter((t) => status.get(t.id) === "completed").length;
    const inProgress = data.topics.filter((t) => status.get(t.id) === "in_progress").length;
    const topicPie = [
      { name: "Completed", value: completed },
      { name: "In progress", value: inProgress },
      { name: "Not started", value: Math.max(0, data.topics.length - completed - inProgress) },
    ];

    const gDone = data.goals.filter((g) => g.status === "completed").length;
    const goalRate = data.goals.length ? Math.round((gDone / data.goals.length) * 100) : 0;

    const logSet = new Set(data.logs.map((l) => `${l.habit_id}|${l.log_date}`));
    const habitBars = data.habits.map((h) => {
      let n = 0;
      for (let i = 0; i < 30; i++) if (logSet.has(`${h.id}|${addDays(today, -i)}`)) n++;
      return { name: `${h.icon} ${h.name.length > 14 ? h.name.slice(0, 13) + "…" : h.name}`, percent: Math.round((n / 30) * 100) };
    });
    const habitAvg = habitBars.length ? Math.round(habitBars.reduce((a, b) => a + b.percent, 0) / habitBars.length) : 0;

    // streak history: the running streak at the end of each of the last 30 days
    let run = 0;
    const streakAt: Record<string, number> = {};
    for (let d = addDays(today, -120); d <= today; d = addDays(d, 1)) {
      run = (byDay[d] ?? 0) >= 60 ? run + 1 : 0;
      streakAt[d] = run;
    }
    const streakHist = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29);
      return { label: d.slice(5), streak: streakAt[d] ?? 0 };
    });

    const totalSecs = Object.values(byDay).reduce((a, b) => a + b, 0);
    const avgPerDay = sumRange(addDays(today, -29), today) / 30;
    return { daily, weekly, monthly, perCourse, topicPie, goalRate, gDone, habitBars, habitAvg, streakHist, totalSecs, avgPerDay };
  }, [data, today]);

  if (!data || !v) return <PageSkeleton />;
  const series = range === "daily" ? v.daily : range === "weekly" ? v.weekly : v.monthly;
  const hasStudy = data.sessions.length > 0;

  return (
    <>
      <PageHeader icon={BarChart3} title="Analytics" description="See where your time goes and how you're trending." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Total studied" value={hoursFromSeconds(v.totalSecs, 1)} decimals={1} suffix="h" tone="brand" hint="Last ~6 months" />
        <StatCard icon={Clock} label="Daily average" value={hoursFromSeconds(v.avgPerDay, 2)} decimals={2} suffix="h" tone="violet" hint="Last 30 days" />
        <StatCard icon={Target} label="Goal completion" value={v.goalRate} suffix="%" tone="success" hint={`${v.gDone} goals done`} />
        <StatCard icon={Repeat} label="Habit consistency" value={v.habitAvg} suffix="%" tone="warn" hint="Last 30 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardTitle icon={Clock} action={<Tabs id="an-range" value={range} onChange={setRange} tabs={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}>
            Study time (hours)
          </CardTitle>
          {!hasStudy ? (
            <EmptyState icon={Clock} title="No study data yet" description="Finish a timer session and your charts come alive." className="py-10" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={axis} />
                  <Tooltip contentStyle={tip} formatter={(x) => [`${x} h`, "Studied"]} />
                  <Area type="monotone" dataKey="hours" stroke="rgb(var(--brand))" strokeWidth={2.5} fill="url(#area)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={CheckCircle2}>Course-wise progress (%)</CardTitle>
          {v.perCourse.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No courses yet" className="py-8" />
          ) : (
            <div style={{ height: Math.max(180, v.perCourse.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={v.perCourse} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={axis} />
                  <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tip} formatter={(x) => [`${x}%`, "Complete"]} cursor={{ fill: "rgb(var(--brand) / 0.08)" }} />
                  <Bar dataKey="percent" radius={[0, 8, 8, 0]}>
                    {v.perCourse.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={CheckCircle2}>Topic completion</CardTitle>
          {data.topics.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No topics yet" className="py-8" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={v.topicPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                    {v.topicPie.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={Repeat}>Habit consistency (30 days)</CardTitle>
          {v.habitBars.length === 0 ? (
            <EmptyState icon={Repeat} title="No habits yet" className="py-8" />
          ) : (
            <div style={{ height: Math.max(180, v.habitBars.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={v.habitBars} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={axis} />
                  <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tip} formatter={(x) => [`${x}%`, "Days done"]} cursor={{ fill: "rgb(var(--brand) / 0.08)" }} />
                  <Bar dataKey="percent" fill="rgb(var(--violet))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={Flame}>Streak history</CardTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={v.streakHist}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} tick={axis} />
                <Tooltip contentStyle={tip} formatter={(x) => [`${x} days`, "Streak"]} />
                <Line type="stepAfter" dataKey="streak" stroke="rgb(var(--warn))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={BarChart3}>Group performance — study minutes this week{active ? ` (${active.group.name})` : ""}</CardTitle>
          {!board?.length ? (
            <EmptyState icon={BarChart3} title="Join a group to compare" className="py-8" />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={board.map((r) => ({ name: `@${r.username}`, minutes: r.week_minutes }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={axis} />
                  <Tooltip contentStyle={tip} formatter={(x) => [`${x} min`, "This week"]} cursor={{ fill: "rgb(var(--brand) / 0.08)" }} />
                  <Bar dataKey="minutes" fill="rgb(var(--brand2))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

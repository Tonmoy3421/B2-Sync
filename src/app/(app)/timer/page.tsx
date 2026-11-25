"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coffee, Flag, Pause, Play, RotateCcw, SkipForward, Timer as TimerIcon, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, PageHeader, Select, StatCard, Tabs } from "@/components/ui";
import { Flame, Clock, CalendarRange } from "lucide-react";
import { useCourses, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { chime, saveSession } from "@/lib/timer";
import { addDays, cn, dhakaDate, errMsg, formatClock, formatDuration, formatDateTime, hoursFromSeconds, weekStart } from "@/lib/utils";
import type { StudySession } from "@/lib/types";

type Mode = "stopwatch" | "countdown" | "pomodoro" | "custom";
type Phase = "focus" | "short" | "long";
const STORE = "studysync:timer-v1";

interface Saved {
  mode: Mode;
  running: boolean;
  startedAt: number | null; // ms timestamp when the current run began
  accMs: number; // time accumulated before the current run
  targetSec: number; // countdown/custom/pomodoro phase length
  phase: Phase;
  cycle: number;
  courseId: string;
}

const DEFAULTS: Saved = { mode: "pomodoro", running: false, startedAt: null, accMs: 0, targetSec: 25 * 60, phase: "focus", cycle: 0, courseId: "" };
const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

export default function TimerPage() {
  const { profile } = useProfile();
  const { courses } = useCourses();
  const [s, setS] = useState<Saved>(DEFAULTS);
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [minutes, setMinutes] = useState(45);
  const [focusMin, setFocusMin] = useState(25);
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(15);
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const finishing = useRef(false);

  // restore after refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setS({ ...DEFAULTS, ...(JSON.parse(raw) as Saved) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s, loaded]);

  // tick
  useEffect(() => {
    if (!s.running) return;
    const t = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [s.running]);

  const elapsedSec = (s.accMs + (s.running && s.startedAt ? Date.now() - s.startedAt : 0)) / 1000;
  const counting = s.mode !== "stopwatch";
  const remaining = Math.max(0, s.targetSec - elapsedSec);
  const shown = counting ? remaining : elapsedSec;
  const isBreak = s.mode === "pomodoro" && s.phase !== "focus";

  useEffect(() => {
    document.title = s.running || elapsedSec > 0 ? `${formatClock(shown)} · B2 Sync` : "Study Timer · B2 Sync";
    return () => {
      document.title = "B2 Sync";
    };
  });

  useEffect(() => {
    if (!s.running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [s.running]);

  const { data: sessions, mutate } = useSWR(profile ? `sessions:${profile.id}` : null, async () => {
    const since = new Date(Date.now() - 35 * 86400000).toISOString();
    const { data } = await supabaseBrowser().from("study_sessions").select("*").gte("created_at", since).order("created_at", { ascending: false });
    return (data ?? []) as StudySession[];
  });

  const stats = useMemo(() => {
    const list = (sessions ?? []).filter((x) => x.mode !== "break");
    const today = dhakaDate();
    const wk = weekStart(today);
    const month = today.slice(0, 7);
    let d = 0,
      w = 0,
      m = 0;
    const days: Record<string, number> = {};
    list.forEach((x) => {
      const day = dhakaDate(x.created_at);
      days[day] = (days[day] ?? 0) + x.duration_seconds;
      if (day === today) d += x.duration_seconds;
      if (day >= wk) w += x.duration_seconds;
      if (day.startsWith(month)) m += x.duration_seconds;
    });
    const chart = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { day: new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" }), hours: hoursFromSeconds(days[day] ?? 0, 2) };
    });
    return { d, w, m, chart };
  }, [sessions]);

  const patch = (p: Partial<Saved>) => setS((x) => ({ ...x, ...p }));

  const start = () => patch({ running: true, startedAt: Date.now() });
  const pause = () => patch({ running: false, accMs: s.accMs + (s.startedAt ? Date.now() - s.startedAt : 0), startedAt: null });
  const reset = () => setS((x) => ({ ...x, running: false, startedAt: null, accMs: 0 }));

  function configure(mode: Mode) {
    if (s.running) return toast.info("Pause or finish the current session first");
    const target = mode === "stopwatch" ? 0 : mode === "pomodoro" ? focusMin * 60 : minutes * 60;
    setS((x) => ({ ...x, mode, accMs: 0, startedAt: null, running: false, targetSec: target, phase: "focus", cycle: 0 }));
  }

  const startPhase = useCallback((phase: Phase, cycle: number) => {
    const len = phase === "focus" ? focusMin : phase === "short" ? shortMin : longMin;
    setS((x) => ({ ...x, phase, cycle, targetSec: len * 60, accMs: 0, startedAt: Date.now(), running: true }));
  }, [focusMin, shortMin, longMin]);

  const finish = useCallback(
    async (auto: boolean) => {
      if (finishing.current || !profile) return;
      finishing.current = true;
      const spent = s.accMs / 1000 + (s.running && s.startedAt ? (Date.now() - s.startedAt) / 1000 : 0);
      const done = s.mode !== "stopwatch" && spent >= s.targetSec - 1;
      const dur = s.mode !== "stopwatch" ? Math.min(spent, s.targetSec) : spent;
      setSaving(true);
      try {
        if (dur >= 60 || (s.mode === "pomodoro" && s.phase !== "focus" && dur >= 30)) {
          await saveSession({
            userId: profile.id,
            courseId: isBreak ? null : s.courseId || null,
            mode: isBreak ? "break" : s.mode,
            plannedSeconds: s.mode === "stopwatch" ? 0 : s.targetSec,
            durationSeconds: dur,
            completed: done,
          });
          if (!isBreak) toast.success(`Saved ${formatDuration(dur)} of study 🎓`);
          await mutate();
        } else if (!auto) {
          toast.info("Sessions under 1 minute aren't saved");
        }
        if (auto) chime();
        if (s.mode === "pomodoro" && auto) {
          if (s.phase === "focus") {
            const next = s.cycle + 1;
            startPhase(next % 4 === 0 ? "long" : "short", next);
            toast("Break time ☕", { description: "Stretch, drink water, rest your eyes." });
          } else {
            startPhase("focus", s.cycle);
            toast("Back to focus 💪");
          }
        } else {
          setS((x) => ({ ...x, running: false, startedAt: null, accMs: 0, phase: "focus" }));
        }
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setSaving(false);
        finishing.current = false;
      }
    },
    [profile, s, isBreak, mutate, startPhase]
  );

  // auto-finish countdowns
  useEffect(() => {
    if (s.running && counting && remaining <= 0) void finish(true);
  });

  async function removeSession(id: string) {
    const { error } = await supabaseBrowser().from("study_sessions").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Session removed");
    await mutate();
  }

  const pct = counting && s.targetSec > 0 ? Math.min(100, (elapsedSec / s.targetSec) * 100) : 0;
  const R = 120;
  const C = 2 * Math.PI * R;
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;

  return (
    <>
      <PageHeader icon={TimerIcon} title="Study Timer" description="Every minute you finish counts toward your XP, streak and pledges." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Today" value={hoursFromSeconds(stats.d, 2)} decimals={2} suffix="h" tone="brand" />
        <StatCard icon={CalendarRange} label="This week" value={hoursFromSeconds(stats.w, 1)} decimals={1} suffix="h" tone="violet" />
        <StatCard icon={CalendarRange} label="This month" value={hoursFromSeconds(stats.m, 1)} decimals={1} suffix="h" tone="success" />
        <StatCard icon={Flame} label="Streak" value={profile?.streak ?? 0} suffix="days" tone="warn" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <Tabs
            id="timer-mode"
            value={s.mode}
            onChange={configure}
            tabs={[
              { value: "pomodoro", label: "Pomodoro" },
              { value: "stopwatch", label: "Stopwatch" },
              { value: "countdown", label: "Countdown" },
              { value: "custom", label: "Custom" },
            ]}
          />

          <div className="mt-6 flex flex-col items-center">
            <div className="relative h-[280px] w-[280px]">
              <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
                <circle cx="140" cy="140" r={R} fill="none" stroke="rgb(var(--line) / 0.15)" strokeWidth="12" />
                <circle
                  cx="140"
                  cy="140"
                  r={R}
                  fill="none"
                  stroke={isBreak ? "rgb(var(--success))" : "rgb(var(--brand))"}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C - (C * (counting ? pct : s.running ? (elapsedSec % 60) / 60 * 100 : 0)) / 100}
                  style={{ transition: "stroke-dashoffset 0.3s linear", filter: "drop-shadow(0 0 8px rgb(var(--brand) / 0.55))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {s.mode === "pomodoro" && (
                  <Badge tone={isBreak ? "success" : "brand"} className="mb-2">
                    {isBreak ? <Coffee className="h-3 w-3" /> : <Flame className="h-3 w-3" />} {PHASE_LABEL[s.phase]} · round {(s.cycle % 4) + 1}/4
                  </Badge>
                )}
                <span className="text-6xl font-extrabold tabular-nums tracking-tight">{formatClock(shown)}</span>
                <span className="mt-1 text-xs text-muted">{s.running ? "Stay with it…" : elapsedSec > 0 ? "Paused" : "Ready when you are"}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!s.running ? (
                <Button size="lg" icon={Play} onClick={start} disabled={counting && s.targetSec <= 0}>
                  {elapsedSec > 0 ? "Resume" : "Start"}
                </Button>
              ) : (
                <Button size="lg" variant="secondary" icon={Pause} onClick={pause}>
                  Pause
                </Button>
              )}
              {elapsedSec >= 5 && (
                <Button size="lg" variant="success" icon={Flag} loading={saving} onClick={() => finish(false)}>
                  Finish & save
                </Button>
              )}
              {s.mode === "pomodoro" && (
                <Button size="lg" variant="ghost" icon={SkipForward} onClick={() => startPhase(s.phase === "focus" ? "short" : "focus", s.cycle)} title="Skip phase">
                  Skip
                </Button>
              )}
              {elapsedSec > 0 && (
                <Button size="lg" variant="ghost" icon={RotateCcw} onClick={reset}>
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-line/15 pt-5 sm:grid-cols-2">
            <Select label="What are you studying?" value={s.courseId} onChange={(e) => patch({ courseId: e.target.value })}>
              <option value="">General study</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} · ` : ""}
                  {c.name}
                </option>
              ))}
            </Select>

            {(s.mode === "countdown" || s.mode === "custom") && (
              <Input
                label="Minutes"
                type="number"
                min={1}
                max={480}
                value={minutes}
                disabled={s.running || elapsedSec > 0}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(480, Number(e.target.value) || 1));
                  setMinutes(v);
                  patch({ targetSec: v * 60 });
                }}
              />
            )}
            {s.mode === "pomodoro" && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Focus", v: focusMin, set: setFocusMin, max: 90 },
                  { l: "Short", v: shortMin, set: setShortMin, max: 30 },
                  { l: "Long", v: longMin, set: setLongMin, max: 60 },
                ].map((f) => (
                  <Input
                    key={f.l}
                    label={`${f.l} (min)`}
                    type="number"
                    min={1}
                    max={f.max}
                    value={f.v}
                    disabled={s.running || elapsedSec > 0}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(f.max, Number(e.target.value) || 1));
                      f.set(v);
                      if (f.l === "Focus") patch({ targetSec: v * 60 });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {s.mode === "custom" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  disabled={s.running || elapsedSec > 0}
                  onClick={() => {
                    setMinutes(m);
                    patch({ targetSec: m * 60 });
                  }}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", minutes === m ? "border-brand bg-brand/15 text-brand" : "border-line/20 text-muted hover:border-brand/50")}
                >
                  {m} min
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardTitle>Last 7 days (hours)</CardTitle>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line) / 0.15)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} width={28} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "rgb(var(--brand) / 0.08)" }} contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / 0.2)", borderRadius: 12 }} />
                  <Bar dataKey="hours" fill="rgb(var(--brand))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardTitle>Session history</CardTitle>
            {!sessions?.length ? (
              <EmptyState icon={TimerIcon} title="No sessions yet" description="Start the timer above — finished sessions show up here." className="py-8" />
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {sessions.slice(0, 30).map((x) => (
                  <li key={x.id} className="group flex items-center justify-between gap-2 rounded-xl bg-line/5 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {formatDuration(x.duration_seconds)} <span className="font-normal text-muted">· {x.mode}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {courseName(x.course_id) ?? "General"} · {formatDateTime(x.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {x.completed && <Badge tone="success">done</Badge>}
                      <button aria-label="Delete session" onClick={() => setDelId(x.id)} className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        title="Delete this session?"
        description="The history entry is removed. XP you already earned stays."
        confirmLabel="Delete"
        danger
        onConfirm={() => delId && removeSession(delId)}
      />
    </>
  );
}

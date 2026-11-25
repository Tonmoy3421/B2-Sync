"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Brain, Eye, Flag, Headphones, Pause, Play, Quote, Shuffle, Volume2, VolumeX } from "lucide-react";
import { Badge, Button, Card, CardTitle, Select } from "@/components/ui";
import { useCourses, useProfile } from "@/lib/hooks";
import { AMBIENT_OPTIONS, ambient, type AmbientId } from "@/lib/ambient";
import { celebrate } from "@/lib/actions";
import { QUOTES, shuffleQuote } from "@/lib/quotes";
import { chime, saveSession } from "@/lib/timer";
import { cn, errMsg, formatClock, formatDuration } from "@/lib/utils";

const PRESETS = [15, 25, 45, 60, 90];

export default function FocusPage() {
  const { profile } = useProfile();
  const { courses } = useCourses();
  const [minutes, setMinutes] = useState(25);
  const [courseId, setCourseId] = useState("");
  const [music, setMusic] = useState<AmbientId>("pads");
  const [volume, setVolume] = useState(0.45);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accMs, setAccMs] = useState(0);
  const [, force] = useState(0);
  const [distractions, setDistractions] = useState(0);
  const [saving, setSaving] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const finishing = useRef(false);

  const target = minutes * 60;
  const elapsed = (accMs + (running && startedAt ? Date.now() - startedAt : 0)) / 1000;
  const remaining = Math.max(0, target - elapsed);
  const active = running || elapsed > 0;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [running]);

  // music follows the timer
  useEffect(() => {
    ambient.setVolume(muted ? 0 : volume);
  }, [volume, muted]);
  useEffect(() => {
    try {
      if (running) ambient.play(music);
      else ambient.stop();
    } catch (e) {
      toast.error(errMsg(e));
    }
    return () => ambient.stop();
  }, [running, music]);

  // count tab-switches as distractions
  useEffect(() => {
    if (!running) return;
    let left = false;
    const onVis = () => {
      if (document.hidden) left = true;
      else if (left) {
        left = false;
        setDistractions((d) => d + 1);
        toast("👀 You left the page — distraction logged", { duration: 2500 });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running]);

  useEffect(() => {
    document.title = active ? `${formatClock(remaining)} · Focus` : "Focus Mode · B2 Sync";
    return () => {
      document.title = "B2 Sync";
    };
  });

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const finish = useCallback(
    async (auto: boolean) => {
      if (finishing.current || !profile) return;
      finishing.current = true;
      const spent = Math.min(target, elapsed);
      setRunning(false);
      setSaving(true);
      try {
        if (spent >= 60) {
          await saveSession({
            userId: profile.id,
            courseId: courseId || null,
            mode: "focus",
            plannedSeconds: target,
            durationSeconds: spent,
            completed: auto && spent >= target - 1,
            distractions,
          });
          if (auto) {
            chime();
            celebrate(true);
            toast.success(`Focus session complete — ${formatDuration(spent)} 🧘`);
          } else toast.success(`Saved ${formatDuration(spent)} of focus`);
        } else if (!auto) toast.info("Under 1 minute — nothing saved");
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setSaving(false);
        setAccMs(0);
        setStartedAt(null);
        setDistractions(0);
        finishing.current = false;
      }
    },
    [profile, target, elapsed, courseId, distractions]
  );

  useEffect(() => {
    if (running && remaining <= 0) void finish(true);
  });

  function start() {
    setStartedAt(Date.now());
    setRunning(true);
  }
  function pause() {
    setAccMs((a) => a + (startedAt ? Date.now() - startedAt : 0));
    setStartedAt(null);
    setRunning(false);
  }

  const R = 130;
  const C = 2 * Math.PI * R;
  const pct = target > 0 ? Math.min(100, (elapsed / target) * 100) : 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-24 lg:pb-0">
      {/* static background glows */}
      <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-violet/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <div className="flex flex-1 flex-col items-center">
          <div className="mb-2 flex w-full items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Leave focus mode
            </Link>
            <Badge tone="violet">
              <Headphones className="h-3 w-3" /> Do Not Disturb
            </Badge>
          </div>

          <div className="relative mt-4 h-[310px] w-[310px]">
            <svg viewBox="0 0 310 310" className="h-full w-full -rotate-90">
              <circle cx="155" cy="155" r={R} fill="none" stroke="rgb(var(--line) / 0.15)" strokeWidth="10" />
              <circle
                cx="155"
                cy="155"
                r={R}
                fill="none"
                stroke="url(#fg)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
                style={{ transition: "stroke-dashoffset 0.3s linear", filter: "drop-shadow(0 0 10px rgb(var(--brand) / 0.6))" }}
              />
              <defs>
                <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgb(34 211 238)" />
                  <stop offset="100%" stopColor="rgb(167 139 250)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-7xl font-black tabular-nums tracking-tight">
                {formatClock(active ? remaining : target)}
              </span>
              <span className="mt-1 text-sm text-muted">{running ? "Deep focus…" : active ? "Paused" : "Pick a length and begin"}</span>
              {distractions > 0 && (
                <span className="mt-2 flex items-center gap-1 text-xs text-warn">
                  <Eye className="h-3 w-3" /> {distractions} distraction{distractions > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                disabled={active}
                onClick={() => setMinutes(m)}
                className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition disabled:opacity-40", minutes === m ? "border-brand bg-brand/15 text-brand" : "border-line/20 text-muted hover:border-brand/50")}
              >
                {m} min
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!running ? (
              <Button size="lg" icon={Play} onClick={start} disabled={!profile}>
                {active ? "Resume" : "Begin focus"}
              </Button>
            ) : (
              <Button size="lg" variant="secondary" icon={Pause} onClick={pause}>
                Pause
              </Button>
            )}
            {active && (
              <Button size="lg" variant="success" icon={Flag} loading={saving} onClick={() => finish(false)}>
                End & save
              </Button>
            )}
          </div>

          <div className="mt-8 grid w-full max-w-xl gap-4 rounded-xl2 border border-line/15 bg-surface/40 p-4 backdrop-blur sm:grid-cols-2">
            <Select label="Studying" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={active}>
              <option value="">General study</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div>
              <span className="label">Soft music (plays while the timer runs)</span>
              <div className="flex items-center gap-2">
                <Select aria-label="Music" value={music} onChange={(e) => setMusic(e.target.value as AmbientId)}>
                  {AMBIENT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.emoji} {o.label}
                    </option>
                  ))}
                </Select>
                <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)} className="rounded-xl border border-line/20 p-2.5 text-muted transition hover:border-brand/50 hover:text-brand">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
              <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            <Brain className="mr-1 inline h-3 w-3" />
            Focus sessions earn bonus XP — fewer distractions, more XP.
          </p>
        </div>

        <div className="w-full lg:sticky lg:top-24 lg:w-[380px]">
          <Card>
            <CardTitle icon={Quote} action={<Badge tone="violet">Inspiration</Badge>}>Study quote</CardTitle>
            <div className="flex min-h-[260px] flex-col justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">{QUOTES[quoteIndex].category}</p>
                <blockquote className="mt-3 text-lg font-semibold leading-relaxed">
                  “{QUOTES[quoteIndex].text}”
                </blockquote>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line/10 pt-4">
                <span className="text-xs text-muted">{quoteIndex + 1} / {QUOTES.length}</span>
                <Button size="sm" variant="secondary" icon={Shuffle} onClick={() => setQuoteIndex((i) => shuffleQuote(i).index)}>
                  Shuffle
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

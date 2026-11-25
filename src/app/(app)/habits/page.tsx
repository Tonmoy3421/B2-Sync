"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Archive, Check, Flame, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui";
import { useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { HABIT_ICONS } from "@/lib/constants";
import { afterAction, invalidate } from "@/lib/actions";
import { addDays, cn, dhakaDate, errMsg } from "@/lib/utils";
import type { Habit, HabitLog } from "@/lib/types";

const SUGGESTIONS = ["Study every day", "Practice programming", "Revise previous lessons", "Read documentation", "Solve DSA problems", "Complete assignments"];

function streakOf(dates: Set<string>, today: string) {
  let cur = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

export default function HabitsPage() {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Habit | null>(null);
  const today = dhakaDate();

  const { data, mutate, isLoading } = useSWR(profile ? `habits:${profile.id}` : null, async () => {
    const sb = supabaseBrowser();
    const since = addDays(today, -90);
    const [h, l] = await Promise.all([
      sb.from("habits").select("*").eq("archived", false).order("created_at"),
      sb.from("habit_logs").select("habit_id, log_date").gte("log_date", since),
    ]);
    return { habits: (h.data ?? []) as Habit[], logs: (l.data ?? []) as HabitLog[] };
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);
  const byHabit = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (data?.logs ?? []).forEach((l) => m.set(l.habit_id, (m.get(l.habit_id) ?? new Set()).add(l.log_date)));
    return m;
  }, [data]);

  const doneToday = (data?.habits ?? []).filter((h) => byHabit.get(h.id)?.has(today)).length;
  const total = data?.habits.length ?? 0;
  const best = Math.max(0, ...(data?.habits ?? []).map((h) => streakOf(byHabit.get(h.id) ?? new Set(), today)));

  async function toggle(h: Habit, date: string) {
    if (!profile) return;
    const sb = supabaseBrowser();
    const has = byHabit.get(h.id)?.has(date);
    // optimistic UI
    await mutate(
      async (cur) => {
        const res = has
          ? await sb.from("habit_logs").delete().eq("habit_id", h.id).eq("log_date", date)
          : await sb.from("habit_logs").insert({ habit_id: h.id, user_id: profile.id, log_date: date });
        if (res.error) throw res.error;
        return cur;
      },
      {
        optimisticData: (cur) => (cur ? { ...cur, logs: has ? cur.logs.filter((l) => !(l.habit_id === h.id && l.log_date === date)) : [...cur.logs, { habit_id: h.id, log_date: date }] } : cur!),
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((e) => toast.error(errMsg(e)));
    if (!has) void afterAction("analytics", "missions", "dashboard");
  }

  async function create() {
    if (!profile) return;
    if (name.trim().length < 2) return toast.error("Name your habit");
    setBusy(true);
    const { error } = await supabaseBrowser().from("habits").insert({ user_id: profile.id, name: name.trim(), icon });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Habit added 🌱");
    setOpen(false);
    setName("");
    await mutate();
  }

  async function archive(h: Habit) {
    const { error } = await supabaseBrowser().from("habits").update({ archived: true }).eq("id", h.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Habit archived");
    await mutate();
    void invalidate("analytics");
  }
  async function remove(h: Habit) {
    const { error } = await supabaseBrowser().from("habits").delete().eq("id", h.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Habit deleted");
    await mutate();
    void invalidate("analytics");
  }

  return (
    <>
      <PageHeader icon={Repeat} title="Habits" description="Small daily routines that quietly decide your grades." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New habit</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={Check} label="Done today" value={doneToday} suffix={`/ ${total}`} tone="success" />
        <StatCard icon={Flame} label="Best current streak" value={best} suffix="days" tone="warn" />
        <div className="col-span-2 lg:col-span-1">
          <Card className="h-full">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Today&apos;s completion</p>
            <p className="mt-2 text-3xl font-bold">{total ? Math.round((doneToday / total) * 100) : 0}%</p>
            <Progress value={total ? (doneToday / total) * 100 : 0} className="mt-3" height="h-2.5" />
          </Card>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-56" />
      ) : total === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Pick one to start — tiny and daily beats big and rare."
          action={
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => { setName(s); setOpen(true); }} className="rounded-full border border-line/25 px-3 py-1.5 text-sm font-medium transition hover:border-brand hover:text-brand">
                  + {s}
                </button>
              ))}
            </div>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line/10 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 text-left font-medium">Habit</th>
                {days.map((d) => (
                  <th key={d} className={cn("px-2 py-3 text-center font-medium", d === today && "text-brand")}>
                    {new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" })}
                    <span className="block text-[10px] font-normal">{d.slice(8)}</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-medium">Streak</th>
                <th className="px-3 py-3 text-center font-medium">30d</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {data!.habits.map((h) => {
                const set = byHabit.get(h.id) ?? new Set<string>();
                const st = streakOf(set, today);
                let c30 = 0;
                for (let i = 0; i < 30; i++) if (set.has(addDays(today, -i))) c30++;
                return (
                  <tr key={h.id} className="border-b border-line/5 last:border-0">
                    <td className="px-5 py-3 font-semibold">
                      <span className="mr-2">{h.icon}</span>
                      {h.name}
                    </td>
                    {days.map((d) => {
                      const on = set.has(d);
                      return (
                        <td key={d} className="px-2 py-3 text-center">
                          <button
                            aria-label={`${h.name} ${d} ${on ? "done" : "not done"}`}
                            aria-pressed={on}
                            onClick={() => toggle(h, d)}
                            className={cn("mx-auto flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-90", on ? "border-transparent bg-brand-gradient text-white shadow-glow" : "border-line/25 text-transparent hover:border-brand/60 hover:text-brand/50", d === today && !on && "border-brand/50")}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">{st > 0 ? <Badge tone="warn">🔥 {st}</Badge> : <span className="text-muted">–</span>}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums">{Math.round((c30 / 30) * 100)}%</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button aria-label="Archive habit" title="Archive" onClick={() => archive(h)} className="rounded-lg p-1.5 text-muted hover:bg-brand/10 hover:text-fg"><Archive className="h-4 w-4" /></button>
                        <button aria-label="Delete habit" title="Delete" onClick={() => setDel(h)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">You can fill in today and the previous 7 days. Today&apos;s check-in earns +5 XP once per habit.</p>

      <Modal open={open} onClose={() => setOpen(false)} title="New habit">
        <div className="space-y-4">
          <Input label="Habit" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solve 2 DSA problems" maxLength={80} autoFocus />
          <div>
            <span className="label">Icon</span>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICONS.map((i) => (
                <button key={i} onClick={() => setIcon(i)} aria-label={`Icon ${i}`} className={cn("h-10 w-10 rounded-xl border text-xl transition hover:scale-110", icon === i ? "border-brand bg-brand/15" : "border-line/20")}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={create}>Add habit</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this habit?" description="Its whole history is deleted too. Archive it instead to keep the history." confirmLabel="Delete" danger onConfirm={() => del && remove(del)} />
    </>
  );
}

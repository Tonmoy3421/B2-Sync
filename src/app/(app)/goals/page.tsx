"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Flame, Gift, Pencil, Plus, Target, Trash2, Trophy } from "lucide-react";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Progress, Select, Skeleton, Tabs, Textarea } from "@/components/ui";
import { useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACHIEVEMENTS, MISSIONS } from "@/lib/constants";
import { afterAction, celebrate, invalidate } from "@/lib/actions";
import { addDays, cn, dhakaDate, errMsg, formatDate, timeLeft, weekStart } from "@/lib/utils";
import type { Goal } from "@/lib/types";

const PRIORITY = { high: "danger", medium: "warn", low: "muted" } as const;

export default function GoalsPage() {
  const { profile } = useProfile();
  const [tab, setTab] = useState<"goals" | "missions" | "badges">("goals");
  const [edit, setEdit] = useState<Goal | "new" | null>(null);
  const [del, setDel] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<"active" | "completed">("active");

  const { data: goals, mutate, isLoading } = useSWR(profile ? `goals:${profile.id}` : null, async () => {
    const { data } = await supabaseBrowser().from("goals").select("*").order("created_at", { ascending: false });
    return (data ?? []) as Goal[];
  });

  const list = (goals ?? []).filter((g) => g.status === filter);
  const activeCount = (goals ?? []).filter((g) => g.status === "active").length;

  async function setProgress(g: Goal, progress: number) {
    const { error } = await supabaseBrowser().from("goals").update({ progress }).eq("id", g.id);
    if (error) return toast.error(errMsg(error));
    if (progress >= 100) {
      celebrate(true);
      toast.success("Goal completed! 🎉");
    }
    await mutate();
    void afterAction("analytics", "dashboard");
  }
  async function reopen(g: Goal) {
    const { error } = await supabaseBrowser().from("goals").update({ status: "active", progress: 90 }).eq("id", g.id);
    if (error) return toast.error(errMsg(error));
    await mutate();
  }
  async function remove(g: Goal) {
    const { error } = await supabaseBrowser().from("goals").delete().eq("id", g.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Goal deleted");
    await mutate();
    void invalidate("analytics");
  }

  return (
    <>
      <PageHeader
        icon={Target}
        title="Goals & Missions"
        description="Set bigger targets, then grab daily and weekly bonus XP."
        actions={tab === "goals" ? <Button icon={Plus} onClick={() => setEdit("new")}>New goal</Button> : undefined}
      />
      <Tabs id="goal-tabs" className="mb-6" value={tab} onChange={setTab} tabs={[{ value: "goals", label: "Goals", icon: Target, count: activeCount }, { value: "missions", label: "Missions", icon: Flame }, { value: "badges", label: "Achievements", icon: Trophy }]} />

      {tab === "goals" && (
        <>
          <div className="mb-4 flex gap-2">
            {(["active", "completed"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition", filter === f ? "border-brand bg-brand/15 text-brand" : "border-line/20 text-muted hover:border-brand/50")}>
                {f}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={Target}
              title={filter === "active" ? "No active goals" : "No completed goals yet"}
              description={filter === "active" ? "Try “Study 20 hours this week” or “Finish Chapter 3”." : "Finish a goal to see it here."}
              action={filter === "active" ? <Button icon={Plus} onClick={() => setEdit("new")}>Create a goal</Button> : undefined}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((g) => {
                const overdue = g.status === "active" && g.deadline && g.deadline < dhakaDate();
                return (
                  <Card key={g.id} hover>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={cn("truncate font-bold", g.status === "completed" && "line-through opacity-70")}>{g.title}</h3>
                        {g.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{g.description}</p>}
                      </div>
                      <Badge tone={PRIORITY[g.priority]}>{g.priority}</Badge>
                    </div>
                    <div className="mt-4">
                      <Progress value={g.progress} showLabel />
                      {g.status === "active" && (
                        <input aria-label="Progress" type="range" min={0} max={100} step={5} defaultValue={g.progress} onMouseUp={(e) => setProgress(g, Number((e.target as HTMLInputElement).value))} onTouchEnd={(e) => setProgress(g, Number((e.target as HTMLInputElement).value))} onKeyUp={(e) => setProgress(g, Number((e.target as HTMLInputElement).value))} className="mt-2 w-full" />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-danger" : "text-muted")}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {g.deadline ? `${formatDate(g.deadline)}${g.status === "active" ? ` · ${overdue ? "overdue" : timeLeft(g.deadline + "T23:59:00+06:00")}` : ""}` : "No deadline"}
                      </span>
                      <div className="flex gap-1">
                        {g.status === "active" ? (
                          <>
                            <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => setProgress(g, 100)}>Done</Button>
                            <Button size="sm" variant="ghost" aria-label="Edit goal" onClick={() => setEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => reopen(g)}>Reopen</Button>
                        )}
                        <Button size="sm" variant="ghost" aria-label="Delete goal" onClick={() => setDel(g)}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "missions" && profile && <Missions userId={profile.id} />}
      {tab === "badges" && profile && <Badges userId={profile.id} />}

      <GoalModal goal={edit} onClose={() => setEdit(null)} userId={profile?.id} onSaved={() => { void mutate(); void invalidate("analytics"); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this goal?" description="This can't be undone." confirmLabel="Delete" danger onConfirm={() => del && remove(del)} />
    </>
  );
}

function GoalModal({ goal, onClose, userId, onSaved }: { goal: Goal | "new" | null; onClose: () => void; userId?: string; onSaved: () => void }) {
  const editing = goal && goal !== "new" ? goal : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<Goal["priority"]>("medium");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const k = goal ? (goal === "new" ? "new" : goal.id) : null;
  if (k !== key) {
    setKey(k);
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setDeadline(editing?.deadline ?? "");
    setPriority(editing?.priority ?? "medium");
  }

  async function save() {
    if (!userId) return;
    if (title.trim().length < 2) return toast.error("Give the goal a title");
    setBusy(true);
    const sb = supabaseBrowser();
    const payload = { title: title.trim(), description: description.trim(), deadline: deadline || null, priority };
    const { error } = editing ? await sb.from("goals").update(payload).eq("id", editing.id) : await sb.from("goals").insert({ ...payload, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(editing ? "Goal updated" : "Goal created 🎯");
    onSaved();
    onClose();
  }

  return (
    <Modal open={!!goal} onClose={onClose} title={editing ? "Edit goal" : "New goal"}>
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solve 50 programming problems" maxLength={140} autoFocus />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Goal["priority"])}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>{editing ? "Save" : "Create goal"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function Missions({ userId }: { userId: string }) {
  const { data, mutate } = useSWR(`missions:${userId}`, async () => {
    const sb = supabaseBrowser();
    const today = dhakaDate();
    const wk = weekStart(today);
    const since = new Date(wk + "T00:00:00+06:00").toISOString();
    const [ses, topics, habits, claims] = await Promise.all([
      sb.from("study_sessions").select("duration_seconds, created_at").neq("mode", "break").gte("created_at", since),
      sb.from("topic_progress").select("completed_at").eq("user_id", userId).eq("status", "completed").gte("completed_at", since),
      sb.from("habit_logs").select("log_date").eq("log_date", today),
      sb.from("mission_claims").select("mission_key, period_key"),
    ]);
    const sessions = (ses.data ?? []) as { duration_seconds: number; created_at: string }[];
    const todayMin = Math.floor(sessions.filter((s) => dhakaDate(s.created_at) === today).reduce((a, s) => a + s.duration_seconds, 0) / 60);
    const weekMin = Math.floor(sessions.reduce((a, s) => a + s.duration_seconds, 0) / 60);
    const days = new Set(sessions.map((s) => dhakaDate(s.created_at))).size;
    const tp = (topics.data ?? []) as { completed_at: string }[];
    const progress: Record<string, number> = {
      d_study_45: todayMin,
      d_topic_1: tp.filter((t) => dhakaDate(t.completed_at) === today).length,
      d_habit_1: (habits.data ?? []).length,
      w_study_600: weekMin,
      w_topics_5: tp.length,
      w_days_5: days,
    };
    const claimed = new Set(((claims.data ?? []) as { mission_key: string; period_key: string }[]).map((c) => `${c.mission_key}:${c.period_key}`));
    return { progress, claimed, today, wk };
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function claim(key: string) {
    setBusy(key);
    const { data: xp, error } = await supabaseBrowser().rpc("claim_mission", { p_key: key });
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    celebrate();
    toast.success(`Mission complete! +${xp} XP 🎁`);
    await mutate();
    void afterAction();
  }

  const resetIn = useMemo(() => {
    const next = new Date(addDays(dhakaDate(), 1) + "T00:00:00+06:00").getTime() - Date.now();
    return `${Math.floor(next / 3600000)}h ${Math.floor((next % 3600000) / 60000)}m`;
  }, []);

  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["daily", "weekly"] as const).map((kind) => (
        <Card key={kind}>
          <CardTitle icon={Gift} action={<Badge tone="muted">{kind === "daily" ? `resets in ${resetIn}` : "resets Monday"}</Badge>}>
            {kind === "daily" ? "Daily missions" : "Weekly missions"}
          </CardTitle>
          <ul className="space-y-3">
            {MISSIONS.filter((m) => m.kind === kind).map((m) => {
              const cur = data.progress[m.key] ?? 0;
              const period = kind === "daily" ? data.today : data.wk;
              const got = data.claimed.has(`${m.key}:${period}`);
              const ready = cur >= m.target;
              return (
                <li key={m.key} className="rounded-xl bg-line/5 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-xs text-muted">{m.desc}</p>
                    </div>
                    {got ? (
                      <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> claimed</Badge>
                    ) : (
                      <Button size="sm" variant={ready ? "primary" : "secondary"} disabled={!ready} loading={busy === m.key} onClick={() => claim(m.key)}>
                        +{m.reward} XP
                      </Button>
                    )}
                  </div>
                  <Progress value={(Math.min(cur, m.target) / m.target) * 100} className="mt-3" />
                  <p className="mt-1 text-xs text-muted">{Math.min(cur, m.target)} / {m.target} {m.unit}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Badges({ userId }: { userId: string }) {
  const { data } = useSWR(`achievements:${userId}`, async () => {
    const { data } = await supabaseBrowser().from("user_achievements").select("key, unlocked_at").eq("user_id", userId);
    return new Map(((data ?? []) as { key: string; unlocked_at: string }[]).map((r) => [r.key, r.unlocked_at]));
  });
  if (!data) return <Skeleton className="h-64" />;
  return (
    <>
      <p className="mb-4 text-sm text-muted">{data.size} of {ACHIEVEMENTS.length} unlocked · each badge gives +25 XP</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = data.has(a.key);
          return (
            <Card key={a.key} className={cn("flex items-center gap-3", !got && "opacity-55 grayscale")}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-2xl">{got ? a.emoji : "🔒"}</span>
              <div>
                <p className="font-bold">{a.title}</p>
                <p className="text-xs text-muted">{a.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

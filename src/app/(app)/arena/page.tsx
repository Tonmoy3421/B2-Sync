"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Flame, Plus, ShieldAlert, Skull, Swords, Target, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, Modal, PageHeader, PageSkeleton, Progress, Select, Tabs, Textarea } from "@/components/ui";
import { useActiveGroup, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { afterAction, celebrate, invalidate } from "@/lib/actions";
import { errMsg, formatDateTime, timeAgo, timeLeft } from "@/lib/utils";
import type { Commitment, Dare } from "@/lib/types";

type Who = { username: string; full_name: string; avatar_url: string | null };
type CommitmentX = Commitment & { profile: Who };
type DareX = Dare & { profile: Who; reactions: { emoji: string; user_id: string }[] };
const EMOJIS = ["😂", "👏", "🔥", "😈", "💪"];

function defaultDue() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ArenaPage() {
  const { profile } = useProfile();
  const { memberships, active, setActive, isLoading } = useActiveGroup();
  const [tab, setTab] = useState<"pledges" | "dares" | "shame">("pledges");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(90);
  const [due, setDue] = useState(defaultDue());
  const [busy, setBusy] = useState(false);
  const [dareFor, setDareFor] = useState<DareX | null>(null);
  const [proof, setProof] = useState("");
  const [shameFor, setShameFor] = useState<DareX | null>(null);
  const [delFor, setDelFor] = useState<CommitmentX | null>(null);

  const gid = active?.group.id;

  const { data, mutate } = useSWR(gid ? `arena:${gid}` : null, async () => {
    const sb = supabaseBrowser();
    const [c, d] = await Promise.all([
      sb.from("commitments").select("*, profile:profiles(username, full_name, avatar_url)").eq("group_id", gid!).order("due_at", { ascending: false }).limit(60),
      sb.from("dares").select("*, profile:profiles(username, full_name, avatar_url), reactions:dare_reactions(emoji, user_id)").eq("group_id", gid!).order("created_at", { ascending: false }).limit(60),
    ]);
    return { commitments: (c.data ?? []) as unknown as CommitmentX[], dares: (d.data ?? []) as unknown as DareX[] };
  });

  // my own minutes inside each of my active pledge windows
  const mine = useMemo(() => (data?.commitments ?? []).filter((c) => c.user_id === profile?.id && c.status === "active"), [data, profile]);
  const { data: myMins } = useSWR(mine.length ? `arena:mins:${mine.map((m) => m.id).join(",")}` : null, async () => {
    const earliest = mine.reduce((a, b) => (a < b.starts_at ? a : b.starts_at), mine[0].starts_at);
    const { data } = await supabaseBrowser().from("study_sessions").select("duration_seconds, created_at").neq("mode", "break").gte("created_at", earliest);
    const rows = (data ?? []) as { duration_seconds: number; created_at: string }[];
    const out: Record<string, number> = {};
    mine.forEach((m) => {
      out[m.id] = Math.floor(rows.filter((r) => r.created_at >= m.starts_at && r.created_at <= m.due_at).reduce((s, r) => s + r.duration_seconds, 0) / 60);
    });
    return out;
  });

  async function create() {
    if (!gid || !profile) return;
    if (title.trim().length < 2) return toast.error("Describe your pledge");
    const dueAt = new Date(due);
    if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() + 5 * 60000) return toast.error("Pick a deadline at least 5 minutes from now");
    setBusy(true);
    const { error } = await supabaseBrowser().from("commitments").insert({ user_id: profile.id, group_id: gid, title: title.trim(), target_minutes: minutes, due_at: dueAt.toISOString() });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Pledge made! The group is watching 👀");
    setOpen(false);
    setTitle("");
    await mutate();
    void invalidate("dashboard");
  }

  async function resolve(d: DareX, choice: "dare" | "shame") {
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("resolve_dare", { p_id: d.id, p_choice: choice, p_proof: proof });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    if (choice === "dare") {
      celebrate(true);
      toast.success("Dare done — respect! One warning removed 😈");
    } else toast("You took the shame. Study hard to bounce back 🙈");
    setDareFor(null);
    setShameFor(null);
    setProof("");
    await mutate();
    void afterAction("groups", "activities", "leaderboard");
  }

  async function react(d: DareX, emoji: string) {
    if (!profile) return;
    const sb = supabaseBrowser();
    const mineR = d.reactions.find((r) => r.user_id === profile.id);
    const res = mineR?.emoji === emoji
      ? await sb.from("dare_reactions").delete().eq("dare_id", d.id).eq("user_id", profile.id)
      : mineR
        ? await sb.from("dare_reactions").update({ emoji }).eq("dare_id", d.id).eq("user_id", profile.id)
        : await sb.from("dare_reactions").insert({ dare_id: d.id, user_id: profile.id, emoji });
    if (res.error) return toast.error(errMsg(res.error));
    await mutate();
  }

  async function withdraw(c: CommitmentX) {
    const { error } = await supabaseBrowser().from("commitments").delete().eq("id", c.id);
    if (error) return toast.error("Pledges can only be withdrawn in the first 10 minutes");
    toast.success("Pledge withdrawn");
    await mutate();
  }

  if (isLoading) return <PageSkeleton />;
  if (!active)
    return (
      <>
        <PageHeader icon={Swords} title="Pledges & Dares" description="Promise your group you'll study — or face the dare." />
        <EmptyState icon={Users} title="Join a study group first" description="Pledges are made inside a group, so your friends can hold you accountable." action={<Link href="/groups"><Button>Go to groups</Button></Link>} />
      </>
    );

  const commitments = data?.commitments ?? [];
  const dares = data?.dares ?? [];
  const activePledges = commitments.filter((c) => c.status === "active");
  const history = commitments.filter((c) => c.status !== "active");
  const myPending = dares.filter((d) => d.user_id === profile?.id && d.status === "pending");
  const shamed = dares.filter((d) => d.status === "shamed");
  const doneDares = dares.filter((d) => d.status === "done");
  const max = active.group.max_warnings;

  return (
    <>
      <PageHeader
        icon={Swords}
        title="Pledges & Dares"
        description="Promise study time. Miss it and you get a warning plus a dare — or take the shame."
        actions={
          <>
            {memberships.length > 1 && (
              <Select aria-label="Group" value={gid} onChange={(e) => setActive(e.target.value)}>
                {memberships.map((m) => (
                  <option key={m.group.id} value={m.group.id}>
                    {m.group.name}
                  </option>
                ))}
              </Select>
            )}
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Make a pledge
            </Button>
          </>
        }
      />

      <Card className={`mb-6 ${active.warnings >= max - 1 && active.warnings > 0 ? "border-danger/40" : ""}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/15 text-danger">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold">
                Your warnings in {active.group.name}: {active.warnings}/{max}
              </p>
              <p className="text-sm text-muted">Reach {max} and you&apos;re removed from the group. Completing a dare removes one warning.</p>
            </div>
          </div>
          <div className="flex gap-1.5" aria-label={`${active.warnings} of ${max} warnings`}>
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={`h-3 w-8 rounded-full ${i < active.warnings ? "bg-danger" : "bg-line/20"}`} />
            ))}
          </div>
        </div>
      </Card>

      {myPending.map((d) => (
        <Card key={d.id} className="mb-4 border-warn/40 bg-warn/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-warn" />
            <div className="flex-1">
              <p className="font-bold">You missed a pledge — choose your fate</p>
              <p className="mt-1 text-sm text-muted">You were {d.missed_minutes} min short. Your dare:</p>
              <p className="mt-2 rounded-xl bg-surface/60 p-3 text-sm font-semibold">😈 {d.dare_text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button icon={Flame} onClick={() => setDareFor(d)}>
                  I did the dare
                </Button>
                <Button variant="danger" icon={Skull} onClick={() => setShameFor(d)}>
                  Take the shame (−30 XP)
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}

      <Tabs
        id="arena-tabs"
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pledges", label: "Pledges", icon: Target, count: activePledges.length },
          { value: "dares", label: "Dares", icon: Flame },
          { value: "shame", label: "Wall of Shame", icon: Skull, count: shamed.length },
        ]}
      />

      {tab === "pledges" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle icon={Target}>Active pledges</CardTitle>
            {activePledges.length === 0 ? (
              <EmptyState icon={Target} title="No active pledges" description="Be brave — make the first one." className="py-8" />
            ) : (
              <ul className="space-y-3">
                {activePledges.map((c) => {
                  const isMe = c.user_id === profile?.id;
                  const m = myMins?.[c.id] ?? 0;
                  const pct = Math.min(100, (m / c.target_minutes) * 100);
                  return (
                    <li key={c.id} className="rounded-xl bg-line/5 p-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.profile.full_name || c.profile.username} src={c.profile.avatar_url} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{c.title}</p>
                          <p className="text-xs text-muted">
                            @{c.profile.username} · {c.target_minutes} min · due {formatDateTime(c.due_at)}
                          </p>
                        </div>
                        <Badge tone="warn">{timeLeft(c.due_at)}</Badge>
                        {isMe && Date.now() - new Date(c.starts_at).getTime() < 10 * 60000 && (
                          <button aria-label="Withdraw pledge" onClick={() => setDelFor(c)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {isMe && (
                        <div className="mt-3">
                          <Progress value={pct} showLabel />
                          <p className="mt-1 text-xs text-muted">
                            {m} / {c.target_minutes} min studied since you pledged
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle icon={CheckCircle2}>Recently settled</CardTitle>
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nothing settled yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 12).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-line/5 px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">@{c.profile.username}</span> <span className="text-muted">· {c.title}</span>
                    </span>
                    <Badge tone={c.status === "completed" ? "success" : "danger"}>{c.status === "completed" ? "kept 🤞" : "missed"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "dares" && (
        <DareList dares={dares.filter((d) => d.status !== "shamed")} empty="No dares yet. Dares appear when someone misses a pledge." me={profile?.id} onReact={react} />
      )}
      {tab === "shame" && (
        <>
          <p className="mb-4 text-sm text-muted">These brave souls skipped the dare and took the shame. Be kind — a little teasing, a lot of encouragement.</p>
          <DareList dares={shamed} empty="Nobody has taken the shame. A clean wall! 🎉" me={profile?.id} onReact={react} />
          {doneDares.length > 0 && <p className="mt-4 text-xs text-muted">{doneDares.length} dare{doneDares.length > 1 ? "s" : ""} completed so far.</p>}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Make a study pledge" description="Study at least this many minutes before the deadline, or face the consequences.">
        <div className="space-y-4">
          <Input label="Your pledge" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finish Chapter 4 of Data Structures" maxLength={120} autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Minutes of study" type="number" min={5} max={3000} value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(3000, Number(e.target.value) || 5)))} hint="Counted from your timer sessions" />
            <Input label="Deadline" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <p className="rounded-xl bg-warn/10 p-3 text-xs text-warn">⚠️ Once made, a pledge can only be withdrawn within 10 minutes. Missing it = 1 warning + a dare.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={create}>
              I promise
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!dareFor} onClose={() => setDareFor(null)} title="Prove you did the dare" description={dareFor?.dare_text}>
        <div className="space-y-4">
          <Textarea label="What did you do?" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Describe it, or tell the group where you posted the proof…" maxLength={500} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDareFor(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => dareFor && resolve(dareFor, "dare")}>
              Mark as done
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!shameFor} onClose={() => setShameFor(null)} title="Take the shame?" description="You'll lose 30 XP, your name goes on the Wall of Shame, and you keep your warning." confirmLabel="Take the shame" danger onConfirm={() => shameFor && resolve(shameFor, "shame")} />
      <ConfirmDialog open={!!delFor} onClose={() => setDelFor(null)} title="Withdraw this pledge?" description="No penalty — you're still inside the 10-minute grace window." confirmLabel="Withdraw" onConfirm={() => delFor && withdraw(delFor)} />
    </>
  );
}

function DareList({ dares, empty, me, onReact }: { dares: DareX[]; empty: string; me?: string; onReact: (d: DareX, e: string) => void }) {
  if (!dares.length) return <EmptyState icon={Flame} title={empty} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {dares.map((d) => {
        const counts = EMOJIS.map((e) => ({ e, n: d.reactions.filter((r) => r.emoji === e).length, mine: d.reactions.some((r) => r.emoji === e && r.user_id === me) }));
        return (
          <Card key={d.id}>
            <div className="flex items-center gap-2.5">
              <Avatar name={d.profile.full_name || d.profile.username} src={d.profile.avatar_url} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{d.profile.username}</p>
                <p className="text-xs text-muted">{timeAgo(d.created_at)} · {d.missed_minutes} min short</p>
              </div>
              <Badge tone={d.status === "done" ? "success" : d.status === "shamed" ? "danger" : "warn"}>{d.status === "done" ? "dared ✔" : d.status === "shamed" ? "shamed 🙈" : "pending"}</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold">😈 {d.dare_text}</p>
            {d.proof_note && <p className="mt-2 rounded-xl bg-line/5 p-2.5 text-sm text-muted">“{d.proof_note}”</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {counts.map((c) => (
                <button key={c.e} onClick={() => onReact(d, c.e)} aria-label={`React ${c.e}`} className={`rounded-full border px-2.5 py-1 text-sm transition hover:scale-110 ${c.mine ? "border-brand bg-brand/15" : "border-line/20"}`}>
                  {c.e} {c.n > 0 && <span className="text-xs font-semibold">{c.n}</span>}
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

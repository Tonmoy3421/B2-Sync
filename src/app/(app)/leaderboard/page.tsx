"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Crown, Flame, ShieldAlert, Trophy, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, PageHeader, PageSkeleton, Select, Tabs } from "@/components/ui";
import { useActiveGroup, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACHIEVEMENTS } from "@/lib/constants";
import { levelFromXp, rankForLevel } from "@/lib/xp";
import { cn, formatDuration } from "@/lib/utils";
import type { LeaderRow } from "@/lib/types";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { profile } = useProfile();
  const { memberships, active, setActive, isLoading } = useActiveGroup();
  const [by, setBy] = useState<"xp" | "week" | "streak">("xp");
  const gid = active?.group.id;

  const { data: rows } = useSWR(gid ? `leaderboard:${gid}` : null, async () => {
    const { data, error } = await supabaseBrowser().rpc("group_leaderboard", { p_group: gid });
    if (error) throw error;
    return (data ?? []) as LeaderRow[];
  });

  const { data: badges } = useSWR(gid ? `achievements:group:${gid}` : null, async () => {
    const { data } = await supabaseBrowser().from("user_achievements").select("user_id, key");
    const map: Record<string, string[]> = {};
    (data ?? []).forEach((r: { user_id: string; key: string }) => (map[r.user_id] = [...(map[r.user_id] ?? []), r.key]));
    return map;
  });

  if (isLoading) return <PageSkeleton />;
  if (!active)
    return (
      <>
        <PageHeader icon={Trophy} title="Leaderboard" />
        <EmptyState icon={Users} title="Join a group to compete" description="Leaderboards are private to each study group." action={<Link href="/groups"><Button>Go to groups</Button></Link>} />
      </>
    );

  const sorted = [...(rows ?? [])].sort((a, b) => (by === "xp" ? b.xp - a.xp : by === "week" ? b.week_minutes - a.week_minutes : b.streak - a.streak));
  const metric = (r: LeaderRow) => (by === "xp" ? `${r.xp} XP` : by === "week" ? formatDuration(r.week_minutes * 60) : `${r.streak} 🔥`);
  const top = sorted.slice(0, 3);

  return (
    <>
      <PageHeader
        icon={Trophy}
        title="Leaderboard"
        description={`How ${active.group.name} stacks up this week.`}
        actions={
          memberships.length > 1 ? (
            <Select aria-label="Group" value={gid} onChange={(e) => setActive(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.group.id} value={m.group.id}>
                  {m.group.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      <Tabs id="lb" className="mb-6" value={by} onChange={setBy} tabs={[{ value: "xp", label: "Total XP" }, { value: "week", label: "This week" }, { value: "streak", label: "Streak" }]} />

      {top.length > 0 && (
        <div className="mb-6 grid grid-cols-3 items-end gap-3">
          {[1, 0, 2].map((i) => {
            const r = top[i];
            if (!r) return <div key={i} />;
            return (
              <Card key={r.user_id} className={cn("text-center", i === 0 ? "pb-8 pt-6 shadow-glow" : "")}>
                <div className="text-3xl">{MEDAL[i]}</div>
                <div className="my-2 flex justify-center">
                  <Avatar name={r.full_name || r.username} src={r.avatar_url} size={i === 0 ? 64 : 48} />
                </div>
                <p className="truncate text-sm font-bold">@{r.username}</p>
                <p className="text-xs text-muted">{metric(r)}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-0">
        <CardTitle className="px-5 pt-5">Everyone</CardTitle>
        <ul className="divide-y divide-line/10">
          {sorted.map((r, i) => {
            const lvl = levelFromXp(r.xp);
            const mine = r.user_id === profile?.id;
            const bs = badges?.[r.user_id] ?? [];
            return (
              <li key={r.user_id} className={cn("flex items-center gap-3 px-5 py-3.5", mine && "bg-brand/5")}>
                <span className="w-7 text-center text-sm font-bold text-muted">{i < 3 ? MEDAL[i] : i + 1}</span>
                <Avatar name={r.full_name || r.username} src={r.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    @{r.username} {mine && <Badge tone="brand">you</Badge>} {r.role !== "member" && <Crown className="h-3.5 w-3.5 text-warn" />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    Lv {lvl} · {rankForLevel(lvl)} {bs.length > 0 && <span className="ml-1">{bs.slice(0, 5).map((k) => ACHIEVEMENTS.find((a) => a.key === k)?.emoji).join(" ")}</span>}
                  </p>
                </div>
                <div className="hidden items-center gap-3 text-xs text-muted sm:flex">
                  <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-warn" />{r.streak}</span>
                  {r.warnings > 0 && <span className="flex items-center gap-1 text-danger"><ShieldAlert className="h-3.5 w-3.5" />{r.warnings}</span>}
                </div>
                <span className="w-24 text-right text-sm font-bold tabular-nums">{metric(r)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

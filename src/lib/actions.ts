"use client";

import { mutate } from "swr";
import { toast } from "sonner";
import { supabaseBrowser } from "./supabase/client";
import { ACHIEVEMENTS } from "./constants";

export function celebrate(big = false) {
  import("canvas-confetti").then((m) => {
    const confetti = m.default;
    confetti({
      particleCount: big ? 160 : 70,
      spread: big ? 90 : 60,
      startVelocity: 38,
      origin: { y: 0.7 },
      colors: ["#22d3ee", "#3b82f6", "#a78bfa", "#34d399", "#fbbf24"],
    });
  });
}

/** Re-fetch every cached query whose key starts with one of these prefixes. */
export function invalidate(...prefixes: string[]) {
  return mutate(
    (key) => typeof key === "string" && prefixes.some((p) => key === p || key.startsWith(p + ":")),
    undefined,
    { revalidate: true }
  );
}

/** Call after anything that can earn XP: refreshes profile, checks achievements. */
export async function afterAction(...extra: string[]) {
  const sb = supabaseBrowser();
  const { data } = await sb.rpc("evaluate_achievements");
  const keys = (Array.isArray(data) ? data : []) as string[];
  keys.forEach((k) => {
    const a = ACHIEVEMENTS.find((x) => x.key === k);
    if (a) toast.success(`${a.emoji} Achievement unlocked: ${a.title}`, { description: a.desc + " (+25 XP)" });
  });
  if (keys.length) celebrate(true);
  await invalidate("profile", "achievements", ...extra);
}

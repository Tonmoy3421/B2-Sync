"use client";

import { supabaseBrowser } from "./supabase/client";
import { afterAction } from "./actions";
import type { StudySession } from "./types";

/** Save a finished session. The database turns it into XP, streaks and group activity. */
export async function saveSession(input: {
  userId: string;
  courseId: string | null;
  mode: StudySession["mode"];
  plannedSeconds: number;
  durationSeconds: number;
  completed: boolean;
  distractions?: number;
  note?: string;
}) {
  const duration = Math.min(28800, Math.max(0, Math.round(input.durationSeconds)));
  const { error } = await supabaseBrowser().from("study_sessions").insert({
    user_id: input.userId,
    course_id: input.courseId || null,
    mode: input.mode,
    planned_seconds: Math.max(0, Math.round(input.plannedSeconds)),
    duration_seconds: duration,
    completed: input.completed,
    distractions: input.distractions ?? 0,
    note: input.note ?? "",
  });
  if (error) throw error;
  await afterAction("sessions", "analytics", "leaderboard", "activities", "dashboard", "arena");
}

/** A short pleasant chime made with the Web Audio API (no sound file needed). */
export function chime() {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    /* ignore */
  }
}

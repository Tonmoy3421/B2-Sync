/** level = floor(sqrt(xp / 100)) + 1  ->  L2 = 100xp, L3 = 400xp, L5 = 1600xp, L10 = 8100xp */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return 100 * Math.pow(level - 1, 2);
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(100, Math.round(((xp - start) / (next - start)) * 100));
  return { level, start, next, pct, toNext: next - xp };
}

const RANKS = [
  "Freshman",
  "Note Taker",
  "Focused Mind",
  "Deep Diver",
  "Scholar",
  "Exam Slayer",
  "Knowledge Knight",
  "Study Sage",
  "Academic Legend",
  "Grand Master",
];

export function rankForLevel(level: number): string {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
}

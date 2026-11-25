import type { EventKind, ResourceKind } from "./types";

export const APP_NAME = "B2 Sync";

export const ACHIEVEMENTS = [
  { key: "first_session", title: "First Step", desc: "Finish your first study session", emoji: "🚀" },
  { key: "hours_10", title: "Ten Hour Club", desc: "Study for 10 hours in total", emoji: "⏱️" },
  { key: "hours_50", title: "Deep Work", desc: "Study for 50 hours in total", emoji: "🧠" },
  { key: "streak_3", title: "On a Roll", desc: "Reach a 3-day study streak", emoji: "🔥" },
  { key: "streak_7", title: "Week Warrior", desc: "Reach a 7-day study streak", emoji: "⚡" },
  { key: "streak_30", title: "Unstoppable", desc: "Reach a 30-day study streak", emoji: "🏆" },
  { key: "topics_10", title: "Topic Hunter", desc: "Complete 10 topics", emoji: "🎯" },
  { key: "topics_50", title: "Syllabus Slayer", desc: "Complete 50 topics", emoji: "⚔️" },
  { key: "goal_first", title: "Goal Getter", desc: "Complete your first goal", emoji: "✅" },
  { key: "goals_5", title: "Achiever", desc: "Complete 5 goals", emoji: "🌟" },
  { key: "habit_30", title: "Habit Builder", desc: "Log 30 habit check-ins", emoji: "🌱" },
  { key: "helper", title: "Generous Mind", desc: "Share 5 resources with a group", emoji: "🤝" },
  { key: "team_player", title: "Team Player", desc: "Join a study group", emoji: "👥" },
  { key: "level_5", title: "Rising Star", desc: "Reach level 5", emoji: "⭐" },
  { key: "clean_record", title: "Man of His Word", desc: "Keep 3 study pledges", emoji: "🤞" },
  { key: "dare_devil", title: "Dare Devil", desc: "Complete a dare after a missed pledge", emoji: "😈" },
  { key: "focus_master", title: "Zen Master", desc: "Complete 5 Focus Mode sessions", emoji: "🧘" },
] as const;

export type MissionDef = {
  key: string;
  kind: "daily" | "weekly";
  title: string;
  desc: string;
  target: number;
  reward: number;
  unit: string;
};

// Must match claim_mission() in supabase/schema.sql
export const MISSIONS: MissionDef[] = [
  { key: "d_study_45", kind: "daily", title: "Power Hour", desc: "Study 45 minutes today", target: 45, reward: 30, unit: "min" },
  { key: "d_topic_1", kind: "daily", title: "One Down", desc: "Complete a topic today", target: 1, reward: 25, unit: "topic" },
  { key: "d_habit_1", kind: "daily", title: "Habit Check", desc: "Log a habit today", target: 1, reward: 10, unit: "habit" },
  { key: "w_study_600", kind: "weekly", title: "10-Hour Week", desc: "Study 10 hours this week", target: 600, reward: 150, unit: "min" },
  { key: "w_topics_5", kind: "weekly", title: "Syllabus Sprint", desc: "Complete 5 topics this week", target: 5, reward: 120, unit: "topics" },
  { key: "w_days_5", kind: "weekly", title: "Consistency King", desc: "Study on 5 different days this week", target: 5, reward: 100, unit: "days" },
];

export const DAILY_CHALLENGES = [
  "Explain one topic out loud as if teaching a friend — no notes.",
  "Do a 25-minute Pomodoro on your hardest course first.",
  "Solve 3 past-paper questions without looking at the answers.",
  "Summarise today's lecture in exactly five bullet points.",
  "Put your phone in another room for one full study session.",
  "Teach a classmate one thing you just learned.",
  "Write 5 quiz questions about a topic, then answer them tomorrow.",
  "Review yesterday's notes for 10 minutes before starting anything new.",
  "Study one topic you've been avoiding — just 20 minutes.",
  "Make a one-page cheat sheet for your next exam.",
  "Complete one full practice problem set from start to finish.",
  "Plan tomorrow's study blocks before you sleep tonight.",
  "Try the Feynman technique on a confusing concept.",
  "Read the documentation / textbook section before watching a video.",
];

export const COURSE_COLORS = [
  "#22d3ee",
  "#3b82f6",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#f97316",
];

export const EVENT_KINDS: Record<EventKind, { label: string; color: string; emoji: string }> = {
  class: { label: "Class", color: "#3b82f6", emoji: "🏫" },
  exam: { label: "Exam", color: "#ef4444", emoji: "📝" },
  assignment: { label: "Assignment", color: "#f59e0b", emoji: "📌" },
  study: { label: "Study session", color: "#22d3ee", emoji: "📚" },
  reminder: { label: "Reminder", color: "#a78bfa", emoji: "🔔" },
  group: { label: "Group event", color: "#34d399", emoji: "👥" },
};

export const RESOURCE_KINDS: Record<ResourceKind, { label: string; emoji: string }> = {
  pdf: { label: "PDF", emoji: "📕" },
  note: { label: "Lecture notes", emoji: "🗒️" },
  doc: { label: "Document", emoji: "📄" },
  image: { label: "Image", emoji: "🖼️" },
  audio: { label: "Audio", emoji: "🎧" },
  video: { label: "Video link", emoji: "🎬" },
  link: { label: "URL", emoji: "🔗" },
  assignment: { label: "Assignment", emoji: "📋" },
  past_paper: { label: "Past paper", emoji: "🧾" },
};

export const HABIT_ICONS = ["📚", "💻", "🧮", "📖", "✍️", "🧠", "🏃", "💧", "😴", "🎯", "🔁", "🧩"];

export const SEMESTERS = [
  "1st semester",
  "2nd semester",
  "3rd semester",
  "4th semester",
  "5th semester",
  "6th semester",
  "7th semester",
  "8th semester",
  "Other",
];

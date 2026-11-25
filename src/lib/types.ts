export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  university: string;
  department: string;
  semester: string;
  phone: string;
  address: string;
  blood_group: string;
  auth_provider: string;
  email_verified: boolean;
  updated_at: string;
  xp: number;
  streak: number;
  longest_streak: number;
  last_study_date: string | null;
  theme: "dark" | "light" | "system";
  notify_prefs: { reminders: boolean; group_activity: boolean; dares: boolean };
  privacy_prefs: { show_progress_to_groups: boolean };
  approved?: boolean;
  is_admin?: boolean;
  role?: "user" | "admin";
  suspended?: boolean;
  email?: string | null;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  university: string;
  department: string;
  semester: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
  max_warnings: number;
  created_at: string;
}

export interface Membership {
  role: "owner" | "admin" | "member";
  warnings: number;
  group: Group;
}

export interface Course {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  code: string;
  instructor: string;
  description: string;
  semester: string;
  color: string;
  created_at: string;
}

export interface Topic {
  id: string;
  course_id: string;
  parent_id: string | null;
  title: string;
  deadline: string | null;
  assigned_to: string | null;
  position: number;
  created_at: string;
}

export type TopicStatus = "not_started" | "in_progress" | "completed";

export interface TopicProgress {
  topic_id: string;
  user_id: string;
  status: TopicStatus;
  completed_at: string | null;
}

export interface StudySession {
  id: string;
  user_id: string;
  course_id: string | null;
  mode: "stopwatch" | "countdown" | "pomodoro" | "custom" | "focus" | "break";
  planned_seconds: number;
  duration_seconds: number;
  completed: boolean;
  distractions: number;
  note: string;
  created_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  group_id: string;
  title: string;
  target_minutes: number;
  starts_at: string;
  due_at: string;
  status: "active" | "completed" | "failed";
  resolved_at: string | null;
}

export interface Dare {
  id: string;
  user_id: string;
  group_id: string;
  commitment_id: string;
  dare_text: string;
  missed_minutes: number;
  status: "pending" | "done" | "shamed";
  proof_note: string;
  created_at: string;
  resolved_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "active" | "completed";
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  archived: boolean;
  created_at: string;
}

export interface HabitLog {
  habit_id: string;
  log_date: string;
}

export type EventKind = "class" | "exam" | "assignment" | "study" | "reminder" | "group";

export interface CalEvent {
  id: string;
  user_id: string;
  group_id: string | null;
  course_id: string | null;
  title: string;
  kind: EventKind;
  description: string;
  starts_at: string;
  ends_at: string | null;
  remind_minutes: number;
}

export type ResourceKind =
  | "pdf"
  | "note"
  | "doc"
  | "image"
  | "audio"
  | "video"
  | "link"
  | "assignment"
  | "past_paper";

export interface Resource {
  id: string;
  owner_id: string;
  group_id: string | null;
  course_id: string | null;
  topic_id: string | null;
  title: string;
  kind: ResourceKind;
  description: string;
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Activity {
  id: string;
  group_id: string;
  user_id: string;
  type: string;
  message: string;
  created_at: string;
  profile?: Pick<Profile, "username" | "full_name" | "avatar_url">;
}

export interface LeaderRow {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  warnings: number;
  role: string;
  week_minutes: number;
}

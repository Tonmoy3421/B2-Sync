"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarClock, Check, ChevronDown, CircleDashed, ExternalLink, FolderOpen, GraduationCap, Link2, ListPlus, Loader, Pencil, Plus, Trash2, UserCircle2, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, Modal, PageHeader, PageSkeleton, Progress, Select, Textarea } from "@/components/ui";
import { CourseFormModal } from "@/components/course-form";
import { useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { afterAction, invalidate } from "@/lib/actions";
import { cn, dhakaDate, errMsg, formatDate } from "@/lib/utils";
import type { Course, LeaderRow, Resource, Topic, TopicStatus } from "@/lib/types";

const STATUS_META: Record<TopicStatus, { label: string; icon: typeof Check; tone: string }> = {
  not_started: { label: "Not started", icon: CircleDashed, tone: "text-muted" },
  in_progress: { label: "In progress", icon: Loader, tone: "text-warn" },
  completed: { label: "Completed", icon: Check, tone: "text-success" },
};
const STATUSES: TopicStatus[] = ["not_started", "in_progress", "completed"];

type Note = { topic_id: string; user_id: string; body: string; is_shared: boolean };

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const meId = profile?.id ?? "";

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [topicModal, setTopicModal] = useState<{ parent: Topic | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: course, isLoading } = useSWR(`course:${id}`, async () => {
    const { data } = await supabaseBrowser().from("courses").select("*").eq("id", id).maybeSingle();
    return data as Course | null;
  });

  const { data: topics } = useSWR(`course-topics:${id}`, async () => {
    const { data } = await supabaseBrowser().from("topics").select("*").eq("course_id", id).order("position").order("created_at");
    return (data ?? []) as Topic[];
  });

  const topicIds = useMemo(() => (topics ?? []).map((t) => t.id), [topics]);

  const { data: progress, mutate: mutateProgress } = useSWR(topicIds.length ? `course-progress:${id}:${topicIds.length}` : null, async () => {
    const { data } = await supabaseBrowser().from("topic_progress").select("topic_id, user_id, status").in("topic_id", topicIds);
    const map: Record<string, Record<string, TopicStatus>> = {};
    (data ?? []).forEach((r: { topic_id: string; user_id: string; status: TopicStatus }) => {
      (map[r.topic_id] ??= {})[r.user_id] = r.status;
    });
    return map;
  });

  const { data: members } = useSWR(course?.group_id ? `leaderboard:${course.group_id}` : null, async () => {
    const { data } = await supabaseBrowser().rpc("group_leaderboard", { p_group: course!.group_id });
    return (data ?? []) as LeaderRow[];
  });

  const { data: notes } = useSWR(topicIds.length ? `course-notes:${id}:${topicIds.length}` : null, async () => {
    const { data } = await supabaseBrowser().from("topic_notes").select("*").in("topic_id", topicIds);
    return (data ?? []) as Note[];
  });

  const { data: resources } = useSWR(`course-resources:${id}`, async () => {
    const { data } = await supabaseBrowser().from("resources").select("*").eq("course_id", id).order("created_at", { ascending: false });
    return (data ?? []) as Resource[];
  });

  const roots = useMemo(() => (topics ?? []).filter((t) => !t.parent_id), [topics]);
  const childrenOf = (tid: string) => (topics ?? []).filter((t) => t.parent_id === tid);
  const myStatus = (tid: string): TopicStatus => progress?.[tid]?.[meId] ?? "not_started";

  const total = topics?.length ?? 0;
  const done = (topics ?? []).filter((t) => myStatus(t.id) === "completed").length;
  const inProgress = (topics ?? []).filter((t) => myStatus(t.id) === "in_progress").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const groupAvg = useMemo(() => {
    if (!members?.length || !total || !progress) return null;
    const per = members.map((m) => (topics ?? []).filter((t) => progress[t.id]?.[m.user_id] === "completed").length / total);
    return Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 100);
  }, [members, total, progress, topics]);

  async function setStatus(topic: Topic, status: TopicStatus) {
    if (myStatus(topic.id) === status) return;
    // optimistic UI
    mutateProgress((old) => ({ ...(old ?? {}), [topic.id]: { ...(old?.[topic.id] ?? {}), [meId]: status } }), { revalidate: false });
    const { error } = await supabaseBrowser().rpc("set_topic_status", { p_topic: topic.id, p_status: status });
    if (error) {
      toast.error(errMsg(error));
      void mutateProgress();
      return;
    }
    if (status === "completed") toast.success(`"${topic.title}" completed 🎯`);
    void mutateProgress();
    void afterAction("group-progress", "courses", "course-progress", "dashboard", "analytics");
  }

  async function deleteTopic(t: Topic) {
    const { error } = await supabaseBrowser().from("topics").delete().eq("id", t.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Topic deleted");
    await invalidate("course-topics", "course-progress", "course-notes", "course-resources", "courses", "dashboard", "analytics", "group-progress");
  }

  async function deleteCourse() {
    const { error } = await supabaseBrowser().from("courses").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Course deleted");
    await invalidate("courses", "course", "course-topics", "course-progress", "course-notes", "course-resources", "dashboard", "analytics", "profile-stats", "group-progress");
    router.replace("/courses");
  }

  if (isLoading) return <PageSkeleton />;
  if (!course) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Course not found"
        description="It may have been deleted or you no longer have access."
        action={
          <Link href="/courses">
            <Button>Back to courses</Button>
          </Link>
        }
      />
    );
  }

  const isOwner = course.owner_id === meId;
  const today = dhakaDate();

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title={course.name}
        description={[course.code, course.instructor, course.semester].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/vault?course=${course.id}`}>
              <Button variant="secondary" icon={FolderOpen}>
                Vault
              </Button>
            </Link>
            <Button variant="secondary" icon={ListPlus} onClick={() => setTopicModal({ parent: null })}>
              Add topic
            </Button>
            {isOwner && (
              <>
                <Button variant="ghost" size="icon" aria-label="Edit course" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete course" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </>
            )}
          </>
        }
      />

      {course.description && <p className="-mt-3 mb-5 max-w-3xl text-sm text-muted">{course.description}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Your syllabus progress</p>
              <p className="text-4xl font-extrabold">{pct}%</p>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge tone="success">{done} done</Badge>
              <Badge tone="warn">{inProgress} in progress</Badge>
              <Badge tone="muted">{total - done - inProgress} to go</Badge>
            </div>
          </div>
          <Progress value={pct} color={course.color} height="h-3" />
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{course.group_id ? "Group average" : "Sharing"}</p>
          {course.group_id ? (
            <>
              <p className="text-4xl font-extrabold">{groupAvg ?? 0}%</p>
              <div className="mt-3 flex -space-x-2">
                {(members ?? []).slice(0, 8).map((m) => (
                  <Avatar key={m.user_id} name={m.full_name || m.username} src={m.avatar_url} size={28} className="ring-2 ring-surface" />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">This course is private. Edit it to share with a study group.</p>
          )}
        </Card>
      </div>

      {roots.length === 0 ? (
        <EmptyState icon={ListPlus} title="No topics yet" description="Break this course into chapters and topics. Tick them off as you study to earn XP." action={<Button icon={Plus} onClick={() => setTopicModal({ parent: null })}>Add the first topic</Button>} />
      ) : (
        <div className="space-y-3">
          {roots.map((t) => {
            const kids = childrenOf(t.id);
            const kidsDone = kids.filter((k) => myStatus(k.id) === "completed").length;
            return (
              <div key={t.id} className="space-y-2">
                <TopicRow
                  topic={t}
                  today={today}
                  expanded={expanded === t.id}
                  onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
                  status={myStatus(t.id)}
                  setStatus={(s) => setStatus(t, s)}
                  statusMap={progress?.[t.id] ?? {}}
                  members={members ?? []}
                  meId={meId}
                  course={course}
                  notes={(notes ?? []).filter((n) => n.topic_id === t.id)}
                  resources={(resources ?? []).filter((r) => r.topic_id === t.id)}
                  subtitle={kids.length ? `${kidsDone}/${kids.length} subtopics` : undefined}
                  subPct={kids.length ? Math.round((kidsDone / kids.length) * 100) : undefined}
                  onAddChild={() => setTopicModal({ parent: t })}
                  onDelete={() => deleteTopic(t)}
                />
                {kids.length > 0 && (
                  <div className="ml-5 space-y-2 border-l-2 border-line/15 pl-4 sm:ml-8">
                    {kids.map((k) => (
                      <TopicRow
                        key={k.id}
                        topic={k}
                        compact
                        today={today}
                        expanded={expanded === k.id}
                        onToggle={() => setExpanded(expanded === k.id ? null : k.id)}
                        status={myStatus(k.id)}
                        setStatus={(s) => setStatus(k, s)}
                        statusMap={progress?.[k.id] ?? {}}
                        members={members ?? []}
                        meId={meId}
                        course={course}
                        notes={(notes ?? []).filter((n) => n.topic_id === k.id)}
                        resources={(resources ?? []).filter((r) => r.topic_id === k.id)}
                        onDelete={() => deleteTopic(k)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TopicModal open={!!topicModal} parent={topicModal?.parent ?? null} course={course} members={members ?? []} onClose={() => setTopicModal(null)} nextPosition={total} />
      <CourseFormModal open={editOpen} onClose={() => setEditOpen(false)} course={course} />
      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} danger title="Delete this course?" description="All topics, progress and notes in this course will be deleted for everyone who shares it." confirmLabel="Delete course" onConfirm={deleteCourse} />
    </>
  );
}

/* ----------------------------- Topic row ----------------------------- */
function TopicRow({
  topic,
  compact,
  today,
  expanded,
  onToggle,
  status,
  setStatus,
  statusMap,
  members,
  meId,
  course,
  notes,
  resources,
  subtitle,
  subPct,
  onAddChild,
  onDelete,
}: {
  topic: Topic;
  compact?: boolean;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  status: TopicStatus;
  setStatus: (s: TopicStatus) => void;
  statusMap: Record<string, TopicStatus>;
  members: LeaderRow[];
  meId: string;
  course: Course;
  notes: Note[];
  resources: Resource[];
  subtitle?: string;
  subPct?: number;
  onAddChild?: () => void;
  onDelete: () => void;
}) {
  const overdue = topic.deadline && topic.deadline < today && status !== "completed";
  const assignee = members.find((m) => m.user_id === topic.assigned_to);
  const meta = STATUS_META[status];

  return (
    <Card className={cn("p-0 transition-colors", status === "completed" && "border-success/30")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button onClick={onToggle} aria-expanded={expanded} aria-label="Toggle details" className="rounded-lg p-1 text-muted transition hover:bg-brand/10 hover:text-fg">
          <ChevronDown className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", compact ? "text-sm" : "text-base", status === "completed" && "text-muted line-through decoration-success/60")}>{topic.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {topic.deadline && (
              <Badge tone={overdue ? "danger" : "muted"}>
                <CalendarClock className="h-3 w-3" /> {formatDate(topic.deadline)}
                {overdue && " · overdue"}
              </Badge>
            )}
            {assignee && (
              <Badge tone="violet">
                <UserCircle2 className="h-3 w-3" /> @{assignee.username}
              </Badge>
            )}
            {subtitle && <span>{subtitle}</span>}
            {resources.length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {resources.length}
              </span>
            )}
          </div>
          {subPct !== undefined && <Progress value={subPct} color={course.color} height="h-1" className="mt-2 max-w-xs" />}
        </div>

        {course.group_id && members.length > 1 && (
          <div className="hidden -space-x-1.5 sm:flex" aria-label="Group progress on this topic">
            {members.slice(0, 6).map((m) => {
              const s = statusMap[m.user_id] ?? "not_started";
              return (
                <span key={m.user_id} title={`@${m.username}: ${STATUS_META[s].label}`} className={cn("rounded-full ring-2 ring-surface", s === "completed" ? "opacity-100" : s === "in_progress" ? "opacity-70" : "opacity-30 grayscale")}>
                  <Avatar name={m.full_name || m.username} src={m.avatar_url} size={24} />
                </span>
              );
            })}
          </div>
        )}

        <div className="glass flex rounded-xl p-0.5" role="radiogroup" aria-label={`Status of ${topic.title}`}>
          {STATUSES.map((s) => {
            const M = STATUS_META[s];
            const active = status === s;
            return (
              <button
                key={s}
                role="radio"
                aria-checked={active}
                title={M.label}
                onClick={() => setStatus(s)}
                className={cn(
                  "relative flex h-8 w-9 items-center justify-center rounded-lg transition-colors",
                  active ? (s === "completed" ? "bg-success text-white" : s === "in_progress" ? "bg-warn text-white" : "bg-line/30 text-fg") : "text-muted hover:text-fg"
                )}
              >
                <M.icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <span className={cn("hidden w-24 text-xs font-semibold md:block", meta.tone)}>{meta.label}</span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <TopicDetails topic={topic} meId={meId} course={course} notes={notes} resources={resources} members={members} onAddChild={onAddChild} onDelete={onDelete} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function TopicDetails({
  topic,
  meId,
  course,
  notes,
  resources,
  members,
  onAddChild,
  onDelete,
}: {
  topic: Topic;
  meId: string;
  course: Course;
  notes: Note[];
  resources: Resource[];
  members: LeaderRow[];
  onAddChild?: () => void;
  onDelete: () => void;
}) {
  const mine = notes.find((n) => n.user_id === meId);
  const shared = notes.filter((n) => n.user_id !== meId && n.is_shared);
  const [body, setBody] = useState(mine?.body ?? "");
  const [isShared, setIsShared] = useState(mine?.is_shared ?? false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const first = useRef(true);

  // debounce-save notes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved("saving");
    const t = window.setTimeout(async () => {
      const { error } = await supabaseBrowser().from("topic_notes").upsert({ topic_id: topic.id, user_id: meId, body, is_shared: isShared, updated_at: new Date().toISOString() });
      if (error) {
        toast.error(errMsg(error));
        setSaved("idle");
      } else {
        setSaved("saved");
        void invalidate("course-notes");
      }
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, isShared]);

  async function addLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\/.+\..+/i.test(url)) return toast.error("Enter a full link starting with http:// or https://");
    const { error } = await supabaseBrowser().from("resources").insert({
      owner_id: meId,
      group_id: course.group_id,
      course_id: course.id,
      topic_id: topic.id,
      title: linkTitle.trim() || url,
      kind: /youtu|vimeo/i.test(url) ? "video" : "link",
      url,
    });
    if (error) return toast.error(errMsg(error));
    toast.success("Resource added");
    setLinkTitle("");
    setLinkUrl("");
    await invalidate("course-resources", "vault");
    void afterAction();
  }

  const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.username ?? "member";

  return (
    <div className="grid gap-5 border-t border-line/10 p-4 lg:grid-cols-2">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label !mb-0">My notes</span>
          <span className="text-xs text-muted">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved ✓" : ""}</span>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Key ideas, formulas, things to revisit…" maxLength={5000} aria-label="My notes" />
        {course.group_id && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
            Share these notes with the group
            <Users className="h-3.5 w-3.5" />
          </label>
        )}
        {shared.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="label">Shared by friends</span>
            {shared.map((n) => (
              <div key={n.user_id} className="rounded-xl bg-violet/10 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-violet">@{memberName(n.user_id)}</p>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="label">References &amp; resources</span>
        {resources.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No links yet. Add a video, article or documentation page.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {resources.map((r) => (
              <li key={r.id}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-line/10 px-3 py-2 text-sm transition hover:bg-brand/10 hover:text-brand">
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{r.title}</span>
                  </a>
                ) : (
                  <Link href={`/vault?course=${course.id}`} className="flex items-center gap-2 rounded-xl bg-line/10 px-3 py-2 text-sm">
                    <FolderOpen className="h-4 w-4" /> {r.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-5">
          <input className="field sm:col-span-2" placeholder="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} aria-label="Resource title" maxLength={160} />
          <input className="field sm:col-span-3" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} aria-label="Resource link" />
        </div>
        <Button size="sm" variant="secondary" icon={Plus} className="mt-2" onClick={addLink}>
          Add link
        </Button>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line/10 pt-4">
          {onAddChild && (
            <Button size="sm" variant="ghost" icon={ListPlus} onClick={onAddChild}>
              Add subtopic
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setConfirmDel(true)}>
            Delete topic
          </Button>
        </div>
      </div>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} danger title={`Delete "${topic.title}"?`} description="Its subtopics and everyone's progress on it will be deleted." confirmLabel="Delete" onConfirm={onDelete} />
    </div>
  );
}

/* ----------------------------- Add topic ----------------------------- */
function TopicModal({ open, parent, course, members, onClose, nextPosition }: { open: boolean; parent: Topic | null; course: Course; members: LeaderRow[]; onClose: () => void; nextPosition: number }) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDeadline("");
      setAssignee("");
    }
  }, [open]);

  async function save() {
    // allow pasting several topics, one per line
    const lines = title.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return toast.error("Enter a topic title");
    setBusy(true);
    const rows = lines.map((l, i) => ({
      course_id: course.id,
      parent_id: parent?.id ?? null,
      title: l.slice(0, 200),
      deadline: deadline || null,
      assigned_to: assignee || null,
      position: nextPosition + i,
    }));
    const { error } = await supabaseBrowser().from("topics").insert(rows);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(rows.length > 1 ? `${rows.length} topics added` : "Topic added");
    await invalidate("course-topics", "courses", "group-progress");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={parent ? `Add subtopic to “${parent.title}”` : "Add topics"} description="Tip: paste a whole list — one topic per line.">
      <div className="space-y-4">
        <Textarea label="Topic title(s)" value={title} onChange={(e) => setTitle(e.target.value)} rows={4} placeholder={"Arrays & linked lists\nStacks & queues\nTrees"} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Deadline (optional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {course.group_id && (
            <Select label="Assign to" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  @{m.username}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

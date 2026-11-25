"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Plus, Search, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Progress, Select, Skeleton } from "@/components/ui";
import { CourseFormModal } from "@/components/course-form";
import { useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const { memberships } = useGroups();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("all");

  const { data, isLoading } = useSWR(profile ? `courses:${profile.id}` : null, async () => {
    const sb = supabaseBrowser();
    const { data: courses } = await sb.from("courses").select("*").order("created_at", { ascending: false });
    const list = (courses ?? []) as Course[];
    if (!list.length) return { list, topics: {} as Record<string, number>, done: {} as Record<string, number> };
    const { data: topics } = await sb.from("topics").select("id, course_id").in("course_id", list.map((c) => c.id));
    const topicCourse: Record<string, string> = {};
    const totals: Record<string, number> = {};
    (topics ?? []).forEach((t: { id: string; course_id: string }) => {
      topicCourse[t.id] = t.course_id;
      totals[t.course_id] = (totals[t.course_id] ?? 0) + 1;
    });
    const ids = Object.keys(topicCourse);
    const done: Record<string, number> = {};
    if (ids.length) {
      const { data: prog } = await sb.from("topic_progress").select("topic_id").eq("user_id", profile!.id).eq("status", "completed").in("topic_id", ids);
      (prog ?? []).forEach((p: { topic_id: string }) => {
        const c = topicCourse[p.topic_id];
        done[c] = (done[c] ?? 0) + 1;
      });
    }
    return { list, topics: totals, done };
  });

  const list = data?.list ?? [];
  const semesters = useMemo(() => Array.from(new Set(list.map((c) => c.semester || "Other"))), [list]);
  const filtered = useMemo(
    () =>
      list.filter((c) => (sem === "all" || (c.semester || "Other") === sem) && `${c.name} ${c.code} ${c.instructor}`.toLowerCase().includes(q.toLowerCase())),
    [list, q, sem]
  );
  const grouped = useMemo(() => {
    const m: Record<string, Course[]> = {};
    filtered.forEach((c) => (m[c.semester || "Other"] ??= []).push(c));
    return m;
  }, [filtered]);

  const groupName = (id: string | null) => memberships.find((m) => m.group.id === id)?.group.name;

  return (
    <>
      <PageHeader icon={BookOpen} title="Courses" description="Every course has its own syllabus, topics and progress." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New course</Button>} />

      {list.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="field pl-9" placeholder="Search by name, code or instructor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" />
          </div>
          <div className="sm:w-56">
            <Select aria-label="Filter by semester" value={sem} onChange={(e) => setSem(e.target.value)}>
              <option value="all">All semesters</option>
              {semesters.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" description="Add your first course, then break it into topics to track your progress." action={<Button icon={Plus} onClick={() => setOpen(true)}>Add a course</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" description="Try a different search or semester filter." />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([semester, courses]) => (
            <section key={semester}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">{semester}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((c, i) => {
                  const total = data?.topics?.[c.id] ?? 0;
                  const done = data?.done?.[c.id] ?? 0;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={`/courses/${c.id}`}>
                        <Card hover className="relative h-full overflow-hidden">
                          <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.color }} />
                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-lg font-bold">{c.name}</h3>
                                <p className="truncate text-sm text-muted">{[c.code, c.instructor].filter(Boolean).join(" · ") || "No details yet"}</p>
                              </div>
                              {c.group_id && (
                                <Badge tone="violet">
                                  <Users className="h-3 w-3" />
                                  {groupName(c.group_id) ?? "Group"}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-5">
                              <div className="mb-1.5 flex justify-between text-xs text-muted">
                                <span>
                                  {done}/{total} topics
                                </span>
                                <span className="font-semibold text-fg">{pct}%</span>
                              </div>
                              <Progress value={pct} color={c.color} />
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <CourseFormModal open={open} onClose={() => setOpen(false)} onSaved={(id) => id && router.push(`/courses/${id}`)} />
    </>
  );
}

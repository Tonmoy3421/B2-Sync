"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { AIUB_CSE_COURSES, AIUB_CURRICULUM_URL } from "@/lib/aiub";
import { COURSE_COLORS, SEMESTERS } from "@/lib/constants";
import { useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { invalidate } from "@/lib/actions";
import { cn, errMsg } from "@/lib/utils";
import type { Course } from "@/lib/types";

const AIUB_GROUPS = AIUB_CSE_COURSES.reduce<Record<string, typeof AIUB_CSE_COURSES>>((groups, c) => {
  (groups[c.area] ??= []).push(c);
  return groups;
}, {});

export function CourseFormModal({
  open,
  onClose,
  course,
  defaultGroupId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  course?: Course | null;
  defaultGroupId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const { profile } = useProfile();
  const { memberships } = useGroups();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [description, setDescription] = useState("");
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [groupId, setGroupId] = useState("");
  const [preset, setPreset] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreset("");
    setName(course?.name ?? "");
    setCode(course?.code ?? "");
    setInstructor(course?.instructor ?? "");
    setDescription(course?.description ?? "");
    setSemester(course?.semester || profile?.semester || SEMESTERS[0]);
    setColor(course?.color ?? COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)]);
    setGroupId(course ? course.group_id ?? "" : defaultGroupId ?? "");
  }, [open, course, defaultGroupId, profile?.semester]);

  function applyPreset(code: string) {
    setPreset(code);
    const c = AIUB_CSE_COURSES.find((x) => x.code === code);
    if (!c) return;
    setName(c.name);
    setCode(c.code);
    setSemester(c.semester);
    setDescription(`${c.area} · ${c.credits} credits · AIUB BSc in CSE curriculum`);
  }

  async function save() {
    if (name.trim().length < 2) return toast.error("Course name is required");
    if (!profile) return;
    setBusy(true);
    const sb = supabaseBrowser();
    const payload = {
      name: name.trim(),
      code: code.trim(),
      instructor: instructor.trim(),
      description: description.trim(),
      semester,
      color,
      group_id: groupId || null,
    };
    let id = course?.id ?? "";
    let error;
    if (course) {
      ({ error } = await sb.from("courses").update(payload).eq("id", course.id));
    } else {
      const res = await sb.from("courses").insert({ ...payload, owner_id: profile.id }).select("id").single();
      error = res.error;
      id = res.data?.id ?? "";
    }
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(course ? "Course updated" : "Course created");
    await invalidate("courses", "course", "group-progress");
    onSaved?.(id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={course ? "Edit course" : "New course"} description="Courses hold your syllabus topics. Share with a group to study them together.">
      <div className="space-y-4">
        {!course && (
          <div className="rounded-xl border border-brand/25 bg-brand/5 p-3">
            <label className="label mb-1.5" htmlFor="aiub-preset">
              Pre-fill from AIUB BSc CSE curriculum
            </label>
            <select id="aiub-preset" className="field" value={preset} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">Choose a course…</option>
              {Object.entries(AIUB_GROUPS).map(([area, courses]) => (
                <optgroup key={area} label={area}>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              Optional. Edit any field below after picking. Source:{" "}
              <a href={AIUB_CURRICULUM_URL} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                AIUB CSE curriculum
              </a>
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input label="Course name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures" maxLength={120} autoFocus />
          </div>
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CSE 201" maxLength={20} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Instructor" value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Dr. Rahman" maxLength={80} />
          <Select label="Semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
            {SEMESTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this course about?" maxLength={400} />
        <Select label="Share with group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Just me (private)</option>
          {memberships.map((m) => (
            <option key={m.group.id} value={m.group.id}>
              {m.group.name}
            </option>
          ))}
        </Select>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110", color === c && "ring-2 ring-fg")} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {course ? "Save changes" : "Create course"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

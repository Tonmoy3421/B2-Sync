"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, Plus, Search, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { useCourses, useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { RESOURCE_KINDS } from "@/lib/constants";
import { afterAction, invalidate } from "@/lib/actions";
import { errMsg, timeAgo } from "@/lib/utils";
import type { Resource, ResourceKind } from "@/lib/types";

const MAX_BYTES = 20 * 1024 * 1024;
const LINK_KINDS: ResourceKind[] = ["link", "video"];
const kb = (n: number | null) => (n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function guessKind(file: File): ResourceKind {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "doc";
}
const safeUrl = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
};

export default function VaultPage() {
  const { profile } = useProfile();
  const { courses } = useCourses();
  const { memberships } = useGroups();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fKind, setFKind] = useState("");
  const [del, setDel] = useState<Resource | null>(null);

  const { data, mutate, isLoading } = useSWR(profile ? `resources:${profile.id}` : null, async () => {
    const { data } = await supabaseBrowser().from("resources").select("*, owner:profiles!resources_owner_id_fkey(username)").order("created_at", { ascending: false });
    return (data ?? []) as unknown as (Resource & { owner: { username: string } | null })[];
  });

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!t || `${r.title} ${r.description}`.toLowerCase().includes(t)) &&
        (!fCourse || r.course_id === fCourse) &&
        (!fKind || r.kind === fKind) &&
        (!fGroup || (fGroup === "mine" ? !r.group_id : r.group_id === fGroup))
    );
  }, [data, q, fCourse, fGroup, fKind]);

  async function openIt(r: Resource) {
    if (r.url) {
      if (!safeUrl(r.url)) return toast.error("This link looks unsafe, so it was blocked");
      window.open(r.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!r.storage_path) return;
    const { data: s, error } = await supabaseBrowser().storage.from("vault").createSignedUrl(r.storage_path, 120);
    if (error || !s) return toast.error("Couldn't open the file — you may not have access");
    window.open(s.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(r: Resource) {
    const sb = supabaseBrowser();
    const { error } = await sb.from("resources").delete().eq("id", r.id);
    if (error) return toast.error(errMsg(error));
    if (r.storage_path && r.owner_id === profile?.id) await sb.storage.from("vault").remove([r.storage_path]);
    toast.success("Removed from the vault");
    await mutate();
  }

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;
  const groupName = (id: string | null) => memberships.find((m) => m.group.id === id)?.group.name;

  return (
    <>
      <PageHeader icon={FolderOpen} title="Learning Vault" description="Notes, PDFs, links and past papers — private, or shared with your group." actions={<Button icon={Plus} onClick={() => setOpen(true)}>Add resource</Button>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input aria-label="Search resources" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the vault…" className="field pl-10" />
        </div>
        <Select aria-label="Course" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Group" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
          <option value="">All groups</option>
          <option value="mine">Private (just me)</option>
          {memberships.map((m) => <option key={m.group.id} value={m.group.id}>{m.group.name}</option>)}
        </Select>
        <Select aria-label="Type" value={fKind} onChange={(e) => setFKind(e.target.value)}>
          <option value="">All types</option>
          {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((k) => <option key={k} value={k}>{RESOURCE_KINDS[k].emoji} {RESOURCE_KINDS[k].label}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={FolderOpen} title={data?.length ? "Nothing matches your filters" : "Your vault is empty"} description={data?.length ? "Try clearing a filter." : "Upload a PDF, paste a useful link, or share past papers with your group."} action={!data?.length ? <Button icon={Upload} onClick={() => setOpen(true)}>Add your first resource</Button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const k = RESOURCE_KINDS[r.kind];
            const canDelete = r.owner_id === profile?.id || memberships.some((m) => m.group.id === r.group_id && m.role !== "member");
            return (
              <Card key={r.id} hover className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-2xl">{k.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold" title={r.title}>{r.title}</h3>
                    <p className="text-xs text-muted">@{r.owner?.username ?? "you"} · {timeAgo(r.created_at)} {r.size_bytes ? `· ${kb(r.size_bytes)}` : ""}</p>
                  </div>
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="brand">{k.label}</Badge>
                  {courseName(r.course_id) && <Badge tone="violet">{courseName(r.course_id)}</Badge>}
                  <Badge tone={r.group_id ? "success" : "muted"}>{r.group_id ? groupName(r.group_id) ?? "Group" : "Private"}</Badge>
                </div>
                <div className="mt-auto flex justify-between gap-2 pt-4">
                  <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => openIt(r)}>Open</Button>
                  {canDelete && <Button size="sm" variant="ghost" aria-label="Delete resource" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddModal open={open} onClose={() => setOpen(false)} onSaved={() => { void mutate(); void invalidate("course-resources", "resources"); void afterAction("activities"); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this resource?" description={del?.group_id ? "It will disappear for everyone in the group." : "This can't be undone."} confirmLabel="Delete" danger onConfirm={() => del && remove(del)} />
    </>
  );
}

function AddModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { profile } = useProfile();
  const { courses } = useCourses();
  const { memberships } = useGroups();
  const [kind, setKind] = useState<ResourceKind>("pdf");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isLink = LINK_KINDS.includes(kind);

  function reset() {
    setTitle(""); setDesc(""); setUrl(""); setFile(null); setCourseId(""); setGroupId(""); setKind("pdf");
  }

  function pick(f: File | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) return toast.error("Files can be up to 20 MB");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    setKind((k) => (LINK_KINDS.includes(k) || k === "pdf" || k === "doc" || k === "image" || k === "audio" ? guessKind(f) : k));
  }

  async function save() {
    if (!profile) return;
    if (!title.trim()) return toast.error("Give it a title");
    if (isLink) {
      if (!safeUrl(url.trim())) return toast.error("Enter a valid link starting with https://");
    } else if (!file) return toast.error("Choose a file to upload");

    setBusy(true);
    const sb = supabaseBrowser();
    let storage_path: string | null = null;
    let size_bytes: number | null = null;
    if (!isLink && file) {
      const clean = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
      storage_path = `${profile.id}/${crypto.randomUUID()}-${clean}`;
      const up = await sb.storage.from("vault").upload(storage_path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) {
        setBusy(false);
        return toast.error(errMsg(up.error));
      }
      size_bytes = file.size;
    }
    const { error } = await sb.from("resources").insert({
      owner_id: profile.id,
      group_id: groupId || null,
      course_id: courseId || null,
      title: title.trim(),
      kind,
      description: desc.trim(),
      url: isLink ? url.trim() : null,
      storage_path,
      size_bytes,
    });
    if (error && storage_path) await sb.storage.from("vault").remove([storage_path]);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(groupId ? "Shared with your group 🤝" : "Saved to your vault");
    reset();
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to the vault" size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
            {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((k) => <option key={k} value={k}>{RESOURCE_KINDS[k].emoji} {RESOURCE_KINDS[k].label}</option>)}
          </Select>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </div>

        {isLink ? (
          <Input label="Link" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        ) : (
          <div>
            <span className="label">File (max 20 MB)</span>
            <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }} className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line/25 px-4 py-7 text-sm text-muted transition hover:border-brand/60 hover:text-brand">
              <Upload className="h-6 w-6" />
              {file ? <span className="font-semibold text-fg">{file.name} · {kb(file.size)}</span> : "Click or drop a file here"}
            </button>
            <input ref={input} type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,image/*,audio/*,video/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Course (optional)" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">No course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Who can see it?" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Only me</option>
            {memberships.map((m) => <option key={m.group.id} value={m.group.id}>Group: {m.group.name}</option>)}
          </Select>
        </div>
        <Textarea label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} icon={Upload} onClick={save}>{isLink ? "Save link" : "Upload"}</Button>
        </div>
      </div>
    </Modal>
  );
}

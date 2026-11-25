"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { BookOpen, Camera, Clock, Droplet, Flame, MapPin, Pencil, Phone, Trophy, Users, Zap } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, Input, Modal, PageHeader, PageSkeleton, Progress, Select, StatCard } from "@/components/ui";
import { useCourses, useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACHIEVEMENTS, SEMESTERS } from "@/lib/constants";
import { levelProgress, rankForLevel } from "@/lib/xp";
import { cn, errMsg, hoursFromSeconds } from "@/lib/utils";
import { User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const { user, profile, mutate } = useProfile();
  const { memberships } = useGroups();
  const { courses } = useCourses();
  const [edit, setEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useSWR(profile ? `profile-stats:${profile.id}` : null, async () => {
    const sb = supabaseBrowser();
    const [s, a] = await Promise.all([
      sb.from("study_sessions").select("duration_seconds").neq("mode", "break"),
      sb.from("user_achievements").select("key").eq("user_id", profile!.id),
    ]);
    const rows = (s.data ?? []) as { duration_seconds: number }[];
    return { seconds: rows.reduce((a, r) => a + r.duration_seconds, 0), sessions: rows.length, badges: new Set(((a.data ?? []) as { key: string }[]).map((r) => r.key)) };
  });

  async function uploadAvatar(f: File | null) {
    if (!f || !profile) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return toast.error("Use a PNG, JPG or WebP image");
    if (f.size > 2 * 1024 * 1024) return toast.error("Image must be under 2 MB");
    setUploading(true);
    const sb = supabaseBrowser();
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const up = await sb.storage.from("avatars").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) {
      setUploading(false);
      return toast.error(errMsg(up.error));
    }
    const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    setUploading(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Profile picture updated 📸");
    await mutate();
  }

  if (!profile) return <PageSkeleton />;
  const lp = levelProgress(profile.xp);

  return (
    <>
      <PageHeader icon={UserIcon} title="Profile" actions={<Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Edit profile</Button>} />

      <Card className="relative mb-6 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar name={profile.full_name || profile.username} src={profile.avatar_url} size={96} />
            <button aria-label="Change profile picture" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-110 disabled:opacity-60">
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadAvatar(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">{profile.full_name || profile.username}</h2>
            <p className="text-sm font-semibold text-brand">@{profile.username}</p>
            <p className="mt-1 text-sm text-muted">{[profile.department, profile.university, profile.semester].filter(Boolean).join(" · ") || "Add your university details"}</p>
            <p className="text-xs text-muted">{user?.email}</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">Level {lp.level} · {rankForLevel(lp.level)}</span>
              <span className="text-muted">{profile.xp} XP</span>
            </div>
            <Progress value={lp.pct} className="mt-2" height="h-2.5" />
            <p className="mt-1 text-xs text-muted">{lp.toNext} XP to level {lp.level + 1}</p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Hours studied" value={hoursFromSeconds(data?.seconds ?? 0, 1)} decimals={1} tone="brand" hint={`${data?.sessions ?? 0} sessions`} />
        <StatCard icon={Flame} label="Streak" value={profile.streak} suffix="days" tone="warn" hint={`Longest: ${profile.longest_streak}`} />
        <StatCard icon={Users} label="Study groups" value={memberships.length} tone="violet" />
        <StatCard icon={BookOpen} label="Courses" value={courses.length} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={Trophy} action={<Badge tone="brand">{data?.badges.size ?? 0}/{ACHIEVEMENTS.length}</Badge>}>Achievements</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const got = data?.badges.has(a.key);
              return (
                <div key={a.key} className={cn("flex items-center gap-3 rounded-xl bg-line/5 p-3", !got && "opacity-50 grayscale")}>
                  <span className="text-2xl">{got ? a.emoji : "🔒"}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{a.title}</p>
                    <p className="truncate text-xs text-muted">{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle icon={Phone}>Personal details</CardTitle>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-xs text-muted">Phone number</p>
                  <p className="font-semibold">{profile.phone || "Not added"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-xs text-muted">Address</p>
                  <p className="break-words font-semibold">{profile.address || "Not added"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Droplet className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-xs text-muted">Blood group</p>
                  <p className="font-semibold">{profile.blood_group || "Not added"}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEdit(true)} className="mt-1">
                Edit details
              </Button>
            </div>
          </Card>
          <Card>
            <CardTitle icon={Users}>My groups</CardTitle>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted">Not in a group yet. <Link className="font-semibold text-brand hover:underline" href="/groups">Join one</Link></p>
            ) : (
              <ul className="space-y-2">
                {memberships.map((m) => (
                  <li key={m.group.id}>
                    <Link href={`/groups/${m.group.id}`} className="flex items-center justify-between rounded-xl bg-line/5 px-3 py-2.5 text-sm transition hover:bg-brand/10">
                      <span className="truncate font-semibold">{m.group.name}</span>
                      <Badge tone={m.warnings ? "danger" : "muted"}>{m.warnings ? `${m.warnings} ⚠` : m.role}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle icon={BookOpen}>Enrolled courses</CardTitle>
            {courses.length === 0 ? (
              <p className="text-sm text-muted">No courses yet. <Link className="font-semibold text-brand hover:underline" href="/courses">Add one</Link></p>
            ) : (
              <ul className="space-y-2">
                {courses.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href={`/courses/${c.id}`} className="flex items-center gap-2 rounded-xl bg-line/5 px-3 py-2 text-sm transition hover:bg-brand/10">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="truncate font-semibold">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <EditModal open={edit} onClose={() => setEdit(false)} />
    </>
  );
}

function EditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, mutate } = useProfile();
  const [name, setName] = useState("");
  const [uni, setUni] = useState("");
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState(SEMESTERS[0]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(false);
  if (open !== seen) {
    setSeen(open);
    if (open && profile) {
      setName(profile.full_name);
      setUni(profile.university);
      setDept(profile.department);
      setSem(profile.semester || SEMESTERS[0]);
      setPhone(profile.phone ?? "");
      setAddress(profile.address ?? "");
      setBloodGroup(profile.blood_group ?? "");
    }
  }

  async function save() {
    if (!profile) return;
    if (name.trim().length < 2) return toast.error("Enter your full name");
    setBusy(true);
    const { error } = await supabaseBrowser().from("profiles").update({
      full_name: name.trim(),
      university: uni.trim(),
      department: dept.trim(),
      semester: sem,
      phone: phone.trim(),
      address: address.trim(),
      blood_group: bloodGroup.trim(),
    }).eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Profile saved");
    await mutate();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" description="Your username can't be changed.">
      <div className="space-y-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        <Input label="University" value={uni} onChange={(e) => setUni(e.target.value)} maxLength={100} />
        <Input label="Department" value={dept} onChange={(e) => setDept(e.target.value)} maxLength={100} />
        <Select label="Current semester" value={sem} onChange={(e) => setSem(e.target.value)}>
          {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Input label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +880 1XXX-XXXXXX" maxLength={30} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City, area, road, house" maxLength={200} />
        <Input label="Blood group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O+" maxLength={10} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

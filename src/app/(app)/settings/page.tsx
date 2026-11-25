"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { Bell, LogOut, Moon, Palette, Settings as SettingsIcon, ShieldCheck, Sun } from "lucide-react";
import { Button, Card, CardTitle, ConfirmDialog, PageHeader, PageSkeleton, Switch } from "@/components/ui";
import { useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, errMsg } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, mutate } = useProfile();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [out, setOut] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  if (!profile) return <PageSkeleton />;

  async function update(patch: Partial<Pick<Profile, "theme" | "notify_prefs" | "privacy_prefs">>, ok?: string) {
    const { error } = await supabaseBrowser().from("profiles").update(patch).eq("id", profile!.id);
    if (error) return toast.error(errMsg(error));
    if (ok) toast.success(ok);
    await mutate();
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return toast.error("This browser doesn't support notifications");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") toast.success("Browser notifications enabled 🔔");
    else toast.info("Notifications are blocked. You can change this in your browser's site settings.");
  }

  const dark = !mounted || resolvedTheme !== "light";
  const n = profile.notify_prefs ?? { reminders: true, group_activity: true, dares: true };
  const priv = profile.privacy_prefs ?? { show_progress_to_groups: true };

  return (
    <>
      <PageHeader icon={SettingsIcon} title="Settings" description="Make B2 Sync feel like yours." />
      <div className="mx-auto grid max-w-3xl gap-6">
        <Card className="max-w-sm">
          <CardTitle icon={Palette}>Appearance</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "dark", label: "Dark", icon: Moon },
              { id: "light", label: "Light", icon: Sun },
            ].map((t) => {
              const active = (t.id === "dark") === dark;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); void update({ theme: t.id as "dark" | "light" }); }}
                  aria-pressed={active}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition", active ? "border-brand bg-brand/15 text-brand" : "border-line/20 text-muted hover:border-brand/50")}
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Bell}>Notifications</CardTitle>
          <div className="space-y-4">
            {([
              ["reminders", "Event reminders", "Pop-ups before classes, exams and deadlines"],
              ["group_activity", "Group activity", "When friends finish topics or sessions"],
              ["dares", "Pledges & dares", "Alerts when a pledge is settled"],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
                <Switch label={label} checked={n[key] !== false} onChange={(v) => update({ notify_prefs: { ...n, [key]: v } })} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-t border-line/10 pt-4">
              <div>
                <p className="text-sm font-semibold">Browser notifications</p>
                <p className="text-xs text-muted">{perm === "granted" ? "Enabled" : perm === "denied" ? "Blocked in your browser settings" : "Get pop-ups even when this tab is in the background"}</p>
              </div>
              <Button size="sm" variant="secondary" disabled={perm === "granted" || perm === "denied"} onClick={askPermission}>
                {perm === "granted" ? "Enabled ✓" : "Enable"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle icon={ShieldCheck}>Privacy</CardTitle>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Show my topic progress to group members</p>
              <p className="text-xs text-muted">Turn off to keep your completed topics private. Your XP and streak stay on the leaderboard.</p>
            </div>
            <Switch label="Show progress to groups" checked={priv.show_progress_to_groups !== false} onChange={(v) => update({ privacy_prefs: { ...priv, show_progress_to_groups: v } }, v ? "Progress visible to your groups" : "Progress hidden from your groups")} />
          </div>
        </Card>

        <Card>
          <CardTitle>Account</CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold">@{profile.username}</p>
              <p className="text-muted">{user?.email || "Signed in"}</p>
            </div>
            <Button variant="danger" icon={LogOut} onClick={() => setOut(true)}>Sign out</Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={out}
        onClose={() => setOut(false)}
        title="Sign out?"
        description="You can sign back in with Google any time."
        confirmLabel="Sign out"
        onConfirm={async () => {
          await supabaseBrowser().auth.signOut();
          await globalMutate(() => true, undefined, { revalidate: false });
          router.replace("/login");
        }}
      />
    </>
  );
}

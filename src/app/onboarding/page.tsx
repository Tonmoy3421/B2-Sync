"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Check, Clock3, Loader2, Rocket, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useProfile, useSession } from "@/lib/hooks";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { hasLocalSignIn, markLocalSignIn } from "@/lib/auth/local-signin";
import { SEMESTERS } from "@/lib/constants";
import { invalidate } from "@/lib/actions";
import { errMsg } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, isLoading, mutate: reloadProfile } = useProfile();
  const { isAdmin: sessionAdmin } = useSession();
  const [returning, setReturning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [autoBusy, setAutoBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  // A returning email never sees onboarding again. The server keeps a persistent
  // sign-in history; local mode uses a device marker.
  useEffect(() => {
    if (!user) {
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        if (isLocalMode) {
          setReturning(hasLocalSignIn(user?.email ?? ""));
        } else {
          const res = await fetch("/api/auth/signin-history");
          const data = await res.json().catch(() => ({}));
          setReturning(Boolean(data.returning));
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (isLoading || historyLoading || autoBusy) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile) {
      router.replace(sessionAdmin ? "/admin/dashboard" : "/dashboard");
      return;
    }
    if (!returning) return;

    // Safety net: if history says returning but the profile row is missing,
    // recreate a minimal profile so there is no onboarding redirect loop.
    setAutoBusy(true);
    void (async () => {
      try {
        const email = (user.email ?? "").toLowerCase();
        const localPart = email.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || "member";
        const username = `${localPart.slice(0, 15)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);
        const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
        const fullName = meta?.full_name || meta?.name || localPart;
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, full_name: fullName, university: "", department: "", semester: "" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not restore your workspace.");
        if (data.local) {
          const { error } = await supabaseBrowser().from("profiles").insert({
            id: user.id,
            username,
            full_name: fullName,
            university: "",
            department: "",
            semester: "",
            avatar_url: null,
          });
          if (error) throw error;
        }
        await invalidate("profile");
        await reloadProfile();
        router.replace(sessionAdmin ? "/admin/dashboard" : "/dashboard");
      } catch (e) {
        toast.error(errMsg(e));
        setReturning(false);
      } finally {
        setAutoBusy(false);
      }
    })();
  }, [isLoading, historyLoading, autoBusy, user, profile, returning, router, sessionAdmin, reloadProfile]);

  useEffect(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
    if (meta && !fullName) setFullName(meta.full_name || meta.name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setAvailable(null);
    if (!USERNAME_RE.test(username)) return;
    setChecking(true);
    const t = window.setTimeout(async () => {
      const { data } = await supabaseBrowser().rpc("username_available", { p_username: username });
      setAvailable(Boolean(data));
      setChecking(false);
    }, 400);
    return () => {
      window.clearTimeout(t);
      setChecking(false);
    };
  }, [username]);

  const formatOk = USERNAME_RE.test(username);
  const usernameError = username && !formatOk ? "3–20 characters: lowercase letters, numbers, underscore" : available === false ? "That username is taken" : undefined;
  const canSubmit = formatOk && available === true && fullName.trim().length >= 2 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, full_name: fullName.trim(), university: university.trim(), department: department.trim(), semester }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit your details");

      if (data.local) {
        const meta = user.user_metadata as { avatar_url?: string; picture?: string } | undefined;
        const { error } = await supabaseBrowser().from("profiles").insert({
          id: user.id,
          username,
          full_name: fullName.trim(),
          university: university.trim(),
          department: department.trim(),
          semester,
          avatar_url: meta?.avatar_url || meta?.picture || null,
        });
        if (error) throw error;
      }

      markLocalSignIn(user.email ?? "");
      toast.success(sessionAdmin ? "Welcome, admin!" : "Details sent — your join request is awaiting approval.");
      await invalidate("profile");
      router.replace(sessionAdmin ? "/admin" : "/dashboard");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || historyLoading || autoBusy) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-4 text-sm text-muted">
            {autoBusy ? "Restoring your workspace…" : "Checking your sign-in history…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-5">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="glass w-full max-w-lg space-y-5 rounded-3xl p-7 shadow-card sm:p-9">
        <div>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Rocket className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Set up your profile</h1>
          <p className="mt-1 text-sm text-muted">Your details go to the admin for approval before you join the workspace.</p>
        </div>

        {!sessionAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/10 p-3 text-xs text-muted">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            New accounts are reviewed by the admin. You'll see a pending screen until approved.
          </div>
        )}

        <div className="relative">
          <Input
            label="Username"
            placeholder="e.g. rafi_codes"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            maxLength={20}
            autoComplete="off"
            autoFocus
            error={usernameError}
            hint={available === true ? "✓ Available" : "Letters, numbers and underscore only"}
            className="pl-9 pr-10"
          />
          <AtSign className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-muted" />
          <div className="absolute right-3 top-[33px]">
            {checking ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : available === true ? <Check className="h-5 w-5 text-success" /> : available === false ? <X className="h-5 w-5 text-danger" /> : null}
          </div>
        </div>

        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" maxLength={80} />
        <Input label="University" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. AIUB" maxLength={100} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CSE" maxLength={80} />
          <Select label="Current semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
            {SEMESTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canSubmit}>
          {sessionAdmin ? "Enter workspace" : "Send join request"}
        </Button>
      </form>
    </div>
  );
}

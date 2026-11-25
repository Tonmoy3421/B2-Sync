"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Brain, Eye, EyeOff, Flame, Sparkles, Swords, Users } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { markLocalSignIn } from "@/lib/auth/local-signin";
import { errMsg } from "@/lib/utils";

const FEATURES = [
  { icon: Users, text: "Study with friends in private groups" },
  { icon: Flame, text: "Streaks, XP, levels & leaderboards" },
  { icon: Swords, text: "Miss a pledge? Do the dare — or take the shame" },
  { icon: Brain, text: "Focus Mode with shuffled study quotes" },
];

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.96 0 3.27.84 4.02 1.56l2.74-2.64C17 3.2 14.74 2.2 12 2.2a9.8 9.8 0 1 0 0 19.6c5.66 0 9.4-3.98 9.4-9.58 0-.64-.07-1.14-.16-1.62H12z" />
    </svg>
  );
}

export function GoogleButton({ next = "/dashboard", label = "Continue with Google" }: { next?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function signIn() {
    setBusy(true);
    try {
      if (isLocalMode) {
        const { data, error } = await supabaseBrowser().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        const user = (data as { user?: { id: string; email?: string } } | null)?.user;
        if (!user?.email) throw new Error("Could not create your local Google session.");
        const res = await fetch("/api/auth/local-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not start your session.");
        markLocalSignIn(user.email);
        window.location.assign(safeNext);
        return;
      }
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(errMsg(error));
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className="w-full" onClick={signIn} loading={busy}>
      <GoogleIcon /> {label}
    </Button>
  );
}

export function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute bottom-2.5 right-3 rounded-lg p-1 text-muted transition hover:text-brand"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">
            B2 <span className="text-gradient">Sync</span>
          </span>
        </div>
        <div>
          <div className="text-5xl font-extrabold leading-tight tracking-tight">
            Study together.
            <br />
            <span className="text-gradient">Stay accountable.</span>
            <br />
            Level up.
          </div>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-muted">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-base font-medium text-fg/90">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">Built for a small circle of friends. Invite-only groups.</p>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-60 w-60 rounded-full bg-violet/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="glass w-full max-w-md rounded-3xl p-7 shadow-card sm:p-9">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-extrabold">
              B2 <span className="text-gradient">Sync</span>
            </span>
          </div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

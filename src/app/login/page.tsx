"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AuthShell, GoogleButton, PasswordInput } from "@/components/auth/auth-shell";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { errMsg } from "@/lib/utils";
import { markLocalSignIn } from "@/lib/auth/local-signin";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const kind = params.get("error");
    if (kind === "rate_limit") setError("Too many attempts. Please wait before trying again.");
    else if (kind) setError("We couldn't complete sign-in. Please try again.");
    if (params.get("signedUp")) toast.success("Account created. Sign in to continue.");
    if (params.get("reset")) toast.success("Password updated. Sign in with your new password.");
  }, [params]);

  function finish(isAdmin?: boolean) {
    router.replace(isAdmin ? "/admin/dashboard" : safeNext);
    router.refresh();
  }

  async function signInWithPassword() {
    setError(null);
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      if (isLocalMode) {
        const { data, error: authError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const user = data.user;
        if (!user?.email) throw new Error("Could not start your local session.");
        const res = await fetch("/api/auth/local-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not start your session.");
        markLocalSignIn(user.email);
        finish(false);
        return;
      }

      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "EMAIL_NOT_CONFIRMED") {
          setError("Verify your email before signing in.");
          toast.error("Check your inbox for the verification link.");
        } else {
          setError(json.error || "Could not sign in.");
        }
        return;
      }
      finish(Boolean(json.user?.isAdmin));
    } catch (e) {
      setError(errMsg(e));
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome 👋"
      subtitle="Sign in to your B2 Sync workspace."
      footer={
        <p className="mt-6 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          Sessions expire after 7 days. Expiry only signs you out — your account and data stay intact.
        </p>
      }
    >
      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => { e.preventDefault(); void signInWithPassword(); }}
      >
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Your password" />

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-brand"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
        <p className="text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" />
        OR
        <div className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton next={safeNext} />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="mt-4 text-sm text-muted">Loading B2 Sync…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth/auth-shell";
import { isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { errMsg } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      if (isLocalMode) {
        const { data } = await supabaseBrowser().auth.resetPasswordForEmail(normalized);
        const token = (data as { devToken?: string } | null)?.devToken ?? null;
        setDevToken(token);
        setSent(true);
        toast.success(token ? "Local reset token created." : "If that email has an account, a reset link is on its way.");
        return;
      }
      setDevToken(null);
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not send reset link.");
      setSent(true);
      toast.success("If that email has an account, a reset link is on its way.");
    } catch (e) {
      setError(errMsg(e));
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new one."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 text-center">
          <MailCheck className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 text-sm font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted">The link expires soon. If you don&apos;t see it, check your spam folder.</p>
          {devToken && (
            <div className="mt-4 rounded-xl border border-brand/40 bg-brand/10 p-3 text-left text-xs">
              <p className="font-semibold text-brand">Local mode reset token</p>
              <p className="mt-1 break-all font-mono">{devToken}</p>
              <Link className="mt-2 inline-block font-semibold text-brand hover:underline" href={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                Continue to reset password →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          {error && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

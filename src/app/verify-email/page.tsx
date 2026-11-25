"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthShell } from "@/components/auth/auth-shell";
import { normalizeEmail } from "@/lib/auth/password";
import { errMsg } from "@/lib/utils";

function VerifyForm() {
  const params = useSearchParams();
  const email = normalizeEmail(params.get("email"));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    if (!email) return toast.error("Open the link from your registration email to resend.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not resend email.");
      setSent(true);
      toast.success("Verification email sent again.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="One more step before you start studying."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Already verified?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-5 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-brand" />
        <p className="mt-3 text-sm font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted">
          We sent a verification link to <b className="text-fg">{email || "your email address"}</b>. Click it to activate your account.
        </p>
      </div>
      <Button variant="secondary" className="mt-5 w-full" onClick={resend} loading={busy} disabled={sent}>
        {sent ? "Email sent" : "Resend verification email"}
      </Button>
      <p className="mt-4 text-center text-xs text-muted">Didn&apos;t get it? Check spam, then try again in a few minutes.</p>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>}>
      <VerifyForm />
    </Suspense>
  );
}

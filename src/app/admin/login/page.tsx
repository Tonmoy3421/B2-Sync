"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AuthShell, PasswordInput } from "@/components/auth/auth-shell";
import { errMsg } from "@/lib/utils";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code, remember }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.code === "TOTP_REQUIRED" && !needCode) {
        setNeedCode(true);
        setError(data.error || "Enter your two-factor code.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Admin sign-in failed.");
      toast.success("Owner admin verified.");
      router.replace("/admin/dashboard");
      router.refresh();
    } catch (e) {
      setError(errMsg(e));
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Owner admin sign in"
      subtitle="Restricted to the single provisioned owner account."
      footer={
        <div className="mt-6 space-y-3">
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            Password, owner ID, role and optional 2FA are checked on the server. Sessions expire after 7 days.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
        </div>
      }
    >
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label="Owner email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Admin password" />
        {needCode && (
          <Input
            label="Two-factor code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoComplete="one-time-code"
          />
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand"
          />
          Keep me signed in for 7 days
        </label>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in to admin
        </Button>
      </form>
    </AuthShell>
  );
}

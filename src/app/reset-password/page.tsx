"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AuthShell, PasswordInput } from "@/components/auth/auth-shell";
import { passwordChecklist, validatePassword } from "@/lib/auth/password";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { errMsg } from "@/lib/utils";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = passwordChecklist(password);
  const checklist = [
    { label: "10+ characters", ok: checks.length },
    { label: "Uppercase", ok: checks.uppercase },
    { label: "Lowercase", ok: checks.lowercase },
    { label: "Number", ok: checks.number },
    { label: "Symbol", ok: checks.symbol },
  ];

  async function update() {
    setError(null);
    if (isLocalMode && !token.trim()) return setError("Enter the reset token from the previous step.");
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const { error: updateError } = isLocalMode
        ? await supabaseBrowser().auth.updateUser({ password, token: token.trim() } as { password: string; token: string })
        : await supabaseBrowser().auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password updated.");
      router.replace(isLocalMode ? "/login?reset=1" : "/dashboard");
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
      title="Choose a new password"
      subtitle="Use a strong password you haven't used here before."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Need a new link?{" "}
          <Link href="/forgot-password" className="font-semibold text-brand hover:underline">
            Request another
          </Link>
        </p>
      }
    >
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); void update(); }}
      >
        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        {isLocalMode && (
          <Input label="Reset token" placeholder="Paste the token from the previous step" value={token} onChange={(e) => setToken(e.target.value)} />
        )}
        <PasswordInput label="New password" value={password} onChange={setPassword} placeholder="Create a strong password" autoComplete="new-password" />
        <ul className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
          {checklist.map((item) => (
            <li key={item.label} className={`flex items-center gap-1 ${item.ok ? "text-success" : ""}`}>
              {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {item.label}
            </li>
          ))}
        </ul>
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} placeholder="Repeat your new password" autoComplete="new-password" />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}

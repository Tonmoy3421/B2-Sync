"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AuthShell, GoogleButton, PasswordInput } from "@/components/auth/auth-shell";
import { isValidEmail, normalizeEmail, passwordChecklist, validatePassword } from "@/lib/auth/password";
import { isLocalMode, supabaseBrowser } from "@/lib/supabase/client";
import { errMsg } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
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

  async function register() {
    setError(null);
    const normalized = normalizeEmail(email);
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!isValidEmail(normalized)) return setError("Enter a valid email address.");
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirm) return setError("Passwords do not match.");
    if (!terms) return setError("Accept the terms to continue.");

    setBusy(true);
    try {
      if (isLocalMode) {
        const { data, error: authError } = await supabaseBrowser().auth.signUp({
          email: normalized,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (authError) throw authError;
        const user = data.user;
        if (!user?.email) throw new Error("Could not create your local account.");
        const res = await fetch("/api/auth/local-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not start your session.");
        toast.success("Account created on this device.");
        router.replace("/onboarding");
        router.refresh();
        return;
      }

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email: normalized, password, confirm, terms }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create your account.");
      router.replace(`/verify-email?email=${encodeURIComponent(normalized)}`);
    } catch (e) {
      setError(errMsg(e));
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join your study circle in a minute."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); void register(); }}
      >
        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input label="Full name" placeholder="Alex Morgan" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        <Input label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <PasswordInput label="Password" value={password} onChange={setPassword} placeholder="Create a strong password" autoComplete="new-password" />
        <ul className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
          {checklist.map((item) => (
            <li key={item.label} className={`flex items-center gap-1 ${item.ok ? "text-success" : ""}`}>
              {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {item.label}
            </li>
          ))}
        </ul>
        <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" autoComplete="new-password" />

        <label className="flex cursor-pointer items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line accent-brand"
          />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {isLocalMode && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted">
            Local mode: no verification email is sent. Your account is created securely on this device.
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" />
        OR
        <div className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton next="/onboarding" label="Sign up with Google" />
    </AuthShell>
  );
}

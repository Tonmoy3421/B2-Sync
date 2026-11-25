"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { afterAction, celebrate, invalidate } from "@/lib/actions";
import { errMsg } from "@/lib/utils";

export default function JoinByLinkPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("join_group", { p_code: code });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    celebrate(true);
    toast.success("You're in! 🎉");
    await invalidate("groups");
    void afterAction();
    router.replace(`/groups/${data}`);
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <Card className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">You&apos;ve been invited!</h1>
        <p className="mt-2 text-sm text-muted">
          Invite code <b className="font-mono tracking-widest text-fg">{String(code).toUpperCase()}</b>
        </p>
        <p className="mt-3 text-sm text-muted">Joining lets the group see your topic progress, streak and XP. Your notes stay private unless you share them.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/groups")}>
            Not now
          </Button>
          <Button loading={busy} onClick={join}>
            Join the group
          </Button>
        </div>
      </Card>
    </div>
  );
}

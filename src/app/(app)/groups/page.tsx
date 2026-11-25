"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Copy, Crown, KeyRound, Plus, ShieldAlert, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { useGroups } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { afterAction, celebrate, invalidate } from "@/lib/actions";
import { errMsg } from "@/lib/utils";

export default function GroupsPage() {
  const router = useRouter();
  const { memberships, isLoading } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const ids = memberships.map((m) => m.group.id);
  const { data: counts } = useSWR(ids.length ? `groups:counts:${ids.join(",")}` : null, async () => {
    const { data } = await supabaseBrowser().from("group_members").select("group_id").in("group_id", ids);
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: { group_id: string }) => (map[r.group_id] = (map[r.group_id] ?? 0) + 1));
    return map;
  });

  async function create() {
    if (name.trim().length < 2) return toast.error("Give your group a name");
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("create_group", { p_name: name, p_description: desc });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    celebrate();
    toast.success("Group created! Share the invite code with your friends.");
    setCreateOpen(false);
    setName("");
    setDesc("");
    await invalidate("groups");
    void afterAction();
    router.push(`/groups/${data}`);
  }

  async function join() {
    if (code.trim().length < 6) return toast.error("Enter the invite code");
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("join_group", { p_code: code });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("You joined the group 🎉");
    setJoinOpen(false);
    setCode("");
    await invalidate("groups");
    void afterAction();
    router.push(`/groups/${data}`);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied!");
    } catch {
      toast.error("Couldn't copy — select and copy it manually");
    }
  }

  return (
    <>
      <PageHeader
        icon={Users}
        title="Study Groups"
        description="Private workspaces where you study, compete and keep each other honest."
        actions={
          <>
            <Button variant="secondary" icon={KeyRound} onClick={() => setJoinOpen(true)}>
              Join with code
            </Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              New group
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <EmptyState
          icon={Users}
          title="You're not in a study group yet"
          description="Create one for your friends, or paste an invite code someone sent you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Create a group
              </Button>
              <Button variant="secondary" icon={KeyRound} onClick={() => setJoinOpen(true)}>
                Join with code
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {memberships.map((m, i) => (
            <motion.div key={m.group.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card hover className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{m.group.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{m.group.description || "No description yet"}</p>
                  </div>
                  {m.role !== "member" && (
                    <Badge tone="warn">
                      <Crown className="h-3 w-3" /> {m.role}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="brand">
                    <Users className="h-3 w-3" /> {counts?.[m.group.id] ?? "…"} / {m.group.max_members}
                  </Badge>
                  {m.warnings > 0 && (
                    <Badge tone="danger">
                      <ShieldAlert className="h-3 w-3" /> {m.warnings}/{m.group.max_warnings} warnings
                    </Badge>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                  <button onClick={() => copy(m.group.invite_code)} title="Copy invite code" className="flex items-center gap-1.5 rounded-lg bg-line/10 px-2.5 py-1.5 font-mono text-xs font-bold tracking-widest text-muted transition hover:bg-brand/15 hover:text-brand">
                    {m.group.invite_code} <Copy className="h-3 w-3" />
                  </button>
                  <Link href={`/groups/${m.group.id}`}>
                    <Button size="sm" variant="secondary">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a study group" description="You'll become the owner and get an invite code to share.">
        <div className="space-y-4">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSE 21 Warriors" maxLength={60} autoFocus />
          <Textarea label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What are you preparing for together?" maxLength={300} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={create}>
              Create group
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a group" description="Paste the invite code your friend shared.">
        <div className="space-y-4">
          <Input label="Invite code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3D4" maxLength={12} className="text-center font-mono text-lg tracking-[0.3em]" autoFocus />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={join}>
              Join group
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

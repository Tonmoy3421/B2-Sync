"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, BookOpen, Check, ClipboardList, Clock3, FileText, Globe2,
  LayoutDashboard, Megaphone, Pencil, Plus, Search, Server, Settings2, Shield,
  ShieldCheck, Trash2, UserCheck, UserPlus, Users, X,
} from "lucide-react";
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Select,
  StatCard, Switch, Tabs, Textarea,
} from "@/components/ui";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSession } from "@/lib/hooks";
import { errMsg } from "@/lib/utils";

type Tab = "overview" | "users" | "content" | "website" | "security" | "requests" | "audit";
type ContentTab = "courses" | "materials" | "announcements";
type SecurityTab = "logins" | "failed" | "sessions";
type Row = Record<string, unknown>;

type Stats = {
  users: number;
  activeUsers: number;
  newUsers: number;
  pending: number;
  requests: number;
  events: number;
  courses: number;
  materials: number;
  groups: number;
  actions: number;
  system: Record<string, string>;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin request failed");
  return data as T;
};

async function api(resource: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
  const res = await fetch(`/api/admin/${resource}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Admin action failed");
  return data;
}

function fmt(date?: unknown) {
  if (!date || typeof date !== "string") return "—";
  return new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function label(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matches(row: Row, query: string) {
  if (!query.trim()) return true;
  return JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase());
}

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [contentTab, setContentTab] = useState<ContentTab>("courses");
  const [securityTab, setSecurityTab] = useState<SecurityTab>("logins");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ resource: string; id: string; label: string } | null>(null);
  const { isAdmin, isLoading: sessionLoading } = useSession();

  const { data: stats, error: statsError } = useSWR<Stats>("admin:stats", () => fetcher<Stats>("/api/admin/stats"), {
    refreshInterval: 30000,
  });
  const listKey = tab === "overview" || tab === "security" || tab === "website" ? null : `admin:${tab}`;
  const { data: list, error, isLoading, mutate: reload } = useSWR<{ items: Row[] }>(
    listKey,
    () => fetcher<{ items: Row[] }>(`/api/admin/${tab}`),
    { refreshInterval: 30000 }
  );
  const { data: content, isLoading: contentLoading, mutate: reloadContent } = useSWR<{ items: Row[] }>(
    tab === "content" ? `admin:${contentTab}` : null,
    () => fetcher<{ items: Row[] }>(`/api/admin/${contentTab}`),
    { refreshInterval: 30000 }
  );
  const { data: security, isLoading: securityLoading } = useSWR<{ items: { logins: Row[]; failed: Row[]; suspicious: Row[] } }>(
    tab === "security" ? "admin:security" : null,
    () => fetcher<{ items: { logins: Row[]; failed: Row[]; suspicious: Row[] } }>("/api/admin/security"),
    { refreshInterval: 30000 }
  );
  const { data: sessions, mutate: reloadSessions } = useSWR<{ items: Row[] }>(
    tab === "security" ? "admin:sessions" : null,
    () => fetcher<{ items: Row[] }>("/api/admin/sessions"),
    { refreshInterval: 30000 }
  );
  const { data: settings, mutate: reloadSettings } = useSWR<{ items: Row[] }>(
    tab === "website" ? "admin:settings" : null,
    () => fetcher<{ items: Row[] }>("/api/admin/settings"),
    { refreshInterval: 30000 }
  );

  const rows = useMemo(() => (list?.items ?? []).filter((r) => matches(r, query)), [list, query]);
  const contentRows = useMemo(() => (content?.items ?? []).filter((r) => matches(r, query)), [content, query]);
  const securityRows = securityTab === "sessions"
    ? (sessions?.items ?? []).filter((r) => matches(r, query))
    : ((securityTab === "logins" ? security?.items.logins : securityTab === "failed" ? security?.items.failed : security?.items.suspicious) ?? []).filter((r) => matches(r, query));

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await Promise.all([
        globalMutate("admin:stats"),
        globalMutate(listKey ?? "admin:noop"),
        globalMutate(`admin:${contentTab}`),
        globalMutate("admin:security"),
        globalMutate("admin:sessions"),
        globalMutate("admin:settings"),
      ]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function changeTab(next: Tab) {
    setTab(next);
    setQuery("");
  }

  function confirmDelete(resource: string, id: string, text: string) {
    setConfirm({ resource, id, label: text });
  }

  if (sessionLoading) return <p className="p-6 text-sm text-muted">Verifying owner access…</p>;
  if (!isAdmin) {
    return (
      <Card className="p-6 text-center">
        <Shield className="mx-auto h-10 w-10 text-danger" />
        <h1 className="mt-4 text-lg font-bold">Owner admin access only</h1>
        <p className="mt-2 text-sm text-muted">Sign in at /admin/login with the provisioned owner account.</p>
      </Card>
    );
  }

  const chartData = [
    { name: "Users", value: stats?.users ?? 0 },
    { name: "Active", value: stats?.activeUsers ?? 0 },
    { name: "New 7d", value: stats?.newUsers ?? 0 },
    { name: "Courses", value: stats?.courses ?? 0 },
    { name: "Materials", value: stats?.materials ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Owner dashboard" description="Exclusive control of users, content, website and security." icon={ShieldCheck} />
        <ThemeToggle />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "overview", label: "Overview", icon: LayoutDashboard },
          { value: "users", label: "Users", icon: Users, count: stats?.users },
          { value: "content", label: "Content", icon: BookOpen, count: stats?.materials },
          { value: "website", label: "Website", icon: Globe2 },
          { value: "security", label: "Security", icon: Shield },
          { value: "requests", label: "Requests", icon: ClipboardList, count: stats?.pending },
          { value: "audit", label: "Audit", icon: Clock3 },
        ]}
      />

      {(error || statsError) && (
        <Card className="border-danger/40 p-4 text-sm text-danger">
          {errMsg(error || statsError)} — confirm the schema migration and SUPABASE_SERVICE_ROLE_KEY are configured.
        </Card>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total users" value={stats?.users ?? 0} />
            <StatCard icon={UserCheck} label="Active users" value={stats?.activeUsers ?? 0} tone="success" />
            <StatCard icon={UserPlus} label="New (7 days)" value={stats?.newUsers ?? 0} tone="violet" />
            <StatCard icon={BookOpen} label="Courses" value={stats?.courses ?? 0} tone="warn" />
            <StatCard icon={FileText} label="Study materials" value={stats?.materials ?? 0} tone="violet" />
            <StatCard icon={Activity} label="Website activity" value={stats?.events ?? 0} />
            <StatCard icon={ClipboardList} label="Pending approvals" value={stats?.pending ?? 0} tone="warn" />
            <StatCard icon={ShieldCheck} label="Admin actions" value={stats?.actions ?? 0} tone="success" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-bold">Platform snapshot</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--brand, #22d3ee)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-bold">System status</h2>
              <div className="mt-4 space-y-2 text-sm">
                {Object.entries(stats?.system ?? {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-line/20 px-3 py-2">
                    <span className="capitalize text-muted">{key.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => changeTab("users")}><Users className="h-4 w-4" /> Manage users</Button>
                <Button variant="secondary" onClick={() => changeTab("content")}><BookOpen className="h-4 w-4" /> Content</Button>
                <Button variant="secondary" onClick={() => changeTab("security")}><Shield className="h-4 w-4" /> Security</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "users" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">All users</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={query} onChange={setQuery} />
              <Button size="sm" onClick={() => setModal("add-user")}><UserPlus className="h-4 w-4" /> Add user</Button>
            </div>
          </div>
          {isLoading ? <p className="p-4 text-sm text-muted">Loading…</p> : rows.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description="Try another search or add a member." />
          ) : (
            <div className="space-y-2">
              {rows.map((u) => {
                const suspended = Boolean(u.suspended);
                return (
                  <div key={label(u.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/20 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm">{label(u.full_name) === "—" ? label(u.username) : label(u.full_name)}</b>
                        {u.role === "admin" && <Badge tone="brand">owner admin</Badge>}
                        {suspended && <Badge tone="danger">suspended</Badge>}
                        {u.approved === false && !suspended && <Badge tone="warn">pending</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted">@{label(u.username)} · {label(u.email)} · joined {fmt(u.created_at)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => { setEditRow(u); setModal("edit-user"); }}><Pencil className="h-4 w-4" /></Button>
                      {u.role !== "admin" && !suspended && (
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(() => api("users", "PATCH", { id: u.id, patch: { suspended: true } }), "User suspended.")}>
                          Suspend
                        </Button>
                      )}
                      {u.role !== "admin" && suspended && (
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(() => api("users", "PATCH", { id: u.id, patch: { suspended: false } }), "User reactivated.")}>
                          Reactivate
                        </Button>
                      )}
                      {u.role !== "admin" && (
                        <Button size="sm" variant="ghost" onClick={() => confirmDelete("users", label(u.id), label(u.full_name) || label(u.username))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === "content" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs<ContentTab>
              value={contentTab}
              onChange={(v) => { setContentTab(v); setQuery(""); }}
              tabs={[
                { value: "courses", label: "Courses", icon: BookOpen },
                { value: "materials", label: "Study materials", icon: FileText },
                { value: "announcements", label: "Announcements", icon: Megaphone },
              ]}
            />
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold capitalize">{contentTab}</h2>
              <Button size="sm" onClick={() => setModal(`add-${contentTab}`)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            {contentLoading ? <p className="p-4 text-sm text-muted">Loading…</p> : contentRows.length === 0 ? (
              <EmptyState icon={FileText} title={`No ${contentTab} yet`} description="Add the first item to get started." />
            ) : (
              <div className="space-y-2">
                {contentRows.map((row) => (
                  <div key={label(row.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/20 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm">{label(row.title) === "—" ? label(row.name) : label(row.title)}</b>
                        {Boolean(row.kind) && <Badge>{label(row.kind)}</Badge>}
                        {row.active === true && <Badge tone="success">live</Badge>}
                        {row.active === false && <Badge tone="warn">hidden</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted">
                        {label(row.description) !== "—" ? `${label(row.description)} · ` : ""}
                        {label(row.courses) !== "—" ? `${label(row.courses)} · ` : ""}
                        {fmt(row.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {(contentTab === "announcements" || contentTab === "materials") && (
                        <Button size="sm" variant="ghost" onClick={() => { setEditRow(row); setModal(`edit-${contentTab}`); }}><Pencil className="h-4 w-4" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => confirmDelete(contentTab, label(row.id), label(row.title) || label(row.name))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "website" && (
        <WebsiteSettings busy={busy} settings={settings?.items ?? []} run={run} reload={reloadSettings} />
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs<SecurityTab>
              value={securityTab}
              onChange={(v) => { setSecurityTab(v); setQuery(""); }}
              tabs={[
                { value: "logins", label: "Login history", icon: ShieldCheck },
                { value: "failed", label: "Failed attempts", icon: Shield },
                { value: "sessions", label: "Active sessions", icon: Activity },
              ]}
            />
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <Card className="p-4">
            <h2 className="mb-3 font-bold capitalize">{securityTab}</h2>
            {securityLoading ? <p className="p-4 text-sm text-muted">Loading…</p> : securityRows.length === 0 ? (
              <EmptyState icon={Shield} title="Nothing to show" description="No matching security events." />
            ) : (
              <div className="space-y-2">
                {securityRows.map((row) => (
                  <div key={label(row.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/20 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <b>{label(row.email) !== "—" ? label(row.email) : label(row.ip)}</b>
                      <p className="truncate text-muted">
                        {label(row.reason) !== "—" ? `${label(row.reason)} · ` : ""}
                        {label(row.user_agent) !== "—" ? `${label(row.user_agent)} · ` : ""}
                        {fmt(row.created_at)}
                      </p>
                    </div>
                    {securityTab === "sessions" && !row.revoked_at && (
                      <Button size="sm" variant="danger" loading={busy} onClick={() => confirmDelete("sessions", label(row.id), label(row.email))}>
                        Revoke
                      </Button>
                    )}
                    {Boolean(row.revoked_at) && <Badge tone="danger">revoked</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "requests" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Join requests</h2>
            <SearchBox value={query} onChange={setQuery} />
          </div>
          {rows.length === 0 ? <EmptyState icon={ClipboardList} title="No requests" description="New signups appear here." /> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={label(r.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/20 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm">{label(r.full_name) || label(r.username)}</b>
                      <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}>{label(r.status)}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted">{label(r.email)} · @{label(r.username)} · {fmt(r.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {r.status !== "approved" && (
                      <Button size="sm" loading={busy} onClick={() => void run(() => api("requests", "PATCH", { id: r.id, action: "approve" }), "Request approved.")}>
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(() => api("requests", "PATCH", { id: r.id, action: "reject" }), "Request rejected.")}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => confirmDelete("requests", label(r.id), label(r.full_name))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "audit" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Recent admin actions</h2>
            <SearchBox value={query} onChange={setQuery} />
          </div>
          {rows.length === 0 ? <EmptyState icon={Clock3} title="No actions yet" description="Admin changes are logged here." /> : (
            <div className="space-y-1.5">
              {rows.map((a) => (
                <div key={label(a.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/15 px-3 py-2 text-xs">
                  <span><b>{label(a.action)}</b> · {label(a.target)}</span>
                  <span className="text-muted">{label(a.actor_email)} · {fmt(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add user */}
      <Modal open={modal === "add-user"} onClose={() => setModal(null)} title="Add member" description="New accounts always start with the user role.">
        <GenericForm
          fields={[
            { key: "email", label: "Email", type: "email" },
            { key: "username", label: "Username" },
            { key: "full_name", label: "Full name" },
            { key: "university", label: "University" },
            { key: "department", label: "Department" },
            { key: "semester", label: "Semester" },
          ]}
          busy={busy}
          onSubmit={(values) => run(() => api("users", "POST", values), "Member added.").then(() => setModal(null))}
        />
      </Modal>

      {/* Edit user */}
      <Modal open={modal === "edit-user"} onClose={() => setModal(null)} title="Edit member" description="Role and owner status cannot be changed here.">
        {editRow && (
          <GenericForm
            initial={editRow}
            fields={[
              { key: "full_name", label: "Full name" },
              { key: "username", label: "Username" },
              { key: "email", label: "Email", type: "email" },
              { key: "university", label: "University" },
              { key: "department", label: "Department" },
              { key: "semester", label: "Semester" },
              { key: "approved", label: "Approved", type: "checkbox" },
            ]}
            busy={busy}
            onSubmit={(values) => run(() => api("users", "PATCH", { id: editRow.id, patch: values }), "User updated.").then(() => setModal(null))}
          />
        )}
      </Modal>

      {/* Announcement forms */}
      <Modal open={modal === "add-announcements" || modal === "edit-announcements"} onClose={() => setModal(null)} title="Announcement">
        <GenericForm
          initial={editRow ?? undefined}
          fields={[
            { key: "title", label: "Title" },
            { key: "body", label: "Message", type: "textarea" },
            { key: "active", label: "Visible on website", type: "checkbox" },
          ]}
          busy={busy}
          onSubmit={(values) => {
            const isEdit = modal === "edit-announcements";
            void run(
              () => api("announcements", isEdit ? "PATCH" : "POST", isEdit ? { id: editRow?.id, patch: values } : values),
              isEdit ? "Announcement updated." : "Announcement published."
            ).then(() => { setModal(null); setEditRow(null); void reloadContent(); });
          }}
        />
      </Modal>

      {/* Material forms */}
      <Modal open={modal === "add-materials" || modal === "edit-materials"} onClose={() => setModal(null)} title="Study material">
        <GenericForm
          initial={editRow ?? undefined}
          fields={[
            { key: "title", label: "Title" },
            { key: "kind", label: "Kind", type: "select", options: ["pdf", "note", "doc", "link", "past_paper", "video"] },
            { key: "url", label: "URL" },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          busy={busy}
          onSubmit={(values) => {
            const isEdit = modal === "edit-materials";
            void run(
              () => api("materials", isEdit ? "PATCH" : "POST", isEdit ? { id: editRow?.id, patch: values } : values),
              isEdit ? "Material updated." : "Material added."
            ).then(() => { setModal(null); setEditRow(null); void reloadContent(); });
          }}
        />
      </Modal>

      {/* Course form */}
      <Modal open={modal === "add-courses"} onClose={() => setModal(null)} title="Add course">
        <p className="text-sm text-muted">Create courses from the normal Courses page so student-owned data stays intact. Admin can remove them here.</p>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const target = confirm;
          void run(() => api(target.resource, "DELETE", { id: target.id }), `${target.label} removed.`)
            .then(() => { setConfirm(null); void reload(); void reloadContent(); void reloadSessions(); })
            .catch(() => setConfirm(null));
        }}
        title={`Remove ${confirm?.label ?? "item"}?`}
        description="This action is permanent and is recorded in the audit log."
        confirmLabel={confirm?.resource === "sessions" ? "Revoke session" : "Delete"}
        danger
      />
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-48 pl-9 sm:w-64"
      />
    </div>
  );
}

type Field = { key: string; label: string; type?: "text" | "email" | "textarea" | "select" | "checkbox"; options?: string[] };

function GenericForm({
  fields,
  initial,
  busy,
  onSubmit,
}: {
  fields: Field[];
  initial?: Row;
  busy: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    fields.forEach((f) => {
      seed[f.key] = f.type === "checkbox" ? Boolean(initial?.[f.key]) : label(initial?.[f.key]) === "—" ? "" : label(initial?.[f.key]);
    });
    return seed;
  });
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        if (f.type === "checkbox") {
          return (
            <label key={f.key} className="flex items-center gap-3 text-sm">
              <Switch
                label={f.label}
                checked={Boolean(values[f.key])}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
              <span>{f.label}</span>
            </label>
          );
        }
        if (f.type === "select") {
          return (
            <Select key={f.key} label={f.label} value={label(values[f.key]) === "—" ? "" : String(values[f.key])} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          );
        }
        if (f.type === "textarea") {
          return (
            <Textarea key={f.key} label={f.label} rows={4} value={String(values[f.key] ?? "")} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
          );
        }
        return (
          <Input key={f.key} label={f.label} type={f.type ?? "text"} value={String(values[f.key] ?? "")} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
        );
      })}
      <Button className="w-full" loading={busy} onClick={() => onSubmit(values)}>Save changes</Button>
    </div>
  );
}

function WebsiteSettings({
  busy,
  settings,
  run,
  reload,
}: {
  busy: boolean;
  settings: Row[];
  run: (action: () => Promise<unknown>, message: string) => Promise<void>;
  reload: () => Promise<unknown>;
}) {
  const [categories, setCategories] = useState(() => settingText(settings, "categories"));
  const [subjects, setSubjects] = useState(() => settingText(settings, "subjects"));
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-bold flex items-center gap-2"><Settings2 className="h-5 w-5 text-brand" /> Categories & subjects</h2>
        <p className="mt-1 text-sm text-muted">Comma-separated lists shown across the website.</p>
        <div className="mt-4 space-y-3">
          <Textarea label="Categories" rows={3} value={categories} onChange={(e) => setCategories(e.target.value)} />
          <Textarea label="Subjects" rows={3} value={subjects} onChange={(e) => setSubjects(e.target.value)} />
          <Button
            loading={busy}
            onClick={() => void run(async () => {
              await api("settings", "PATCH", { id: "categories", patch: { value: toList(categories) } });
              await api("settings", "PATCH", { id: "subjects", patch: { value: toList(subjects) } });
            }, "Website lists updated.").then(() => reload())}
          >
            Save lists
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-bold flex items-center gap-2"><Server className="h-5 w-5 text-brand" /> Advanced settings</h2>
        <p className="mt-1 text-sm text-muted">Keys must be lowercase letters, numbers and underscores.</p>
        <div className="mt-4 space-y-3">
          <Input label="Key" value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} placeholder="maintenance_mode" />
          <Textarea label="JSON value" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
          <Button
            loading={busy}
            onClick={() => {
              let parsed: unknown;
              try { parsed = JSON.parse(value); } catch { toast.error("Invalid JSON value."); return; }
              void run(() => api("settings", "POST", { key, value: parsed }), "Setting saved.").then(() => reload());
            }}
          >
            Save setting
          </Button>
        </div>
      </Card>
      <Card className="p-5 lg:col-span-2">
        <h2 className="font-bold">Stored settings</h2>
        <div className="mt-3 space-y-2">
          {settings.length === 0 ? <EmptyState icon={Settings2} title="No settings yet" description="Add categories, subjects or a custom key above." /> : settings.map((s) => (
            <div key={label(s.key)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/20 px-3 py-2 text-xs">
              <b>{label(s.key)}</b>
              <span className="truncate text-muted">{label(s.value)}</span>
              <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${label(s.key)}?`)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function settingText(settings: Row[], key: string) {
  const row = settings.find((s) => s.key === key);
  const value = row?.value;
  if (Array.isArray(value)) return value.join(", ");
  return label(value) === "—" ? "" : label(value);
}

function toList(value: string) {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

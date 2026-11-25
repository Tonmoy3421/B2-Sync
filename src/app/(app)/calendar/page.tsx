"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bell, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { useCourses, useGroups, useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AIUB_CALENDARS, AIUB_CALENDAR_URL, aiubEventIso, type AiubCalendarKey } from "@/lib/aiub";
import { EVENT_KINDS } from "@/lib/constants";
import { invalidate } from "@/lib/actions";
import { addDays, cn, dhakaDate, errMsg, weekStart } from "@/lib/utils";
import type { CalEvent, EventKind } from "@/lib/types";

type View = "month" | "week" | "day";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" });

/** "YYYY-MM-DDTHH:mm" in Dhaka time -> ISO */
const toIso = (local: string) => new Date(local + ":00+06:00").toISOString();
const toLocal = (iso: string) => {
  const d = dhakaDate(iso);
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d}T${t === "24:00" ? "00:00" : t}`;
};

export default function CalendarPage() {
  const { profile } = useProfile();
  const today = dhakaDate();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(today);
  const [edit, setEdit] = useState<CalEvent | { starts: string } | null>(null);
  const [del, setDel] = useState<CalEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const range = useMemo(() => {
    if (view === "day") return [cursor, cursor] as const;
    if (view === "week") return [weekStart(cursor), addDays(weekStart(cursor), 6)] as const;
    const first = cursor.slice(0, 7) + "-01";
    return [weekStart(first), addDays(weekStart(first), 41)] as const;
  }, [view, cursor]);

  const { data: events, mutate } = useSWR(profile ? `calendar:${profile.id}:${range[0]}:${range[1]}` : null, async () => {
    const { data } = await supabaseBrowser()
      .from("events")
      .select("*")
      .gte("starts_at", new Date(range[0] + "T00:00:00+06:00").toISOString())
      .lt("starts_at", new Date(addDays(range[1], 1) + "T00:00:00+06:00").toISOString())
      .order("starts_at");
    return (data ?? []) as CalEvent[];
  });

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    (events ?? []).forEach((e) => {
      const d = dhakaDate(e.starts_at);
      m.set(d, [...(m.get(d) ?? []), e]);
    });
    return m;
  }, [events]);

  function move(dir: -1 | 1) {
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, 7 * dir));
    else {
      const d = new Date(cursor.slice(0, 7) + "-15T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + dir);
      setCursor(d.toISOString().slice(0, 10));
    }
  }

  const title = useMemo(() => {
    const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...o });
    if (view === "month") return f(cursor, { month: "long", year: "numeric" });
    if (view === "week") return `${f(range[0], { month: "short", day: "numeric" })} – ${f(range[1], { month: "short", day: "numeric", year: "numeric" })}`;
    return f(cursor, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, cursor, range]);

  const days = useMemo(() => {
    const n = view === "month" ? 42 : view === "week" ? 7 : 1;
    return Array.from({ length: n }, (_, i) => addDays(range[0], i));
  }, [view, range]);

  async function remove(e: CalEvent) {
    const { error } = await supabaseBrowser().from("events").delete().eq("id", e.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Event deleted");
    await mutate();
    void invalidate("dashboard", "reminders");
  }

  function Chip({ e }: { e: CalEvent }) {
    const k = EVENT_KINDS[e.kind];
    return (
      <button
        onClick={() => e.user_id === profile?.id ? setEdit(e) : toast.info("Only the creator can edit this group event")}
        className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold transition hover:brightness-125"
        style={{ background: `${k.color}26`, color: k.color }}
        title={`${e.title} · ${time(e.starts_at)}`}
      >
        <span className="shrink-0">{view === "month" ? "" : time(e.starts_at)}</span>
        <span className="truncate">{e.title}</span>
      </button>
    );
  }

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Calendar"
        description="Classes, exams, deadlines, study blocks and group events — with reminders."
        actions={
          <>
            <Button variant="secondary" icon={CalendarRange} onClick={() => setImportOpen(true)}>AIUB calendar</Button>
            <Button icon={Plus} onClick={() => setEdit({ starts: `${view === "month" ? today : cursor}T09:00` })}>New event</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Previous" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="icon" aria-label="Next" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setCursor(today)}>Today</Button>
          <h2 className="ml-2 text-lg font-bold">{title}</h2>
        </div>
        <Tabs id="cal-view" value={view} onChange={setView} tabs={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]} />
      </div>

      {view === "day" ? (
        <Card>
          {(byDay.get(cursor) ?? []).length === 0 ? (
            <EmptyState icon={CalendarDays} title="Free day" description="Nothing scheduled — add a study block?" action={<Button icon={Plus} onClick={() => setEdit({ starts: `${cursor}T09:00` })}>Add event</Button>} className="border-0" />
          ) : (
            <ul className="space-y-2">
              {(byDay.get(cursor) ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: `${EVENT_KINDS[e.kind].color}18` }}>
                  <span className="text-xl">{EVENT_KINDS[e.kind].emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">{time(e.starts_at)}{e.ends_at ? ` – ${time(e.ends_at)}` : ""} · {EVENT_KINDS[e.kind].label}</p>
                    {e.description && <p className="mt-1 text-sm text-muted">{e.description}</p>}
                  </div>
                  {e.user_id === profile?.id && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(e)}>Edit</Button>
                      <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setDel(e)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line/10 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = view === "week" || d.slice(0, 7) === cursor.slice(0, 7);
              return (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setCursor(d); setView("day"); }}
                  onKeyDown={(e) => e.key === "Enter" && (setCursor(d), setView("day"))}
                  className={cn("min-h-[92px] cursor-pointer border-b border-r border-line/10 p-1.5 transition hover:bg-brand/5 sm:min-h-[112px]", !inMonth && "opacity-40", view === "week" && "min-h-[260px]")}
                >
                  <span className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", d === today && "bg-brand-gradient text-white")}>{Number(d.slice(8))}</span>
                  <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                    {list.slice(0, view === "week" ? 12 : 3).map((e) => <Chip key={e.id} e={e} />)}
                    {view === "month" && list.length > 3 && <p className="px-1 text-[10px] font-semibold text-muted">+{list.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => (
          <Badge key={k} tone="muted"><span style={{ color: EVENT_KINDS[k].color }}>●</span> {EVENT_KINDS[k].label}</Badge>
        ))}
      </div>

      <EventModal state={edit} onClose={() => setEdit(null)} userId={profile?.id} onSaved={() => { void mutate(); void invalidate("dashboard", "reminders"); }} onDelete={(e) => { setEdit(null); setDel(e); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this event?" description={del?.title ?? ""} confirmLabel="Delete" danger onConfirm={() => del && remove(del)} />
      <AiubCalendarModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        userId={profile?.id}
        onImported={async () => {
          setImportOpen(false);
          await mutate();
          void invalidate("reminders");
        }}
      />
    </>
  );
}

/* ------------------------- AIUB calendar import --------------------- */
function AiubCalendarModal({
  open,
  onClose,
  userId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
  onImported: () => Promise<void> | void;
}) {
  const [key, setKey] = useState<AiubCalendarKey>("cse");
  const [busy, setBusy] = useState(false);
  const cal = AIUB_CALENDARS[key];

  async function importEvents() {
    if (!userId) return;
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const { data: existing, error: readError } = await sb.from("events").select("title, starts_at").eq("user_id", userId);
      if (readError) throw readError;
      const have = new Set((existing ?? []).map((e) => `${e.title}|${dhakaDate(e.starts_at)}`));
      const rows = cal.events
        .filter((e) => !have.has(`${e.title}|${e.date}`))
        .map((e) => ({
          user_id: userId,
          title: e.title,
          kind: e.kind,
          description: [e.description, e.endDate && e.endDate !== e.date ? `Until ${e.endDate}` : "", `Source: AIUB ${cal.term} academic calendar`]
            .filter(Boolean)
            .join(" · "),
          starts_at: aiubEventIso(e.date),
          ends_at: e.endDate ? aiubEventIso(e.endDate, true) : null,
          remind_minutes: e.kind === "exam" || e.kind === "assignment" ? 1440 : 60,
        }));

      if (!rows.length) {
        toast.info("These AIUB events are already on your calendar");
        onClose();
        return;
      }
      const { error } = await sb.from("events").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} AIUB event${rows.length === 1 ? "" : "s"} added to your calendar`);
      await onImported();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const format = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import AIUB academic calendar"
      description={`${cal.term} · ${cal.note}`}
      size="lg"
    >
      <div className="space-y-4">
        <Tabs
          id="aiub-calendar"
          value={key}
          onChange={setKey}
          tabs={(Object.keys(AIUB_CALENDARS) as AiubCalendarKey[]).map((k) => ({ value: k, label: AIUB_CALENDARS[k].label }))}
        />
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {cal.events.map((e) => (
            <div key={`${e.date}-${e.title}`} className="flex items-start gap-3 rounded-xl bg-line/5 px-3 py-2">
              <span className="w-16 shrink-0 text-xs font-bold text-brand">
                {format(e.date)}
                {e.endDate && e.endDate !== e.date ? ` – ${format(e.endDate)}` : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{e.title}</span>
                {e.description && <span className="block text-xs text-muted">{e.description}</span>}
              </span>
              <Badge tone="muted">{EVENT_KINDS[e.kind].emoji}</Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Events already in your calendar with the same title and date are skipped. Source:{" "}
          <a href={AIUB_CALENDAR_URL} target="_blank" rel="noreferrer" className="text-brand hover:underline">aiub.edu/academic-calendar</a>
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} icon={CalendarRange} onClick={importEvents}>Import {cal.events.length} events</Button>
        </div>
      </div>
    </Modal>
  );
}

function EventModal({ state, onClose, userId, onSaved, onDelete }: { state: CalEvent | { starts: string } | null; onClose: () => void; userId?: string; onSaved: () => void; onDelete: (e: CalEvent) => void }) {
  const { courses } = useCourses();
  const { memberships } = useGroups();
  const editing = state && "id" in state ? state : null;
  const [key, setKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("study");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [desc, setDesc] = useState("");
  const [remind, setRemind] = useState(30);
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);

  const k = state ? (editing ? editing.id : `new:${(state as { starts: string }).starts}`) : null;
  if (k !== key) {
    setKey(k);
    setTitle(editing?.title ?? "");
    setKind(editing?.kind ?? "study");
    setStarts(editing ? toLocal(editing.starts_at) : (state as { starts: string } | null)?.starts ?? "");
    setEnds(editing?.ends_at ? toLocal(editing.ends_at) : "");
    setDesc(editing?.description ?? "");
    setRemind(editing?.remind_minutes ?? 30);
    setCourseId(editing?.course_id ?? "");
    setGroupId(editing?.group_id ?? "");
  }

  async function save() {
    if (!userId) return;
    if (!title.trim()) return toast.error("Give the event a title");
    if (!starts) return toast.error("Pick a start time");
    if (ends && ends <= starts) return toast.error("End time must be after the start");
    setBusy(true);
    const payload = { title: title.trim(), kind, description: desc.trim(), starts_at: toIso(starts), ends_at: ends ? toIso(ends) : null, remind_minutes: remind, course_id: courseId || null, group_id: groupId || null };
    const sb = supabaseBrowser();
    const { error } = editing ? await sb.from("events").update(payload).eq("id", editing.id) : await sb.from("events").insert({ ...payload, user_id: userId });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(editing ? "Event updated" : "Event added 📅");
    onSaved();
    onClose();
  }

  return (
    <Modal open={!!state} onClose={onClose} title={editing ? "Edit event" : "New event"} size="lg">
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algorithms midterm" maxLength={140} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            {(Object.keys(EVENT_KINDS) as EventKind[]).map((x) => <option key={x} value={x}>{EVENT_KINDS[x].emoji} {EVENT_KINDS[x].label}</option>)}
          </Select>
          <Select label="Remind me" value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
            {[[0, "At start"], [10, "10 minutes before"], [30, "30 minutes before"], [60, "1 hour before"], [1440, "1 day before"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Input label="Starts (Dhaka time)" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          <Input label="Ends (optional)" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
          <Select label="Course (optional)" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">None</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Share with group (optional)" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Just me</option>
            {memberships.map((m) => <option key={m.group.id} value={m.group.id}>{m.group.name}</option>)}
          </Select>
        </div>
        <Textarea label="Notes" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
        <p className="flex items-center gap-1.5 text-xs text-muted"><Bell className="h-3.5 w-3.5" /> Reminders pop up while B2 Sync is open in your browser.</p>
        <div className="flex justify-between gap-2">
          {editing ? <Button variant="danger" icon={Trash2} onClick={() => onDelete(editing)}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button loading={busy} onClick={save}>{editing ? "Save" : "Add event"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

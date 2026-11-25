"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BookOpen, CalendarDays, FileText, FolderOpen, ListChecks, Search as SearchIcon, Target, User, Users } from "lucide-react";
import { Avatar, Card, CardTitle, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useProfile } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime, likeEscape } from "@/lib/utils";

interface Results {
  courses: { id: string; name: string; code: string }[];
  topics: { id: string; title: string; course_id: string }[];
  groups: { id: string; name: string }[];
  people: { id: string; username: string; full_name: string; avatar_url: string | null }[];
  notes: { topic_id: string; body: string }[];
  resources: { id: string; title: string; kind: string }[];
  goals: { id: string; title: string }[];
  events: { id: string; title: string; starts_at: string }[];
}

function SearchInner() {
  const { profile } = useProfile();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useSWR(profile && term.length >= 2 ? `search:${term}` : null, async (): Promise<Results> => {
    const sb = supabaseBrowser();
    const like = `%${likeEscape(term)}%`;
    // Every query goes through Row Level Security, so you only ever see what you're allowed to.
    const [courses, topics, groups, people, notes, resources, goals, events] = await Promise.all([
      sb.from("courses").select("id, name, code").or(`name.ilike.${like},code.ilike.${like}`).limit(6),
      sb.from("topics").select("id, title, course_id").ilike("title", like).limit(8),
      sb.from("groups").select("id, name").ilike("name", like).limit(6),
      sb.from("profiles").select("id, username, full_name, avatar_url").or(`username.ilike.${like},full_name.ilike.${like}`).limit(6),
      sb.from("topic_notes").select("topic_id, body").ilike("body", like).limit(6),
      sb.from("resources").select("id, title, kind").or(`title.ilike.${like},description.ilike.${like}`).limit(8),
      sb.from("goals").select("id, title").ilike("title", like).limit(6),
      sb.from("events").select("id, title, starts_at").ilike("title", like).order("starts_at", { ascending: false }).limit(6),
    ]);
    return {
      courses: courses.data ?? [],
      topics: topics.data ?? [],
      groups: groups.data ?? [],
      people: people.data ?? [],
      notes: notes.data ?? [],
      resources: resources.data ?? [],
      goals: goals.data ?? [],
      events: events.data ?? [],
    } as Results;
  });

  const total = data ? Object.values(data).reduce((a, l) => a + l.length, 0) : 0;
  const Row = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="flex items-center gap-3 rounded-xl bg-line/5 px-3 py-2.5 text-sm transition hover:bg-brand/10">
      {children}
    </Link>
  );

  return (
    <>
      <PageHeader icon={SearchIcon} title="Search" description="Courses, topics, groups, people, notes, files, goals and reminders — only what you're allowed to see." />
      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input autoFocus aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters…" className="field h-14 pl-12 text-base" maxLength={60} />
      </div>

      {term.length < 2 ? (
        <EmptyState icon={SearchIcon} title="Start typing to search" description="Try a course code, a friend's username, or a topic name." />
      ) : isLoading || !data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : total === 0 ? (
        <EmptyState icon={SearchIcon} title={`No results for “${term}”`} description="Check the spelling, or try a shorter word." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.courses.length > 0 && (
            <Card><CardTitle icon={BookOpen}>Courses</CardTitle><div className="space-y-2">{data.courses.map((c) => <Row key={c.id} href={`/courses/${c.id}`}><span className="font-semibold">{c.name}</span><span className="text-xs text-muted">{c.code}</span></Row>)}</div></Card>
          )}
          {data.topics.length > 0 && (
            <Card><CardTitle icon={ListChecks}>Topics</CardTitle><div className="space-y-2">{data.topics.map((t) => <Row key={t.id} href={`/courses/${t.course_id}`}><span className="font-semibold">{t.title}</span></Row>)}</div></Card>
          )}
          {data.groups.length > 0 && (
            <Card><CardTitle icon={Users}>Study groups</CardTitle><div className="space-y-2">{data.groups.map((g) => <Row key={g.id} href={`/groups/${g.id}`}><span className="font-semibold">{g.name}</span></Row>)}</div></Card>
          )}
          {data.people.length > 0 && (
            <Card><CardTitle icon={User}>People</CardTitle><div className="space-y-2">{data.people.map((p) => <Row key={p.id} href="/leaderboard"><Avatar name={p.full_name || p.username} src={p.avatar_url} size={28} /><span className="font-semibold">@{p.username}</span><span className="truncate text-xs text-muted">{p.full_name}</span></Row>)}</div></Card>
          )}
          {data.notes.length > 0 && (
            <Card><CardTitle icon={FileText}>Notes</CardTitle><div className="space-y-2">{data.notes.map((n) => {
              const i = Math.max(0, n.body.toLowerCase().indexOf(term.toLowerCase()) - 20);
              return <Row key={n.topic_id} href="/courses"><span className="line-clamp-2 text-muted">…{n.body.slice(i, i + 90)}…</span></Row>;
            })}</div></Card>
          )}
          {data.resources.length > 0 && (
            <Card><CardTitle icon={FolderOpen}>Vault</CardTitle><div className="space-y-2">{data.resources.map((r) => <Row key={r.id} href="/vault"><span className="font-semibold">{r.title}</span><span className="text-xs text-muted">{r.kind}</span></Row>)}</div></Card>
          )}
          {data.goals.length > 0 && (
            <Card><CardTitle icon={Target}>Goals</CardTitle><div className="space-y-2">{data.goals.map((g) => <Row key={g.id} href="/goals"><span className="font-semibold">{g.title}</span></Row>)}</div></Card>
          )}
          {data.events.length > 0 && (
            <Card><CardTitle icon={CalendarDays}>Calendar &amp; reminders</CardTitle><div className="space-y-2">{data.events.map((e) => <Row key={e.id} href="/calendar"><span className="font-semibold">{e.title}</span><span className="text-xs text-muted">{formatDateTime(e.starts_at)}</span></Row>)}</div></Card>
          )}
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <SearchInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, ChevronsLeft, Clock3, Flame, LogOut, Menu, MoreHorizontal, RefreshCw, Search, Settings, Shield, Sparkles, UserRound, X, Zap } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { ThemeToggle } from "./theme-toggle";
import { MOBILE_TABS, NAV_SECTIONS } from "./nav";
import { useProfile, useSession } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { levelFromXp, levelProgress } from "@/lib/xp";
import { celebrate, invalidate } from "@/lib/actions";
import { cn, errMsg } from "@/lib/utils";
import type { CalEvent } from "@/lib/types";

const COLLAPSE_KEY = "studysync:sidebar-collapsed";

function SidebarContents({ collapsed, onNavigate, variant = "desktop", isAdmin = false }: { collapsed: boolean; onNavigate?: () => void; variant?: "desktop" | "mobile"; isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{section.title}</p>}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "justify-center",
                      active ? "text-white" : "text-muted hover:bg-brand/10 hover:text-fg"
                    )}
                  >
                    {active && (
                      <motion.span layoutId={`nav-active-${variant}`} className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow" transition={{ type: "spring", damping: 30, stiffness: 380 }} />
                    )}
                    <item.icon className={cn("relative h-5 w-5 shrink-0 transition-transform group-hover:scale-110", !active && "group-hover:text-brand")} />
                    {!collapsed && <span className="relative truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {isAdmin && (
        <div>
          {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">Administration</p>}
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin/dashboard"
                onClick={onNavigate}
                title={collapsed ? "Admin panel" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  pathname.startsWith("/admin") ? "text-white" : "text-muted hover:bg-brand/10 hover:text-fg"
                )}
              >
                {pathname.startsWith("/admin") && <motion.span layoutId={`nav-active-${variant}`} className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow" />}
                <Shield className="relative h-5 w-5 shrink-0" />
                {!collapsed && <span className="relative truncate">Admin panel</span>}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
        <Sparkles className="h-5 w-5" />
      </div>
      {!collapsed && <span className="text-lg font-extrabold tracking-tight">B2 <span className="text-gradient">Sync</span></span>}
    </Link>
  );
}

/** Background jobs that run while the app is open. */
function Watchers({ userId, remindersOn }: { userId: string; remindersOn: boolean }) {
  // 1) settle expired pledges for everyone in my groups
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabaseBrowser().rpc("evaluate_my_commitments");
      if (!cancelled && typeof data === "number" && data > 0) {
        toast.info("A study pledge was just settled — check Pledges & Dares");
        await invalidate("profile", "groups", "commitments", "dares", "activities", "leaderboard", "arena");
      }
    };
    void run();
    const t = window.setInterval(run, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [userId]);

  // 2) upcoming-event reminders
  const { data: events } = useSWR(
    remindersOn ? "reminders" : null,
    async () => {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const { data } = await supabaseBrowser().from("events").select("*").gte("starts_at", from).lte("starts_at", to);
      return (data ?? []) as CalEvent[];
    },
    { refreshInterval: 5 * 60 * 1000 }
  );

  useEffect(() => {
    if (!events?.length) return;
    const check = () => {
      let seen: string[] = [];
      try {
        seen = JSON.parse(sessionStorage.getItem("studysync:notified") || "[]");
      } catch {
        seen = [];
      }
      const now = Date.now();
      events.forEach((ev) => {
        const start = new Date(ev.starts_at).getTime();
        const remindAt = start - ev.remind_minutes * 60000;
        if (now >= remindAt && now < start && !seen.includes(ev.id)) {
          seen.push(ev.id);
          const mins = Math.max(1, Math.round((start - now) / 60000));
          toast(`⏰ ${ev.title}`, { description: `Starts in ${mins} min`, duration: 12000 });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(ev.title, { body: `Starts in ${mins} min` });
          }
        }
      });
      try {
        sessionStorage.setItem("studysync:notified", JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    };
    check();
    const t = window.setInterval(check, 30000);
    return () => window.clearInterval(t);
  }, [events]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isLoading, error, mutate: reloadProfile } = useProfile();
  const { isAdmin, isLoading: sessionLoading } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const prevXp = useRef<number | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { setDrawer(false); setAccountOpen(false); }, [pathname]);

  // guard: must be signed in and must have a profile (username)
  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
    else if (!profile) router.replace("/onboarding");
  }, [isLoading, user, profile, router]);

  // XP toast + level-up confetti whenever XP changes
  useEffect(() => {
    if (!profile) return;
    if (prevXp.current !== null && profile.xp !== prevXp.current) {
      const diff = profile.xp - prevXp.current;
      if (diff > 0) toast.success(`+${diff} XP`, { icon: <Zap className="h-4 w-4 text-brand" />, duration: 2500 });
      else toast.error(`${diff} XP`, { duration: 2500 });
      if (levelFromXp(profile.xp) > levelFromXp(prevXp.current)) {
        celebrate(true);
        toast.success(`🎉 Level up! You are now level ${levelFromXp(profile.xp)}`, { duration: 6000 });
      }
    }
    prevXp.current = profile.xp;
  }, [profile]);

  function toggleCollapse() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    await supabaseBrowser().auth.signOut();
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
  }

  // Visible fallback: never leave a blank/dark screen if loading stalls or fails.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass w-full max-w-md rounded-2xl p-7 text-center">
          <Clock3 className="mx-auto h-10 w-10 text-warn" />
          <h1 className="mt-4 text-lg font-bold">Couldn&apos;t load your workspace</h1>
          <p className="mt-2 break-words text-sm text-muted">{errMsg(error)}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => reloadProfile()}>Try again</Button>
            <Button variant="secondary" onClick={() => router.push("/login")}>Back to sign in</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || sessionLoading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-4 text-sm font-medium text-fg">{!user ? "Redirecting to sign in…" : !profile ? "Setting up your workspace…" : "Loading B2 Sync…"}</p>
          <button onClick={() => router.push("/login")} className="mt-3 text-xs text-brand hover:underline">
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  if (profile.approved === false && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass w-full max-w-md rounded-2xl p-7 text-center">
          <Clock3 className="mx-auto h-10 w-10 text-brand" />
          <h1 className="mt-4 text-xl font-bold">Request pending</h1>
          <p className="mt-2 text-sm text-muted">
            Thanks, {profile.full_name || profile.username}. Your join request is with the admin. You&apos;ll get full access once it&apos;s approved.
          </p>
          <p className="mt-3 text-xs text-muted">Signed in as {user.email}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => reloadProfile()}>Check again</Button>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  const lp = levelProgress(profile.xp);
  const fullBleed = pathname === "/focus";

  return (
    <div className="flex min-h-screen">
      <Watchers userId={user.id} remindersOn={profile.notify_prefs?.reminders !== false} />

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="glass sticky top-0 hidden h-screen shrink-0 flex-col border-y-0 border-l-0 lg:flex"
      >
        <Logo collapsed={collapsed} />
        <SidebarContents collapsed={collapsed} isAdmin={isAdmin} />
        <div className="border-t border-line/15 p-3">
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted transition hover:bg-brand/10 hover:text-fg"
          >
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
              <ChevronsLeft className="h-4 w-4" />
            </motion.span>
            {!collapsed && "Collapse"}
          </button>
        </div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              className="glass fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface/95 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              <div className="flex items-center justify-between pr-3">
                <Logo />
                <button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-2 text-muted hover:bg-brand/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContents collapsed={false} onNavigate={() => setDrawer(false)} variant="mobile" isAdmin={isAdmin} />
              <div className="border-t border-line/15 p-3">
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 sm:px-6">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-xl p-2 text-muted transition hover:bg-brand/10 hover:text-fg lg:hidden">
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/search" className="group flex h-10 max-w-md flex-1 items-center gap-2 rounded-xl border border-line/20 bg-surface/50 px-3.5 text-sm text-muted transition hover:border-brand/50">
            <Search className="h-4 w-4 group-hover:text-brand" />
            <span className="truncate">Search courses, notes, people…</span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link href="/timer" title="Study streak" className="glass hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold sm:flex">
              <Flame className={cn("h-4 w-4", profile.streak > 0 ? "text-warn" : "text-muted")} />
              <span className="tabular-nums">{profile.streak}</span>
            </Link>
            <Link href="/profile" title="Your level" className="glass flex items-center gap-2.5 rounded-xl px-3 py-1.5">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-xs font-extrabold text-white">{lp.level}</div>
              <div className="hidden w-24 sm:block">
                <div className="flex justify-between text-[10px] font-semibold text-muted">
                  <span>{profile.xp} XP</span>
                  <span>{lp.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/20">
                  <motion.div className="h-full rounded-full bg-brand-gradient" animate={{ width: `${lp.pct}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            </Link>
            <ThemeToggle />
            <Link href="/profile" aria-label="Profile" className="hidden sm:block">
              <Avatar name={profile.full_name || profile.username} src={profile.avatar_url} size={40} />
            </Link>
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className="hidden rounded-xl p-2.5 text-muted transition hover:bg-danger/10 hover:text-danger lg:block">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className={cn("flex-1", fullBleed ? "" : "mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10")}>
          <motion.div key={pathname} initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: "easeOut" }}>
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex border-x-0 border-b-0 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", active ? "text-brand" : "text-muted")}>
              {active && <motion.span layoutId="tab-dot" className="absolute -top-px h-0.5 w-8 rounded-full bg-brand" />}
              <t.icon className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted">
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>
    </div>
  );
}

"use client";

import useSWR, { mutate as globalMutate } from "swr";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase/client";
import type { Membership, Profile } from "./types";

export async function getUid(): Promise<string | null> {
  const { data } = await supabaseBrowser().auth.getSession();
  return data.session?.user.id ?? null;
}

export function useProfile() {
  const { data, isLoading, error, mutate } = useSWR(
    "profile",
    async (): Promise<{ user: User | null; profile: Profile | null }> => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getSession();
      const user = auth.session?.user ?? null;
      if (!user) return { user: null, profile: null };
      const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return { user, profile: (profile as Profile | null) ?? null };
    },
    { revalidateOnFocus: true }
  );
  return { user: data?.user ?? null, profile: data?.profile ?? null, isLoading, error, mutate };
}

export function useGroups() {
  const { data, isLoading, mutate } = useSWR("groups", async (): Promise<Membership[]> => {
    const uid = await getUid();
    if (!uid) return [];
    const { data, error } = await supabaseBrowser()
      .from("group_members")
      .select("role, warnings, group:groups(*)")
      .eq("user_id", uid);
    if (error) throw error;
    return ((data ?? []) as unknown as Membership[]).filter((m) => m.group);
  });
  return { memberships: data ?? [], isLoading, mutate };
}

const ACTIVE_KEY = "studysync:active-group";

/** The group the user is currently "working in" (remembered between visits). */
export function useActiveGroup() {
  const { memberships, isLoading } = useGroups();
  const { data: storedId } = useSWR("active-group-id", () => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });
  const active = memberships.find((m) => m.group.id === storedId) ?? memberships[0] ?? null;
  const setActive = (id: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
    globalMutate("active-group-id", id, false);
  };
  return { memberships, active, setActive, isLoading };
}

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export function useSession() {
  const { data, isLoading, mutate } = useSWR<{ user: SessionUser | null }>("session", async () => {
    const res = await fetch("/api/auth/session");
    return (await res.json()) as { user: SessionUser | null };
  });
  return { user: data?.user ?? null, isAdmin: data?.user?.isAdmin ?? false, isLoading, mutate };
}

export function useCourses() {
  const { profile } = useProfile();
  // Distinct key: courses/:id is the summary object used by the courses page.
  const { data, isLoading } = useSWR(profile ? `courses:list:${profile.id}` : null, async () => {
    const { data } = await supabaseBrowser().from("courses").select("*").order("created_at", { ascending: false });
    return (data ?? []) as import("./types").Course[];
  });
  return { courses: data ?? [], isLoading };
}

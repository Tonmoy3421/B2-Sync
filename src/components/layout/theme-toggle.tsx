"use client";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getUid } from "@/lib/hooks";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  async function toggle() {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
    // remember the choice on the account too (best effort)
    const uid = await getUid();
    if (uid) await supabaseBrowser().from("profiles").update({ theme: next }).eq("id", uid);
  }

  return (
    <motion.button
      whileTap={{ scale: 0.88, rotate: 15 }}
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle theme"
      className={`glass relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-fg transition hover:border-brand/50 ${className ?? ""}`}
    >
      {/* CSS controls which icon shows, so the browser paints the right one on first frame. */}
      <Sun className="block h-5 w-5 text-warn dark:hidden" />
      <Moon className="hidden h-5 w-5 text-brand dark:block" />
    </motion.button>
  );
}

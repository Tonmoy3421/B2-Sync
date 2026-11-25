"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      richColors
      closeButton
      toastOptions={{ className: "!rounded-xl2 !font-sans" }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem themes={["dark", "light"]} disableTransitionOnChange>
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}

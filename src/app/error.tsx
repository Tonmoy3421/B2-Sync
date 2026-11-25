"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("B2 Sync error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-[var(--fg)]">
      <div className="glass w-full max-w-md rounded-2xl p-7 text-center">
        <RefreshCw className="mx-auto h-10 w-10 text-brand" />
        <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">{error.message || "The page could not be displayed."}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>Go to dashboard</Button>
        </div>
      </div>
    </div>
  );
}

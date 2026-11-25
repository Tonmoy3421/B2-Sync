"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#060a14", color: "#f8fafc", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>B2 Sync could not start</h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>{error.message || "An unexpected error occurred."}</p>
          <button
            onClick={reset}
            style={{ marginTop: 20, padding: "10px 18px", borderRadius: 12, border: 0, background: "#22d3ee", color: "#04121a", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

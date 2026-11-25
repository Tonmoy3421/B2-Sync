import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "B2 Sync", template: "%s · B2 Sync" },
  description: "Study together. Stay accountable. Level up. The collaborative study platform for university friends.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060a14" },
    { media: "(prefers-color-scheme: light)", color: "#eef3fa" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

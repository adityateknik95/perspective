import type { Metadata } from "next";
import { fraunces, newsreader, jetbrainsMono } from "@/lib/fonts";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Perspective",
    template: "%s · Perspective",
  },
  description: "A place for how you saw it, not how you rated it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs synchronously before paint to set data-theme="dark" when
            the persisted preference (or OS, when no preference) is dark.
            suppressHydrationWarning above lets React tolerate the resulting
            attribute mismatch — we WANT the script to mutate <html>. */}
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-cream font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}

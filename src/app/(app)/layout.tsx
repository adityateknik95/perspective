import { AppHeader } from "@/components/layout/app-header";

// Wraps every authenticated-shell route (and public profile pages) with the
// shared header. Route-specific gating (e.g. onboarding, settings) is handled
// by the middleware and individual pages.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}

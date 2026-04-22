import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <Logo className="text-reading-lg" />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-md flex-col justify-center px-6 py-16">
        {children}
      </main>
    </div>
  );
}

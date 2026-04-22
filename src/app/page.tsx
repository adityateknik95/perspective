import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-8 px-6 py-24">
      <Logo className="text-display-xl" />
      <p className="max-w-prose font-body text-reading-lg text-ink-soft">
        A place for how you saw it, not how you rated it.
      </p>
      <p className="font-mono text-meta-sm uppercase text-ink-muted">
        Landing page lands in the final slice. See{" "}
        <Link
          href="/design-system"
          className="text-wine underline underline-offset-4 hover:text-wine-deep"
        >
          /design-system
        </Link>{" "}
        for the tokens.
      </p>
    </main>
  );
}

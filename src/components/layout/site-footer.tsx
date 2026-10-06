import Link from "next/link";
import { TmdbAttribution } from "@/components/tmdb/tmdb-attribution";

// Site-wide footer: legal links, plus the TMDB attribution the API terms
// require on every page that can show TMDB data (via posters, nearly all).
export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <nav aria-label="Legal" className="flex gap-6 font-mono text-meta-sm uppercase text-ink-muted">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </nav>
        <TmdbAttribution />
      </div>
    </footer>
  );
}

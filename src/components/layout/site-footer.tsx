import { TmdbAttribution } from "@/components/tmdb/tmdb-attribution";

// Site-wide footer. Carries the TMDB attribution the API terms require on
// every page that can show TMDB data (which, via posters, is nearly all).
export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <TmdbAttribution />
      </div>
    </footer>
  );
}

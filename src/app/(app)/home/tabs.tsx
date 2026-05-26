import Link from "next/link";
import { cn } from "@/lib/cn";

export type HomeTab = "films" | "following" | "writing";

const TABS: ReadonlyArray<{ key: HomeTab; label: string; sub: string }> = [
  { key: "films", label: "Films", sub: "In cinema this week" },
  { key: "following", label: "Following", sub: "People you read" },
  { key: "writing", label: "Writing", sub: "Your drafts" },
];

interface HomeTabsProps {
  active: HomeTab;
}

// Linkable tab strip. Each tab is a server-rendered <Link> so the back
// button works and a tab is shareable. Tab state lives in the URL via
// ?tab=… — the page reads it and renders the matching content. The first
// time someone hits /home with no query, we default to films.
//
// Visually: an editorial divider with three tracking-out labels. Active
// tab gets a wine underline; inactive tabs read muted. Matches the
// "Filed under" / "Now showing" register the app uses elsewhere.
export function HomeTabs({ active }: HomeTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Home sections"
      className="border-b border-rule"
    >
      <ul className="-mb-px flex flex-wrap gap-x-8 gap-y-2">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          // Default tab omits the query entirely so /home is the canonical
          // URL — saves the user a redirect and keeps the link clean.
          const href =
            tab.key === "films" ? "/home" : `/home?tab=${tab.key}`;
          return (
            <li key={tab.key}>
              <Link
                href={href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group inline-flex flex-col gap-1 border-b-2 py-4 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                  isActive
                    ? "border-wine text-ink"
                    : "border-transparent text-ink-muted hover:border-ink-soft hover:text-ink",
                )}
              >
                <span className="font-display text-display-sm">
                  {tab.label}
                </span>
                <span className="font-mono text-meta-sm uppercase tracking-[0.15em]">
                  {tab.sub}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

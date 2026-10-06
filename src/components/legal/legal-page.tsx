import type { ReactNode } from "react";

// Shared shell for /terms and /privacy.
//
// THESE ARE DRAFTS. They were written to match what the code actually does
// (what's stored, who processes it, what deletion removes), but they are not
// legal advice and have not been reviewed by counsel. Every [bracketed]
// <Fill> is a decision or fact only the operator can supply. Remove the
// banner (and the noindex in each page's metadata) only after review.

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-reading px-4 py-12 sm:px-6">
      <div
        role="note"
        className="border-l-4 border-wine bg-cream-deep px-4 py-3 font-mono text-meta-sm uppercase text-wine"
      >
        Draft — not yet reviewed. Not legal advice. Text in [brackets] is a
        placeholder.
      </div>
      <h1 className="mt-10 font-display text-display-md text-ink sm:text-display-lg">
        {title}
        <span className="italic">.</span>
      </h1>
      <p className="mt-3 font-mono text-meta-sm uppercase text-ink-muted">Last updated {updated}</p>
      <div className="legal-prose mt-10 space-y-5 font-body text-reading text-ink-soft [&_a]:text-wine [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-display-sm [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        {children}
      </div>
    </article>
  );
}

// A value the operator has to supply. Highlighted so it can't be missed.
export function Fill({ children }: { children: ReactNode }) {
  return <mark className="bg-wine/15 px-1 text-ink">[{children}]</mark>;
}

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/moderation/admin";
import { loadModerationQueue } from "@/lib/moderation/queue";
import { EmptyState } from "@/components/ui/empty-state";
import { ModerationButtons } from "./moderation-buttons";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

// Always fresh: this is a work queue, not a page to cache.
export const dynamic = "force-dynamic";

// Minimal moderation queue. Admins (ADMIN_USER_IDS) see open reports
// grouped by target and can hide the content or dismiss the reports; hidden
// content is listed below with an Unhide. Everyone else gets a 404.
export default async function ReportsPage() {
  await requireAdmin();
  const { queue, hidden } = await loadModerationQueue();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="font-mono text-meta-sm uppercase text-ink-muted">Moderation</p>
      <h1 className="mt-3 font-display text-display-lg text-ink">
        Reports<span className="italic">.</span>
      </h1>

      <section aria-labelledby="open-heading" className="mt-10">
        <h2 id="open-heading" className="font-mono text-meta-sm uppercase text-ink-muted">
          Open ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <EmptyState className="mt-4" title="Nothing to review." body="New reports will show up here." />
        ) : (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {queue.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`} className="space-y-3 py-6">
                <p className="font-mono text-meta-sm uppercase text-ink-muted">
                  {item.targetType} · {item.reportCount}{" "}
                  {item.reportCount === 1 ? "report" : "reports"} · first{" "}
                  <time dateTime={item.firstReportedAt}>
                    {new Date(item.firstReportedAt).toLocaleString("en-US")}
                  </time>
                  {item.target?.hidden && " · already hidden"}
                </p>

                {item.target ? (
                  <div>
                    <Link href={item.target.href} className="font-body text-reading text-ink hover:underline">
                      {item.target.excerpt || "(empty)"}
                    </Link>
                    {item.target.authorUsername && (
                      <p className="mt-1 font-mono text-meta-sm uppercase text-ink-muted">
                        by @{item.target.authorUsername}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-body text-reading-sm italic text-ink-muted">
                    The content was deleted after it was reported.
                  </p>
                )}

                <ul className="space-y-1 border-l-2 border-rule pl-3">
                  {item.reasons.map((reason, i) => (
                    <li key={i} className="whitespace-pre-wrap font-body text-reading-sm text-ink-soft">
                      {reason}
                    </li>
                  ))}
                </ul>

                <ModerationButtons
                  target={{ targetType: item.targetType, targetId: item.targetId }}
                  kinds={item.target && !item.target.hidden ? ["hide", "dismiss"] : ["dismiss"]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hidden-heading" className="mt-14">
        <h2 id="hidden-heading" className="font-mono text-meta-sm uppercase text-ink-muted">
          Hidden ({hidden.length})
        </h2>
        {hidden.length === 0 ? (
          <p className="mt-4 font-body text-reading-sm text-ink-muted">Nothing is hidden.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {hidden.map((item) => (
              <li
                key={`${item.targetType}:${item.targetId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-meta-sm uppercase text-ink-muted">
                    {item.targetType} · hidden{" "}
                    <time dateTime={item.hiddenAt}>
                      {new Date(item.hiddenAt).toLocaleString("en-US")}
                    </time>
                  </p>
                  <Link href={item.href} className="block truncate font-body text-reading-sm text-ink hover:underline">
                    {item.excerpt || "(empty)"}
                  </Link>
                </div>
                <ModerationButtons
                  target={{ targetType: item.targetType, targetId: item.targetId }}
                  kinds={["unhide"]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

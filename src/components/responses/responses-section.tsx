import Link from "next/link";
import { getResponseThread } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { buttonClassName } from "@/components/ui/button";
import { ResponseComposer } from "./response-composer";
import { ResponseItem } from "./response-item";

interface ResponsesSectionProps {
  perspectiveId: string;
  // Drafts and private pieces don't accept public responses, just like
  // reactions. The read view gates this and won't render the section in
  // those cases.
}

// Server component — fetches the response tree on the read view server-side
// so the initial paint includes the full thread. Inside, the items are
// client components (they need useTransition + useOptimistic for resonance
// and the inline reply composer).
//
// We don't lazy-load. The thread is the second-most-engaged surface after
// the prose itself; the few KB the rows add are worth the no-flash render.
export async function ResponsesSection({
  perspectiveId,
}: ResponsesSectionProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const thread = await getResponseThread(perspectiveId, viewerId, supabase);
  // is_deleted rows are kept in the tree (so structure renders) — count
  // visible responses for the header tally.
  const visibleCount = countVisible(thread);

  const signInHref = `/login?next=${encodeURIComponent(
    `/perspective/${perspectiveId}`,
  )}`;

  return (
    <section
      aria-label="Responses"
      className="mt-14 border-t border-rule pt-8"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-display-sm text-ink">
          Responses<span className="italic">.</span>
        </h2>
        {visibleCount > 0 && (
          <p className="font-mono text-meta-sm uppercase text-ink-muted">
            {visibleCount} {visibleCount === 1 ? "response" : "responses"}
          </p>
        )}
      </header>

      <div className="mt-6">
        {viewerId ? (
          <ResponseComposer perspectiveId={perspectiveId} />
        ) : (
          <div className="border border-rule bg-cream-deep/40 px-6 py-5">
            <p className="font-body text-reading-sm text-ink-soft">
              Sign in to respond.{" "}
              <Link
                href={signInHref}
                className={buttonClassName("link", "sm")}
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="mt-8">
        {thread.length === 0 ? (
          <p className="py-6 font-body text-reading-sm italic text-ink-muted">
            No responses yet. Start the thread.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {thread.map((node) => (
              <li key={node.id}>
                <ResponseItem
                  response={node}
                  perspectiveId={perspectiveId}
                  viewerId={viewerId}
                  signInHref={signInHref}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Walks the tree (two levels deep, max) and counts non-deleted nodes. The
// tally feels more honest than counting every row including [removed]s.
function countVisible(
  nodes: import("@/lib/social/queries").ResponseNode[],
): number {
  let n = 0;
  for (const node of nodes) {
    if (!node.is_deleted) n += 1;
    for (const reply of node.replies) {
      if (!reply.is_deleted) n += 1;
    }
  }
  return n;
}

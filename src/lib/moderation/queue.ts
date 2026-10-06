import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Data for /admin/reports, read with the service role (reports have no
// SELECT policy at all, and hidden content is invisible to everyone but its
// author). Only call this behind requireAdmin().

export type ReportRow = {
  id: string;
  target_type: "perspective" | "response";
  target_id: string;
  reason: string;
  created_at: string;
};

export type QueueItem = {
  targetType: "perspective" | "response";
  targetId: string;
  reportCount: number;
  firstReportedAt: string;
  reasons: string[];
  // Resolved target; null when it was deleted after being reported.
  target: {
    excerpt: string;
    authorUsername: string | null;
    href: string;
    hidden: boolean;
  } | null;
};

export type HiddenItem = {
  targetType: "perspective" | "response";
  targetId: string;
  excerpt: string;
  href: string;
  hiddenAt: string;
};

const MAX_REASONS_SHOWN = 5;

// One queue entry per reported target, most-reported first, then oldest
// first (the report that has waited longest). Pure, so it's unit-tested.
export function groupReports(rows: ReportRow[]): Omit<QueueItem, "target">[] {
  const groups = new Map<string, Omit<QueueItem, "target">>();
  for (const r of rows) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        targetType: r.target_type,
        targetId: r.target_id,
        reportCount: 1,
        firstReportedAt: r.created_at,
        reasons: [r.reason],
      });
      continue;
    }
    g.reportCount += 1;
    if (r.created_at < g.firstReportedAt) g.firstReportedAt = r.created_at;
    if (g.reasons.length < MAX_REASONS_SHOWN) g.reasons.push(r.reason);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      b.reportCount - a.reportCount ||
      a.firstReportedAt.localeCompare(b.firstReportedAt),
  );
}

const excerpt = (text: string | null | undefined, max = 240) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export async function loadModerationQueue(): Promise<{
  queue: QueueItem[];
  hidden: HiddenItem[];
}> {
  const admin = createAdminClient();

  const { data: reports, error } = await admin
    .from("reports")
    .select("id, target_type, target_id, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;

  const groups = groupReports((reports ?? []) as ReportRow[]);
  const ids = (type: "perspective" | "response") =>
    groups.filter((g) => g.targetType === type).map((g) => g.targetId);

  const [perspectives, responses, hiddenPerspectives, hiddenResponses] = await Promise.all([
    admin
      .from("perspectives")
      .select("id, title, body_plaintext, hidden_at, author:profiles!perspectives_user_id_fkey(username)")
      .in("id", ids("perspective")),
    admin
      .from("responses")
      .select("id, perspective_id, body_plaintext, hidden_at, author:profiles!responses_user_id_fkey(username)")
      .in("id", ids("response")),
    admin
      .from("perspectives")
      .select("id, title, hidden_at")
      .not("hidden_at", "is", null)
      .order("hidden_at", { ascending: false })
      .limit(50),
    admin
      .from("responses")
      .select("id, perspective_id, body_plaintext, hidden_at")
      .not("hidden_at", "is", null)
      .order("hidden_at", { ascending: false })
      .limit(50),
  ]);

  const pById = new Map((perspectives.data ?? []).map((p) => [p.id, p]));
  const rById = new Map((responses.data ?? []).map((r) => [r.id, r]));

  const queue: QueueItem[] = groups.map((g) => {
    if (g.targetType === "perspective") {
      const p = pById.get(g.targetId);
      return {
        ...g,
        target: p
          ? {
              excerpt: `${p.title || "(untitled)"} — ${excerpt(p.body_plaintext, 200)}`,
              authorUsername: one(p.author)?.username ?? null,
              href: `/perspective/${p.id}`,
              hidden: p.hidden_at !== null,
            }
          : null,
      };
    }
    const r = rById.get(g.targetId);
    return {
      ...g,
      target: r
        ? {
            excerpt: excerpt(r.body_plaintext),
            authorUsername: one(r.author)?.username ?? null,
            href: `/perspective/${r.perspective_id}#response-${r.id}`,
            hidden: r.hidden_at !== null,
          }
        : null,
    };
  });

  const hidden: HiddenItem[] = [
    ...(hiddenPerspectives.data ?? []).map((p) => ({
      targetType: "perspective" as const,
      targetId: p.id,
      excerpt: p.title || "(untitled)",
      href: `/perspective/${p.id}`,
      hiddenAt: p.hidden_at as string,
    })),
    ...(hiddenResponses.data ?? []).map((r) => ({
      targetType: "response" as const,
      targetId: r.id,
      excerpt: excerpt(r.body_plaintext, 120),
      href: `/perspective/${r.perspective_id}#response-${r.id}`,
      hiddenAt: r.hidden_at as string,
    })),
  ].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt));

  return { queue, hidden };
}

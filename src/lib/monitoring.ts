import "server-only";

// Error monitoring hook. A no-op unless ERROR_WEBHOOK_URL is set, in which
// case each report is POSTed there as JSON. Kept vendor-neutral on purpose:
// the payload has a `text` field (what Slack / Discord / Mattermost incoming
// webhooks display) plus structured fields for anything that parses JSON.
// Swapping in a vendor SDK later means changing this one function.
//
// Guarantees callers rely on:
//   - never throws, never rejects — reporting must not turn one error into two
//   - bounded: 2s timeout, stack and context truncated
//   - no request bodies, cookies or headers are ever included; callers pass
//     only what they choose in `context`
//
// Next 14 has no server-side onRequestError hook (that's Next 15), so this is
// called explicitly from server code, and the error boundaries report via
// /api/client-error, which forwards here.

const TIMEOUT_MS = 2000;
const MAX_STACK = 4000;
const MAX_CONTEXT_JSON = 2000;

export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export type ErrorReport = {
  text: string;
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  source: "server" | "client";
  context?: ErrorContext;
  environment: string;
  at: string;
};

export function buildErrorReport(
  error: unknown,
  opts: { source?: "server" | "client"; context?: ErrorContext } = {},
  env: Record<string, string | undefined> = process.env,
): ErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (err as Error & { digest?: string }).digest;
  const environment = env.VERCEL_ENV ?? env.NODE_ENV ?? "unknown";
  const source = opts.source ?? "server";

  let context = opts.context;
  if (context && JSON.stringify(context).length > MAX_CONTEXT_JSON) {
    context = { truncated: true };
  }

  return {
    text: `[perspective/${environment}] ${source} error: ${err.name}: ${err.message}`.slice(0, 500),
    name: err.name,
    message: err.message.slice(0, 1000),
    stack: err.stack?.slice(0, MAX_STACK),
    digest,
    source,
    context,
    environment,
    at: new Date().toISOString(),
  };
}

export async function reportError(
  error: unknown,
  opts: { source?: "server" | "client"; context?: ErrorContext } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // Always keep the local log line; the webhook is in addition, not instead.
  console.error(error);

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildErrorReport(error, opts)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (sendError) {
    console.warn("reportError: webhook delivery failed:", sendError);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { clientErrorSchema } from "@/lib/validation/client-error";
import { reportError } from "@/lib/monitoring";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

// POST /api/client-error — error boundaries report here; we forward to
// reportError(), which is a no-op unless ERROR_WEBHOOK_URL is set.
//
// Public by necessity (errors happen to signed-out readers too), so it's
// shaped to be useless as a spam relay into the webhook:
//   - 4 KB body cap, schema-validated, every field length-bounded
//   - 10/min per IP and 300/hour overall
//   - always 204, so it can't be used to probe whether reporting is on
const MAX_BODY_BYTES = 4096;
const RATE_IP = { max: 10, windowMs: 60_000 };
const RATE_GLOBAL = { max: 300, windowMs: 60 * 60_000 };

const accepted = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return accepted();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return accepted();
  }
  const parsed = clientErrorSchema.safeParse(json);
  if (!parsed.success) return accepted();

  for (const [key, rate] of [
    [`client-error:${clientIp(request.headers)}`, RATE_IP],
    ["client-error:global", RATE_GLOBAL],
  ] as const) {
    if (!(await checkRateLimit(key, rate)).ok) return accepted();
  }

  const { name, message, digest, path, boundary } = parsed.data;
  const error = Object.assign(new Error(message), { name: name ?? "Error", digest });
  // The browser's stack is minified and points at our own bundles; it's
  // not worth forwarding, and dropping it keeps reports small.
  error.stack = undefined;
  await reportError(error, {
    source: "client",
    context: { path, boundary, digest },
  });

  return accepted();
}

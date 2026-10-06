// Best-effort client IP for rate-limit keys on signed-out endpoints (login,
// signup, password reset, film search).
//
// On Vercel, x-forwarded-for is set by the platform edge, which overwrites
// any client-supplied value, so its first entry is the real client. Off
// Vercel (self-hosted behind an unknown proxy) the header can be spoofed;
// that only lets an attacker spread requests across more buckets, which is
// why the sensitive limits are also keyed by email, not just IP.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

// PostgREST surfaces Postgres SQLSTATEs as error.code. 42501 is
// insufficient_privilege — what an RLS WITH CHECK failure or a missing
// column grant looks like from the client.
//
// Server actions check visibility up front so users get a specific message,
// but the database is the real gate (0006–0008). When the two disagree — a
// piece went private between the action's lookup and its write — the
// database wins, and this lets the action translate that into the same
// friendly copy instead of leaking "new row violates row-level security".
export function isPermissionDenied(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === "42501";
}

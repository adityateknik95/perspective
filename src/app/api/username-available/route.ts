import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_REGEX } from "@/lib/validation/username";
import { isReservedUsername } from "@/lib/reserved-usernames";

// GET /api/username-available?username=foo
//   200 { available: true }
//   200 { available: false, reason: "format" | "reserved" | "taken" }
//   500 { available: null, reason: "check_failed" }
//
// The DB's UNIQUE constraint is the authority — this endpoint is UX only.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username") ?? "";
  const username = raw.trim().toLowerCase();

  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json({ available: false, reason: "format" });
  }
  if (isReservedUsername(username)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("username_available", {
    u: username,
  });

  if (error) {
    console.error("username_available rpc failed:", error);
    return NextResponse.json(
      { available: null, reason: "check_failed" },
      { status: 500 },
    );
  }

  return data === true
    ? NextResponse.json({ available: true })
    : NextResponse.json({ available: false, reason: "taken" });
}

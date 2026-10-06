// Render-time check for avatar URLs. 0010_avatar_guards.sql stops new bad
// values at the database, but rows written before it (or a value that slips
// through some future path) shouldn't make every reader's browser fetch a
// third-party URL. Only public objects in our own project's avatars bucket
// are rendered; anything else falls back to initials.
const AVATAR_PATH = "/storage/v1/object/public/avatars/";

export function isTrustedAvatarUrl(
  src: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): src is string {
  if (!src || !supabaseUrl) return false;
  try {
    const url = new URL(src);
    const project = new URL(supabaseUrl);
    return (
      url.origin === project.origin &&
      url.pathname.startsWith(AVATAR_PATH) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

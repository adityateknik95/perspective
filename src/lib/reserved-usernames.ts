// Usernames that collide with an existing route, the planned header nav, or
// reserved marketing/system paths. Next.js's route tree already wins against
// /[username] for static routes — this list prevents the inverse problem of
// a user registering a username that would make their own profile page
// permanently unreachable.
export const RESERVED_USERNAMES = new Set<string>([
  // Current routes
  "signup",
  "login",
  "logout",
  "onboarding",
  "settings",
  "design_system",
  "forgot_password",
  "reset_password",
  "auth",
  "api",

  // Planned header nav (from the product mockup)
  "feed",
  "discover",
  "lenses",
  "library",
  "write",

  // Reserved generic paths likely to appear later
  "admin",
  "help",
  "about",
  "contact",
  "support",
  "privacy",
  "terms",
  "legal",
  "cookies",
  "docs",
  "blog",
  "press",
  "careers",
  "status",
  "pricing",
  "home",
  "search",
  "explore",
  "tags",
  "tag",

  // Brand / system
  "perspective",
  "perspectives",
  "official",
  "staff",
  "team",
  "system",

  // Impersonation or reserved-identity risk
  "www",
  "mail",
  "root",
  "me",
  "user",
  "users",
  "profile",
  "profiles",
  "account",
  "accounts",
  "new",
  "edit",
  "delete",
  "null",
  "undefined",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

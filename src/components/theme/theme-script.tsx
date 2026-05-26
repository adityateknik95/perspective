// Tiny inline script injected into <head> before any other JS evaluates.
// It reads the persisted choice and sets data-theme on <html> SYNCHRONOUSLY
// so the first paint is correct — without this we get a "flash of wrong
// theme" between SSR (no JS) and hydration.
//
// The script must be self-contained — no imports, no module scope — because
// it runs as a plain <script>. Stringified and emitted via dangerouslySet…
// in the root layout.
//
// Storage key + values are duplicated here and in theme-toggle.tsx because
// the script can't import from elsewhere. Keep them in lockstep.

const SCRIPT = `(function() {
  try {
    var stored = localStorage.getItem('perspective-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) {
    // localStorage blocked or matchMedia missing — fall back to light, the
    // CSS variables default to it. Bad theme on a private window beats a
    // crashed page on a private window.
  }
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

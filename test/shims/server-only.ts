// Empty shim for `server-only` used by vitest. The real package throws on
// import to prevent server modules from being bundled into a client; in
// tests we run those modules directly in Node, so a no-op is correct.
export {};

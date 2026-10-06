import { z } from "zod";

// The one place client-reachable code gets zod from.
//
// zod v4 probes for eval support (`Function("")`) the first time a schema
// is parsed, to decide whether it can JIT-compile parsers. Our CSP forbids
// eval (security-headers.mjs), so in the browser that probe fails safely
// but logs a CSP violation on every page, which would bury real violations
// in reports. jitless skips the probe; the interpreted parser is what runs
// under the CSP anyway, so behaviour is unchanged.
z.config({ jitless: true });

export { z };

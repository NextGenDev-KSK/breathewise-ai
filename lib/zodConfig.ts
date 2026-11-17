import { z } from "zod";

/**
 * Zod v4 probes `new Function` to JIT-compile object parsers. Our strict Content-Security-Policy
 * (no 'unsafe-eval') blocks that probe, which surfaces as a CSP issue. Jitless mode skips it.
 */
z.config({ jitless: true });

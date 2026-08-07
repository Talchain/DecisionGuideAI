// scripts/derive-vite-env-reads.d.mts
// Types for the env-read deriver, so `vite.config.ts` is type-checked against it
// rather than silently `any`.
//
// The implementation is plain .mjs deliberately: `vite.config.ts` imports it at
// config-evaluation time, before any build step exists to compile it.

/** Strip `//` and block comments so a comment naming a var is not read as a read. */
export declare function stripComments(text: string): string

/**
 * Every `VITE_*` name read by a literal `import.meta.env(?.)VITE_X` reference
 * anywhere under `srcDir`. Comments are stripped first.
 */
export declare function deriveViteEnvReads(srcDir: string): string[]

/**
 * Vite `define` entries pinning every READ-but-UNSET variable to literal
 * `undefined`.
 *
 * Without these, Vite has no specific define for an unset variable, so esbuild's
 * longest match is `import.meta.env` — substituting the ENTIRE env object, with
 * every variable's value, into that chunk. One unset read poisons a whole chunk.
 *
 * @param srcDir directory to scan for reads
 * @param env    the resolved build env (from Vite's `loadEnv`)
 */
export declare function buildNarrowEnvDefines(
  srcDir: string,
  env: Record<string, string | undefined>,
): Record<string, string>

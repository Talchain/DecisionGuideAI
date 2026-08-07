// scripts/ci/assert-bundle-env-allowlist.d.mts
// Types for the bundle env allow-list guard, so its anti-vacuity spec is checked
// rather than silently `any`.
//
// The implementation is plain .mjs deliberately: the guard must be runnable with
// a bare `node scripts/ci/assert-bundle-env-allowlist.mjs` during an incident.

/** Repo root, resolved from this file's location. */
export declare const ROOT: string
/** Absolute path to `bundle-env-allowlist.json`. */
export declare const ALLOWLIST_PATH: string

/**
 * Thrown when a scan produced nothing to assert against. Never swallow this: an
 * empty scan makes every downstream absence assertion pass by testing nothing.
 */
export declare class VacuousScanError extends Error {}

export interface Chunk {
  file: string
  text: string
}

/**
 * VITE_* keys baked as `NAME:<literal value>` across the given chunks.
 *
 * `void 0` / `undefined` are NOT counted: they carry no data, and accepting them
 * matched minified ternaries (`…?e.VITE_ORG:void 0`) as false positives.
 *
 * @throws VacuousScanError rather than ever returning an empty set.
 */
export declare function extractBakedKeys(chunks: Chunk[]): {
  all: Set<string>
  byChunk: Map<string, Set<string>>
}

/** Strip `//` and block comments so a comment naming a var does not count as a read. */
export declare function stripComments(text: string): string

/**
 * The keys a literal source read (or the generated flagEnv) can explain.
 * @throws VacuousScanError when flagEnv derives zero keys.
 */
export declare function deriveExplainedKeys(input: { srcDir: string; flagEnvPath: string }): {
  readInSource: Set<string>
  flagEnvKeys: Set<string>
  explained: Set<string>
}

/** Pure verdict. Both arrays empty means PASS. */
export declare function computeVerdict(input: {
  baked: Set<string>
  explained: Set<string>
  allowed: Set<string>
}): { unexplained: string[]; undeclared: string[] }

/** CLI entry. Returns the process exit code (0 pass, 1 fail). */
export declare function run(input: {
  distAssets: string
  srcDir: string
  flagEnvPath: string
  allowlistPath: string
  log?: (message: string) => void
  err?: (message: string) => void
}): number

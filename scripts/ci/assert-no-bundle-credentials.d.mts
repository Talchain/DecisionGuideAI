// scripts/ci/assert-no-bundle-credentials.d.mts
// Types for the emitted-bundle credential sentinel, so its controls spec is
// checked rather than silently `any`.
//
// The implementation is plain .mjs deliberately: the guard must be runnable with a
// bare `node scripts/ci/assert-no-bundle-credentials.mjs` during an incident, with
// no build step and no toolchain between an engineer and the answer.
//
// Mirrors the sibling `assert-bundle-env-allowlist.d.mts`, which exists for the same
// reason. Without it the spec's `scanChunk(...)` returns `any`, every callback
// parameter becomes an implicit any, and the controls stop being typechecked at
// exactly the point they matter.

/** Repo root, resolved from this file's location. */
export declare const ROOT: string

/** How far from an auth marker a literal may sit and still count as "in an auth context". */
export declare const AUTH_WINDOW: number

/**
 * Thrown when a scan produced nothing to assert against. Never swallow this: an
 * empty scan makes an absence assertion pass by testing nothing.
 */
export declare class VacuousScanError extends Error {}

export interface Chunk {
  file: string
  text: string
}

/**
 * A single scan result.
 *
 * `kind: 'allowed'` is a match that is PUBLIC BY DESIGN, decided from the value
 * itself (a JWT's `role` claim, a digest's key name) rather than from a list. It is
 * reported, never silently dropped, so an exemption cannot become invisible.
 *
 * `value` exists only so callers can fingerprint it — pass it through `redact`.
 */
export interface Finding {
  kind: 'violation' | 'allowed'
  id: string
  file: string
  value: string
  reason: string
  near: string | null
}

/**
 * Decode a `.map` file into its `sourcesContent` entries as scannable pseudo-chunks.
 * Returns [] for a non-map. Only `sourcesContent` is expanded: `mappings` is a huge
 * high-entropy base64-VLQ blob that any entropy scan would flag for ever.
 */
export declare function expandSourceMap(file: string, text: string): Chunk[]

/** Findings for one chunk, deduplicated so one value yields one finding. */
export declare function scanChunk(chunk: Chunk): Finding[]

/**
 * Scan every chunk.
 * @throws VacuousScanError on zero files, or on files totalling zero bytes.
 */
export declare function scanChunks(chunks: Chunk[]): {
  findings: Finding[]
  violations: Finding[]
  allowed: Finding[]
  bytes: number
}

/** Shannon entropy in bits per character. */
export declare function shannonEntropy(value: string): number

/**
 * Is this literal credential-SHAPED? Charset + length + entropy, minus the shapes
 * measured as false positives against a real build (letters-only and word-segment
 * identifiers).
 */
export declare function isCredentialShaped(value: string): boolean

/**
 * Decode a JWT and judge it by its own `role` claim.
 * @returns null to ALLOW (Supabase `anon`, public by design), or a reason to FAIL.
 */
export declare function classifyJwt(token: string): string | null

/** The object key a literal is assigned to (`foo:"<literal>"` → `foo`), or null. */
export declare function precedingKey(text: string, index: number): string | null

/** Every scannable file under `dir`, recursively. */
export declare function collectFiles(dir: string, out?: string[]): string[]

/** EVERY file under `dir`, so the output can report what it SKIPPED. */
export declare function collectAll(dir: string, out?: string[]): string[]

/**
 * The ONLY way a matched value leaves this module: `<N chars, sha256:xxxxxxxx>`.
 * A guard that prints the credential it found has published it a second time.
 */
export declare function redact(value: string): string

/** CLI entry. Returns the process exit code (0 pass, 1 fail). */
export declare function run(input: {
  distDir: string
  log?: (message: string) => void
  err?: (message: string) => void
}): number

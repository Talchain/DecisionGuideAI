// scripts/ci/assert-logger-emits.d.mts
// Types for the logger-emission build guard, so its controls spec is checked
// rather than silently `any`.
//
// The implementation is plain .mjs deliberately: the guard must be runnable with
// a bare `node scripts/ci/assert-logger-emits.mjs` during an incident, with no
// build step and no toolchain between an engineer and the answer. Mirrors the
// sibling `assert-no-bundle-credentials.d.mts`, which exists for the same reason.

/** Repo root, resolved from this file's location. */
export declare const ROOT: string

/** The artefact class scanned, printed on every run. */
export declare const SCANNED_CLASS: string

/** The four log levels the guard requires an emission for. */
export declare const LEVELS: readonly ['debug', 'info', 'warn', 'error']

/**
 * Thrown when a scan produced nothing to assert against. Never swallow this: an
 * empty `dist/` is exactly the shape a failed or skipped build takes, and it
 * must be a hard error rather than a clean-looking pass.
 */
export declare class VacuousScanError extends Error {}

export interface Chunk {
  file: string
  text: string
}

/** Every scannable file under `dir`, recursively. */
export declare function collectFiles(dir: string, out?: string[]): string[]

/**
 * Which levels emit in `text`, bound by IDENTITY: the tag literal must sit in
 * FIRST-ARGUMENT position of a call whose method name matches it. A stray
 * `[WARN]` in unrelated copy, or a `.warn("[ERROR]")` transposition, does not
 * count — the latter is returned in `mismatches` instead.
 */
export declare function scanEmission(text: string): {
  emitting: Set<string>
  mismatches: Array<{ method: string; tag: string }>
}

/**
 * Count call expressions rooted at the BARE global `console`. Namespaced calls
 * (`window.console.log(…)`) are deliberately excluded — that is how a dependency
 * legitimately survives the strip, and this app ships two of them.
 */
export declare function countBareConsole(text: string): number

/**
 * Read every chunk under `distDir`.
 * @throws {VacuousScanError} on zero files, or on files totalling zero bytes.
 */
export declare function collectChunks(distDir: string): { chunks: Chunk[]; bytes: number }

/**
 * Prove the detector is alive HERE — this Node, this run — before any verdict.
 * Runs a CONTRAST PAIR: a live emission shape must be detected; the dead no-op
 * shape, a tag/method mismatch and a bare tag literal must not be.
 * @throws {Error} if any control disagrees.
 */
export declare function selfTest(): void

/** CLI entry. Returns the process exit code (0 pass, 1 fail). */
export declare function run(input: {
  distDir: string
  log?: (message: string) => void
  err?: (message: string) => void
}): number

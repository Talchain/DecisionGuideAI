// scripts/ci/assert-validators-deterministic.d.mts
// Types for the generated-validators determinism guard, so its controls spec is
// checked rather than silently `any`.
//
// The implementation is plain .mjs deliberately: the guard must be runnable with
// a bare `node scripts/ci/assert-validators-deterministic.mjs` during an
// incident, with no build step and no toolchain between an engineer and the
// answer. Mirrors the sibling `assert-logger-emits.d.mts` and
// `assert-no-bundle-credentials.d.mts`, which exist for the same reason.

/** Repo root, resolved from this file's location. */
export declare const ROOT: string

/** The generator under test — the same script `npm run build` invokes. */
export declare const GENERATOR: string

/** Directory holding the committed artefacts (`src/generated`). */
export declare const COMMITTED_DIR: string

/** What a non-trivial output looks like, per artefact. */
export interface ArtefactSpec {
  file: string
  /** Byte floor. Real output is an order of magnitude above it. */
  minBytes: number
  /** Substrings chosen to be stable across Ajv versions. */
  markers: readonly string[]
}

export declare const ARTEFACTS: readonly ArtefactSpec[]

/**
 * Thrown when an output is missing, empty, too small, or lacks a required
 * marker. Never swallow it: two empty outputs compare EQUAL, so agreement
 * between them is agreement about nothing.
 */
export declare class VacuousOutputError extends Error {}

/**
 * Assert one generated artefact is real output rather than a vacuous stand-in.
 * Returns its byte length.
 * @throws {VacuousOutputError}
 */
export declare function assertNonTrivial(
  label: string,
  text: unknown,
  spec: ArtefactSpec,
): number

/**
 * Byte-compare two outputs, reporting WHERE they diverge. Callers must run
 * `assertNonTrivial` on both sides first — this cannot tell agreement from
 * mutual absence, and is not supposed to.
 */
export declare function compare(
  a: string,
  b: string,
): { identical: boolean; index: number; aContext: string; bContext: string }

/**
 * Run the generator into `outDir` as a real subprocess — the same entry point
 * the build invokes, not a refactored library version of it.
 * @throws {VacuousOutputError} if it exits 0 without writing an artefact.
 */
export declare function generateInto(
  outDir: string,
  options?: { generator?: string; cwd?: string },
): Record<string, string>

/**
 * Prove the instrument is alive HERE, this run, before any verdict. Runs a
 * CONTRAST PAIR on the comparator and on the vacuity gate — including the
 * control that matters most, that two EMPTY outputs compare equal and must
 * still be rejected.
 * @throws {Error} if any control disagrees.
 */
export declare function selfTest(): void

/** CLI entry. Returns the process exit code (0 pass, 1 fail). */
export declare function run(input?: {
  committedDir?: string
  log?: (message: string) => void
  err?: (message: string) => void
}): number

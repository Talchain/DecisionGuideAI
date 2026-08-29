// scripts/core-e2e/resolve-immutable-target.d.mts
// Types for the Core E2E target resolver, so its guard spec is checked rather
// than silently `any`.
//
// The implementation is plain .mjs deliberately: it runs BEFORE Playwright exists,
// as a bare `node scripts/core-e2e/resolve-immutable-target.mjs` in a workflow step
// and in a terminal during an incident, with no build step between an engineer and
// the answer. Mirrors the sibling `scripts/ci/assert-logger-emits.d.mts`, which
// exists for the same reason.
//
// ⚠ A `.d.mts` IS A MIRROR AND CAN LIE — it constrains call sites, never behaviour.
// What pins the behaviour is `tests/ci-guards/core-build-attribution.spec.ts`, which
// EXECUTES the real module with injected IO. Read a green there as evidence about the
// code; read this file as evidence about nothing.

/** The mutable staging alias. A discovery channel, never a target. */
export declare const DEFAULT_ALIAS: string

/** `https://<deploy id>--<site>.netlify.app`, anchored at both ends. */
export declare const DEPLOY_PERMALINK_RE: RegExp

export interface DeployHost {
  deployId: string
  site: string
}

/** `{ deployId, site }` for a deploy permalink, else null. */
export declare function parseDeployPermalink(url: string): DeployHost | null

/**
 * True when the URL cannot move under a running suite.
 *
 * ⚠ DUPLICATED, ON PURPOSE AND UNDER GUARD, as `targetIsImmutable` in
 * `e2e/core/lib/manifest.ts` — that file is compiled by the typecheck gate and this
 * one is not. The two are pinned against a shared positive/negative corpus by
 * `tests/ci-guards/core-build-attribution.spec.ts`; edit either alone and it reds.
 */
export declare function isImmutableTarget(url: string): boolean

/** Strip a trailing slash so `${target}/version.json` never doubles it. */
export declare function normaliseTarget(url: string): string

export interface VersionFields {
  commit: string
  short: string
  deployId: string | null
  deployUrl: string | null
}

/**
 * The fields the resolver needs out of `/version.json`.
 *
 * Returns null — never a placeholder — for anything unreadable. A placeholder that
 * flows into an equality check is how `unknown === unknown` becomes a pass.
 */
export declare function readVersionFields(body: string | object | null): VersionFields | null

export type SampleVerdict = 'malformed' | 'wait' | 'unpinnable' | 'accept'

/**
 * The acceptance predicate. `wait` is the only verdict the one-commit deploy lag can
 * reach, and it can never become `accept` for the wrong build — which is the whole
 * non-raciness argument.
 */
export declare function classifySample(
  sample: VersionFields | null,
  expectedCommit: string,
): { verdict: SampleVerdict; reason: string }

export interface VerifiedPin {
  url: string
  commit: string
  short: string
  deployId: string
}

/**
 * Prove the permalink is reachable, holds the build we matched, and identifies
 * itself. A 404 is a HARD ERROR here — never a skip, never a fallback.
 * @throws {Error} on any of the three.
 */
export declare function assertPinVerified(input: {
  pinUrl: string
  matched: { commit: string | null; short: string }
  pin: VersionFields | null
  httpStatus?: number | null
}): VerifiedPin

/**
 * Resolve the immutable deploy the Core suite must drive.
 *
 * IO is injected so the acceptance behaviour — including the bounded wait and the
 * refusal to fall back — is provable without a network, a clock or a deployed build.
 * @throws {Error} on budget exhaustion, an unpinnable build, or a failed pin check.
 *   It NEVER returns the alias.
 */
export declare function resolveImmutableTarget(options?: {
  aliasUrl?: string
  expectedCommit?: string
  budgetMs?: number
  pollMs?: number
  /** Per-request cap. Without it the budget is only checked BETWEEN samples, so one
   *  stalled connection escapes it entirely and a hang is indistinguishable from a
   *  slow deploy. */
  fetchTimeoutMs?: number
  fetchImpl?: (url: string, init?: unknown) => Promise<{
    ok: boolean
    status: number
    text: () => Promise<string>
  }>
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  log?: (message: string) => void
}): Promise<VerifiedPin & { waitedMs: number; samples: number; discoveredVia: string }>

/**
 * Canonical analysis-run registry.
 *
 * OutputsDock owns the single canonical run pipeline (gate → V5 chip dispatch
 * → V2 fallback) because it hosts the one live `useV2Run` instance whose
 * spinner/error state the dock UI renders. Other surfaces that expose a
 * "run analysis" affordance (canvas ⌘Enter, command palette) must NOT build
 * their own request pipeline — they call the registered runner so every
 * visible CTA converges on the same path and the same gating.
 *
 * The registry is deliberately not a React context: callers live in separate
 * trees (portal palette, canvas keyboard layer) and the dock can re-register
 * across remounts without tearing down consumers.
 */

export type CanonicalRunOutcome =
  | { status: 'dispatched' }
  | { status: 'v2' }
  | { status: 'blocked'; reason: string }
  | { status: 'already-running' }

export interface CanonicalRunOptions {
  /** Telemetry label for the surface that initiated the run. */
  source?: string
}

export type CanonicalRunner = (
  // eslint-disable-next-line no-unused-vars
  opts?: CanonicalRunOptions,
) => Promise<CanonicalRunOutcome>

let currentRunner: CanonicalRunner | null = null

/**
 * Register the canonical runner. Returns an unregister function that only
 * clears the registry if this registration is still the active one — a later
 * registration is never clobbered by an earlier owner's cleanup.
 */
export function registerCanonicalRunner(runner: CanonicalRunner): () => void {
  currentRunner = runner
  return () => {
    if (currentRunner === runner) {
      currentRunner = null
    }
  }
}

/** The active canonical runner, or null when no host is mounted. */
export function getCanonicalRunner(): CanonicalRunner | null {
  return currentRunner
}

/** Shared copy for the no-host case — one string, every surface. */
export const RUNNER_UNAVAILABLE_MESSAGE =
  'Analysis is still loading. Try again in a moment.'

export type CanonicalRunResult = CanonicalRunOutcome | { status: 'unavailable'; reason: string }

/**
 * Execute the canonical run, folding the no-registered-host case into the
 * outcome union so call sites handle ONE shape and can never silently no-op:
 * every branch either runs the pipeline or carries a human-readable reason.
 */
export async function executeCanonicalRun(
  opts?: CanonicalRunOptions,
): Promise<CanonicalRunResult> {
  const runner = currentRunner
  if (!runner) {
    return { status: 'unavailable', reason: RUNNER_UNAVAILABLE_MESSAGE }
  }
  return runner(opts)
}

/** Test hook: reset module state between specs. */
export function __resetCanonicalRunnerForTests(): void {
  currentRunner = null
}

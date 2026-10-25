/**
 * Read-after-write (DL rulings, contract v1.5–v1.6): after a core-route turn, the scenario read must serve the saved
 * model (CEE's `content_hash` of the full graph, living model included) and, after a Run, that Run, current (canonical
 * view `run.run_id`, not stale). A read that serves anything else is tried once more; if it still does, or no read
 * answers at all, the person is told to refresh, so the canvas is never silently stale. The turn names what to expect
 * (`_read_after_write`, set by `coreTurnContract.ts`); legacy turns name nothing and nothing is read.
 */
import { ADDITIVE_EXTENSIONS_KEY } from '../../v5/responseParser'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { parseCanonicalAnalysisView } from '../runView/canonicalAnalysisView'
import { useCanonicalAnalysisViewStore } from '../stores/canonicalAnalysisViewStore'

export const STALE_MODEL_NOTICE =
  'Your change was saved, but this view is showing an older copy of your model. Refresh the page to see the saved version.'
export const RUN_NOT_DELIVERED_NOTICE =
  'The analysis ran, but this view hasn’t received its result yet. Refresh the page to see it.'
export const READ_FAILED_NOTICE = 'This view couldn’t refresh. Refresh the page to see your latest model.'

export interface ReadAfterWriteExpectation {
  readonly scenarioRevision: string
  /** The Run this turn computed, or null when it ran none. */
  readonly runId: string | null
}

const rec = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' ? v as Record<string, unknown> : null)

/** What a turn asks the read to serve, or null when it asks nothing (every legacy turn). */
export function readAfterWriteExpectation(response: unknown): ReadAfterWriteExpectation | null {
  const ask = rec(rec(rec(response)?.[ADDITIVE_EXTENSIONS_KEY])?._read_after_write)
  const scenarioRevision = ask?.scenario_revision
  if (typeof scenarioRevision !== 'string' || scenarioRevision.length === 0) return null
  return { scenarioRevision, runId: typeof ask?.run_id === 'string' && ask.run_id.length > 0 ? ask.run_id : null }
}

export interface ReadAfterWriteDeps {
  readonly read?: typeof fetchScenarioGraph
  readonly wait?: (ms: number) => Promise<void>
}

export type ReadAfterWriteOutcome = 'confirmed' | 'stale_model' | 'run_not_delivered' | 'unknown'

/**
 * `confirmed`: a read (first try or the one retry) serves the saved model and, after a Run, that Run, current.
 * `stale_model` / `run_not_delivered`: the last graph read still served another model, or the right model without
 * this Run current. `unknown`: no graph was read at all (network, 503, refused): it says so too (DL, v1.6).
 */
export async function checkReadAfterWrite(
  scenarioId: string,
  expected: ReadAfterWriteExpectation,
  identity: { userId?: string | null; accessToken?: string | null },
  deps: ReadAfterWriteDeps = {},
): Promise<ReadAfterWriteOutcome> {
  const read = deps.read ?? fetchScenarioGraph
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  let last: ReadAfterWriteOutcome = 'unknown'
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await wait(1_500)
    const result = await read(scenarioId, { userId: identity.userId ?? null, accessToken: identity.accessToken ?? null })
    if (result.status !== 'graph') continue
    if (result.contentHash !== expected.scenarioRevision) { last = 'stale_model'; continue }
    const view = rec(result.canonicalAnalysisView)
    const runDelivered = expected.runId === null
      || (rec(view?.run)?.run_id === expected.runId && rec(view?.staleness)?.stale === false)
    if (runDelivered) {
      // The core turn carries no canonical view, so the option cards' served chance cells (`OptionChanceCellProvider`) stayed
      // empty until a reload hydrated it (served 22 Oct, CEE 4a4c338c). The read that confirms THIS Run carries it: adopt it,
      // as hydration does, so the cards say CEE's words now.
      const served = expected.runId === null ? null : parseCanonicalAnalysisView(view)
      if (served !== null) useCanonicalAnalysisViewStore.getState().adopt(scenarioId, served)
      return 'confirmed'
    }
    last = 'run_not_delivered'
  }
  return last
}

/**
 * The notice for an outcome the person must act on, or null. `wrote`: the turn carries a receipt of its write; only then
 * may a stale read say "Your change was saved" (DL, U-W2). After any other turn it says the view couldn't refresh.
 */
export function readAfterWriteNotice(outcome: ReadAfterWriteOutcome, opts: { wrote: boolean }): string | null {
  return outcome === 'stale_model' ? (opts.wrote ? STALE_MODEL_NOTICE : READ_FAILED_NOTICE)
    : outcome === 'run_not_delivered' ? RUN_NOT_DELIVERED_NOTICE
    : outcome === 'unknown' ? READ_FAILED_NOTICE
    : null
}

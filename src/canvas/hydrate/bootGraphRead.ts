/**
 * Boot graph read — what this page learned when it asked CEE for the scenario's
 * saved model, so a whole-graph registration can take the answer as an INPUT.
 *
 * ── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────
 * Witnessed on served `fa84d226` (23 Sep 08:34Z, scenario `f47d2260`): a stale
 * second tab reloaded, the boot read returned 200 with CEE's 14 nodes, and 0.9 s
 * later the reload re-arm (`useImportRegistration`) POSTed `graph/register` with
 * the tab's own 15 — undoing a delete the other tab had committed. The re-arm
 * never looked at the read: a 200, a 404 and a network failure all ended in the
 * same whole-graph write. The brief's rule is "no user edit may be re-registered
 * behind the canonical path"; the multi-user design's (collab design recs §5.6)
 * is that a copy which does not match the saved model never writes over it.
 *
 * ── THE ONE QUESTION IT ANSWERS ────────────────────────────────────────────
 * `mayRegisterOverSavedModel(scenarioId)`: may this page send its own copy as
 * the scenario's whole model?
 *   · no read for this scenario        → 'permit' (unchanged behaviour: no
 *                                         scenario id yet, or no hydration
 *                                         mounted — nothing can be overwritten
 *                                         that this page knows of)
 *   · a read is in flight              → 'wait'
 *   · CEE holds no model (`absent`,
 *     `notReadable`)                   → 'permit' — the first registration
 *   · anything else                    → 'refuse' — CEE holds a model (merged,
 *                                         unchanged, mergeRefused) or the page
 *                                         could not find out (unavailable,
 *                                         unusable, refused, signInRequired).
 *                                         Fail CLOSED: an unknown is not a
 *                                         licence to overwrite.
 *
 * ⚠ SCOPE. This gates the reload RE-ARM only (a model that merely lost its
 *   acknowledgement). A deliberate import still waiting for its first
 *   registration (ROADMAP 2.467 / 2.503) is carried by the pending marker, which
 *   the re-arm never touches, and is unchanged here.
 *
 * Keyed by scenario for the reason `serverGraphRetryStore` gives: an unkeyed
 * value survives a scenario change and answers for the wrong decision.
 */
import { create } from 'zustand'

import type { HydrationOutcome } from './serverGraphHydration'

export type BootGraphReadState = 'reading' | HydrationOutcome

interface BootGraphReadStore {
  byScenario: Readonly<Record<string, BootGraphReadState>>
}

export const useBootGraphReadStore = create<BootGraphReadStore>(() => ({ byScenario: {} }))

/** Outcomes that mean "CEE holds no model for this scenario". */
const NO_SAVED_MODEL: ReadonlySet<BootGraphReadState> = new Set<BootGraphReadState>([
  'absent',
  'notReadable',
])

function write(scenarioId: string, state: BootGraphReadState | null): void {
  useBootGraphReadStore.setState((s) => {
    const next = { ...s.byScenario }
    if (state === null) delete next[scenarioId]
    else next[scenarioId] = state
    return { byScenario: next }
  })
}

/** Called synchronously before the read's first await. */
export function beginBootGraphRead(scenarioId: string): void {
  write(scenarioId, 'reading')
}

/**
 * Called on every exit of the read. `skipped` (aborted, or the canvas moved to
 * another scenario) is NOT an answer about this scenario, so it forgets the
 * read rather than recording a verdict the page never reached.
 */
export function settleBootGraphRead(scenarioId: string, outcome: HydrationOutcome): void {
  write(scenarioId, outcome === 'skipped' ? null : outcome)
}

export type RegisterOverSavedModel = 'permit' | 'wait' | 'refuse'

export function registerOverSavedModelVerdict(
  state: BootGraphReadState | undefined,
): RegisterOverSavedModel {
  if (state === undefined) return 'permit'
  if (state === 'reading') return 'wait'
  return NO_SAVED_MODEL.has(state) ? 'permit' : 'refuse'
}

export function mayRegisterOverSavedModel(scenarioId: string | null | undefined): RegisterOverSavedModel {
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) return 'permit'
  return registerOverSavedModelVerdict(useBootGraphReadStore.getState().byScenario[scenarioId])
}

/** Test/teardown helper. */
export function __resetBootGraphReadForTest(): void {
  useBootGraphReadStore.setState({ byScenario: {} })
}

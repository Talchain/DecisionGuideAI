/**
 * scenarioResponseFence — the ONE question two separate guards were both asking.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS MODULE EXISTS (M3, settled 2026-08-27)
 * ═══════════════════════════════════════════════════════════════════════════
 * A mounted client consumed 15 chunks / 110,343 bytes, saw DRAFTING,
 * GRAPH_READY, COACHING_READY and COMPLETE, and rendered ZERO nodes. Direct
 * HTTP to the same server completed 14/14, so the server was not the cause.
 *
 * The streamed draft turn compares the live scenario against the dispatching
 * one in TWO places, and until now they were two separately-written
 * expressions that merely happened to be identical:
 *
 *   1. `onGraphReady`'s preview guard — refuses to draw a GRAPH_READY frame
 *      onto a scenario that is no longer the one that asked for it. It THROWS,
 *      which `consumeStreamedDraftTurn` catches and records as
 *      `renderedGraph: null`.
 *   2. the terminal "scenario-response fence" — refuses to route the COMPLETE
 *      response before `routeV5Response`, optimistic-edit resolution,
 *      `applyV5State` and graph-receipt ingestion.
 *
 * ⚠⚠ THE DEFECT IS THAT THEY ARE CORRELATED, AND ONE OF THEM IS DOCUMENTED AS
 * THE OTHER'S FALLBACK. `consumeStreamedDraftTurn`'s catch says, in terms:
 * *"A canvas-side failure must not cost the user the whole turn — the terminal
 * ingest below still runs and applies the full graph."* That is TRUE for an
 * ordinary canvas-side throw. It is FALSE for the scenario-mismatch class,
 * because the very condition that made guard 1 throw ALSO trips guard 2 — so
 * the preview is refused, the terminal apply is refused, and the complete model
 * is discarded with no rung of the fallback ever executing.
 *
 * This is the two-questions-under-one-name defect inverted: here it is ONE
 * question wearing two names, and the second name was being counted on as an
 * independent rescue. Naming it once makes the correlation impossible to miss,
 * and impossible to reintroduce — a derived guard asserts there are no raw
 * re-derivations of this comparison left in the turn path.
 *
 * ⛔ THIS MODULE DOES NOT WEAKEN THE FENCE, AND MUST NOT BE MADE TO.
 * The fence exists to stop a response landing on the WRONG scenario: the same
 * element ids may legitimately exist in two scenarios and must not bridge their
 * authority. Rendering a model onto someone else's decision is a WORSE defect
 * than the one being diagnosed here. The predicate below is byte-identical in
 * behaviour to the two expressions it replaces — proved row by row in
 * `scenarioResponseFence.spec.ts`. What changes is that the discard is no
 * longer SILENT.
 *
 * ⚠ THE REMEDY FOR M3 IS NOT HERE. Why the live scenario id differs from the
 * dispatching one on a FRESH scenario with nothing else running is a separate,
 * unsettled question — see the PR body's writer manifest. This module makes the
 * discard observable so that question can be answered from a deployed drive
 * instead of by inspection; it does not pretend to answer it.
 */
import { logger } from '../../lib/logger'
import { useDraftStore } from '../stores/draftStore'

/**
 * Does a response belong to the scenario that dispatched it?
 *
 * The comparison is deliberately STRICT and un-narrowed: any difference,
 * including a null on either side, means "not ours". A null live id is not
 * "probably fine" — it is a canvas that is not currently claiming any decision,
 * and writing a model into that is exactly the bridging the fence forbids.
 */
export function responseBelongsToDispatchingScenario(
  liveScenarioId: string | null | undefined,
  scenarioIdAtDispatch: string | null | undefined,
): boolean {
  if (liveScenarioId === null || liveScenarioId === undefined) return false
  if (scenarioIdAtDispatch === null || scenarioIdAtDispatch === undefined) return false
  return liveScenarioId === scenarioIdAtDispatch
}

/**
 * Where in the turn a discard happened.
 *
 * ⚠ FIVE SITES IN ONE FUNCTION ASK THIS ONE QUESTION, and four of them can
 * drop a real model. They are listed in the order a streamed turn meets them,
 * because that order is the finding: each was written as an independent
 * staleness check, so each reads as though the next one will still catch the
 * model — and they are perfectly correlated, so none of them does.
 */
export type ScenarioFenceSite =
  /** `onGraphReady` — refuses to draw the GRAPH_READY preview. */
  | 'graph_ready_preview'
  /** The terminal scenario-response fence, before `routeV5Response`. */
  | 'terminal_response'
  /** The inline-draft apply gate — the last rung a model can still reach the user. */
  | 'inline_draft_apply'
  /** The staleness guard after a scenario-graph re-fetch from the DB. */
  | 'db_refetch_staleness'

/**
 * Record that the fence discarded something, so a deployed drive can SEE it.
 *
 * ⚠ `logger.warn`, NOT a DEV-gated `console.warn`, and that is the whole point.
 * The production log level defaults to `warn` (`lib/logger.ts`), while
 * `import.meta.env.DEV` is false on every deployed build — so the discard that
 * produced M3 emitted NOTHING AT ALL in production. A client that drops a
 * complete 110 KB model must not do it silently: silence is what made the
 * defect invisible for as long as it was, and it is why the surface above it
 * ended up blaming the server.
 *
 * Deliberately carries `carriedGraph`, because "we discarded a response" and
 * "we discarded a MODEL" are different events and only the second explains a
 * canvas that renders zero nodes after a complete stream.
 */
export function recordScenarioFenceDiscard(input: {
  site: ScenarioFenceSite
  liveScenarioId: string | null | undefined
  scenarioIdAtDispatch: string | null | undefined
  carriedGraph: boolean
}): void {
  logger.warn('scenario_response_fence.discarded', {
    site: input.site,
    liveScenarioId: input.liveScenarioId ?? null,
    scenarioIdAtDispatch: input.scenarioIdAtDispatch ?? null,
    carriedGraph: input.carriedGraph,
  })

  // ── AND MAKE IT SAYABLE, not merely loggable (P0, 2026-08-29) ──────────────
  //
  // A log the user cannot read does not stop the product lying to them.
  // `ServerGraphRetryNotice` was still reaching the sentence "Olumi did not
  // return a model for this decision" on precisely these turns, because its
  // delivery predicate is keyed on the DISPATCHING scenario and the fence only
  // fires when that disagrees with the live one. The M3 honesty fix was defeated
  // by the same key mismatch it exists to catch.
  //
  // ⚠ RECORDED HERE, IN THE ONE FUNNEL, NOT AT THE FOUR CALL SITES. Four call
  // sites would be a hand-maintained mirror of "places a model can be dropped"
  // (trap 12), and the fifth would be added without this. Every site already
  // passes through this function; that is what makes it the right home.
  //
  // ⚠ `carriedGraph` GATES IT, and the distinction is the point: discarding a
  // response is ordinary, discarding a MODEL is what leaves the canvas empty and
  // sends the user to a failure surface. Only the second earns a sentence.
  //
  // ⛔ THIS DOES NOT WEAKEN THE FENCE AND CANNOT. It runs AFTER the discard
  // decision, records an observation, and returns nothing. No caller branches on
  // it. The response is still refused.
  if (input.carriedGraph) {
    useDraftStore.getState().markDraftStreamGraphDiscardedByFence(
      input.liveScenarioId ?? null,
    )
  }
}

/**
 * THE ONE-WRITER LATCH (OW-1) — "does CEE hold this scenario's model?", as
 * STORED state, so a whole-graph `graph/register` can never be written over it.
 *
 * ── THE CONTRACT (programme-docs #63, 5794896612 → 5797440981) ──────────────
 *   Rule 1. `graph/register` is sent only when CEE holds NO model — the boot
 *           read answered `absent` (200, `graph_present:false`) or `notReadable`
 *           (404). An UNKNOWN read (5xx, transport) is not a licence: hold, and
 *           read again (`bootGraphRead.ts`, `unknownGraphReadRetry.ts`).
 *   Rule 2. A per-scenario latch. After ANY acknowledgement for a scenario the
 *           page never registers again for that scenario. The acknowledgements:
 *             · a registration CEE answered 200   (`useImportRegistration`)
 *             · a boot read that returned CEE's graph, `merged` or `unchanged`
 *                                                 (`serverGraphHydration`)
 *             · an applied receipt                (`useConversation` sendTurn)
 *             · a server version restore          (`ServerVersionsSection`)
 *
 * ── WHY IT IS STORE STATE, NOT A DERIVATION (Panel, #63 5797440981) ─────────
 * `analysisHeldOn`'s reactivity note: a selector bound to `nodes` never re-runs
 * when an acknowledgement lands, because the graph does not change. So the fact
 * lives in the canvas store (`ceeHeldScenarioIds`) and every consumer reads it
 * by identity through `ceeHoldsModel(state, scenarioId)` — Panel's Run-gate
 * build takes it as its `ceeHoldsModel` input, with no second derivation.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TOUCH ─────────────────────────────────────
 * The digest-keyed acknowledgement (`isGraphServerAcknowledged` /
 * `markGraphServerAcknowledged` / `analyticalDigest`) is unchanged. The latch is
 * an ADDITIONAL, stored signal written at every acknowledgement site; the Run
 * gate still releases on the digest until Panel swaps it onto this.
 *
 * ── THE TWO RULES EVERY WRITER KEEPS ────────────────────────────────────────
 *   · KEYED BY SCENARIO. A switch A → B does not carry A's latch to B, and
 *     returning to A finds it still latched: what CEE holds does not change
 *     because the page looked at another decision. So it is NOT in
 *     `DECISION_CONTEXT_CLEAR`, and nothing ever un-latches it for the page's
 *     life (the store has no `persist()`; a reload starts unlatched and the boot
 *     read re-derives it).
 *   · WRITTEN FOR THE SCENARIO THE ACKNOWLEDGEMENT BELONGS TO — the id the
 *     request was sent for — never for `currentScenarioId` read at the moment
 *     it lands. A registration of A answered after the user opened B latches A.
 */
import { logger } from '../../lib/logger'
import { useCanvasStore } from '../store'

/** The slice `ceeHoldsModel` reads — the canvas store state satisfies it. */
export interface CeeHeldModelState {
  readonly ceeHeldScenarioIds: ReadonlySet<string>
}

/** Which acknowledgement latched the scenario — for the log line only. */
export type CeeHeldModelAcknowledgement =
  | 'registration'
  | 'boot_read'
  | 'applied_receipt'
  | 'version_restore'

/**
 * ⭐ THE READER. True ⇔ this page has seen an acknowledgement that CEE holds
 * `scenarioId`'s model. Pure: every input explicit, so a selector
 * `useCanvasStore((s) => ceeHoldsModel(s, id))` re-runs when the latch moves.
 */
export function ceeHoldsModel(
  state: CeeHeldModelState,
  scenarioId: string | null | undefined,
): boolean {
  return typeof scenarioId === 'string' && scenarioId.length > 0 && state.ceeHeldScenarioIds.has(scenarioId)
}

/**
 * ⭐ THE WRITER. Latch `scenarioId` — the scenario the acknowledgement belongs
 * to (see the header). Idempotent; a missing id latches nothing.
 */
export function latchCeeHeldModel(
  scenarioId: string | null | undefined,
  acknowledgement: CeeHeldModelAcknowledgement,
): void {
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) return
  const held = useCanvasStore.getState().ceeHeldScenarioIds
  if (held.has(scenarioId)) return
  const next = new Set(held)
  next.add(scenarioId)
  useCanvasStore.setState({ ceeHeldScenarioIds: next })
  logger.info('one_writer.cee_holds_model', { scenarioId, acknowledgement })
}

/** Test/teardown helper: the latch is page-life state, so specs must reset it. */
export function __resetCeeHeldModelLatchForTest(): void {
  useCanvasStore.setState({ ceeHeldScenarioIds: new Set<string>() })
}

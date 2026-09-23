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
 * `mayRegisterOverSavedModel(state)`: may this page send its own copy as the
 * scenario's whole model?
 *   · the scenario is not CEE-addressable
 *     (no id, or a local non-UUID id)   → 'permit' — nothing CEE holds can be
 *                                         overwritten; a registration mints
 *   · a CEE-addressable scenario with
 *     NO read recorded yet               → 'wait' (review B1 F: the re-arm can
 *                                         run in the commit BEFORE the read
 *                                         begins — "no answer yet" is not an
 *                                         answer)
 *   · a read is in flight               → 'wait'
 *   · CEE holds no model (`absent`,
 *     `notReadable`)                     → 'permit' — the first registration
 *   · anything else                      → 'refuse'. Either CEE holds a model
 *                                         (`merged`, `unchanged`, `registered`,
 *                                         `mergeRefused`), or the page could not
 *                                         find out (unavailable, unusable,
 *                                         refused, signInRequired) or abandoned
 *                                         the read (skipped). Fail CLOSED: an
 *                                         unknown is not a licence to overwrite
 *                                         (the boot hook reads again —
 *                                         `unknownGraphReadRetry.ts`).
 *
 * ⭐ OW-1 RULE 1 (programme-docs #63): "`graph/register` is sent only when CEE
 *   holds no model." This used to 'permit' a canvas whose ELEMENTS were a
 *   subset of CEE's after `merged`/`unchanged`/`registered` (review B2 option
 *   (i), the #1855 in-page re-offer). That re-offer is gone: it could still
 *   write a VALUE CEE lacked (Panel V1), and under rule 2 a read that returned
 *   the graph, or an acknowledged registration, LATCHES the scenario
 *   (`registration/ceeHeldModel.ts`), so the page never registers it again. The
 *   re-arm asks the latch first; this verdict is the read's half of the same
 *   rule and refuses on its own when CEE is known to hold a model.
 *
 * ── ONE READ, ONE TOKEN (review B1 E) ──────────────────────────────────────
 * `beginBootGraphRead` returns a token; `settleBootGraphRead` applies only while
 * that token is still the scenario's CURRENT one. So a superseded read — the
 * hydration hook re-runs on a `user?.id` change and aborts read 1 while read 2
 * is in flight — can neither erase nor overwrite read 2's mark. A `skipped`
 * settle of the current token is RECORDED (it verdicts 'refuse'), never deleted:
 * deleting it used to turn "in flight" into "no record", which then permitted.
 *
 * ── A REGISTRATION CEE ACKNOWLEDGED IS A SETTLED READ ──────────────────────
 * A successful `graph/register` REPLACED the scenario's model with exactly the
 * elements it carried; the ack path records them in `lastAuthoritativeGraph`
 * and calls `recordRegistrationAcknowledged`, which settles this record as
 * `registered` under a NEW token. (It also latches the scenario — OW-1 rule 2 —
 * so the re-arm never offers it again; the settled record is kept for the
 * token rule below.) The new token supersedes any read still in flight — its
 * answer predates, or at best races, what CEE acknowledged — so that answer
 * changes NOTHING: not this record, and (`isCurrentBootGraphRead`, asked at the
 * read's write boundary) not the canvas, the removal notice,
 * `lastAuthoritativeGraph` or the acknowledgement. A LATER read begins its own
 * token and replaces this record as usual.
 *
 * ⚠ SCOPE. This gates the reload/in-page RE-ARM only (a model that lost, or
 *   never had, its acknowledgement). A deliberate import still waiting for its
 *   first registration (ROADMAP 2.467 / 2.503) is carried by the pending marker,
 *   which the re-arm never touches, and is not gated by this verdict. The OW-1
 *   LATCH does gate it (`useImportRegistration`): once CEE is known to hold the
 *   scenario's model on this page, a deliberate import is not written over it
 *   either — it stays pending, visibly unconfirmed.
 *
 * Keyed by scenario for the reason `serverGraphRetryStore` gives: an unkeyed
 * value survives a scenario change and answers for the wrong decision.
 */
import { create } from 'zustand'

import type { HydrationOutcome } from './serverGraphHydration'

/**
 * `reading` — a read is in flight; `registered` — no read answer is current, but
 * CEE acknowledged a registration of this page's copy (see the header); every
 * other state is the read's own `HydrationOutcome`.
 */
export type BootGraphReadState = 'reading' | 'registered' | HydrationOutcome

export interface BootGraphReadRecord {
  /** The read that owns this record; only it may settle it. */
  readonly token: number
  readonly state: BootGraphReadState
}

interface BootGraphReadStore {
  byScenario: Readonly<Record<string, BootGraphReadRecord>>
}

export const useBootGraphReadStore = create<BootGraphReadStore>(() => ({ byScenario: {} }))

/**
 * A scenario id CEE can address is a UUID — `scenarios.id` is a uuid column, so
 * anything else is a local draft id and would spend a request to earn a
 * guaranteed refusal. The ONE definition: `hydrateCanvasFromServer` reads it
 * too, so "the read would be issued" and "the gate waits for a read" cannot
 * disagree about which ids are CEE's.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCeeAddressableScenarioId(scenarioId: unknown): scenarioId is string {
  return typeof scenarioId === 'string' && UUID_RE.test(scenarioId)
}

/** Outcomes that mean "CEE holds no model for this scenario". */
const NO_SAVED_MODEL: ReadonlySet<BootGraphReadState> = new Set<BootGraphReadState>([
  'absent',
  'notReadable',
])

/** Monotonic across the page, so a token is never reused for a later read. */
let lastToken = 0

function write(scenarioId: string, record: BootGraphReadRecord): void {
  useBootGraphReadStore.setState((s) => ({ byScenario: { ...s.byScenario, [scenarioId]: record } }))
}

/**
 * Called synchronously before the read's first await. The returned token is
 * the read's claim on the record; pass it to `settleBootGraphRead`.
 */
export function beginBootGraphRead(scenarioId: string): number {
  lastToken += 1
  write(scenarioId, { token: lastToken, state: 'reading' })
  return lastToken
}

/**
 * Called on every exit of the read. Applies only while `token` is still the
 * scenario's current read; a superseded read changes nothing. Returns whether
 * it applied.
 */
export function settleBootGraphRead(
  scenarioId: string,
  token: number,
  outcome: HydrationOutcome,
): boolean {
  const current = useBootGraphReadStore.getState().byScenario[scenarioId]
  if (current === undefined || current.token !== token) return false
  write(scenarioId, { token, state: outcome })
  return true
}

/**
 * Whether `token` is still the scenario's CURRENT read — the same test
 * `settleBootGraphRead` applies, asked at the read's WRITE boundary. A read a
 * registration acknowledgement or a newer read has superseded answers for a
 * model that is no longer the latest word on what CEE holds, so its answer must
 * change nothing: not the record (the settle refuses), and not the canvas, the
 * removal notice, `lastAuthoritativeGraph` or the acknowledgement either
 * (`serverGraphHydration.ts` "A SUPERSEDED READ CHANGES NOTHING").
 */
export function isCurrentBootGraphRead(scenarioId: string, token: number): boolean {
  return useBootGraphReadStore.getState().byScenario[scenarioId]?.token === token
}

/**
 * A registration CEE ACKNOWLEDGED for this scenario is a settled answer about
 * what CEE holds (the header's "A REGISTRATION CEE ACKNOWLEDGED IS A SETTLED
 * READ"). Called from the registration ack path, only while the canvas is still
 * this scenario's, alongside the `lastAuthoritativeGraph` record. A fresh token:
 * a read still in flight cannot overwrite it.
 */
export function recordRegistrationAcknowledged(scenarioId: string): void {
  if (!isCeeAddressableScenarioId(scenarioId)) return
  lastToken += 1
  write(scenarioId, { token: lastToken, state: 'registered' })
}

export type RegisterOverSavedModel = 'permit' | 'wait' | 'refuse'

export interface RegisterOverSavedModelInput {
  readonly scenarioId: string | null | undefined
  /** The scenario's recorded read state, or undefined when none is recorded. */
  readonly read: BootGraphReadState | undefined
}

/** Pure: the whole rule, with every input explicit (OW-1 rule 1, see the header). */
export function registerOverSavedModelVerdict(
  input: RegisterOverSavedModelInput,
): RegisterOverSavedModel {
  if (!isCeeAddressableScenarioId(input.scenarioId)) return 'permit'
  const read = input.read
  if (read === undefined || read === 'reading') return 'wait'
  if (NO_SAVED_MODEL.has(read)) return 'permit'
  return 'refuse'
}

export interface RegisterOverSavedModelState {
  readonly currentScenarioId: string | null | undefined
}

/** The thin store-reading wrapper the re-arm calls. */
export function mayRegisterOverSavedModel(state: RegisterOverSavedModelState): RegisterOverSavedModel {
  const scenarioId = state.currentScenarioId
  return registerOverSavedModelVerdict({
    scenarioId,
    read: isCeeAddressableScenarioId(scenarioId)
      ? useBootGraphReadStore.getState().byScenario[scenarioId]?.state
      : undefined,
  })
}

/** Test/teardown helper. */
export function __resetBootGraphReadForTest(): void {
  useBootGraphReadStore.setState({ byScenario: {} })
}

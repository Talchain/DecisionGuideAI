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
 *   · CEE holds a model the page read
 *     (`merged`, `unchanged`), or one
 *     this page REGISTERED and CEE
 *     acknowledged (`registered`)        → 'permit' ONLY while the canvas holds
 *                                         no element CEE lacks — every node id
 *                                         and edge pair ⊆ `lastAuthoritativeGraph`
 *                                         (review B2 option (i)); otherwise
 *                                         'refuse'. A registration of a subset
 *                                         cannot resurrect a delete; one that
 *                                         carries an element CEE lacks can.
 *   · anything else                      → 'refuse' — the page could not find
 *                                         out (unavailable, unusable, refused,
 *                                         signInRequired), the merge refused
 *                                         the graph (mergeRefused), or the read
 *                                         was abandoned (skipped). Fail CLOSED:
 *                                         an unknown is not a licence to
 *                                         overwrite.
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
 * `registered` under a NEW token. Without it, a reload while a starter/import
 * registration was still pending read first, the merge refused the pending
 * import (`mergeRefused`, verdict 'refuse'), and that refusal outlived the
 * registration that answered it: every later value-only change was walled off
 * for the page's life. The new token supersedes any read still in flight — its
 * answer predates, or at best races, what CEE acknowledged. A LATER read begins
 * its own token and replaces this record as usual.
 *
 * ⚠ SCOPE. This gates the reload/in-page RE-ARM only (a model that lost, or
 *   never had, its acknowledgement). A deliberate import still waiting for its
 *   first registration (ROADMAP 2.467 / 2.503) is carried by the pending marker,
 *   which the re-arm never touches, and is unchanged here.
 *
 * Keyed by scenario for the reason `serverGraphRetryStore` gives: an unkeyed
 * value survives a scenario change and answers for the wrong decision.
 */
import { create } from 'zustand'

import type { HydrationOutcome } from './serverGraphHydration'
import {
  identityFromCanvasGraph,
  type AuthoritativeGraphIdentity,
} from '../utils/graphIdentity'

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

/**
 * States that mean "CEE holds a model, and this page knows which elements":
 * it read them, or CEE acknowledged registering them.
 */
const SAVED_MODEL_READ: ReadonlySet<BootGraphReadState> = new Set<BootGraphReadState>([
  'merged',
  'unchanged',
  'registered',
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
 * A registration CEE ACKNOWLEDGED for this scenario is a settled answer about
 * what CEE holds (the header's "A REGISTRATION CEE ACKNOWLEDGED IS A SETTLED
 * READ"). Called from the registration ack path, only while the canvas is still
 * this scenario's, alongside the `lastAuthoritativeGraph` record the subset rule
 * reads. A fresh token: a read still in flight cannot overwrite it.
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
  /**
   * The element set CEE is known to hold — `store.lastAuthoritativeGraph`,
   * READ. Named for its meaning, not the store field, so this read never looks
   * like a write to the recorder scan in
   * `provisionalDelivery.graphAcceptance.reachability.spec.ts`.
   */
  readonly ceeHolds: AuthoritativeGraphIdentity | null
  /** The element set on the canvas now. */
  readonly canvas: AuthoritativeGraphIdentity
}

/** Every canvas node id and edge pair is one CEE is known to hold. */
function canvasHoldsNothingCeeLacks(
  canvas: AuthoritativeGraphIdentity,
  cee: AuthoritativeGraphIdentity | null,
): boolean {
  if (cee === null) return false
  const nodeIds = new Set(cee.nodeIds)
  const edgePairs = new Set(cee.edgePairs)
  return (
    canvas.nodeIds.every((id) => nodeIds.has(id)) &&
    canvas.edgePairs.every((pair) => edgePairs.has(pair))
  )
}

/** Pure: the whole rule, with every input explicit. */
export function registerOverSavedModelVerdict(
  input: RegisterOverSavedModelInput,
): RegisterOverSavedModel {
  if (!isCeeAddressableScenarioId(input.scenarioId)) return 'permit'
  const read = input.read
  if (read === undefined || read === 'reading') return 'wait'
  if (NO_SAVED_MODEL.has(read)) return 'permit'
  if (SAVED_MODEL_READ.has(read)) {
    return canvasHoldsNothingCeeLacks(input.canvas, input.ceeHolds)
      ? 'permit'
      : 'refuse'
  }
  return 'refuse'
}

export interface RegisterOverSavedModelState {
  readonly currentScenarioId: string | null | undefined
  readonly nodes: ReadonlyArray<{ id?: unknown }>
  readonly edges: ReadonlyArray<{ source?: unknown; target?: unknown }>
  readonly lastAuthoritativeGraph: AuthoritativeGraphIdentity | null
}

/** The thin store-reading wrapper the re-arm calls. */
export function mayRegisterOverSavedModel(state: RegisterOverSavedModelState): RegisterOverSavedModel {
  const scenarioId = state.currentScenarioId
  return registerOverSavedModelVerdict({
    scenarioId,
    read: isCeeAddressableScenarioId(scenarioId)
      ? useBootGraphReadStore.getState().byScenario[scenarioId]?.state
      : undefined,
    ceeHolds: state.lastAuthoritativeGraph,
    canvas: identityFromCanvasGraph(state.nodes, state.edges),
  })
}

/** Test/teardown helper. */
export function __resetBootGraphReadForTest(): void {
  useBootGraphReadStore.setState({ byScenario: {} })
}

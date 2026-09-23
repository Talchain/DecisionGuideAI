/**
 * ⭐ AN UNCONFIRMED DELETE IS NOT A DELETE CEE AGREED TO — the delete twin of
 * #1892's unresolved rename/add hold.
 *
 * ## The defect this closes (#1892 review @ 846997a1, residual row "Delete";
 * #1905 residual 1, verified by its author on base and head)
 *
 * A `structural_delete` whose turn ends ambiguously — an untyped 500, or a
 * transport loss — keeps its deletion on the canvas (`resolveStructuralDelete`:
 * the server may have committed, so reverting would be the opposite lie) and
 * tells the user it could not confirm. Nothing then held registration, so once
 * delivery settled ONE whole-graph `graph/register` carried the post-delete
 * canvas and its ack made that canvas look like a model CEE holds: CEE deleted
 * the node through the side channel, and a deletion its own edit protocol never
 * confirmed became canonical. The same principle #1892 already applies to
 * renames and adds — delivery settling is not proof CEE accepted the edit.
 *
 * ## Log vocabulary
 *
 * The hold's cause is `'unresolved_structural_edit'` (the rename/add/delete
 * family). It reaches the log as `import_registration.deferred_for_edit_delivery`
 * only when a registration was ALREADY armed; the re-arm effect stands down on
 * it without a line (witnessed in this spec's 500 case). So this module names
 * the edit itself: `structural_delete.unconfirmed_held` when an attempt is
 * recorded, `structural_delete.unconfirmed_superseded` when a later proven
 * delete settles earlier records, `structural_delete.unconfirmed_proven_by_receipt`
 * when a later applied receipt proves them. No user-facing copy lives here.
 *
 * ## What this module answers
 *
 * `unconfirmedDeleteStillOnCanvas(state)`: for THIS scenario, is there an
 * unconfirmed deletion whose optimistic state the canvas still shows — every
 * element it removed still absent? `editDeliveryHold` holds registration while
 * it is (`unresolved_structural_edit`). It releases when that state is gone (an
 * element came back — undo, a receipt, a boot merge of CEE's graph) or on reload
 * (the register is not persisted).
 *
 * ⛔ ONLY PROOF SUPERSEDES (the #1892 review's rule, delete form — its second
 * verdict, @ 9dac7d3e: "a later refusal alone is not proof"). Two sources:
 *   · a later PROVEN delete drops the earlier records that share an element
 *     with it, so a later committed delete of a restored node is never walled
 *     off by a stale one;
 *   · a later APPLIED RECEIPT of any kind (Panel's #1905 item 2) settles every
 *     record of its scenario that its committed graph proves — see
 *     `settleUnconfirmedDeletesProvenByReceipt`.
 * A reverted/refused attempt releases nothing.
 *
 * ## Every exit settles (Panel's #1905 item 1)
 *
 * `useConversation` resolves a delete on three arms and misses three exits: an
 * abort (a user preempt, a client timeout), a superseded turn, and the scenario
 * fence. The carrier (`useStructuralDeleteEvents`) closes them by asking, after
 * its own await, whether ANYBODY settled the attempt — `takeStructuralDeleteAttemptSettled`.
 */
import {
  readStructuralDeleteReceipt,
  type StructuralDeleteIntent,
} from '../mutations/structuralDelete'
import { logger } from '../../lib/logger'

interface UnconfirmedDelete {
  readonly scenarioId: string | null
  readonly nodeIds: readonly string[]
  readonly edgeIds: readonly string[]
  /** The attempt itself — its canonical removals are what a later receipt must prove. */
  readonly intent: StructuralDeleteIntent
}

let records: UnconfirmedDelete[] = []

/**
 * Attempts some resolver has settled, by intent id. Read ONCE by the carrier's
 * every-exit settle (`takeStructuralDeleteAttemptSettled`), which forgets it.
 */
const settledAttempts = new Set<string>()

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of [...listeners]) l()
}

function claimedOf(intent: StructuralDeleteIntent): { nodeIds: string[]; edgeIds: string[] } {
  return { nodeIds: [...intent.claimedNodeIds], edgeIds: [...intent.claimedEdgeIds] }
}

/**
 * Settle one delete attempt.
 *   'proven'      — the committed graph proves the removal: supersedes earlier
 *                   records sharing an element.
 *   'reverted'    — refused / unproven, the canvas was restored: releases nothing.
 *   'unconfirmed' — kept without proof (ambiguous typed error, transport loss):
 *                   recorded, so registration holds while it stands.
 */
export type StructuralDeleteSettlement = 'proven' | 'reverted' | 'unconfirmed'

export function settleStructuralDeleteAttempt(
  intent: StructuralDeleteIntent,
  scenarioId: string | null,
  settlement: StructuralDeleteSettlement,
): void {
  const { nodeIds, edgeIds } = claimedOf(intent)
  if (typeof intent.id === 'string') settledAttempts.add(intent.id)
  const before = records.length
  if (settlement === 'proven') {
    const nodes = new Set(nodeIds)
    const edges = new Set(edgeIds)
    records = records.filter(
      (r) =>
        r.scenarioId !== scenarioId ||
        (!r.nodeIds.some((id) => nodes.has(id)) && !r.edgeIds.some((id) => edges.has(id))),
    )
  }
  const superseded = before - records.length
  if (superseded > 0) {
    logger.info('structural_delete.unconfirmed_superseded', { scenarioId, nodeIds, edgeIds, superseded })
  }
  const recorded = settlement === 'unconfirmed' && (nodeIds.length > 0 || edgeIds.length > 0)
  if (recorded) {
    records.push({ scenarioId, nodeIds, edgeIds, intent })
    logger.info('structural_delete.unconfirmed_held', { scenarioId, nodeIds, edgeIds })
  }
  if (superseded > 0 || recorded) emit()
}

/** Structural so `editDeliveryHold` and its tests can pass a literal. */
export interface UnconfirmedDeleteState {
  readonly nodes: ReadonlyArray<{ id?: unknown }>
  readonly edges?: ReadonlyArray<{ id?: unknown }>
  readonly currentScenarioId?: string | null
}

export function unconfirmedDeleteStillOnCanvas(state: UnconfirmedDeleteState): boolean {
  if (records.length === 0) return false
  const scenario = state.currentScenarioId ?? null
  const nodeIds = new Set(state.nodes.map((n) => n.id))
  const edgeIds = new Set((state.edges ?? []).map((e) => e.id))
  return records.some(
    (r) =>
      r.scenarioId === scenario &&
      r.nodeIds.every((id) => !nodeIds.has(id)) &&
      r.edgeIds.every((id) => !edgeIds.has(id)),
  )
}

/**
 * Did any resolver settle this attempt? Answers once, then forgets the id.
 *
 * For the carrier's EVERY-EXIT settle: its await has returned, so if nobody
 * settled the attempt, it was sent and never heard (aborted, superseded, or
 * fenced) and `unconfirmed` is the honest terminal state. Asked of the
 * settlement itself rather than of a list of exits, so a new exit is covered
 * without being named.
 */
export function takeStructuralDeleteAttemptSettled(intentId: string): boolean {
  const settled = settledAttempts.has(intentId)
  settledAttempts.delete(intentId)
  return settled
}

/**
 * ⭐ A LATER APPLIED RECEIPT CAN PROVE AN UNCONFIRMED DELETE (Panel's #1905
 * item 2). A delete that answered 500 may have committed; the only evidence
 * that it did is a committed graph without its elements, and until this the
 * only receipt consulted was the delete's OWN. So when CEE had committed it,
 * the canvas matched CEE's committed graph and analysis stayed held until
 * reload.
 *
 * Settles `proven` each standing record of THIS scenario whose removals are
 * ALL absent from `response.draft_graph` — by the delete's own receipt rule
 * (`readStructuralDeleteReceipt`: nodes by id, independent links by endpoint
 * pair; a canvas edge id is never evidence, no committed graph carries one).
 *
 * ⛔ Three guards, each fail-closed:
 *   · SCENARIO — the receipt answers for its own decision; the same node id in
 *     another decision is a different element.
 *   · OVERLAP — a committed graph sharing no node with the canvas is not this
 *     model's receipt (`reconcileAppliedGraph` drops it for the same reason),
 *     and it lacks EVERY element trivially: counting it would be a vacuous proof.
 *   · ALL, not ANY — one element still committed means CEE did not take this
 *     delete, whatever else has gone.
 * A record with no canonical removal to test is never proven.
 */
export function settleUnconfirmedDeletesProvenByReceipt(input: {
  readonly scenarioId: string | null
  readonly response: unknown
  readonly canvasNodeIds: Iterable<string>
}): void {
  if (records.length === 0) return
  const draftGraph = (input.response as { draft_graph?: unknown } | null | undefined)?.draft_graph
  const committedNodes = (draftGraph as { nodes?: unknown } | null | undefined)?.nodes
  if (!Array.isArray(committedNodes)) return
  const onCanvas = new Set(input.canvasNodeIds)
  const overlaps = committedNodes.some((n) => {
    const id = (n as { id?: unknown } | null)?.id
    return typeof id === 'string' && onCanvas.has(id)
  })
  if (!overlaps) return

  const before = records.length
  const proven: UnconfirmedDelete[] = []
  records = records.filter((r) => {
    if (r.scenarioId !== input.scenarioId) return true
    const removals = (r.intent.removedNodeIds?.length ?? 0) + (r.intent.removedEdges?.length ?? 0)
    if (removals === 0) return true
    if (readStructuralDeleteReceipt(r.intent, input.response) !== 'proven') return true
    proven.push(r)
    return false
  })
  if (records.length === before) return
  logger.info('structural_delete.unconfirmed_proven_by_receipt', {
    scenarioId: input.scenarioId,
    nodeIds: proven.flatMap((r) => r.nodeIds),
    edgeIds: proven.flatMap((r) => r.edgeIds),
    settled: proven.length,
  })
  emit()
}

export function subscribeUnconfirmedDeletes(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only. */
export function __resetUnconfirmedDeletesForTest(): void {
  records = []
  settledAttempts.clear()
  emit()
}

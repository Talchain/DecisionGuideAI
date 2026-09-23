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
 * delete settles earlier records. No user-facing copy lives here.
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
 * ⛔ ONLY A LATER PROVEN DELETE SUPERSEDES (the #1892 review's rule, delete
 * form — its second verdict, @ 9dac7d3e: "a later refusal alone is not proof").
 * A proven attempt drops the earlier records that share an element with it, so
 * a later committed delete of a restored node is never walled off by a stale
 * one; a reverted/refused attempt releases nothing.
 */
import type { StructuralDeleteIntent } from '../mutations/structuralDelete'
import { logger } from '../../lib/logger'

interface UnconfirmedDelete {
  readonly scenarioId: string | null
  readonly nodeIds: readonly string[]
  readonly edgeIds: readonly string[]
}

let records: UnconfirmedDelete[] = []

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
    records.push({ scenarioId, nodeIds, edgeIds })
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

export function subscribeUnconfirmedDeletes(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only. */
export function __resetUnconfirmedDeletesForTest(): void {
  records = []
  emit()
}

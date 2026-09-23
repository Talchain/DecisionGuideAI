/**
 * ⭐ AN UNCONFIRMED DELETE IS NOT A DELETE CEE AGREED TO — the delete twin of
 * #1892's unresolved rename/add hold.
 *
 * ## The defect this closes (#1892 review @ 846997a1, residual row "Delete")
 *
 * A `structural_delete` whose turn ends ambiguously — an untyped 500, or a
 * transport loss — keeps its deletion on the canvas (`resolveStructuralDelete`:
 * the server may have committed, so reverting would be the opposite lie) and
 * tells the user it could not confirm. Nothing then held registration, so the
 * next whole-graph `graph/register` omitted the node and CEE deleted it through
 * the side channel: a deletion its own edit protocol never confirmed became
 * canonical. The same principle #1892 already applies to renames and adds —
 * delivery settling is not proof CEE accepted the edit.
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
 * ⛔ ONLY THE LATEST ATTEMPT SPEAKS (the #1892 review's blocker, in its delete
 * form): every settled delete attempt — proven, reverted or unconfirmed —
 * first drops the earlier records that share an element with it, so a later
 * committed delete of a restored node can never be walled off by a stale one.
 */
import type { StructuralDeleteIntent } from '../mutations/structuralDelete'

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
 * Settle one delete attempt. `unconfirmed` is true only on the arms that keep
 * the deletion without proof (ambiguous typed error, transport loss).
 */
export function settleStructuralDeleteAttempt(
  intent: StructuralDeleteIntent,
  scenarioId: string | null,
  unconfirmed: boolean,
): void {
  const { nodeIds, edgeIds } = claimedOf(intent)
  const nodes = new Set(nodeIds)
  const edges = new Set(edgeIds)
  const before = records.length
  records = records.filter(
    (r) =>
      r.scenarioId !== scenarioId ||
      (!r.nodeIds.some((id) => nodes.has(id)) && !r.edgeIds.some((id) => edges.has(id))),
  )
  if (unconfirmed && (nodeIds.length > 0 || edgeIds.length > 0)) {
    records.push({ scenarioId, nodeIds, edgeIds })
  }
  if (records.length !== before || unconfirmed) emit()
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

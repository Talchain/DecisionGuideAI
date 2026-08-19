/**
 * Undo may not resurrect an element the SERVER has durably deleted.
 *
 * THE DEFECT, measured at deployed UI `aa916511`: `structural_delete` made a
 * canvas delete durable, but `undo()` restores `history.past[n]` verbatim and
 * knows nothing about the receipt — so Cmd+Z put the node back on the canvas
 * while the saved model still held it deleted. That is the founder's original
 * complaint (*"it keeps adding the option that I deleted back"*) re-opened on
 * screen, one keystroke after the wire fix closed it.
 *
 * ⚠ EVERY ASSERTION BINDS BY NODE ID, NEVER BY COUNT (CLAUDE.md trap 19). A
 * count assertion is satisfied by a different node than the one the server
 * removed — which is exactly the assertion that passes on the wrong object.
 *
 * ⚠ THE OPPOSITE-DIRECTION TWIN IS MANDATORY HERE (trap 22b). This guard sits
 * between two harms: resurrecting a durably-deleted node (a lie) and refusing
 * to restore a node that was never durably deleted (silently eating the user's
 * undo). Every withhold case below has a restore case beside it.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import { useCanvasStore } from '../store'

/** The option the founder deletes. Its ID is what every assertion binds to. */
const EU = 'opt-eu'
/** A sibling option that is NEVER deleted — the discriminator for identity binding. */
const US = 'opt-us'
const GOAL = 'goal-1'

function seedGraph(): void {
  const nodes: Node[] = [
    { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow revenue' } },
    { id: EU, type: 'option', position: { x: 100, y: 0 }, data: { label: 'Expand into the EU' } },
    { id: US, type: 'option', position: { x: 200, y: 0 }, data: { label: 'Expand into the US' } },
  ]
  const edges: Edge<EdgeData>[] = [
    { id: 'e-eu-goal', source: EU, target: GOAL },
    { id: 'e-us-goal', source: US, target: GOAL },
  ]
  useCanvasStore.setState({
    nodes,
    edges,
    history: { past: [], future: [] },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    durablyDeletedElements: { nodeIds: [], edgeIds: [] },
    durableDeletionNotice: null,
  })
}

const nodeIds = (): string[] => useCanvasStore.getState().nodes.map((n) => n.id)
const edgeIds = (): string[] => useCanvasStore.getState().edges.map((e) => e.id)

/**
 * Mark a deletion as PROVEN by the server, exactly as `resolveStructuralDelete`
 * does on a `'proven'` receipt. Set directly rather than through the action so
 * the undo tests below fail on BEHAVIOUR at pristine (the node comes back)
 * rather than on a missing function — a red about the defect, not about an API.
 */
function serverProvedDeleted(ids: { nodeIds?: string[]; edgeIds?: string[] }): void {
  useCanvasStore.setState({
    durablyDeletedElements: { nodeIds: ids.nodeIds ?? [], edgeIds: ids.edgeIds ?? [] },
  })
}

describe('undo vs. durable deletion — the canvas may not contradict the saved model', () => {
  beforeEach(() => {
    seedGraph()
  })

  it('does NOT bring back a node whose deletion the server proved', () => {
    useCanvasStore.getState().deleteNodeById(EU)
    expect(nodeIds()).not.toContain(EU)
    serverProvedDeleted({ nodeIds: [EU] })

    useCanvasStore.getState().undo()

    // THE ASSERTION. Bound to the deleted node's own id.
    expect(nodeIds()).not.toContain(EU)
    // And the graph is still coherent: no edge dangles off the withheld node.
    expect(edgeIds()).not.toContain('e-eu-goal')
  })

  it('DOES bring back a node whose deletion was never proven — a local-only delete stays undoable', () => {
    // The opposite-direction twin. `captureStructuralDelete` stands down when no
    // CEE graph_hash is held (its KNOWN GAP), so this delete never became
    // durable and undo must behave exactly as it always has.
    useCanvasStore.getState().deleteNodeById(EU)
    expect(nodeIds()).not.toContain(EU)

    useCanvasStore.getState().undo()

    expect(nodeIds()).toContain(EU)
    expect(edgeIds()).toContain('e-eu-goal')
  })

  it('withholds ONLY the proven node and restores its sibling from the SAME snapshot', () => {
    // THE IDENTITY DISCRIMINATOR. Both options leave in ONE gesture, so both sit
    // in ONE history snapshot and one undo restores both — a guard keyed on
    // anything weaker than the id (a count, "the deleted ones", the snapshot
    // itself) either brings EU back or eats US. Only an id-bound guard splits
    // them, and this test fails in BOTH directions if it is not.
    useCanvasStore.setState({
      selection: { nodeIds: new Set([EU, US]), edgeIds: new Set(), anchorPosition: null },
    })
    useCanvasStore.getState().deleteSelected()
    expect(nodeIds()).not.toContain(EU)
    expect(nodeIds()).not.toContain(US)
    serverProvedDeleted({ nodeIds: [EU] })

    useCanvasStore.getState().undo()

    expect(nodeIds()).toContain(US) // the un-proven sibling must come back
    expect(nodeIds()).not.toContain(EU) // the proven one must not
    // US's edge rides back with it; EU's must not dangle.
    expect(edgeIds()).toContain('e-us-goal')
    expect(edgeIds()).not.toContain('e-eu-goal')
  })

  it('holds the line across MULTI-STEP undo, back past the delete', () => {
    // The defect's real shape: the entry that resurrects is not the first undo.
    useCanvasStore.getState().deleteNodeById(EU)
    serverProvedDeleted({ nodeIds: [EU] })
    // A later, unrelated edit — its snapshot post-dates the delete.
    useCanvasStore.getState().pushHistory()
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n) => (n.id === US ? { ...n, data: { label: 'Expand into the US (v2)' } } : n)),
    })

    useCanvasStore.getState().undo() // step 1 — back to the post-delete state
    expect(nodeIds()).not.toContain(EU)
    useCanvasStore.getState().undo() // step 2 — back PAST the delete
    expect(nodeIds()).not.toContain(EU)
    useCanvasStore.getState().undo() // step 3 — exhausts the stack
    expect(nodeIds()).not.toContain(EU)
  })

  it('holds the line through REDO as well', () => {
    useCanvasStore.getState().deleteNodeById(EU)
    serverProvedDeleted({ nodeIds: [EU] })
    useCanvasStore.getState().undo()
    expect(nodeIds()).not.toContain(EU)

    useCanvasStore.getState().redo()

    expect(nodeIds()).not.toContain(EU)
  })

  it('tells the user, by name, that undo declined — and says nothing when it did not', () => {
    useCanvasStore.getState().deleteNodeById(EU)
    serverProvedDeleted({ nodeIds: [EU] })
    useCanvasStore.getState().undo()

    const notice = useCanvasStore.getState().durableDeletionNotice
    expect(notice).not.toBeNull()
    expect(notice?.kind).toBe('withheld')
    expect(notice?.nodeIds).toContain(EU)
    expect(notice?.labels).toContain('Expand into the EU')

    // Silence when the guard did not fire — an undo that restored everything
    // must not tell the user something was held back.
    seedGraph()
    useCanvasStore.getState().deleteNodeById(EU)
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().durableDeletionNotice).toBeNull()
  })

  it('re-fires the notice on a SECOND declined undo (two presses, two events)', () => {
    // TWO snapshots that both pre-date the delete, so both undos are declined.
    // (`historyHash` keys on the label, so relabelling makes a distinct entry.)
    useCanvasStore.getState().pushHistory()
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n) => (n.id === US ? { ...n, data: { label: 'Expand into the US (v2)' } } : n)),
    })
    useCanvasStore.getState().pushHistory()
    useCanvasStore.getState().deleteNodeById(EU)
    serverProvedDeleted({ nodeIds: [EU] })

    useCanvasStore.getState().undo()
    const first = useCanvasStore.getState().durableDeletionNotice
    useCanvasStore.getState().undo()
    const second = useCanvasStore.getState().durableDeletionNotice

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    // Without a monotonic seq a value-comparing subscriber swallows the second
    // and the user is told once for two presses.
    expect(second!.seq).toBeGreaterThan(first!.seq)
  })
})

describe('recordDurableDeletion — the receipt arriving AFTER an undo already restored the node', () => {
  beforeEach(() => {
    seedGraph()
  })

  it('takes the node back off the canvas and says so', () => {
    // The race: delete, undo before the turn returns, THEN the receipt proves it.
    useCanvasStore.getState().deleteNodeById(EU)
    useCanvasStore.getState().undo()
    expect(nodeIds()).toContain(EU) // the un-proven undo legitimately restored it

    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [EU], edgeIds: [] })

    expect(nodeIds()).not.toContain(EU)
    expect(edgeIds()).not.toContain('e-eu-goal')
    const notice = useCanvasStore.getState().durableDeletionNotice
    expect(notice?.kind).toBe('reconciled')
    expect(notice?.nodeIds).toContain(EU)
  })

  it('is silent when the node had already gone — the ordinary case', () => {
    useCanvasStore.getState().deleteNodeById(EU)

    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [EU], edgeIds: [] })

    expect(nodeIds()).not.toContain(EU)
    expect(nodeIds()).toContain(US)
    // Nothing was taken off the canvas, so there is nothing to announce.
    expect(useCanvasStore.getState().durableDeletionNotice).toBeNull()
  })

  it('never removes a node it was not told about', () => {
    useCanvasStore.getState().recordDurableDeletion({ nodeIds: [EU], edgeIds: [] })
    expect(nodeIds()).toContain(US)
    expect(nodeIds()).toContain(GOAL)
  })
})

describe('the record does not outlive the graph whose ids it names', () => {
  it('reset() clears it — because reset REISSUES the same node ids', () => {
    // ⚠ NOT HOUSEKEEPING. `createNodeId` returns `String(nextNodeId)` and
    // `reset()` sets `nextNodeId: 1`, so the next graph reuses the ids the last
    // one had. A surviving record would match a BRAND-NEW node by id and
    // withhold it from undo — eating work the server never deleted, which is
    // the opposite-direction harm of the defect this guard closes.
    seedGraph()
    useCanvasStore.getState().recordDurableDeletion({ nodeIds: ['1'], edgeIds: [] })
    expect(useCanvasStore.getState().durablyDeletedElements.nodeIds).toContain('1')

    useCanvasStore.getState().reset()

    expect(useCanvasStore.getState().durablyDeletedElements.nodeIds).toHaveLength(0)
    expect(useCanvasStore.getState().durableDeletionNotice).toBeNull()

    // ...and the reissued id is genuinely undoable again.
    const fresh: Node[] = [
      { id: '1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'A brand-new option' } },
    ]
    useCanvasStore.setState({ nodes: fresh, edges: [], history: { past: [], future: [] } })
    useCanvasStore.getState().deleteNodeById('1')
    useCanvasStore.getState().undo()
    expect(nodeIds()).toContain('1')
  })
})

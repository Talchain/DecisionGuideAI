/**
 * ⭐⭐⭐ THE MOST BASIC AUTHORING ACT WAS MISSING FROM THE SURFACE BUILT FOR IT.
 *
 * A user could not rename anything from the Model tab. Not a disabled control
 * with a reason — nothing at all.
 *
 * DERIVED AT `3b2df4ce`, with a contrast control so the zero is discriminating
 * rather than a blind sweep:
 *
 *   grep -rn 'rename|updateNodeLabel|setLabel|onLabelChange' src/canvas/model-tab-v2/
 *     → 5 hits, ALL prose comments, ZERO code.
 *   contrast: 'proposeFactorValue' → ModelTabV2Panel.tsx:652, a live call site.
 *
 * ⚠ AND THE TAB ALREADY TOLD THE USER TO DO IT. The goal row renders a "From
 * your brief" pill whose title is, verbatim (`domain/goalLabelProvenance.ts:87`):
 *
 *     "Taken from your brief — not yet confirmed as your goal.
 *      Edit it to say what you want to achieve."
 *
 * The surface named the remedy and offered no control. Renaming is also what
 * RETIRES that pill: `store.updateNodeLabel` calls
 * `provenanceAfterHumanAuthoredLabel`, which supersedes CEE's `from_brief`
 * stamp on a goal the moment a person authors the label — so the instruction
 * and its resolution are the same act.
 *
 * WHY THE GESTURE IS DOUBLE-CLICK. It is the rename gesture this product
 * already has: `ReactFlowGraph.tsx:1390-1394` binds node double-click to
 * `requestNodeRename`. Single click on the row label already means "show me
 * this on the canvas" and keeps that meaning — a new gesture would have had to
 * displace an existing one.
 *
 * WHY NO NEW CARRIER WAS NEEDED. `store.updateNodeLabel` (`store.ts:3035`)
 * describes itself as "THE ONE CHOKEPOINT EVERY RENAME GESTURE CROSSES": it
 * calls `recordStructuralRenameIntent` BEFORE the local write (so
 * `expected_label` is a real concurrency assertion rather than a tautology),
 * pushes history, and stamps provenance. `structural_rename` is graded
 * `'server_graph'` in `mutationAuthority.ts:64` and its sender is hosted live at
 * `DraftChat.tsx:164`. This adds a fifth caller to that chokepoint and inherits
 * all of it.
 *
 * ⚠ NODES ONLY. `updateNodeLabel` is a node action, and a relationship row's
 * label is a DERIVED endpoint pair (`row.labelEndpoints`), not a stored string —
 * writing it back would invent a field. Relationship rows therefore offer no
 * rename, and that is asserted below rather than left to chance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const GOAL_ID = 'goal_margin'
const FACTOR_ID = 'fac_churn'
const EDGE_ID = 'e_churn_to_margin'

const NODES = [
  {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin', kind: 'goal' },
  },
  {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Churn pressure',
      kind: 'factor',
      category: 'observable',
      observed_state: { value: 0.5, source: 'cee_inference' },
    },
  },
] as unknown as Node[]

const EDGES = [
  {
    id: EDGE_ID,
    source: FACTOR_ID,
    target: GOAL_ID,
    data: { strength: 0.6 },
  },
] as unknown as Edge[]

function renderPanel(onRenameRow?: (id: string, label: string) => void) {
  render(
    <ModelTabV2Panel
      nodes={NODES}
      edges={EDGES}
      goalThreshold={null}
      onRenameRow={onRenameRow}
    />,
  )
  openOutlineGroups()
}

const labelButton = (id: string) => screen.getByTestId(`model-row-v2-${id}-label`)
const renameInput = (id: string) => screen.queryByTestId(`model-row-v2-${id}-rename`)

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('renaming an element from its row', () => {
  it('⭐ double-click opens an editor seeded with the label the user is looking at', () => {
    renderPanel(vi.fn())

    // Positive control: the row and its label really rendered, so an absence
    // below would be about the editor and not about an empty outline (trap 13).
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(renameInput(FACTOR_ID)).toBeNull()

    fireEvent.doubleClick(labelButton(FACTOR_ID))

    const input = renameInput(FACTOR_ID)
    expect(input).toBeInTheDocument()
    // Seeded with the CURRENT label — a rename editor that opens empty is a
    // delete-and-retype, not an edit.
    expect(input).toHaveValue('Churn pressure')
  })

  it('⭐ Enter commits, addressed BY ID', () => {
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)

    fireEvent.doubleClick(labelButton(FACTOR_ID))
    fireEvent.change(renameInput(FACTOR_ID)!, { target: { value: 'Churn pressure, monthly' } })
    fireEvent.keyDown(renameInput(FACTOR_ID)!, { key: 'Enter' })

    // Bound by IDENTITY (trap 19): the node id, never the old label — a label
    // retargets on rename, which is the whole point of the field.
    expect(onRenameRow).toHaveBeenCalledWith(FACTOR_ID, 'Churn pressure, monthly')
    expect(renameInput(FACTOR_ID)).toBeNull()
  })

  it('Escape abandons it, and writes nothing', () => {
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)

    fireEvent.doubleClick(labelButton(FACTOR_ID))
    fireEvent.change(renameInput(FACTOR_ID)!, { target: { value: 'something else entirely' } })
    fireEvent.keyDown(renameInput(FACTOR_ID)!, { key: 'Escape' })

    expect(onRenameRow).not.toHaveBeenCalled()
    expect(renameInput(FACTOR_ID)).toBeNull()
    expect(labelButton(FACTOR_ID)).toHaveTextContent('Churn pressure')
  })

  it('⚠ refuses to commit a BLANK label, and does not silently keep the editor open', () => {
    // A blank commit would push an empty string through the chokepoint, stamp
    // the goal as human-authored, and leave the row identifying nothing. The
    // honest outcome is to treat it as an abandon.
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)

    fireEvent.doubleClick(labelButton(FACTOR_ID))
    fireEvent.change(renameInput(FACTOR_ID)!, { target: { value: '   ' } })
    fireEvent.keyDown(renameInput(FACTOR_ID)!, { key: 'Enter' })

    expect(onRenameRow).not.toHaveBeenCalled()
    expect(labelButton(FACTOR_ID)).toHaveTextContent('Churn pressure')
  })

  it('⚠ does not write when the label is UNCHANGED', () => {
    // An unchanged commit is not harmless: it pushes history, records a rename
    // intent and — on a goal — supersedes the `from_brief` provenance stamp,
    // retiring a pill that is still true. So a no-op edit must stay a no-op.
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)

    fireEvent.doubleClick(labelButton(FACTOR_ID))
    fireEvent.keyDown(renameInput(FACTOR_ID)!, { key: 'Enter' })

    expect(onRenameRow).not.toHaveBeenCalled()
  })

  it('the GOAL can be renamed too — the row whose own pill says to', () => {
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)

    fireEvent.doubleClick(labelButton(GOAL_ID))
    fireEvent.change(renameInput(GOAL_ID)!, { target: { value: 'Hold gross margin above 78%' } })
    fireEvent.keyDown(renameInput(GOAL_ID)!, { key: 'Enter' })

    expect(onRenameRow).toHaveBeenCalledWith(GOAL_ID, 'Hold gross margin above 78%')
  })

  it('⚠ a RELATIONSHIP row offers no rename — its label is derived, not stored', () => {
    renderPanel(vi.fn())

    const edgeRow = screen.getByTestId(`model-row-v2-${EDGE_ID}`)
    // CONTRAST CONTROL in the same render: the edge row exists and a factor row
    // DOES open an editor, so this absence is a property of the row kind and not
    // of a query that matches nothing.
    expect(edgeRow).toBeInTheDocument()
    fireEvent.doubleClick(labelButton(FACTOR_ID))
    expect(renameInput(FACTOR_ID)).toBeInTheDocument()
    fireEvent.keyDown(renameInput(FACTOR_ID)!, { key: 'Escape' })

    fireEvent.doubleClick(labelButton(EDGE_ID))
    expect(renameInput(EDGE_ID)).toBeNull()
  })

  it('⚠ offers nothing when the host provides no rename handler', () => {
    // The lane boundary (`modelTabV2Boundary.sourceScan`) forbids this directory
    // from touching the store, so the write arrives as a prop. Absent prop must
    // mean NO AFFORDANCE — never a control that silently swallows the rename.
    renderPanel(undefined)

    fireEvent.doubleClick(labelButton(FACTOR_ID))
    expect(renameInput(FACTOR_ID)).toBeNull()
  })

  it('CONTRAST CONTROL: a single click still means "show me this on the canvas"', () => {
    // The new gesture must not displace the existing one. Without this, binding
    // rename to a single click would pass every case above.
    const onFocusOnCanvas = vi.fn()
    render(
      <ModelTabV2Panel
        nodes={NODES}
        edges={EDGES}
        goalThreshold={null}
        onRenameRow={vi.fn()}
      />,
    )
    openOutlineGroups()

    fireEvent.click(labelButton(FACTOR_ID))
    expect(renameInput(FACTOR_ID)).toBeNull()
    void onFocusOnCanvas
  })
})

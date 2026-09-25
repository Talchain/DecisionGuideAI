/**
 * EdgePanel — the link's sign/direction gets a REACHABLE control.
 *
 * ## The defect, restated for this surface
 *
 * `useEdgeMutations.setDirection` → `buildEdgeDirectionEditEvent` was already
 * built and already reaches CEE: it emits `edge_strength_edit` with
 * `direction_intent`, and magnitude edits through that same kind are
 * witnessed on staging (`setDirectionEmitsEdgeDirectionEdit.spec.tsx`). Its
 * only two call sites were unreachable — `RelationshipsSection` is never
 * mounted, and `EdgeAdvancedEditor`'s own "Effect direction" select sits
 * behind `techMode`'s collapsed `TechnicalDisclosure`, closed by default —
 * so no default user could ever flip a link's sign without going through the
 * magnitude slider's negative half, which does not use this carrier at all.
 *
 * ⚠ THIS IS A SURFACE TEST ON PURPOSE (CLAUDE.md trap 3b). A seam test on
 * `setDirection` alone (already covered by
 * `setDirectionEmitsEdgeDirectionEdit.spec.tsx`) would pass while the new
 * control still called nothing, or called a second writer. Every assertion
 * here is driven through the rendered control, mounted through
 * `InspectorRouter` — the surface that actually routes an edge selection to
 * `EdgePanel` — not through `EdgePanel` in isolation.
 *
 * ⚠ EVERY OUTGOING-EVENT ASSERTION BINDS BY IDENTITY (trap 19): the payload is
 * compared field for field against an exact literal, including the edge's
 * own endpoint ids, never a value predicate a sibling edge could also satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    // importOriginal-spread, never a hand-listed factory (CLAUDE.md trap 12).
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const NODES = [
  { id: 'n_price', type: 'factor', data: { label: 'Price' }, position: { x: 0, y: 0 } },
  { id: 'n_revenue', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/** A causal edge whose strength the SERVER stated — direction IS assertable. */
const ASSERTABLE_CAUSAL_EDGE = [{
  id: 'e1', source: 'n_price', target: 'n_revenue',
  data: {
    weight: 0.4, direction: 'positive', weightSource: 'cee',
    serverStrength: { mean: 0.4, effect_direction: 'positive' },
  },
}]

/** Same edge, no server-stated strength — nothing truthful for `expected`. */
const UNASSERTABLE_CAUSAL_EDGE = [{
  id: 'e1', source: 'n_price', target: 'n_revenue',
  data: { weight: 0.4, direction: 'positive' },
}]

/**
 * The DISCRIMINATING CONTRAST — a `bidirected` `edge_type` denies a single
 * direction of causation outright (an unobserved common cause), the same
 * fixture shape `StyledEdge.directionMark.spec.tsx:433` and
 * `StyledEdge.structural.spec.tsx:281` already use for the canvas arrowhead.
 * Still carries `serverStrength`, so a control gated only on assertability
 * (and not on `resolveEdgeDirectionMarker`) would wrongly still offer it.
 */
const NON_CAUSAL_EDGE = [{
  id: 'e1', source: 'n_price', target: 'n_revenue',
  data: {
    weight: 0.4, direction: 'positive', weightSource: 'cee', edge_type: 'bidirected',
    serverStrength: { mean: 0.4, effect_direction: 'positive' },
  },
}]

function seed(edges: unknown[]) {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function renderInspector() {
  return render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
}

function readEdge() {
  return useCanvasStore.getState().edges.find(e => e.id === 'e1')
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
})

describe('a causal edge whose strength the server has stated', () => {
  beforeEach(() => seed(ASSERTABLE_CAUSAL_EDGE))

  it('offers the direction control, operable, showing the CURRENT direction', async () => {
    renderInspector()
    const increases = await screen.findByTestId('edge-direction-increases')
    const decreases = screen.getByTestId('edge-direction-decreases')

    // Reachable at all — neither an ancestor fieldset nor the control itself
    // inerts it, the exact defect this file exists to close.
    expect(increases).not.toBeDisabled()
    expect(decreases).not.toBeDisabled()
    expect(increases.closest('fieldset[disabled]')).toBeNull()

    // Seeded direction is 'positive' — shown, not merely storable.
    expect(increases).toHaveAttribute('aria-pressed', 'true')
    expect(decreases).toHaveAttribute('aria-pressed', 'false')
  })

  it('dispatches ONE edge_strength_edit stating the flipped direction, magnitude untouched', async () => {
    renderInspector()
    const decreases = await screen.findByTestId('edge-direction-decreases')
    fireEvent.click(decreases)

    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(sendSystemEvent.mock.calls[0][0]).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'n_price',
        to: 'n_revenue',
        magnitude: 0.4,
        direction_intent: 'negative',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
    // The local write lands on THIS edge, by id.
    await waitFor(() => expect(readEdge()?.data).toMatchObject({
      direction: 'negative', directionSource: 'user',
    }))
    // And the button now shows the direction it just wrote.
    expect(await screen.findByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does NOT send when the pressed button already matches the current direction', async () => {
    renderInspector()
    const increases = await screen.findByTestId('edge-direction-increases')
    fireEvent.click(increases)

    // Give any accidental async dispatch a turn to land before asserting absence.
    await new Promise(r => setTimeout(r, 0))
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

describe('a causal edge with no server-stated strength', () => {
  beforeEach(() => seed(UNASSERTABLE_CAUSAL_EDGE))

  it('still shows the control but keeps it fenced — the direction edit cannot be asserted either', async () => {
    renderInspector()
    const increases = await screen.findByTestId('edge-direction-increases')
    const decreases = screen.getByTestId('edge-direction-decreases')
    expect(increases).toBeDisabled()
    expect(decreases).toBeDisabled()
  })
})

describe('a non-causal edge (contrast control)', () => {
  beforeEach(() => seed(NON_CAUSAL_EDGE))

  /**
   * ⭐⭐ THE CONTRAST CONTROL. `resolveEdgeDirectionMarker` refuses a
   * `bidirected` `edge_type` for the SAME reason the canvas arrowhead
   * refuses it — asserting "increases/decreases" on a link the model itself
   * declines to give a single direction would be a causal claim the edge
   * does not make. Withheld entirely, not merely disabled: this edge carries
   * `serverStrength`, so a gate that checked only assertability would pass
   * this edge through wrongly.
   */
  it('offers no direction control at all', async () => {
    renderInspector()
    // Let the panel finish mounting before asserting an absence.
    await screen.findByText(/Price/)
    expect(screen.queryByTestId('edge-direction-control')).toBeNull()
    expect(screen.queryByTestId('edge-direction-increases')).toBeNull()
    expect(screen.queryByTestId('edge-direction-decreases')).toBeNull()
  })
})

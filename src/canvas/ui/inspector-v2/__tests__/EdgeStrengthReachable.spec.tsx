/**
 * The link-strength control can be operated by a user.
 *
 * ## The defect, and why it was invisible
 *
 * Every piece of the edge-strength edit path was already built and connected:
 * `buildEdgeStrengthEditEvent` → `setStrength`'s `sendSystemEvent` →
 * `buildPayload.ts`'s `adaptEdgeStrengthEdit` → CEE's `dispatchEdgeStrengthEdit`
 * (a 616-line handler that resolves the persisted edge and routes the write
 * through `adjust_edge_strength`). What was missing was a user able to touch it.
 *
 * `InspectorRouter`'s edge branch wrapped the whole panel in an unconditional
 * `<fieldset disabled>`, which natively inerts every form-associated
 * descendant. So the slider rendered, the presets rendered, and `setStrength`
 * was uncallable from any real mount.
 *
 * ⚠ AND `EdgePanel`'s OWN SPECS COULD NOT SEE IT, which is why it survived:
 * they render `EdgePanel` directly and never cross the Router boundary. Every
 * assertion here therefore goes through `InspectorRouter` — the surface that
 * actually mounts this panel.
 *
 * ## The fixture is grounded, not invented
 *
 * `serverStrength: { mean, effect_direction }` is the shape measured on the
 * deployed build (staging `e5a62322`, live model, 13 of 21 edges carrying it
 * with `weightSource: 'cee'`). A fixture I made up would encode my model of the
 * producer rather than the producer, and this file's whole subject is a control
 * whose write must survive a server round trip.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import {
  INSPECTOR_EDGE_REASON,
  INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON,
} from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function setStoreState(nodes: unknown[], edges: unknown[] = []) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

/** Endpoint ids in the deployed model's own 8-hex shape. */
const NODES = [
  { id: '2891dabb', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'c12af5de', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/** Carries what the SERVER stated — the tuple `expected` is built from. */
const ASSERTABLE_EDGE = [
  {
    id: 'e1',
    source: '2891dabb',
    target: 'c12af5de',
    data: {
      weight: 0.5,
      direction: 'positive',
      serverStrength: { mean: 0.5, effect_direction: 'positive' },
    },
  },
]

/** Same edge with no server-stated strength — nothing truthful for `expected`. */
const UNASSERTABLE_EDGE = [
  { id: 'e1', source: '2891dabb', target: 'c12af5de', data: { weight: 0.5, direction: 'positive' } },
]

const strengthPresets = () =>
  screen.getAllByRole('button').filter(b => /weak|moderate|strong/i.test(b.textContent ?? ''))

const boundary = () =>
  document.querySelector<HTMLFieldSetElement>('fieldset[data-authority="disabled"]')

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('an edge whose strength the server has stated', () => {
  beforeEach(() => setStoreState(NODES, ASSERTABLE_EDGE))

  /**
   * ⭐ THE DEFECT, STATED AS THE PROPERTY IT VIOLATED. Before the change every
   * one of these was `disabled` because an ancestor fieldset inerted them.
   */
  it('lets a user actually operate the strength presets', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const presets = strengthPresets()
    // Floor: an empty set would satisfy the loop vacuously.
    expect(presets.length, 'no strength presets rendered at all').toBeGreaterThan(0)
    for (const b of presets) {
      expect(b, `"${b.textContent}" is still inert`).not.toBeDisabled()
      expect(b.closest('fieldset[disabled]'), 'an ancestor fieldset still inerts it').toBeNull()
    }
  })

  it('explains what saves, using the constant rather than a copy of it', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(INSPECTOR_EDGE_REASON)
  })

  /**
   * ⛔ OPTING OUT OF THE BLANKET FENCE IS A DUTY TO FENCE YOUR OWN. Existence
   * probability and uncertainty each do ONE local `updateEdge` and emit
   * nothing, so a control that looked saveable would be destroyed on the next
   * server rehydrate. This is the arm that would red if unfencing the panel
   * had let them through with the strength control.
   */
  it('still fences the controls that write nothing to the model', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const existence = screen.getByLabelText('Connection existence probability')
    expect(existence).toBeDisabled()
    expect(existence.closest('fieldset[data-authority="disabled"]')).not.toBeNull()
  })

  it('keeps a real authority boundary in the panel — not an empty one', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const fence = boundary()
    expect(fence, 'the fence disappeared entirely').not.toBeNull()
    expect(
      fence!.querySelectorAll('input, select, textarea, button').length,
      'the fence encloses no controls, so asserting inertness over it proves nothing',
    ).toBeGreaterThan(0)
  })
})

describe('an edge with no server-stated strength', () => {
  beforeEach(() => setStoreState(NODES, UNASSERTABLE_EDGE))

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN. The two describes differ in exactly one field
   * — `serverStrength` — so a change that unfenced everything regardless would
   * pass the block above and RED here. Without this arm, "the control is
   * operable" proves only that something turned the fieldset off, not that the
   * carrier question decided it.
   */
  it('keeps the strength control fenced, because the edit cannot be asserted', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const presets = strengthPresets()
    expect(presets.length, 'no strength presets rendered at all').toBeGreaterThan(0)
    for (const b of presets) {
      expect(b, `"${b.textContent}" is operable on an edge whose edit cannot reach the model`).toBeDisabled()
    }
  })

  it('says why, rather than showing the sentence that promises a save', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const notice = screen.getByTestId('inspector-authority-notice')
    expect(notice).toHaveTextContent(INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON)
    expect(notice).not.toHaveTextContent(INSPECTOR_EDGE_REASON)
  })
})

/**
 * ROADMAP D2 — the band you chose is the band that lights up.
 *
 * MEASURED on served `e6d7971b`, my own scenario, twice with different values:
 * state **Strong 0.55** and the control highlights **Moderate 0.30**; state
 * **Very strong 0.85** and it highlights **Moderate 0.30** again. Both saved
 * correctly — server `0.55` and `0.85` — so the model was right and the screen
 * was wrong about the user's own choice.
 *
 * ⭐ `0.30` IS NOT A STALE VALUE, IT IS *THE* FABRICATED DEFAULT.
 * `USER_EDGE_DEFAULTS.weight` is the constant `captureStructuralAddEdge` refuses
 * to put on the wire, and the one `drawnLinkCopyDoesNotDelegate.spec.tsx` proves
 * this panel must not propose BEFORE a save. **It comes back AFTER the save** —
 * the display gate that refuses it covers the pre-save state only.
 *
 * ROOT, and it is NOT the provenance defect it travelled with: `localStrength`
 * is `useState(signedValue)`, whose initialiser runs once on mount, and
 * `setLocalStrength` is called only from user interactions — never from a store
 * change. `handleStateStrengthForSave` writes the store and leaves the panel's
 * own state at its mount-time value. Two defects, one user moment, two roots;
 * fixed separately rather than conflated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

const NODES = [
  { id: '2891dabb', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'c12af5de', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/** Exactly what a drag leaves behind: the 0.3 default, no stamp, the receipt. */
const DRAWN_LINK = [
  {
    id: 'e1',
    source: '2891dabb',
    target: 'c12af5de',
    data: { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated' },
  },
]

function seed() {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: DRAWN_LINK as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const bands = () => screen.queryAllByRole('button').filter((b) => /^(Slight|Moderate|Strong|Very strong)/.test(b.textContent ?? ''))
const pressedBand = () => bands().find((b) => b.getAttribute('aria-pressed') === 'true')

beforeEach(() => { vi.clearAllMocks(); cleanup(); seed() })

describe('the strength the user states is the one the control shows', () => {
  it('⭐ choosing Strong leaves STRONG pressed, not the fabricated default', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    // ⛔ FLOOR FIRST — this directory has shipped assertions that passed on an
    // empty DOM. `queryAll` returns [] whether the control is absent or the
    // panel never mounted, so every "nothing is pressed" claim is vacuous there.
    expect(bands().length, 'the panel did not mount at all').toBeGreaterThan(0)
    // Precondition: nothing is proposed before the user chooses (the #1541 rule).
    expect(pressedBand(), 'a band was pre-selected before any choice').toBeUndefined()

    const strong = bands().find((b) => /^Strong/.test(b.textContent ?? ''))!
    fireEvent.click(strong)

    const nowPressed = pressedBand()
    expect(nowPressed, 'no band is pressed after the user chose one').toBeDefined()
    expect(nowPressed!.textContent).toMatch(/^Strong/)
    // Bind by identity to the WRONG answer too, so the failure names the defect
    // rather than merely differing from the expectation.
    expect(nowPressed!.textContent, 'the fabricated 0.30 default is shown as the choice').not.toMatch(/^Moderate/)
  })

  it('the store records the value the user actually chose', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const strong = bands().find((b) => /^Strong/.test(b.textContent ?? ''))!
    fireEvent.click(strong)
    const edge = useCanvasStore.getState().edges.find((e) => e.id === 'e1')
    expect(Math.abs((edge?.data as { weight?: number })?.weight ?? 0)).toBeGreaterThan(0.4)
  })
})

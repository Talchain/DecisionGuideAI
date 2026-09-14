/**
 * The impact preview must measure from the strength you STATED, not from the
 * default you never chose.
 *
 * `origStrengthRef` is the baseline every preview delta is computed against:
 * `previewEdit(edgeId, v - origStrengthRef.current)` (`EdgePanel.tsx:285`). It is
 * a `useRef` seeded at MOUNT, and both existing writers maintain it —
 * `handleStrengthBlur` (`:290`) and `handleStrengthPresetChange` (`:305`).
 * `handleStateStrengthForSave`, the drawn-link twin added by #1541, does not.
 *
 * So: draw a link (weight `0.3`, the fabricated default), state `0.85` to save
 * it, then fine-tune. The first drag reports its impact as a change from **0.3**
 * — a number the user never chose — instead of from the 0.85 they did.
 *
 * ⛔ NOT CLOSED BY THE `key={edgeId}` REMOUNT (#1546), and the distinction is the
 * reason this exists. A key only remounts when the key CHANGES. Switching edges
 * re-seeds the ref and is fixed there; **staying on the SAME edge across a save
 * never remounts**, so the stale baseline survives exactly where the save
 * happened. Same field, two different paths, and only one of them was closed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const previewEdit = vi.fn()
const clearPreview = vi.fn()
vi.mock('../../../hooks/useEditImpactPreview', () => ({
  useEditImpactPreview: () => ({ previewEdit, clearPreview }),
}))
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const NODES = [
  { id: '2891dabb', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'c12af5de', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/** A freshly drawn link: the 0.3 default, no stamp, the stand-down receipt. */
const DRAWN = [{
  id: 'e1', source: '2891dabb', target: 'c12af5de',
  data: { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated' },
}]

function seed() {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: DRAWN as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    // Non-empty so the capture can succeed and the panel can leave the
    // awaiting-strength branch, which is what puts the fine-tune control on screen.
    lastServerGraphHash: 'abc123hash',
    _internal: {},
  } as never)
}

const bandNamed = (re: RegExp) => screen.queryAllByRole('button')
  .find((b) => re.test(b.textContent ?? ''))

beforeEach(() => { vi.clearAllMocks(); cleanup(); seed() })

describe('the impact preview measures from the strength the user stated', () => {
  it('⭐ after stating 0.85, a fine-tune reports its delta from 0.85 — not from the 0.3 nobody chose', async () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    // FLOOR: the panel mounted and offers the save control.
    expect(screen.queryAllByRole('button').length, 'panel did not mount').toBeGreaterThan(0)

    const veryStrong = bandNamed(/^Very strong/)
    expect(veryStrong, 'the state-for-save control is not on screen').toBeDefined()
    fireEvent.click(veryStrong!)

    // The store must now hold what the user stated, or the rest measures nothing.
    const stated = Math.abs(((useCanvasStore.getState().edges
      .find((e) => e.id === 'e1')!.data as { weight?: number }).weight) ?? 0)
    expect(stated, 'precondition: the stated strength did not reach the store').toBeCloseTo(0.85, 2)

    // Now FINE-TUNE. Only the slider routes through `handleStrengthChange`,
    // which is the one path that previews; the preset row calls `clearPreview`
    // instead. Targeting the wrong control is how the first version of this spec
    // failed for the wrong reason — it reported "no previewEdit call" rather than
    // a wrong delta, which is an absent measurement, not a passing one.
    previewEdit.mockClear()
    const ranges = [...document.querySelectorAll('input[type=range]')] as HTMLInputElement[]
    const strength = ranges.find((r) => Math.abs(Number(r.value) - 0.85) < 0.02)
    expect(strength, `no strength slider at 0.85; ranges = ${ranges.map((r) => r.value)}`).toBeDefined()

    fireEvent.change(strength!, { target: { value: '0.55' } })

    // ⚠ `SignedStrengthSlider` DEBOUNCES its `onChange` by 120 ms, so the preview
    // is SCHEDULED rather than fired. Asserting immediately reports "no preview
    // at all" — an absent measurement dressed as a failing one, which is how the
    // first version of this spec failed for the wrong reason twice.
    await waitFor(() => expect(previewEdit).toHaveBeenCalled())

    const deltas = previewEdit.mock.calls.map((c) => c[1] as number)
    expect(deltas.length, 'the slider fired no preview at all').toBeGreaterThan(0)

    // ⭐ THE DISCRIMINATION IS THE SIGN, which is why this cannot pass by accident.
    //   baseline 0.85 (correct) -> 0.55 - 0.85 = -0.30
    //   baseline 0.30 (stale)   -> 0.55 - 0.30 = +0.25
    // A wrong baseline does not merely shift the number, it INVERTS the reported
    // direction of the user's own adjustment: weakening a link is previewed as
    // strengthening it.
    expect(deltas[0], `previewed delta ${deltas[0]}: a POSITIVE value means the baseline was the 0.3 default the user never chose`).toBeCloseTo(-0.30, 2)
  })
})

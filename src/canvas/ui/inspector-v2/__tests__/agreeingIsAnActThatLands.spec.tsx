/**
 * Agreeing with Olumi's estimate, FROM THE INSPECTOR, must be an act that can
 * land — and must never claim to have landed when it has not.
 *
 * ⛔⛔ THE DEFECT THIS PINS WAS WIRE-WITNESSED ON SERVED `1d0306a0`, scenario
 * `52cf4a0c-2b00-4c21-a87c-f32e4dcd436c`, not reasoned from source:
 *
 *   REQUEST  {"kind":"edge_strength_edit", ... "magnitude":0.3,
 *             "expected":{"mean":0.3,...}, "intent":"set"}
 *   RESPONSE 200 — "That link already has exactly that strength and direction,
 *             so I haven't recorded it as your judgement. Confirm the current
 *             strength explicitly if you want to adopt the existing value."
 *             blocks: [], graph_hash UNCHANGED, weightSource still 'cee'.
 *
 * And what the person was shown, sampled after the click:
 *   +250/+600/+1200ms  →  "Updated"   (success green, with a tick)
 *   +2000ms onward     →  "Re-run to see how this affects the results"
 *
 * ⚠ SO THIS IS NOT A DEAD BUTTON — IT IS A BUTTON THAT REPORTED THE OPPOSITE OF
 * WHAT HAPPENED, and then invited the person to spend an analysis on a change
 * that did not exist. The truthful sentence went to the Olumi conversation, a
 * surface they must open deliberately; it appeared NOWHERE in the canvas view.
 * The same act from the Model tab sent `intent:'confirm_current'` and landed.
 * One act, two surfaces, opposite outcomes.
 *
 * ⚠ THIS IS A SURFACE TEST ON PURPOSE. A seam test on `confirmCurrentStrength`
 * would pass while the button still called `setStrength` — the defect lives in
 * the WIRING and in the COPY, so it is driven through the rendered control the
 * person actually presses (CLAUDE.md trap 3b: bind to the surface, not the unit).
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY (trap 19): the event is compared field for
 * field against an exact literal, and the edge is addressed by id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    // importOriginal-spread, never a hand-listed factory (trap 12).
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})
vi.mock('../../../hooks/useEditImpactPreview', () => ({
  useEditImpactPreview: () => ({ previewEdit: vi.fn(), clearPreview: vi.fn() }),
}))
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const NODES = [
  { id: '3eec8c99', type: 'factor', data: { label: 'Engineering Build Cost' }, position: { x: 0, y: 0 } },
  { id: '95d24f97', type: 'risk', data: { label: 'Vendor Lock-in Risk' }, position: { x: 0, y: 0 } },
]

/**
 * An edge the SERVER stated — `serverStrength` is the tuple the ingestion hops
 * record, and it is what makes the estimate ratifiable at all. Shaped from the
 * real captured edge `e-14`, so the fixture is a transcription rather than an
 * invention (trap 16: a fixture you wrote yourself is not evidence about the wire).
 */
const SERVER_STATED = [{
  id: 'e-14', source: '3eec8c99', target: '95d24f97',
  data: {
    weight: 0.3, direction: 'positive', weightSource: 'cee',
    serverStrength: { mean: 0.3, effect_direction: 'positive' },
  },
}]

function seed() {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: SERVER_STATED as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e-14']), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    lastServerGraphHash: 'abc123hash',
    _internal: {},
  } as never)
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
  seed()
})

function renderInspector() {
  return render(<InspectorRouter nodeId={null} edgeId="e-14" onClose={() => {}} />)
}

describe('agreeing with an estimate, from the inspector', () => {
  it('⭐ sends confirm_current — the only carrier the server can accept — not a set it refuses', async () => {
    renderInspector()
    const btn = await screen.findByTestId('edge-confirm-current-strength')
    // Precondition pinned IN-TEST (trap 13b): the control must be operable, or a
    // green result would only prove we never pressed anything.
    expect(btn.closest('fieldset[disabled]')).toBeNull()
    fireEvent.click(btn)

    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(sendSystemEvent.mock.calls[0][0]).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: '3eec8c99',
        to: '95d24f97',
        magnitude: 0.3,
        direction_intent: 'preserve',
        expected: { mean: 0.3, effect_direction: 'positive' },
        // ⛔ THE WHOLE DEFECT IN ONE FIELD. `'set'` at a magnitude equal to the
        // persisted value is `set_target_unchanged` — refused, witnessed.
        intent: 'confirm_current',
      },
    })
  })

  it('⭐ says the statement was SENT, never that it was saved', async () => {
    renderInspector()
    fireEvent.click(await screen.findByTestId('edge-confirm-current-strength'))
    await screen.findByTestId('edge-strength-confirm-sent')
    expect(screen.getByText(/Sent to Olumi/i)).toBeInTheDocument()
    // `dispatched` means a statement left, NOT that it landed —
    // `proposeEdgeStrengthConfirmation`'s own ruling: no caller may render it as
    // agreement recorded. "Updated" is exactly that rendering.
    expect(screen.queryByText(/^Updated$/i)).toBeNull()
  })

  it('⭐ does not invite a RE-RUN over a change that never happened', async () => {
    /**
     * ⚠ THE STALE VERDICT IS SEEDED, AND WITHOUT IT THIS TEST IS VACUOUS.
     * `InlineRerunPrompt` renders only when CEE's freshness verdict is already
     * stale AND an edit was confirmed in this panel. The first draft of this
     * file asserted the re-run text with no seed and PASSED AT PRISTINE — it
     * could not have failed (CLAUDE.md trap 13). A second draft bound to a
     * `data-testid` that only the FIX introduces, which is worse: the query
     * found nothing at pristine for the trivial reason that the marker did not
     * exist yet. Both arms must be able to render the thing being asserted.
     */
    useCanvasStore.setState({ analysisFreshness: { freshness: 'stale', computedAt: 1 } } as never)
    renderInspector()
    fireEvent.click(await screen.findByTestId('edge-confirm-current-strength'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalled())
    expect(screen.queryByText(/Re-run to see how this affects the results/i)).toBeNull()
  })

  it('writes nothing locally — CEE owns this provenance, the canvas learns it from the response', async () => {
    renderInspector()
    fireEvent.click(await screen.findByTestId('edge-confirm-current-strength'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalled())
    const edge = useCanvasStore.getState().edges.find(e => e.id === 'e-14')
    expect((edge?.data as Record<string, unknown>)?.weightSource).toBe('cee')
    expect((edge?.data as Record<string, unknown>)?.weight).toBe(0.3)
  })
})

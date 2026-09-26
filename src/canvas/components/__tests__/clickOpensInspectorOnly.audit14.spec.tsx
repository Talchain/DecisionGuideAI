/**
 * ⭐ A CARD CLICK OPENS THE INSPECTOR, AND ONLY THE INSPECTOR (design audit #14, the LOW part).
 *
 * Served on UI `853feeb7` (pricing, 1280×800), one click on the factor
 * "Bottom-Up Adoption Friction" opened three surfaces
 * (`1280x800-pricing-model-click-factor.png`):
 *   1. the inspector (330×665);
 *   2. an unrequested tooltip, "Say what you think in plain words" (211×35);
 *   3. a dock row, "Selected: Bottom-Up Adoption Friction · Ask about this".
 *
 * TRIGGER SOURCES, derived:
 *   · (2) is the in-words toggle's hover tooltip
 *     (`FactorControllablePanel.tsx`, `<Tooltip content="Say what you think in
 *     plain words">`). The inspector is placed beside the clicked node
 *     (`InspectorModal.placeInspector`), so it opens UNDER THE RESTING POINTER;
 *     the browser's synthetic hover after layout fires `mouseenter` on the
 *     toggle, and the 300 ms delay elapses with no pointer movement at all.
 *   · (3) is `SelectionPill` in the dock, which renders for any single
 *     selection. The inspector already offers "Explore with Olumi" for the
 *     same element, so the row repeats it.
 *
 * THE RULE: the in-words tooltip opens only after the user has moved the
 * pointer (or used the keyboard) on the value row; the dock's "Selected" row is
 * hidden while the inspector is open, and returns when it closes.
 *
 * CLAIM TYPE: jsdom DOM, by testid and exact text. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
// The inspector's panels are not under test in the dock half; the modal's own
// mount is.
vi.mock('../../ui/inspector-v2', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, InspectorRouter: () => <div data-testid="inspector-router-stub" /> }
})

import { FactorControllablePanel } from '../../ui/inspector-v2/panels/FactorControllablePanel'
import { describeInWordsToggleLabel } from '../BeliefElicitationField'
import { InspectorModal } from '../InspectorModal'
import { SelectionPill } from '../SelectionPill'
import { useCanvasStore } from '../../store'

/** The served factor the audit clicked (pricing starter). */
const FACTOR_ID = 'fac_adoption_friction'
const FACTOR_LABEL = 'Bottom-Up Adoption Friction'
/** The served tooltip text, byte for byte. */
const IN_WORDS_TIP = 'Say what you think in plain words'

function seedFactor(): void {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: FACTOR_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            kind: 'factor',
            label: FACTOR_LABEL,
            observedState: { value: 0.8, display_value: 'Very high (0.8)', source: 'cee_inference', extractionType: 'inferred' },
          },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'idle', report: null },
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    } as never,
    false,
  )
}

const visibleTooltipTexts = (): string[] =>
  [...document.querySelectorAll('[role="tooltip"]')].map((t) => t.textContent ?? '')

describe('audit #14 (2): the inspector opening under a resting pointer shows no tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seedFactor()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('⭐ a hover with no pointer movement (the synthetic one after layout) opens no tooltip', () => {
    render(<FactorControllablePanel nodeId={FACTOR_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    // The browser's synthetic move after layout carries the RESTING position,
    // and it may repeat; neither is the user moving the pointer.
    act(() => {
      const resting = screen.getByLabelText(describeInWordsToggleLabel(FACTOR_LABEL))
      fireEvent.mouseMove(resting, { clientX: 486, clientY: 340 })
    })
    act(() => {
      const resting = screen.getByLabelText(describeInWordsToggleLabel(FACTOR_LABEL))
      fireEvent.mouseMove(resting, { clientX: 486, clientY: 340 })
    })
    // Re-queried: the hover lands on the toggle as mounted NOW.
    const toggle = screen.getByLabelText(describeInWordsToggleLabel(FACTOR_LABEL))
    act(() => {
      fireEvent.mouseEnter(toggle.parentElement as HTMLElement)
      vi.advanceTimersByTime(400)
    })
    expect(visibleTooltipTexts()).not.toContain(IN_WORDS_TIP)
  })

  it('CONTROL — after the user moves the pointer on the value row, hovering the toggle shows it', () => {
    render(<FactorControllablePanel nodeId={FACTOR_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    const row = screen.getByLabelText(describeInWordsToggleLabel(FACTOR_LABEL)).closest('[data-testid="factor-value-row"]') as HTMLElement
    expect(row).not.toBeNull()
    act(() => {
      fireEvent.mouseMove(row, { clientX: 480, clientY: 330 })
      fireEvent.mouseMove(row, { clientX: 486, clientY: 331 })
    })
    const toggle = screen.getByLabelText(describeInWordsToggleLabel(FACTOR_LABEL))
    act(() => {
      fireEvent.mouseEnter(toggle.parentElement as HTMLElement)
      vi.advanceTimersByTime(400)
    })
    expect(visibleTooltipTexts()).toContain(IN_WORDS_TIP)
  })
})

describe('audit #14 (3): the dock "Selected" row is hidden while the inspector is open', () => {
  beforeEach(() => {
    seedFactor()
    useCanvasStore.setState({ selection: { nodeIds: new Set([FACTOR_ID]), edgeIds: new Set() } } as never, false)
  })
  afterEach(() => cleanup())

  it('⭐ inspector open: no "Selected:" row; inspector closed: the row returns with the exact label', () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={() => {}} />
        <SelectionPill />
      </ReactFlowProvider>,
    )
    expect(screen.getByTestId('inspector-router-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-panel-selection-pill')).toBeNull()

    rerender(
      <ReactFlowProvider>
        <SelectionPill />
      </ReactFlowProvider>,
    )
    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toHaveTextContent(`Selected:${FACTOR_LABEL}`)
  })
})

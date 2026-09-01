/**
 * The strip's DETAIL reflects a value written while it is open.
 *
 * ⚠⚠ WHY THIS FILE EXISTS SEPARATELY FROM `stripSeesItsOwnEdit.spec.ts`. That
 * one pins the signature HELPER — that it moves on a value and not on a drag.
 * It does not pin that `ModelStrip` USES it, so deleting
 * `stripNodeValueSignature(n)` from the subscription leaves it fully green.
 * A helper with no consumer is the defect one level up, and it is exactly the
 * shape that let the original bug ship: the field was added to what the strip
 * RENDERS without being added to what the strip SUBSCRIBES to.
 *
 * ⭐ WITNESSED ON DEPLOYED `32e9becd`: typing 42 into this detail's own editor
 * wrote through to the canvas node — which re-rendered showing 42 — while the
 * detail still read "No value set".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: Record<string, unknown>[] = []

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'

beforeEach(() => {
  nodes.length = 0
  nodes.push(
    { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention' } },
    { id: 'f1', type: 'factor', data: { label: 'Engineering hiring pressure' } },
  )
})
afterEach(cleanup)

/** Open the strip and the detail for `f1`. */
const openDetail = () => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  const mark = screen
    .getAllByTestId(`${TID}-mark`)
    .find((el) => el.getAttribute('data-node-id') === 'f1')!
  fireEvent.click(mark)
}

describe('a value written while the detail is open shows up in it', () => {
  it('re-reads the node after the store changes, rather than serving the value it was built with', () => {
    openDetail()
    // PRECONDITION, PINNED IN-TEST: it genuinely starts with no value, so the
    // assertion below cannot pass because it was always showing one.
    expect(screen.getByTestId(`${TID}-detail-value-text`)).toHaveTextContent(
      COPY.modelStrip.noValue,
    )

    // The write the edit authority performs: the node's observed state gains a
    // value. (The authority itself is exercised in
    // `modelStripFactorValueEdit.spec.tsx`; what is under test here is whether
    // this surface can SEE such a write.)
    nodes[1] = {
      id: 'f1',
      type: 'factor',
      data: {
        label: 'Engineering hiring pressure',
        observedState: { value: 0.42, raw_value: 42, unit: '£', source: 'user_override' },
      },
    }

    // Any interaction re-renders; the question is whether the memo recomputes.
    // With the old `id:type` signature it does not, and this stays "No value set".
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    const mark = screen
      .getAllByTestId(`${TID}-mark`)
      .find((el) => el.getAttribute('data-node-id') === 'f1')!
    fireEvent.click(mark)

    const shown = screen.getByTestId(`${TID}-detail-value-text`)
    expect(shown).toHaveTextContent('42')
    expect(shown).toHaveAttribute('data-has-value', 'true')
    // …and the provenance the same write stamped.
    expect(screen.getByTestId(`${TID}-detail-value-source`)).toHaveTextContent('User edited')
  })
})

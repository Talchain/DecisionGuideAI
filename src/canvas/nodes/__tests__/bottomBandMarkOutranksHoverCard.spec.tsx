/**
 * ⛔ A BOTTOM-BAND MARK'S OWN TOOLTIP IS NEVER COVERED BY THE CARD'S HOVER CARD (Lenses, 22 Oct: the hover card opened on
 * any hover of the card and partly covered every mark's tooltip, not only the marks that carry `data-node-tooltip`).
 *
 * The real outcome card with its real "Outcome not quantified" mark (`CardMark`, portalled into the card's bottom band),
 * and the real hover card (`NodeHoverCard`). Contrast: hovering the card's title opens the hover card.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null, stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { OutcomeNode } from '../OutcomeNode'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../components/hoverCard/hoverCardPlacement'

const outcome = { id: 'orders_filled', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Orders filled', kind: 'outcome' } } as Node
const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms) }) }
const hoverCard = () => screen.queryByTestId('node-hover-card')

function renderOutcome() {
  useCanvasStore.setState({ nodes: [outcome], edges: [], lodRung: 'full', viewMode: 'standard', results: { status: 'idle', report: null } } as never)
  render(
    <ReactFlowProvider>
      <OutcomeNode id={outcome.id} type="outcome" data={outcome.data as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </ReactFlowProvider>,
  )
  const title = screen.getByTestId('node-title')
  const mark = screen.getByTestId('outcome-unquantified')
  expect(mark.closest('[data-card-bottom-band]')).not.toBeNull()
  return { card: title.closest('[role="group"]') as HTMLElement, title, mark }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); useCanvasStore.setState({ nodes: [], edges: [] } as never) })

describe('a bottom-band mark outranks the card\'s hover card', () => {
  it('⛔ an open hover card closes while the pointer is on a mark, and returns on the title', async () => {
    const { card, title, mark } = renderOutcome()
    fireEvent.mouseEnter(card)
    await advance(HOVER_CARD_OPEN_DELAY_MS + 50)
    expect(hoverCard()).not.toBeNull()
    fireEvent.mouseOver(mark)
    await advance(HOVER_CARD_OPEN_DELAY_MS + 50)
    expect(hoverCard()).toBeNull()
    // Contrast: back on the title, the hover card opens again.
    fireEvent.mouseOut(mark, { relatedTarget: title })
    fireEvent.mouseOver(title)
    await advance(HOVER_CARD_OPEN_DELAY_MS + 50)
    expect(hoverCard()).not.toBeNull()
  })

  it('⛔ a pointer that goes straight to a mark never opens the hover card', async () => {
    const { card, mark } = renderOutcome()
    fireEvent.mouseEnter(card)
    await advance(100)
    fireEvent.mouseOver(mark)
    await advance(2000)
    expect(hoverCard()).toBeNull()
  })
})

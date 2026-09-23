/**
 * ⭐ A BAND'S TITLE SITS ON ITS CONTENT EDGE, SO THE LANDING FIT CANNOT CLIP IT
 * (Paul, 24 Sep: "Question", "Options", "Goal" clipped under the header and the
 * left toolbar on both PoCs; contract v3.1 `.layer-label` sits left-aligned with
 * the layer's content, just above it).
 *
 * The band is furniture and never enters the fit, so a title placed at the
 * band's padded edge (120 units outside the outermost card) is outside the
 * fitted box by construction. The measurement here is in GRAPH units: the
 * band's own left + the title's left must equal the lane's content x, and the
 * title must be bottom-anchored above the first card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import { TierLanes, LANE_TITLE_GAP, laneTitleFlowAnchor } from '../TierLanes'
import { deriveTierLanes } from '../../utils/tierLanes'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@xyflow/react')
  return { ...actual, ViewportPortal: ({ children }: { children: ReactNode }) => children }
})

function n(id: string, type: string, x: number, y: number, w = 200, h = 100): Node {
  return { id, type, position: { x, y }, data: { label: id }, width: w, height: h } as unknown as Node
}

const BOARD: Node[] = [
  n('dec', 'decision', 1064, 150, 336, 290),
  n('o1', 'option', 100, 500, 336, 515),
  n('o2', 'option', 600, 500, 336, 515),
  n('f1', 'factor', 200, 1150, 187, 360),
  n('out1', 'outcome', 800, 1600, 187, 219),
  n('goal', 'goal', 500, 2000, 336, 264),
]

const px = (v: string) => Number.parseFloat(v)

afterEach(cleanup)

describe('band titles sit inside the fitted box (contract v3.1 layer-label)', () => {
  it('every title’s graph-space x equals its lane’s content x (not the padded band edge)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      const band = screen.getByTestId(`tier-lane-${lane.tier}`)
      const title = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      const titleFlowX = px(band.style.left) + px(title.style.left)
      expect(titleFlowX).toBe(lane.x)
      expect(titleFlowX).toBe(laneTitleFlowAnchor(lane).x)
    }
  })

  it('every title is bottom-anchored LANE_TITLE_GAP above its first card, so a counter-scaled label grows up, never over a card', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      const band = screen.getByTestId(`tier-lane-${lane.tier}`)
      const title = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      expect(title.style.transform).toBe('translateY(-100%)')
      const titleBottomFlowY = px(band.style.top) + px(title.style.top)
      expect(titleBottomFlowY).toBe(lane.y - LANE_TITLE_GAP)
      expect(titleBottomFlowY).toBeLessThan(lane.y)
    }
  })

  it('CONTRAST — the band itself keeps its breathing room (still padded outside the cards)', () => {
    render(<TierLanes nodes={BOARD} />)
    const lane = deriveTierLanes(BOARD)[1]
    expect(px(screen.getByTestId(`tier-lane-${lane.tier}`).style.left)).toBeLessThan(lane.x)
  })
})

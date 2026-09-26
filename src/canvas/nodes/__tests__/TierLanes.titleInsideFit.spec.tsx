/**
 * ⭐ BAND TITLES ARE LABELS ONLY, IN ONE LEFT COLUMN INSIDE THE FIT
 * (Paul, 24 Sep: "Keep the labels on the left, but remove the different colour
 * panels of the different node types"; NODE-ANATOMY-v32 L1/L2; contract v3.1
 * `.layer-label` shares one left x for every layer).
 *
 * Measured in GRAPH units. Every title's x equals the graph's leftmost card
 * edge — the fitted box's own left edge — so the landing fit cannot put it
 * under the toolbar, and a centred Question/Goal title stays on the left. Each
 * title is bottom-anchored above its band's first card so a counter-scaled
 * label grows up, never over a card. And no tinted panel is drawn at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import { TierLanes, LANE_TITLE_GAP, laneTitleColumnX } from '../TierLanes'
import { deriveTierLanes, deriveLaneTitles } from '../../utils/tierLanes'

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
  n('f1', 'factor', 40, 1150, 187, 360),
  n('out1', 'outcome', 800, 1600, 187, 219),
  n('goal', 'goal', 500, 2000, 336, 264),
]

const px = (v: string) => Number.parseFloat(v)

afterEach(cleanup)

describe('band titles: one left column, no panels (NODE-ANATOMY-v32 L1/L2)', () => {
  it('every title sits at ONE x — the graph’s leftmost card edge — including the centred Question and Goal', () => {
    render(<TierLanes nodes={BOARD} />)
    const lanes = deriveTierLanes(BOARD)
    const leftmost = Math.min(...BOARD.map(b => b.position.x))
    expect(laneTitleColumnX(lanes)).toBe(leftmost)
    for (const lane of lanes) {
      expect(px(screen.getByTestId(`tier-lane-${lane.tier}-title`).style.left)).toBe(leftmost)
    }
  })

  it('every title is bottom-anchored LANE_TITLE_GAP above its band’s first card — or above its kind shapes where its run would cross one', () => {
    render(<TierLanes nodes={BOARD} />)
    const placed = deriveLaneTitles(BOARD)
    for (const lane of deriveTierLanes(BOARD)) {
      const title = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      expect(px(title.style.top)).toBe(lane.y - LANE_TITLE_GAP)
      const rises = placed.find((p) => p.tier === lane.tier)!.clearsKindGlyphs
      expect(title.style.transform).toBe(
        rises ? 'translateY(calc(-100% - 12px * var(--canvas-label-scale, 1)))' : 'translateY(-100%)',
      )
    }
  })

  /*
   * Review of #2074, Blocker 1: at the landing bound a card's kind shape stands
   * 24 units above it, and a title whose run reaches that shape sat under it.
   * On this board the factor band starts AT the title column (f1 at x 40), so
   * FACTORS' run crosses f1's shape (centre 40 + 187/2) and rises by the
   * shape's overhang at the live scale; GOAL, over a card centred far to the
   * right, stays on its card — as the prototype's GOAL and EXPLORATION do.
   */
  it('a title whose run crosses a kind shape rises by the shape’s overhang; one clear of every shape stays on its cards', () => {
    render(<TierLanes nodes={BOARD} />)
    const placed = deriveLaneTitles(BOARD)
    const byTier = (t: number) => placed.find((p) => p.tier === t)!
    expect(byTier(2).clearsKindGlyphs).toBe(true)
    expect(screen.getByTestId('tier-lane-2-title').style.transform).toBe(
      'translateY(calc(-100% - 12px * var(--canvas-label-scale, 1)))',
    )
    expect(byTier(5).clearsKindGlyphs).toBe(false)
    expect(screen.getByTestId('tier-lane-5-title').style.transform).toBe('translateY(-100%)')
  })

  it('⛔ no tinted band panel is drawn (the rectangles that stretched past the viewport)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      expect(screen.queryByTestId(`tier-lane-${lane.tier}`)).toBeNull()
    }
    expect(screen.getByTestId('tier-lanes').querySelector('.bg-panel')).toBeNull()
  })

  it('CONTRAST — every occupied tier still gets its title', () => {
    render(<TierLanes nodes={BOARD} />)
    expect(deriveTierLanes(BOARD).length).toBeGreaterThan(3)
    for (const lane of deriveTierLanes(BOARD)) {
      expect(screen.getByTestId(`tier-lane-${lane.tier}-title`).textContent).toBe(lane.title)
    }
  })
})

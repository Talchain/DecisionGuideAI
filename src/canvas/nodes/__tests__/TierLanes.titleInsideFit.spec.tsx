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
import { TierLanes, LANE_TITLE_GAP, LANE_TITLE_BESIDE_MIN, laneTitleFlowAnchor } from '../TierLanes'
import { deriveTierLanes } from '../../utils/tierLanes'
import { typography } from '../../../styles/typography'
import { DECISION_NODE_LABEL, MODEL_GROUP_TITLE } from '../../domain/vocabulary'

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

  // contract v3.1 CHR-3: tier 0 (the Question row) sits BESIDE its card when
  // there is room, so it is excluded here and pinned in its own block below.
  it('every title is bottom-anchored LANE_TITLE_GAP above its first card, so a counter-scaled label grows up, never over a card', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD).filter(l => l.tier !== 0)) {
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

/**
 * contract v3.1 — the rest of the lane chrome, pinned by identity (testid +
 * exact style values), so each delta below is RED at the pre-v3.1 source.
 *
 * A board shaped like the five shipped starters: 88 units from the tallest card
 * in one row to the next row's top (measured on all five), Question centred and
 * alone in its row.
 */
const STARTER_BOARD: Node[] = [
  n('dec', 'decision', 700, 0, 336, 200),
  n('o1', 'option', 100, 288, 336, 400),
  n('o2', 'option', 600, 288, 336, 380),
  n('f1', 'factor', 200, 776, 187, 300),
  n('out1', 'outcome', 800, 1164, 187, 219),
  n('goal', 'goal', 500, 1471, 336, 264),
]

function bandBox(tier: number) {
  const el = screen.getByTestId(`tier-lane-${tier}`)
  const top = px(el.style.top)
  return { left: px(el.style.left), top, width: px(el.style.width), bottom: top + px(el.style.height) }
}

describe('lane geometry stays inside the fit’s chrome gap (contract v3.1 CHR-1 / CHR-2)', () => {
  it('CHR-1: the band pads 16 units at the sides — never 120 — so its end cannot reach under the sidebar', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    for (const lane of deriveTierLanes(STARTER_BOARD)) {
      const b = bandBox(lane.tier)
      expect(b.left).toBe(lane.x - 16)
      expect(b.width).toBe(lane.width + 32)
    }
  })

  it('CHR-2: 16 units below every row (the Goal band stops inside the fit gap, clear of the bottom notice strip)', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    for (const lane of deriveTierLanes(STARTER_BOARD)) {
      expect(bandBox(lane.tier).bottom).toBe(lane.y + lane.height + 16)
    }
  })

  it('CHR-2: 44 units of title zone above each titled-above row', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    for (const lane of deriveTierLanes(STARTER_BOARD).filter(l => l.tier !== 0)) {
      expect(bandBox(lane.tier).top).toBe(lane.y - 44)
    }
  })

  it('⭐ CHR-2: adjacent bands never overlap — a clear 28-unit gutter at every 88-unit row gap, no seam', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    const lanes = deriveTierLanes(STARTER_BOARD)
    for (let i = 1; i < lanes.length; i++) {
      const gutter = bandBox(lanes[i].tier).top - bandBox(lanes[i - 1].tier).bottom
      expect(gutter, `rows ${lanes[i - 1].tier}→${lanes[i].tier}`).toBe(28)
    }
  })

  it('CHR-11: the band corner is concentric with the cards it holds (card radius token + the 16-unit pad)', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    const band = screen.getByTestId('tier-lane-1')
    expect(band.style.borderRadius).toBe('calc(var(--radius-lg) + 16px)')
    expect(band.className).not.toContain('rounded-2xl')
  })
})

describe('the Question row’s title sits beside its card, inside the fit (contract v3.1 CHR-3)', () => {
  it('⭐ with room in the board-left column, the tier-0 title is level with the Question card’s top — nothing above the fitted box', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    const lane = deriveTierLanes(STARTER_BOARD).find(l => l.tier === 0)!
    expect(lane.contentLeft - lane.x).toBeGreaterThanOrEqual(LANE_TITLE_BESIDE_MIN)
    const band = screen.getByTestId('tier-lane-0')
    const title = screen.getByTestId('tier-lane-0-title')
    expect(px(band.style.left) + px(title.style.left)).toBe(lane.x)
    expect(px(band.style.top) + px(title.style.top)).toBe(lane.y)
    expect(title.style.transform).toBe('')
    // The band claims no title zone above the row either.
    expect(px(band.style.top)).toBe(lane.y - 16)
    expect(laneTitleFlowAnchor(lane)).toEqual({ placement: 'beside', x: lane.x, topY: lane.y })
  })

  it('⛔ CONTRAST: a Question card that starts at board-left keeps the placement above its row', () => {
    const narrow = STARTER_BOARD.map(x => (x.id === 'dec' ? n('dec', 'decision', 100, 0, 336, 200) : x))
    render(<TierLanes nodes={narrow} />)
    const lane = deriveTierLanes(narrow).find(l => l.tier === 0)!
    const band = screen.getByTestId('tier-lane-0')
    const title = screen.getByTestId('tier-lane-0-title')
    expect(title.style.transform).toBe('translateY(-100%)')
    expect(px(band.style.top) + px(title.style.top)).toBe(lane.y - LANE_TITLE_GAP)
    expect(px(band.style.top)).toBe(lane.y - 44)
  })

  it('⛔ CONTRAST: only the first row goes beside — a narrow Options row still titles above', () => {
    const board = [...STARTER_BOARD.filter(x => x.id !== 'o1')]
    const lane = deriveTierLanes(board).find(l => l.tier === 1)!
    expect(lane.contentLeft - lane.x).toBeGreaterThanOrEqual(LANE_TITLE_BESIDE_MIN)
    expect(laneTitleFlowAnchor(lane).placement).toBe('above')
  })
})

describe('the title is lane furniture, not card content (contract v3.1 T11 / CHR-4)', () => {
  it('⭐ smaller, tracked, muted: the edgeLabel token, 0.05em tracking, text-light — not the cards’ nodeLabel', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    for (const lane of deriveTierLanes(STARTER_BOARD)) {
      const title = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      for (const cls of typography.edgeLabel.split(' ')) expect(title.className.split(' ')).toContain(cls)
      expect(title.className).not.toContain('calc(12px*')
      expect(title.className.split(' ')).toContain('text-text-light')
      expect(title.style.letterSpacing).toBe('0.05em')
      expect(title.style.lineHeight).toBe('1')
    }
  })

  it('⛔ sentence case (DS v5 §2, enforced by check-ds-compliance) and the Model outline’s own words', () => {
    render(<TierLanes nodes={STARTER_BOARD} />)
    expect(screen.getByTestId('tier-lane-0-title').className).not.toMatch(/\bupper/)
    expect(screen.getByTestId('tier-lane-0-title').textContent).toBe(DECISION_NODE_LABEL)
    expect(screen.getByTestId('tier-lane-1-title').textContent).toBe(MODEL_GROUP_TITLE.options)
    expect(screen.getByTestId('tier-lane-5-title').textContent).toBe(MODEL_GROUP_TITLE.goal)
  })
})

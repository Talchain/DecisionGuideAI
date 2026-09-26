/**
 * DESIGN-GAP-AUDIT row 4 / DESIGN-GAP-v31 #26 — the tier labels take contract
 * v3.1 `.layer-label`: 10px, 0.5px tracking (both ON SCREEN, counter-scaled),
 * and — WS1, 26 Sep 2026, on the Canvas lead's brief that v3.1 wins — the
 * contract's band WORDS (EXPLORATION / ALTERNATIVES / FACTORS / OUTCOMES /
 * RISKS / GOAL), written as content.
 *
 * What is still pinned from the earlier rule, because review 5824187641 was
 * about HOW the all-caps arrived as much as whether: no `uppercase` class, no
 * `text-transform`, no module class and no raw hex — the words are content
 * `check-ds-compliance` can see, and the colour is the shared muted token
 * (`#6E6B6B`, 4.65:1 on the canvas; the contract's `#777870` is 3.93:1).
 *
 * ⚠ OPEN: DS v5 §2 asks for sentence case, and that review asked for an owner
 * ruling before all-caps tier labels ship. `tierLanes.ts` `TITLE_BY_TIER` is
 * the one place to revert.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import { TierLanes } from '../TierLanes'
import { deriveTierLanes } from '../../utils/tierLanes'
import { typography } from '../../../styles/typography'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@xyflow/react')
  return { ...actual, ViewportPortal: ({ children }: { children: ReactNode }) => children }
})

function n(id: string, type: string, x: number, y: number, w = 200, h = 100): Node {
  return { id, type, position: { x, y }, data: { label: id }, width: w, height: h } as unknown as Node
}

// Every occupied tier, so the fix is proven on the WHOLE set rather than one
// hand-picked label (the "CONTRAST — every occupied tier" idiom this file's
// sibling spec already uses).
const BOARD: Node[] = [
  n('dec', 'decision', 1064, 150, 336, 290),
  n('o1', 'option', 100, 500, 336, 515),
  n('o2', 'option', 600, 500, 336, 515),
  n('f1', 'factor', 40, 1150, 187, 360),
  n('out1', 'outcome', 800, 1600, 187, 219),
  n('goal', 'goal', 500, 2000, 336, 264),
]

const tokens = (el: Element | null): string[] => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

afterEach(cleanup)

describe('contract v3.1 .layer-label style — product words, contract chrome', () => {
  it('the counter-scaled base size is 10px, not 11px (typography.edgeLabel)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      const t = tokens(screen.getByTestId(`tier-lane-${lane.tier}-title`))
      expect(t).toContain('text-[length:calc(10px*var(--canvas-label-scale,1))]')
      // CONTRAST: the OLD size this replaces, so a no-op edit cannot pass.
      expect(t).not.toContain('text-[length:calc(11px*var(--canvas-label-scale,1))]')
      expect(t).not.toContain(typography.edgeLabel.split(/\s+/)[0])
    }
  })

  it('uses the shared muted token and NO all-caps styling — no uppercase class, no text-transform, no module class', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      const el = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      const t = tokens(el)
      expect(t).toContain('text-text-light')
      expect(t.some(c => /^(uppercase|tierLabel)/.test(c) || c.includes('tierLabel'))).toBe(false)
      expect((el as HTMLElement).style.textTransform).toBe('')
      expect((el as HTMLElement).style.color).toBe('')
    }
  })

  it('0.5px letter-spacing ON SCREEN — counter-scaled with the type (WS1 #26)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      expect(screen.getByTestId(`tier-lane-${lane.tier}-title`).style.letterSpacing).toBe('calc(0.5px * var(--canvas-label-scale, 1))')
    }
  })

  it('the DOM text is the contract\'s band word, as content (no transform produces it)', () => {
    render(<TierLanes nodes={BOARD} />)
    const lanes = deriveTierLanes(BOARD)
    expect(lanes.length).toBeGreaterThan(3)
    const texts = lanes.map((lane) => screen.getByTestId(`tier-lane-${lane.tier}-title`).textContent)
    expect(texts).toEqual(['EXPLORATION', 'ALTERNATIVES', 'FACTORS', 'OUTCOMES', 'GOAL'])
    for (const lane of lanes) expect(screen.getByTestId(`tier-lane-${lane.tier}-title`).textContent).toBe(lane.title)
  })
})

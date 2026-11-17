/**
 * V12 Simple's foot edge (17 Nov): while cards are below the foot, the foot is a clean edge (the cards below are behind it and the cue counts
 * them), so nothing shows half under a foot control. Bound by the edge's own test id; each condition by the one thing that differs.
 */
import '@testing-library/jest-dom/vitest'
import { useLayoutEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { BelowCue, cardsBehindOf, cardsBelowOf, FOOT_EDGE, FOOT_EDGE_FADE, FOOT_EDGE_SOFT, footEdgeHeightOf, pressUpOf } from '../BelowCue'
import { VIEW_CARD } from '../canvas'
import { FOOT_GUTTER } from '../footClear'

const H = 704
const card = (id: string, y: number) => ({ id, type: VIEW_CARD, position: { x: 0, y }, data: {}, measured: { width: 200, height: 100 } })
function Seed({ nodes }: { nodes: ReturnType<typeof card>[] }): null {
  const api = useStoreApi()
  useLayoutEffect(() => { api.setState({ nodes, width: 1232, height: H, transform: [0, 0, 1] } as never) }, [api, nodes])
  return null
}
const draw = (nodes: ReturnType<typeof card>[], edge: boolean) => render(<ReactFlowProvider><Seed nodes={nodes} /><BelowCue edge={edge} /></ReactFlowProvider>).container
const edgeOf = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-testid="view-foot-edge"]')
const ABOVE = [card('a', 100)], BELOW = [card('a', 100), card('b', H - 40)]

afterEach(cleanup)

describe('the foot edge on Simple', () => {
  it('E1 with a card below the foot: the edge is drawn, the gutter\'s height, fading into the canvas\'s ground, and takes no press', () => {
    const el = draw(BELOW, true), edge = edgeOf(el)!
    expect([edge.style.height, edge.style.background, edge.className.includes('pointer-events-none'), edge.getAttribute('aria-hidden')]).toEqual([`${FOOT_EDGE}px`, FOOT_EDGE_FADE, true, 'true'])
    expect(FOOT_EDGE).toBe(FOOT_GUTTER)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent, 'the cue counts what is behind it').toContain('1 more card below')
  })
  it('E2 CONTRAST: nothing below the foot draws no edge; and the edge is Simple\'s only (not asked for, not drawn)', () => {
    expect(edgeOf(draw(ABOVE, true))).toBeNull()
    cleanup()
    const el = draw(BELOW, false)
    expect([edgeOf(el), el.querySelector('[data-testid="view-below-cue"]') !== null]).toEqual([null, true])
  })
})

describe('a card cut by the gutter\'s line is wholly behind the edge, never half shown over the foot controls (DL 17 Nov)', () => {
  // A card from 560 to 660 at zoom 1: its top is above the gutter's line (704 - 88 = 616), its foot below the cue's band (640), so the cue counts it.
  const CUT = [card('a', 100), card('cut', 560)]
  it('E3 the edge rises to the cut card\'s top less its soft top, and the cue counts the card', () => {
    const el = draw(CUT, true)
    expect(edgeOf(el)!.style.height).toBe(`${H - 560 + FOOT_EDGE_SOFT}px`)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent).toContain('1 more card below')
  })
  it('E3 CONTRAST: a card wholly below the line leaves the edge at the gutter; a card as tall as the board never lifts it past half the window', () => {
    const boxes = (ys: number[], h = 100) => ys.map((y) => ({ y, h }))
    expect(footEdgeHeightOf(boxes([100, H - 40]), 0, 1, H)).toBe(FOOT_EDGE)
    expect(footEdgeHeightOf(boxes([100, 650]), 0, 1, H), 'a card starting 34 px under the line').toBe(FOOT_EDGE)
    expect(footEdgeHeightOf(boxes([40], 2000), 0, 1, H)).toBe(Math.ceil(H / 2))
    expect(footEdgeHeightOf(boxes([100]), 0, 1, H), 'nothing below: the gutter').toBe(FOOT_EDGE)
  })
})

describe('every card the edge hides is counted (Line reviewer, e385f882 F1)', () => {
  it('E4 a top-aligned row with a tall and a short card: the edge rises over both and the cue says 2 (was 1: the short card was hidden and not counted)', () => {
    const row = [{ y: 560, h: 100 }, { y: 560, h: 50 }]
    expect([footEdgeHeightOf(row, 0, 1, H), cardsBehindOf(row, 0, 1, H)]).toEqual([H - 560 + FOOT_EDGE_SOFT, 2])
    expect(cardsBelowOf(row, 0, 1, H), 'the count before this fix').toBe(1)
    const el = draw([card('tall', 560), { ...card('short', 560), measured: { width: 200, height: 50 } }], true)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent).toContain('2 more cards below')
  })
  it('E4 CONTRAST: the short card alone is wholly above the edge: no rise, nothing counted, no edge drawn', () => {
    const short = [{ y: 560, h: 50 }]
    expect([footEdgeHeightOf(short, 0, 1, H), cardsBehindOf(short, 0, 1, H)]).toEqual([FOOT_EDGE, 0])
    expect(edgeOf(draw([{ ...card('short', 560), measured: { width: 200, height: 50 } }], true))).toBeNull()
  })
})

describe('the cue\'s press brings the last row into view and the edge does not rise over it (Line reviewer, 0df2339a F1)', () => {
  const last = [{ y: 600, h: 100 }]
  it('E5 one press moves the last row\'s foot to the band (60 px) and then nothing is behind the edge: [88, 0] (was [176, 1], and a second press did nothing)', () => {
    expect(pressUpOf(last, 0, 1, H)).toBe(60)
    expect([footEdgeHeightOf(last, -60, 1, H), cardsBehindOf(last, -60, 1, H)]).toEqual([FOOT_EDGE, 0])
  })
  it('E5 a fractional foot: the press rounds up, so the foot ends at or above the band and nothing is counted', () => {
    const f = [{ y: 600.4, h: 100 }]
    expect(pressUpOf(f, 0, 1, H)).toBe(61)
    expect(cardsBehindOf(f, -pressUpOf(f, 0, 1, H), 1, H)).toBe(0)
  })
  it('E5 CONTRAST: the same card before the press is behind the edge and counted', () => {
    expect(cardsBehindOf(last, 0, 1, H)).toBe(1)
  })
})

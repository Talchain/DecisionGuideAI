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
import { BelowCue, cardsBehindOf, cardsBelowOf, FOOT_EDGE, FOOT_EDGE_FADE, FOOT_FADE_H, footEdgeHeightOf, pressUpOf } from '../BelowCue'
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

describe('the foot fade on Simple (CHANGED BY DESIGN, v10 review item 7: drawn to the foot, last 24 px fade, was an 88 px opaque edge)', () => {
  it('E1 CHANGED BY DESIGN (v10 review item 7): with a card below the foot, a 24 px fade into the canvas ground is drawn, takes no press, and the cue counts what is behind it', () => {
    const el = draw(BELOW, true), edge = edgeOf(el)!
    expect([edge.style.height, edge.style.background, edge.className.includes('pointer-events-none'), edge.getAttribute('aria-hidden')]).toEqual([`${FOOT_FADE_H}px`, FOOT_EDGE_FADE, true, 'true']) // CHANGED BY DESIGN (v10 look): the drawn fade is the controls' 72 px band; the count line stays 24
    expect([FOOT_EDGE, FOOT_EDGE < FOOT_GUTTER, FOOT_FADE_H]).toEqual([24, true, 72])
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent, 'the cue counts what is behind it').toContain('1 more card below')
  })
  it('E2 CONTRAST: nothing below the foot draws no fade; and the fade is Simple\'s only (not asked for, not drawn)', () => {
    expect(edgeOf(draw(ABOVE, true))).toBeNull()
    cleanup()
    const el = draw(BELOW, false)
    expect([edgeOf(el), el.querySelector('[data-testid="view-below-cue"]') !== null]).toEqual([null, true])
  })
})

describe('v10 item 7: a card in the old gutter is drawn, not hidden (CHANGED BY DESIGN: was "wholly behind the edge")', () => {
  it('E3 CHANGED BY DESIGN (v10 review item 7): a card from 560 to 660 is drawn (its foot is above the fade top at 680), the fade stays 24 px and nothing is counted', () => {
    const CUT = [card('a', 100), card('cut', 560)]
    expect([footEdgeHeightOf(CUT.map((c) => ({ y: c.position.y, h: 100 })), 0, 1, H), cardsBehindOf(CUT.map((c) => ({ y: c.position.y, h: 100 })), 0, 1, H)]).toEqual([FOOT_FADE_H, 0])
    expect(edgeOf(draw(CUT, true))).toBeNull()
  })
  it('E3 CONTRAST: a card whose foot is under the fade (top 600, foot 700 > 680) is counted by id of count, and the fade is drawn', () => {
    const boxes = (ys: number[], h = 100) => ys.map((y) => ({ y, h }))
    expect(cardsBehindOf(boxes([100, 600]), 0, 1, H)).toBe(1)
    expect(cardsBehindOf(boxes([100, 580]), 0, 1, H), 'foot at 680 exactly: in view').toBe(0)
    expect(footEdgeHeightOf(boxes([40], 2000), 0, 1, H), 'never rises: always the drawn 72 px band').toBe(FOOT_FADE_H)
    const el = draw([card('a', 100), card('under', 600)], true)
    expect([edgeOf(el)?.style.height, el.querySelector('[data-testid="view-below-cue"]')?.textContent]).toEqual([`${FOOT_FADE_H}px`, '1 more card below'])
  })
})

describe('every card under the fade is counted (Line reviewer, e385f882 F1)', () => {
  it('E4 CHANGED BY DESIGN (v10 review item 7): a top-aligned row with a tall and a short card: both feet below 680 are counted (2), a short one ending above it is not', () => {
    expect(cardsBehindOf([{ y: 640, h: 100 }, { y: 640, h: 30 }], 0, 1, H), 'the short one ends at 670, in view').toBe(1)
    expect(cardsBehindOf([{ y: 640, h: 100 }, { y: 640, h: 60 }], 0, 1, H)).toBe(2)
    const el = draw([card('tall', 640), { ...card('short', 640), measured: { width: 200, height: 60 } }], true)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent).toContain('2 more cards below')
  })
  it('E4 CONTRAST: the short card alone (foot 690 > 680 is counted; at 40 tall, foot 680, it is not)', () => {
    expect([cardsBehindOf([{ y: 640, h: 50 }], 0, 1, H), cardsBehindOf([{ y: 640, h: 40 }], 0, 1, H)]).toEqual([1, 0])
    expect(edgeOf(draw([{ ...card('short', 640), measured: { width: 200, height: 40 } }], true))).toBeNull()
  })
})

describe('the cue\'s press brings the last row into view and nothing is behind the fade after it (Line reviewer, 0df2339a F1)', () => {
  const last = [{ y: 600, h: 100 }]
  it('E5 one press moves the last row\'s foot to the band (60 px) and then nothing is behind the fade: [24, 0]', () => {
    expect(pressUpOf(last, 0, 1, H)).toBe(60)
    expect([footEdgeHeightOf(last, -60, 1, H), cardsBehindOf(last, -60, 1, H)]).toEqual([FOOT_FADE_H, 0])
  })
  it('E5 a fractional foot: the press rounds up, so the foot ends at or above the band and nothing is counted', () => {
    const f = [{ y: 600.4, h: 100 }]
    expect(pressUpOf(f, 0, 1, H)).toBe(61)
    expect(cardsBehindOf(f, -pressUpOf(f, 0, 1, H), 1, H)).toBe(0)
  })
  it('E5 CONTRAST: the same card before the press is under the fade and counted; cardsBelowOf (Detailed, 64 px band) is unchanged', () => {
    expect([cardsBehindOf(last, 0, 1, H), cardsBelowOf(last, 0, 1, H)]).toEqual([1, 1])
    expect(cardsBelowOf([{ y: 560, h: 100 }], 0, 1, H)).toBe(1)
  })
})

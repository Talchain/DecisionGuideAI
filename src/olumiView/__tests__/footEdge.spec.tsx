import '@testing-library/jest-dom/vitest'
import { useLayoutEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { BelowCue, cardsBehindOf, cardsBelowOf, FOOT_BAND, pressUpOf } from '../BelowCue'
import { VIEW_CARD } from '../canvas'

const H = 704
const card = (id: string, y: number) => ({ id, type: VIEW_CARD, position: { x: 0, y }, data: {}, measured: { width: 200, height: 100 } })
function Seed({ nodes }: { nodes: ReturnType<typeof card>[] }): null {
  const api = useStoreApi()
  useLayoutEffect(() => { api.setState({ nodes, width: 1232, height: H, transform: [0, 0, 1] } as never) }, [api, nodes])
  return null
}
const draw = (nodes: ReturnType<typeof card>[], edge: boolean) => render(<ReactFlowProvider><Seed nodes={nodes} /><BelowCue edge={edge} /></ReactFlowProvider>).container
const edgeOf = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-testid="view-foot-edge"]')
const BELOW = [card('a', 100), card('b', H - 40)]

afterEach(cleanup)

describe('the floating foot cue on Simple', () => {
  it('with cards below, draws no foot band and keeps the more-cards button on the left beside zoom', () => {
    const zoom = render(<nav aria-label="Viewport controls" />).container.querySelector('nav')!
    vi.spyOn(zoom, 'getBoundingClientRect').mockReturnValue({ right: 140 } as DOMRect)
    const el = draw(BELOW, true)
    const cue = el.querySelector<HTMLElement>('[data-testid="view-below-cue"]')!
    expect(edgeOf(el)).toBeNull()
    expect(cue.querySelector('button')).toHaveTextContent('1 more card below')
    expect(cue.style.left).toBe('152px')
  })
})

describe('every card under the fade is counted (Line reviewer, e385f882 F1)', () => {
  it('E4 CHANGED BY DESIGN (v10d): a top-aligned row with a tall and a short card: both feet below 624 are counted (2), a short one ending above it is not', () => {
    expect(cardsBehindOf([{ y: 584, h: 100 }, { y: 584, h: 30 }], 0, 1, H), 'the short one ends at 614, in view').toBe(1)
    expect(cardsBehindOf([{ y: 584, h: 100 }, { y: 584, h: 60 }], 0, 1, H)).toBe(2)
    const el = draw([card('tall', 584), { ...card('short', 584), measured: { width: 200, height: 60 } }], true)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent).toContain('2 more cards below')
  })
  it('E4 CONTRAST: the short card alone (foot 634 > 624 is counted; at 40 tall, foot 624, it is not)', () => {
    expect([cardsBehindOf([{ y: 584, h: 50 }], 0, 1, H), cardsBehindOf([{ y: 584, h: 40 }], 0, 1, H)]).toEqual([1, 0])
    expect(edgeOf(draw([{ ...card('short', 584), measured: { width: 200, height: 40 } }], true))).toBeNull()
  })
})

describe('the cue\'s press brings the last row into view and nothing is behind the fade after it (Line reviewer, 0df2339a F1)', () => {
  const last = [{ y: 600, h: 100 }]
  it('E5 CHANGED BY DESIGN (v10d): one press moves the last row\'s foot above the band (to 608, 92 px) and then nothing is behind the fade', () => {
    expect(pressUpOf(last, 0, 1, H)).toBe(92)
    expect([cardsBehindOf(last, -92, 1, H), (last[0].y + last[0].h) - 92 <= H - FOOT_BAND]).toEqual([0, true])
  })
  it('E5 a fractional foot: the press rounds up, so the foot ends at or above the band and nothing is counted', () => {
    const f = [{ y: 600.4, h: 100 }]
    expect(pressUpOf(f, 0, 1, H)).toBe(93)
    expect(cardsBehindOf(f, -pressUpOf(f, 0, 1, H), 1, H)).toBe(0)
  })
  it('E5 CONTRAST: the same card before the press is under the fade and counted; cardsBelowOf (Detailed, the 96 px band) counts it too', () => {
    expect([cardsBehindOf(last, 0, 1, H), cardsBelowOf(last, 0, 1, H)]).toEqual([1, 1])
    expect(cardsBelowOf([{ y: 560, h: 100 }], 0, 1, H)).toBe(1)
  })
})

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
  it('with cards below, draws the more-cards button without a foot band or local position', () => {
    const el = draw(BELOW, true)
    const cue = el.querySelector<HTMLElement>('[data-testid="view-below-cue"]')!
    expect(edgeOf(el)).toBeNull()
    expect(cue.querySelector('button')).toHaveTextContent('1 more card below')
    expect(cue).not.toHaveAttribute('style')
  })
})

describe('Simple counts cards past the window foot', () => {
  it('counts the lower bottom in a top-aligned row that straddles the window foot', () => {
    const y = H - 99
    const el = draw([card('tall', y), { ...card('short', y), measured: { width: 200, height: 98 } }], true)
    expect(el.querySelector('[data-testid="view-below-cue"]')?.textContent).toContain('1 more card below')
  })
  it('counts a card bottom only when it is more than half a pixel past the window foot', () => {
    const y = H - 100
    expect([-1, 0, 0.5, 1].map((offset) => cardsBehindOf([{ y: y + offset, h: 100 }], 0, 1, H))).toEqual([0, 0, 0, 1])
    expect(draw([card('inside', y - 1)], true).querySelector('[data-testid="view-below-cue"]')).toBeNull()
  })
})

describe('one press clears the cue in Simple and Detailed', () => {
  it('counts the last row before the press and clears both counts after it', () => {
    const last = [{ y: H - 99, h: 100 }]
    expect([cardsBehindOf(last, 0, 1, H), cardsBelowOf(last, 0, 1, H)]).toEqual([1, 1])
    const after = -pressUpOf(last, 0, 1, H)
    expect(last[0].y + last[0].h + after).toBe(H - FOOT_BAND)
    expect([cardsBehindOf(last, after, 1, H), cardsBelowOf(last, after, 1, H)]).toEqual([0, 0])
  })
  it('E5 a fractional foot: the press rounds up, so the foot ends at or above the band and nothing is counted', () => {
    const f = [{ y: H - 98.6, h: 100 }]
    expect(pressUpOf(f, 0, 1, H)).toBe(FOOT_BAND + 2)
    expect(cardsBehindOf(f, -pressUpOf(f, 0, 1, H), 1, H)).toBe(0)
  })
})

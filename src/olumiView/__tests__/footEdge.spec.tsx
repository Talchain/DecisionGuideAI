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
import { BelowCue, FOOT_EDGE, FOOT_EDGE_FADE } from '../BelowCue'
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

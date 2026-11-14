/**
 * DL-529 (14 Nov): Olumi's look on the board, slices (1) and (2), on the real View projection. Fixtures are the served Views of the two
 * gate boards (core f6447f70, read on my :4051 from .backup copies, zero writes): run 2's approved board (s_e399f8a9d922, version 2) and
 * run 1's fresh pending first model (s_a30668165d74). Bound by card id; every expected word is core's own field.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { CoreCard, farChanceOf } from '../previous/CoreCard'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
const RUN2 = load('live-v51-run2-approved.view.json'), RUN1 = load('live-v51-run1-pending.view.json')
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, card: ViewCard): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const cardOf = (v: View, pick: (c: ViewCard) => boolean) => v.model!.cards.find(pick)!

describe('slice (1): the option card shows its headline as the View serves it', () => {
  it('L1 a chance: core\'s words up to core\'s own first clause are the one headline; the clause is the qualifier under it, never cut into the headline', () => {
    const o = cardOf(RUN1, (c) => c.family === 'option' && c.headline?.state === 'chance')
    const head = farChanceOf(o)!
    expect(head, 'precondition: core\'s chance line has its clause').not.toBe(o.headline!.text)
    const el = draw(RUN1, o)
    expect([el.querySelector(`[data-core-lead="${o.id}"] .ok-chance [data-core-lead-clamp]`)?.textContent, el.querySelector(`[data-view="${o.id}.headline.qualifier"]`)?.textContent])
      .toEqual([head, o.headline!.text.slice(head.length + 2)])
  })

  it('L2 no chance yet: core\'s words as the quiet pill, "Why not" opening core\'s reason, and core\'s ONE next step (headline.add) in the next-step slot', () => {
    const o = cardOf(RUN2, (c) => c.family === 'option' && c.headline?.state === 'none' && c.headline.add != null)
    const el = draw(RUN2, o)
    expect(el.querySelector(`[data-core-lead="${o.id}"] .ok-pill [data-core-lead-clamp]`)?.textContent).toBe(o.headline!.text)
    expect(el.querySelector(`[data-view="${o.id}.headline.why"] p`)?.textContent).toBe(o.headline!.why)
    const next = el.querySelectorAll(`[data-view="${o.id}.headline.add"]`)
    expect([next.length, next[0]?.textContent, next[0]?.className.includes('ok-next')]).toEqual([1, o.headline!.add, true])
  })

  it('L3 a fixed result is said as fixed, in core\'s words, never as a chance', () => {
    const o = cardOf(RUN2, (c) => c.family === 'option' && c.headline?.state === 'fixed')
    const el = draw(RUN2, o)
    expect([el.querySelector(`[data-core-lead="${o.id}"]`)?.getAttribute('data-ok-face'), el.querySelector(`[data-core-lead="${o.id}"] .ok-fixed`)?.textContent]).toEqual(['fixed', o.headline!.text])
    expect(el.querySelector('.ok-chance'), 'CONTRAST: no chance headline').toBeNull()
  })

  it('L4 Olumi\'s estimate is underlined in Olumi\'s blue and says whose it is on the face; the person\'s figure is solid with their author line', () => {
    const est = cardOf(RUN2, (c) => c.family === 'quantity' && c.olumi != null && (c.figure?.text ?? '') !== '' && c.figure?.edit != null && c.author?.by === 'olumi')
    const theirs = cardOf(RUN2, (c) => c.family === 'quantity' && (c.figure?.text ?? '') !== '' && c.author?.by === 'person')
    const a = draw(RUN2, est)
    expect([a.querySelector(`[data-core-lead-clamp="${est.id}"]`)?.className.includes('ok-fig-olumi'), a.querySelector(`[data-core-author="${est.id}"]`)?.className.includes('ok-by-olumi')]).toEqual([true, true]); cleanup()
    const b = draw(RUN2, theirs)
    expect([b.querySelector(`[data-core-lead-clamp="${theirs.id}"]`)?.className.includes('ok-fig-olumi'), b.querySelector(`[data-core-author="${theirs.id}"]`)?.textContent]).toEqual([false, theirs.author!.text])
  })

  it('L5 the aim: its target with core\'s mark, and whose the target and the aim are, both on the face (core\'s bound.olumi.title and author.text)', () => {
    const g = cardOf(RUN2, (c) => c.bound?.olumi != null)
    const el = draw(RUN2, g)
    expect(el.querySelector(`[data-view="${g.id}.bound.olumi.title"]`)?.textContent).toContain(g.bound!.olumi!.title)
    expect(el.querySelector(`[data-core-author="${g.id}"]`)?.textContent).toBe(g.author!.text)
  })
})


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
import { isWorkedOut, workedStepsOf } from '../look/WorkedSteps'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
const RUN2 = load('live-v51-run2-approved.view.json'), RUN1 = load('live-v51-run1-pending.view.json')
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, card: ViewCard, width?: number): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading, ...(width === undefined ? {} : { width }) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
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
    // the track is core's number at true scale (rows[].chance), bound by the headline's aim
    const row = o.rows.find((r) => r.kind === 'chance' && r.aim_id === o.headline!.aim_id) as { chance: number }
    expect((el.querySelector(`[data-view="${o.id}.chance.track"] > span`) as HTMLElement).style.width).toBe(`${row.chance * 100}%`)
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

describe('slice (2): how a worked-out figure is worked out, step by step, from the View\'s structure', () => {
  const D = cardOf(RUN2, (c) => workedStepsOf(RUN2, c.id).length > 0)

  it('W1 the derived card lists one step per link into it that carries the relation: the base with its figure, each option\'s term with core\'s effect words', () => {
    const [w] = workedStepsOf(RUN2, D.id)
    const links = RUN2.model!.links.filter((l) => l.to === D.id && (l.records ?? []).includes(w!.relation.id))
    const el = draw(RUN2, D)
    const steps = [...el.querySelectorAll(`[data-view="${D.id}.worked.${w!.relation.id}"] li`)]
    expect(steps.map((s) => s.getAttribute('data-step-from'))).toEqual(links.map((l) => l.from))
    const base = links.find((l) => l.kind === 'plain')!, from = RUN2.model!.cards.find((c) => c.id === base.from)!
    expect(steps.find((s) => s.getAttribute('data-step') === 'base')!.querySelector('b')!.textContent).toBe(from.figure!.text)
    for (const l of links.filter((x) => x.kind === 'through')) expect(steps.find((s) => s.getAttribute('data-step-from') === l.from)!.querySelector('b')!.textContent).toBe((l as { effect: { text: string } }).effect.text)
  })

  it('W2 CONTRAST: a relation in words (no sized term) is not a calculation and shows no steps; a card with none draws none', () => {
    const inWords = RUN2.model!.cards.filter((c) => RUN2.model!.links.some((l) => l.to === c.id && (l.records ?? []).length > 0 && (l as { effect?: unknown }).effect == null) && workedStepsOf(RUN2, c.id).length === 0)
    expect(inWords.length, 'precondition: a card a relation in words points into').toBeGreaterThan(0)
    for (const c of inWords) expect(draw(RUN2, c).querySelector('.ok-steps'), c.id).toBeNull()
  })
})

describe('slice (3): an option\'s limits are drawn in the same structure as its aim', () => {
  const WS = load('live-loop11-workshop-r3-pending.view.json')
  const limitRows = (c: ViewCard) => c.rows.map((r, i) => ({ r: r as { kind: string; aim_id?: string | null; value?: string | null; text?: string | null }, i })).filter(({ r }) => r.aim_id != null && r.aim_id !== c.headline?.aim_id)

  it('M1 a worked-out limit: core\'s row value under the headline, bound by the row; the headline\'s own aim is not drawn twice', () => {
    const o = cardOf(WS, (c) => c.family === 'option' && limitRows(c).some(({ r }) => r.kind === 'limit'))
    const { r, i } = limitRows(o).find(({ r }) => r.kind === 'limit')!
    const el = draw(WS, o)
    expect(el.querySelector(`[data-view="${o.id}.rows.${i}.value"]`)?.textContent).toBe(r.value)
    expect(el.querySelectorAll(`[data-ok-limit="${o.headline!.aim_id}"]`).length, 'CONTRAST: the aim stays the headline').toBe(0)
  })

  it('M2 a limit not worked out: core\'s reason behind "Why not", as the aim\'s is; never a value', () => {
    const o = cardOf(WS, (c) => c.family === 'option' && limitRows(c).some(({ r }) => r.kind === 'none'))
    const { r, i } = limitRows(o).find(({ r }) => r.kind === 'none')!
    const el = draw(WS, o)
    expect(el.querySelector(`[data-view="${o.id}.rows.${i}.why"] p`)?.textContent).toBe(r.text)
    expect(el.querySelector(`[data-view="${o.id}.rows.${i}.value"]`)).toBeNull()
  })
})

describe('a figure worked out from others is a quiet status line, never a headline figure', () => {
  it('L6 by the View\'s structure (a relation link into the card): the derived card\'s words as a status line; CONTRAST: the person\'s figure keeps the headline figure', () => {
    // The loop11 workshop's "Change in extra spend" (worked out, waiting): one value, so its words are the face's lead line.
    const WS = load('live-loop11-workshop-r3-pending.view.json')
    const d = cardOf(WS, (c) => (c.figure?.text ?? '') !== '' && (c.values?.length ?? 0) <= 1 && isWorkedOut(WS, c.id))
    const own = cardOf(RUN2, (c) => (c.figure?.text ?? '') !== '' && c.author?.by === 'person' && !isWorkedOut(RUN2, c.id))
    const a = draw(WS, d)
    expect([a.querySelector(`[data-core-lead="${d.id}"]`)?.getAttribute('data-ok-face'), a.querySelector(`[data-core-lead="${d.id}"] .ok-status [data-core-lead-clamp]`)?.textContent]).toEqual(['worked', d.figure!.text]); cleanup()
    expect(draw(RUN2, own).querySelector(`[data-core-lead="${own.id}"]`)?.getAttribute('data-ok-face')).toBe('figure')
  })
})

describe('DL-538: a card drawn at the stage\'s width', () => {
  it('S1 the card is drawn at exactly the width the layout placed it at, its floor included (a wider floor drew each card over its neighbour)', () => {
    const o = cardOf(RUN2, (c) => c.family === 'option')
    const g = draw(RUN2, o, 140).querySelector('[role="group"][aria-label]') as HTMLElement
    expect([g.style.width, g.style.maxWidth, g.style.minWidth]).toEqual(['140px', '140px', '140px'])
    cleanup()
    // CONTRAST: at the full card's width the floor is the layout floor, unchanged
    const full = draw(RUN2, o).querySelector('[role="group"][aria-label]') as HTMLElement
    expect(parseFloat(full.style.minWidth)).toBeLessThanOrEqual(parseFloat(full.style.width))
  })
})

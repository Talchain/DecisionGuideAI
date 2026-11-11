/**
 * R5, D7 (finish line 3: the disagreement kept and made concrete): beside each revealed view, what each of its figures does when the model's
 * Run is run again with it (core's `collab.shared[].effects`). Every word is core's (DL: the View carries every label and value; the UI
 * formats nothing): the status and each row's label from `collab.effect_headings`, the move as core words it (`gap_text`), and the figure,
 * aim, options and conditions by their own labels, by id. A figure core did not run is listed under core's "Not run". A gated viewer sees
 * none. Fixtures: core 066287e's own output (src/olumiView/fixtures/r5, README).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { ViewsPanel } from '../team/ViewsPanel'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', n), 'utf8'))
type Effect = { quantity: string; status?: 'changes' | 'moves' | 'same'; refused?: string; goal?: string; leader?: string | null; model_leader?: string | null; most?: string | null; gap_text?: string | null; if_absent?: string[] }
type Shared = Omit<View['collab']['shared'][number], 'effects'> & { effects: Effect[] }
type Headings = Record<'changes' | 'moves' | 'same' | 'refused' | 'leader' | 'model_leader' | 'most' | 'if_absent', string>
const sharedOf = (v: View) => v.collab.shared as unknown as Shared[]
const headingsOf = (v: View) => (v.collab as unknown as { effect_headings: Headings }).effect_headings
const headingOf = (v: View, id: string) => v.model!.cards.find((c) => c.id === id)!.heading
const show = (v: View) => render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
const effectEl = (s: Shared, q: string) => screen.getByTestId(`team-revealed-${s.id}-effects`).querySelector<HTMLElement>(`[data-effect="${q}"]`)!
const valueOf = (el: Element, at: string) => el.querySelector(`[${at}] > span:last-child`)?.textContent ?? null
const labelOf = (el: Element, at: string) => el.querySelector(`[${at}] > span:first-child`)?.textContent ?? null
afterEach(cleanup)

const effects = read('effects.view3.json')

describe('beside each revealed view, what each of its figures does to the Run (D7), in core\'s words', () => {
  it('each figure core ran: the figure by the view\'s own label, the aim, and the status under core\'s heading; a refused one under "Not run"', () => {
    show(effects)
    const h = headingsOf(effects)
    for (const s of sharedOf(effects)) {
      const items = [...screen.getByTestId(`team-revealed-${s.id}-effects`).querySelectorAll<HTMLElement>('[data-effect]')]
      expect(items.map((e) => e.dataset['effect']), s.by).toEqual(s.effects.map((e) => e.quantity))
      for (const e of s.effects) {
        const el = effectEl(s, e.quantity)
        expect(el.querySelector('[data-effect-figure]')?.textContent).toBe(s.figures.find((f) => f.quantity === e.quantity)!.label)
        expect(el.querySelector('[data-effect-status]')?.textContent, `${s.by} ${e.quantity}`).toBe(e.refused !== undefined ? h.refused : h[e.status!])
        if (e.refused === undefined) expect(el.querySelector('[data-effect-aim]')?.textContent).toBe(headingOf(effects, e.goal!))
      }
    }
    expect(new Set(sharedOf(effects).flatMap((s) => s.effects.map((e) => e.status ?? 'refused')))).toEqual(new Set(['changes', 'same', 'moves', 'refused']))
  })

  it('every row label and the move are drawn exactly as core sends them, never formatted here (core\'s words changed: the drawing follows)', () => {
    // Core's strings replaced by others: a drawer that formats or labels anything itself cannot pass.
    const say = (k: string) => `‹core’s ${k}›`
    const paul = sharedOf(effects).find((s) => s.by === 'Paul')!
    const v = { ...effects, collab: { ...effects.collab, effect_headings: { ...headingsOf(effects), leader: say('leader'), model_leader: say('model_leader'), most: say('most') },
      shared: sharedOf(effects).map((s) => ({ ...s, effects: s.effects.map((e) => (e.gap_text == null ? e : { ...e, gap_text: say(`gap ${e.quantity}`) })) })) } } as unknown as View
    show(v)
    const el = effectEl(paul, 'capacity_target')
    expect([labelOf(el, 'data-effect-leader'), labelOf(el, 'data-effect-model-leader'), labelOf(el, 'data-effect-most')]).toEqual([say('leader'), say('model_leader'), say('most')])
    expect(el.querySelector('[data-effect-gap]')?.textContent).toBe(say('gap capacity_target'))
    expect(effectEl(paul, 'per_specialist').querySelector('[data-effect-gap]')?.textContent).toBe(say('gap per_specialist'))
  })

  it('the move: the option that moves most and core\'s gap_text, verbatim; none where core gives none', () => {
    show(effects)
    const paul = sharedOf(effects).find((s) => s.by === 'Paul')!
    for (const e of paul.effects) {
      const el = effectEl(paul, e.quantity)
      expect(el.querySelector('[data-effect-gap]')?.textContent ?? null, e.quantity).toBe(e.gap_text ?? null)
      expect(el.querySelector('[data-effect-most] [data-effect-option]')?.textContent ?? null).toBe(e.most == null ? null : headingOf(effects, e.most))
    }
    expect(paul.effects.map((e) => e.gap_text ?? null)).toContain(null)
  })

  it('their leader and the model\'s, each the option core names, under core\'s labels (core\'s own two-leader case)', () => {
    const v = read('effects-leaders.view3.json'), paul = sharedOf(v).find((s) => s.by === 'Paul')!, e = paul.effects[0]!
    expect([e.leader, e.model_leader]).toEqual(['hold', 'add_one'])
    show(v)
    const el = effectEl(paul, e.quantity)
    expect([labelOf(el, 'data-effect-leader'), valueOf(el, 'data-effect-leader'), labelOf(el, 'data-effect-model-leader'), valueOf(el, 'data-effect-model-leader')])
      .toEqual([headingsOf(v).leader, headingOf(v, 'hold'), headingsOf(v).model_leader, headingOf(v, 'add_one')])
  })

  it('what it is worked out without: core\'s label, then each condition\'s card heading (core\'s own unsized-risk case)', () => {
    const v = read('effects-if-absent.view3.json'), sam = sharedOf(v).find((s) => s.by === 'Sam')!, e = sam.effects[0]!
    expect(e.if_absent).toEqual(['slow_ramp'])
    show(v)
    const el = effectEl(sam, e.quantity)
    expect([labelOf(el, 'data-effect-if-absent'), valueOf(el, 'data-effect-if-absent')]).toEqual([headingsOf(v).if_absent, headingOf(v, 'slow_ramp')])
    cleanup()
    show(effects) // an effect core gives no condition (if_absent []): no row
    expect(effectEl(sharedOf(effects).find((s) => s.by === 'Paul')!, 'per_specialist').querySelector('[data-effect-if-absent]')).toBeNull()
  })

  it('bound by identity: each person\'s effects under their own view, never another\'s', () => {
    show(effects)
    const h = headingsOf(effects)
    for (const s of sharedOf(effects)) expect(within(screen.getByTestId(`team-revealed-${s.id}-effects`)).queryAllByText(h.refused).length, s.by).toBe(s.effects.filter((e) => e.refused !== undefined).length)
  })

  it('a gated viewer sees no effects; a core before D7 (no key), a view with none, and a core without the row labels draw no words of their own', () => {
    show(read('effects-gated.view3.json'))
    expect(document.querySelector('[data-effect]')).toBeNull()
    cleanup()
    show({ ...effects, collab: { ...effects.collab, shared: sharedOf(effects).map(({ effects: _e, ...x }) => x) } } as unknown as View)
    expect(document.querySelector('[data-testid$="-effects"]')).toBeNull()
    cleanup()
    show({ ...effects, collab: { ...effects.collab, shared: sharedOf(effects).map((x) => ({ ...x, effects: [] })) } } as unknown as View)
    expect(document.querySelector('[data-testid$="-effects"]')).toBeNull()
    cleanup()
    const four = Object.fromEntries(Object.entries(headingsOf(effects)).filter(([k]) => ['changes', 'moves', 'same', 'refused'].includes(k)))
    show({ ...effects, collab: { ...effects.collab, effect_headings: four } } as unknown as View)
    expect(document.querySelector('[data-effect-leader], [data-effect-model-leader], [data-effect-most], [data-effect-if-absent]')).toBeNull()
    expect(document.querySelectorAll('[data-effect-status]').length).toBeGreaterThan(0)
  })
})

describe('a partial comparison (core 65cf0711, PL-243): core\'s scope words beside the consequences', () => {
  // Core's sentence in its own template (src/run/views.ts:176), for this fixture's options; drawn verbatim, bound to its figure by id.
  const SCOPE = 'Compared here: Hire a specialist. Not compared: Outsource overflow; their chance for this aim is not worked out on both figures.'
  it('PS1: the effect core marks partial draws its scope_text verbatim inside that figure\'s row; every other row draws none', () => {
    const paul = sharedOf(effects).find((s) => s.by === 'Paul')!
    const target = paul.effects.find((e) => e.refused === undefined)!
    const v = { ...effects, collab: { ...effects.collab, shared: sharedOf(effects).map((s) => (s.id !== paul.id ? s : { ...s,
      effects: s.effects.map((e) => (e.quantity !== target.quantity ? e : { ...e, not_compared: ['outsource_overflow'], scope_text: SCOPE })) })) } } as unknown as View
    show(v)
    const scoped = [...document.querySelectorAll<HTMLElement>('[data-effect-scope]')]
    expect(scoped).toHaveLength(1)
    expect(scoped[0]!.textContent).toBe(SCOPE)
    expect(scoped[0]!.closest('[data-effect]')!.getAttribute('data-effect')).toBe(target.quantity)
    expect(effectEl(paul, target.quantity)).toContainElement(scoped[0]!)
  })
  it('PS2: CONTRAST: core\'s fixture with no partial comparison draws no scope paragraph', () => {
    show(effects)
    expect(document.querySelectorAll('[data-effect-scope]')).toHaveLength(0)
  })
})

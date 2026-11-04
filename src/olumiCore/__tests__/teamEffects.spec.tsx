/**
 * R5, D7 (DL 4 Nov, finish line 3: the disagreement kept and made concrete): beside each revealed view, what each of its figures does when the
 * model's Run is run again with it (core's `collab.shared[].effects`, typed, no words). Drawn only from core's fields: the status under core's
 * own heading (`collab.effect_headings`), the figure, the aim and the options by their own labels (the view's figure, the model's cards, by id),
 * the option most likely on their figure and on the model's, the option that moves most with its interval, and what it is worked out without
 * (`if_absent`). A figure core did not run is listed under core's "Not run". A gated viewer sees none. Fixtures: core 307a70c's own
 * (src/olumiView/fixtures/r5, README).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { ViewsPanel } from '../team/ViewsPanel'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', n), 'utf8'))
type Effect = { quantity: string; status?: 'changes' | 'moves' | 'same'; refused?: string; goal?: string; leader?: string | null; model_leader?: string | null; most?: string | null; gap?: number; gap_low?: number; gap_high?: number; if_absent?: string[] }
type Shared = View['collab']['shared'][number] & { effects: Effect[] }
type Headings = { changes: string; moves: string; same: string; refused: string }
const effectsView = read('effects.view3.json')
const headingOf = (v: View, id: string) => v.model!.cards.find((c) => c.id === id)!.heading
const show = (v: View) => render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
afterEach(cleanup)

describe('beside each revealed view, what each of its figures does to the Run (D7)', () => {
  const headings = (effectsView.collab as unknown as { effect_headings: Headings }).effect_headings
  const shared = effectsView.collab.shared as Shared[]

  it('each figure core ran, under core\'s own heading for its status, by the figure\'s own label, with the aim', () => {
    show(effectsView)
    for (const s of shared) {
      const box = screen.getByTestId(`team-revealed-${s.id}-effects`)
      const items = [...box.querySelectorAll<HTMLElement>('[data-effect]')]
      expect(items.map((e) => e.dataset['effect']), s.by).toEqual(s.effects.map((e) => e.quantity))
      s.effects.forEach((e, i) => {
        const el = items[i]!
        const label = s.figures.find((f) => f.quantity === e.quantity)!.label
        expect(el.querySelector('[data-effect-figure]')?.textContent, `${s.by} ${e.quantity}`).toBe(label)
        expect(el.querySelector('[data-effect-status]')?.textContent, `${s.by} ${e.quantity}`).toBe(e.refused !== undefined ? headings.refused : headings[e.status!])
        if (e.refused === undefined) expect(el.querySelector('[data-effect-aim]')?.textContent).toBe(headingOf(effectsView, e.goal!))
      })
    }
    // The fixture has all four kinds: each heading shown, verbatim.
    expect(new Set(shared.flatMap((s) => s.effects.map((e) => e.status ?? 'refused')))).toEqual(new Set(['changes', 'same', 'moves', 'refused']))
  })

  it('the option most likely on their figure and on the model\'s, by the option\'s heading; none named where core names none', () => {
    show(effectsView)
    for (const s of shared) s.effects.forEach((e, i) => {
      if (e.refused !== undefined) return
      const el = screen.getByTestId(`team-revealed-${s.id}-effects`).querySelectorAll<HTMLElement>('[data-effect]')[i]!
      expect(el.querySelector('[data-effect-leader] [data-effect-option]')?.textContent ?? null, `${s.by} ${e.quantity}`).toBe(e.leader == null ? null : headingOf(effectsView, e.leader))
      expect(el.querySelector('[data-effect-model-leader] [data-effect-option]')?.textContent ?? null).toBe(e.model_leader == null ? null : headingOf(effectsView, e.model_leader))
    })
  })

  it('their leader and the model\'s are each the option core names for it (constructed: core\'s fixture has no effect where both are named and differ)', () => {
    const paul = shared.find((s) => s.by === 'Paul')!
    const swapped = { ...effectsView, collab: { ...effectsView.collab, shared: shared.map((s) => (s.id !== paul.id ? s : { ...s, effects: s.effects.map((e) => (e.quantity === 'capacity_target' ? { ...e, leader: 'hold' } : e)) })) } } as unknown as View
    show(swapped)
    const el = screen.getByTestId(`team-revealed-${paul.id}-effects`).querySelector('[data-effect="capacity_target"]')!
    expect([el.querySelector('[data-effect-leader] [data-effect-option]')?.textContent, el.querySelector('[data-effect-model-leader] [data-effect-option]')?.textContent])
      .toEqual([headingOf(effectsView, 'hold'), headingOf(effectsView, 'add_one')])
  })

  it('the option that moves most, with core\'s change and its interval in whole percentage points (UI-SEM-099); none where core names none', () => {
    show(effectsView)
    const paul = shared.find((s) => s.by === 'Paul')!
    const line = (q: string) => screen.getByTestId(`team-revealed-${paul.id}-effects`).querySelector(`[data-effect="${q}"] [data-effect-most]`)
    // Core 307a70c: per_specialist gap −0.4962 (−0.5060 to −0.4864); capacity_target +0.3966 (+0.3870 to +0.4061); existing_capacity: most null.
    expect(line('per_specialist')?.textContent).toBe('Moves most: Add one specialist −50 percentage points (−51 to −49)')
    expect(line('capacity_target')?.textContent).toBe('Moves most: Add one specialist +40 percentage points (+39 to +41)')
    expect(line('existing_capacity')).toBeNull()
  })

  it('bound by identity: each person\'s effects under their own view, never another\'s', () => {
    const [a, b] = shared
    show(effectsView)
    expect(within(screen.getByTestId(`team-revealed-${a!.id}-effects`)).queryAllByText(headings.refused).length).toBe(a!.effects.filter((e) => e.refused !== undefined).length)
    expect(within(screen.getByTestId(`team-revealed-${b!.id}-effects`)).queryAllByText(headings.refused).length).toBe(b!.effects.filter((e) => e.refused !== undefined).length)
  })

  it('a gated viewer sees no effects; a core before D7 (no key) and a view with none draw no drawer', () => {
    show(read('effects-gated.view3.json'))
    expect(document.querySelector('[data-effect]')).toBeNull()
    cleanup()
    const before = { ...effectsView, collab: { ...effectsView.collab, shared: shared.map(({ effects: _e, ...x }) => x) } } as unknown as View
    show(before)
    expect(document.querySelector('[data-testid$="-effects"]')).toBeNull()
    cleanup()
    show({ ...effectsView, collab: { ...effectsView.collab, shared: shared.map((x) => ({ ...x, effects: [] })) } } as unknown as View)
    expect(document.querySelector('[data-testid$="-effects"]')).toBeNull()
  })
})

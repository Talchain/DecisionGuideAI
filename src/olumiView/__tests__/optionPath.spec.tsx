/**
 * DL 08:58Z (item 1, sharpened): for ONE selected option, "How it is worked out" follows its path from its own setting → what reads it → the
 * measure the aim reads → the aim, in core's words, and shows where the path breaks. Real path: the dock's selection row (SelectionPill
 * after={selectedRename}) on the served View of my copy of the cd6305e5 run store (s_49a808d28e8a, pending first model, AI off, 0 calls).
 * Bound by record id; every expected word is read from the fixture's own fields.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { SelectionPill } from '../../canvas/components/SelectionPill'
import { useCanvasStore } from '../../canvas/store'
import { selectedRename } from '../SelectedRename'

const STORE = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-cd6305e5-store-pending.view.json'), 'utf8')) as View
type Run = { coverage: { aim_id: string; option: string; text: string }[]; timing: { label: string; value_text: string; risks: string[] }[] }
const select = (view: View, id: string) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false } as never)
  useCanvasStore.setState({ nodes: [{ id, position: { x: 0, y: 0 }, data: { label: view.model!.cards.find((c) => c.id === id)!.heading } }] as never, edges: [] as never,
    selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } } as never)
  return render(<SelectionPill after={selectedRename} />).container
}
afterEach(() => { cleanup(); useViewStore.setState({ view: null, status: 'none' } as never) })

const m = STORE.model!, run = (m as unknown as { run: Run }).run, aim = (m as unknown as { aim: { quantity: string; text: string } }).aim
const card = (id: string) => m.cards.find((c) => c.id === id)!
const GRANTS = 'apply_for_grants_or_a_small_bridge_loan', ANGELS = 'approach_angel_investors_for_a_small_amount_of_quicker_funding'
const GOAL = m.links.find((l) => l.from === aim.quantity && card(l.to).family === 'goal')!

describe('one option\'s path, setting → what reads it → the measure the aim reads → the aim (cd6305e5 store)', () => {
  it('P1 the setting nothing served reads: the path breaks there, with core\'s own words for the break (run.coverage), bound by the setting', () => {
    const el = select(STORE, GRANTS), set = card(GRANTS).sets![0]!
    expect(m.links.some((l) => l.from === set.id || l.from === set.lever) || m.cards.some((c) => (c.worked?.steps ?? []).some((s) => s.figure.options.some((o) => o.id === set.id)))).toBe(false)
    const brk = el.querySelector(`[data-path="set"][data-path-from="${set.id}"] [data-path="break"]`)
    expect([brk?.getAttribute('data-path-missing'), brk?.textContent]).toEqual(['sets[].read_by', `✕ ${run.coverage.find((c) => c.option === GRANTS && c.aim_id === GOAL.to)!.text}`])
    expect(el.querySelector('[data-testid="selected-explain-path"]')?.hasAttribute('data-path-broken')).toBe(true)
  })
  it('P2 the measure the aim reads (model.aim.quantity), worked out as core serves it, for this option, then the aim with core\'s link words', () => {
    const el = select(STORE, GRANTS), w = card(aim.quantity).worked!
    expect(el.querySelector('[data-path="measure"]')?.getAttribute('data-path-from')).toBe(aim.quantity)
    expect((el.querySelector(`[data-path="measure"] [data-view="${aim.quantity}.worked"]`) as HTMLDetailsElement | null)?.open).toBe(true)
    const steps = [...el.querySelectorAll(`[data-path="measure"] [data-view^="${aim.quantity}.worked.steps."]`)]
    expect(steps.map((li) => [li.querySelector(':scope > [data-step-join]')?.textContent ?? null, li.querySelector('.ok-step-name')?.textContent, li.querySelector('b')?.textContent]))
      .toEqual(w.steps.map((s, i) => [i === 0 ? null : 'plus', s.label, s.figure.options.find((o) => o.option === GRANTS)!.text]))
    expect(el.querySelector(`[data-path="aim"][data-path-to="${GOAL.to}"]`)?.textContent).toBe(`→ ${card(GOAL.to).heading} ${aim.text} · ${GOAL.title} ${card(aim.quantity).heading}`)
  })
  it('P3 each event that feeds the measure (a through link from a risk), with when, from core\'s timing; its chance, amount, count and step are named as not served', () => {
    const el = select(STORE, GRANTS)
    const fed = m.links.filter((l) => l.kind === 'through' && l.to === aim.quantity && card(l.from).family === 'risk').map((l) => l.from)
    const drawn = [...el.querySelectorAll('[data-path="event"]')]
    expect(drawn.map((e) => e.getAttribute('data-path-from'))).toEqual(fed)
    for (const e of drawn) {
      const id = e.getAttribute('data-path-from')!, when = run.timing.filter((t) => t.risks.includes(id)).map((t) => ` · ${t.label} ${t.value_text}`)
      expect([e.getAttribute('data-path-missing'), [...e.querySelectorAll('[data-path-timing]')].map((t) => t.textContent)]).toEqual(['occurrence severity reads via', when])
    }
  })
  it('P4 another option: both its settings break, and its own link into the aim is drawn in core\'s words (a link in words, not a quantity)', () => {
    const el = select(STORE, ANGELS), sets = card(ANGELS).sets!
    const brk = sets.map((s) => el.querySelector(`[data-path="set"][data-path-from="${s.id}"] [data-path="break"]`))
    // Core's words for the break once (the option's row for the aim: no run.coverage entry for it), under the first; the second carries the mark.
    const words = (card(ANGELS).rows as { aim_id?: string; kind?: string; text?: string }[]).find((r) => r.aim_id === GOAL.to && r.kind === 'none')!.text
    expect([run.coverage.some((c) => c.option === ANGELS), brk.map((b) => b?.textContent), brk[1]?.getAttribute('title')]).toEqual([false, [`✕ ${words}`, '✕'], words])
    const own = m.links.find((l) => l.from === ANGELS && l.kind !== 'reason')!
    expect(el.querySelector(`[data-path="link"][data-path-to="${own.to}"]`)?.getAttribute('title')).toBe(own.title)
  })
  it('P5 CONTRAST: where core\'s working takes the setting\'s record for this option, the path joins there and does not break', () => {
    const set = card(GRANTS).sets![0]!
    const joined = structuredClone(STORE)
    const step = joined.model!.cards.find((c) => c.id === aim.quantity)!.worked!.steps[1]!
    step.figure.options = step.figure.options.map((o) => (o.option === GRANTS ? { ...o, id: set.id } : o))
    const el = select(joined, GRANTS)
    expect([el.querySelector(`[data-path="set"][data-path-from="${set.id}"] [data-path="break"]`), el.querySelector(`[data-path="set"][data-path-from="${set.id}"] [data-path="reads"]`)?.getAttribute('data-path-to'),
      el.querySelector('[data-testid="selected-explain-path"]')?.hasAttribute('data-path-broken')]).toEqual([null, `${aim.quantity}.worked.steps.1`, false])
  })
  it('P6 DL 09:21Z: the box opens on the path: the explanation comes before core\'s headline sentence and next step (placement only)', () => {
    const el = select(STORE, GRANTS)
    const order = [...el.querySelectorAll('[data-testid="selected-explain"], [data-testid="selected-headline-title"], [data-testid="selected-headline-add"]')].map((e) => e.getAttribute('data-testid'))
    expect([order[0], order.includes('selected-headline-title')]).toEqual(['selected-explain', true])
    expect(order.slice(1).every((t) => t !== 'selected-explain')).toBe(true)
    expect(el.querySelector('[data-testid="selected-explain"] [data-testid="selected-explain-sets"] [data-path="break"]')).not.toBeNull()
  })
})

/**
 * DL journey (3), 14 Nov: select an option, read its explanation in the selected card without hover. Real path: the dock's selection row as
 * the lane draws it (SelectionPill after={selectedRename}) on the served View of run 2's approved board (core f6447f70, s_e399f8a9d922).
 * Bound by card id; every expected word is core's field.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { SelectionPill } from '../../canvas/components/SelectionPill'
import { useCanvasStore } from '../../canvas/store'
import { selectedRename } from '../SelectedRename'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const cards = RUN2.model!.cards
const select = (id: string) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: RUN2, status: 'ready', error: null, stale: false } as never)
  useCanvasStore.setState({ nodes: [{ id, position: { x: 0, y: 0 }, data: { label: cards.find((c) => c.id === id)!.heading } }] as never, edges: [] as never,
    selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } } as never)
  return render(<SelectionPill after={selectedRename} />).container
}
afterEach(() => { cleanup(); useViewStore.setState({ view: null, status: 'none' } as never) })

describe('a selected option explains itself (journey 3)', () => {
  const angel = cards.find((c) => c.family === 'option' && (c.sets ?? []).length > 0 && (c.premises ?? []).length > 0 && RUN2.model!.links.some((l) => l.kind === 'through' && l.from === c.id))!

  it('E1 what it changes (core\'s sets: each lever\'s figure and whose it is) and what it rests on (core\'s premises), whole, with no hover', () => {
    const el = select(angel.id)
    angel.sets!.forEach((s, i) => {
      expect(el.querySelector(`[data-view="${angel.id}.sets.${i}.figure.text"]`)?.textContent).toBe(s.figure!.text)
      expect(el.querySelector(`[data-view="${angel.id}.sets.${i}"]`)?.textContent).toContain(s.author!)
    })
    angel.premises!.forEach((p, i) => expect(el.querySelector(`[data-view="${angel.id}.premises.${i}.text"]`)?.textContent).toContain(p.text))
  })

  it('E2 how the figure it moves is worked out: the steps the View gives, opened by a click, this option\'s own term marked; the base and the other terms too', () => {
    const el = select(angel.id)
    const link = RUN2.model!.links.find((l) => l.kind === 'through' && l.from === angel.id)!
    const steps = el.querySelector(`[data-testid="selected-explain-steps"] [data-view^="${link.to}.worked."]`) as HTMLDetailsElement
    expect(steps, 'the measure\'s steps').not.toBeNull()
    fireEvent.click(steps.querySelector('summary')!)
    const own = [...steps.querySelectorAll('li[data-step-own]')]
    expect(own.map((li) => li.getAttribute('data-step-from'))).toEqual([angel.id])
    expect(own[0]!.querySelector('b')!.textContent).toBe((link as { effect: { text: string } }).effect.text)
    expect(steps.querySelector('li[data-step="base"]'), 'the base is drawn too').not.toBeNull()
    expect(steps.querySelectorAll('li[data-step="term"]').length).toBeGreaterThan(1)
  })

  it('E3 CONTRAST: an option with nothing set, assumed or moved explains nothing more; a figure card has no option explanation', () => {
    const bare = cards.find((c) => c.family === 'option' && (c.sets ?? []).length === 0 && (c.premises ?? []).length === 0 && !RUN2.model!.links.some((l) => l.kind === 'through' && l.from === c.id))!
    expect(select(bare.id).querySelector('[data-testid="selected-explain"]')).toBeNull(); cleanup()
    const fig = cards.find((c) => c.family === 'quantity')!
    expect(select(fig.id).querySelector('[data-testid="selected-explain"]')).toBeNull()
  })
})

describe('DL 04:59Z (4): an option card shows its next step in two lines; the whole sentence is in the panel once selected', () => {
  // The joined copies' own served View (engine 4352bfa3, v5): its "no chance yet" options carry core's 228–432 character next steps.
  const COPY = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-4352bfa3-copy-v5.view.json'), 'utf8')) as View
  const selectIn = (v: View, id: string) => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: v.id, view: v, status: 'ready', error: null, stale: false } as never)
    useCanvasStore.setState({ nodes: [{ id, position: { x: 0, y: 0 }, data: { label: v.model!.cards.find((c) => c.id === id)!.heading } }] as never, edges: [] as never,
      selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } } as never)
    return render(<SelectionPill after={selectedRename} />).container
  }
  const longs = COPY.model!.cards.filter((c) => c.family === 'option' && c.headline?.state === 'none' && (c.headline.add ?? '').length > 200)

  it('E-add every selected option with a long next step shows it whole and verbatim in the panel', () => {
    expect(longs.length).toBeGreaterThan(1)
    for (const o of longs) { expect(selectIn(COPY, o.id).querySelector('[data-testid="selected-headline-add"]')?.textContent).toBe(o.headline!.add); cleanup() }
  })
  it('E-add CONTRAST: an option with no next step, and a figure card, draw no next-step line in the panel', () => {
    const none = COPY.model!.cards.find((c) => c.family === 'option' && (c.headline?.add ?? '') === '')!
    expect(selectIn(COPY, none.id).querySelector('[data-testid="selected-headline-add"]')).toBeNull(); cleanup()
    const fig = COPY.model!.cards.find((c) => c.family === 'quantity')!
    expect(selectIn(COPY, fig.id).querySelector('[data-testid="selected-headline-add"]')).toBeNull()
  })
  it('E-clamp the card\'s next-step rule cuts at two lines (olumiLook.css .ok-next-card); the plain .ok-next (limit-row questions) is never clamped', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const rule = (sel: string) => css.match(new RegExp(`\\.olumi-look \\.${sel} \\{([^}]*)\\}`))?.[1] ?? ''
    expect(rule('ok-next-card')).toMatch(/-webkit-line-clamp:\s*2;/)
    expect(rule('ok-next')).not.toMatch(/line-clamp/)
  })
})

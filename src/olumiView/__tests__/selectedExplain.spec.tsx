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

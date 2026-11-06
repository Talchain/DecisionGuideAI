/**
 * "Where you differ" (inventory item 3): after the reveal, one picture of who leans where, from core's own `collab.shared[].effects`. Each
 * person stands in the lane of the option core says is most likely with their figure, under core's words for what the figure does.
 * Fixture: core 066287e's own output (src/olumiView/fixtures/r5), Paul's effects copied to a second member so two people are placed.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { ViewsPanel } from '../team/ViewsPanel'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', n), 'utf8'))
type Eff = { quantity: string; status?: 'changes' | 'moves' | 'same'; refused?: string; goal?: string; leader?: string | null; model_leader?: string | null }
type Sh = Omit<View['collab']['shared'][number], 'effects'> & { effects: Eff[] }
const fx = read('effects.view3.json')
const shared = fx.collab.shared as unknown as Sh[]
const paul = shared.find((s) => s.by === 'Paul')!
const headings = (fx.collab as unknown as { effect_headings: Record<string, string> }).effect_headings
const show = (v: View) => render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
const withShared = (list: Sh[], over: Partial<View> = {}): View => ({ ...fx, ...over, collab: { ...fx.collab, shared: list } } as unknown as View)
// Bea leans the other way: with her figure the other option is most likely.
const bea: Sh = { ...paul, id: 99, by: 'Bea', by_id: 'p_bea', effects: paul.effects.map((e) => (e.leader === 'add_one' ? { ...e, leader: 'hold' } : e)) }
afterEach(cleanup)

describe('where you differ: who leans where, in core\'s words', () => {
  it('CATCH: each person stands in the lane of the option core placed for their figure, with core\'s status words; the model\'s own leader carries core\'s label', () => {
    show(withShared([paul, bea]))
    const pic = screen.getByTestId('team-differ')
    const lane = (id: string) => pic.querySelector<HTMLElement>(`[data-differ-option="${id}"]`)!
    const names = (id: string) => [...lane(id).querySelectorAll('[data-differ-by]')].map((e) => e.textContent)
    expect(names('add_one')).toEqual(['Paul', 'Paul'])
    expect(names('hold')).toEqual(['Bea', 'Bea'])
    expect(lane('add_one').querySelector('[data-differ-option-heading]')?.textContent).toBe('Add one specialist')
    expect(lane('hold').querySelector('[data-differ-option-heading]')?.textContent).toBe('Keep current staffing')
    expect(lane('add_one').querySelector('[data-differ-model]')?.textContent).toBe(headings['model_leader'])
    expect(lane('hold').querySelector('[data-differ-model]')).toBeNull()
    const statuses = [...lane('hold').querySelectorAll('[data-differ-status]')].map((e) => e.textContent)
    expect(statuses).toEqual([headings['same'], headings['moves']])
    expect([...lane('add_one').querySelectorAll('[data-differ-figure]')].map((e) => e.textContent)).toEqual(['existing capacity', 'capacity target'])
    expect(pic.querySelector('[data-differ-aim-heading]')?.textContent).toBe('At least 100 a week')
  })

  it('a person core placed no option for is named, not hidden', () => {
    const sam = shared.find((s) => s.by === 'Sam')!
    show(withShared([paul, bea, sam]))
    expect(screen.getByTestId('team-differ-unplaced').textContent).toBe('Not placed here: Sam')
  })

  it('CONTRAST: nothing to compare with one person placed, none for a gated viewer, none before core\'s words exist; no mean, winner or recommendation words', () => {
    show(withShared([paul, shared.find((s) => s.by === 'Sam')!]))
    expect(screen.queryByTestId('team-differ')).toBeNull()
    cleanup()
    show(withShared([paul, bea], { gated: true }))
    expect(screen.queryByTestId('team-differ')).toBeNull()
    cleanup()
    show({ ...withShared([paul, bea]), collab: { ...fx.collab, shared: [paul, bea], effect_headings: null } } as unknown as View)
    expect(screen.queryByTestId('team-differ')).toBeNull()
    cleanup()
    show(withShared([paul, bea]))
    expect(screen.getByTestId('team-differ').textContent).not.toMatch(/\b(best|winner|recommend|average|mean|consensus)/i)
  })
})

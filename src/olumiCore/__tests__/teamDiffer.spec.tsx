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
  it('CATCH: one chip per person per lane, each figure under them as "label: text" with a status mark carrying core\'s words; the model\'s leader as core\'s field label with its value', () => {
    show(withShared([paul, bea]))
    const pic = screen.getByTestId('team-differ')
    const lane = (id: string) => pic.querySelector<HTMLElement>(`[data-differ-option="${id}"]`)!
    const names = (id: string) => [...lane(id).querySelectorAll('[data-differ-by]')].map((e) => e.textContent)
    expect(names('add_one')).toEqual(['Paul']) // once, though two of Paul's figures place him here
    expect(names('hold')).toEqual(['Bea'])
    expect(lane('add_one').querySelector('[data-differ-option-heading]')?.textContent).toBe('Add one specialist')
    expect(lane('hold').querySelector('[data-differ-option-heading]')?.textContent).toBe('Keep current staffing')
    // The model's leader: core's label and its value, once per aim, never a fragment and never in a lane.
    expect([...pic.querySelectorAll('[data-differ-model]')].map((e) => e.textContent)).toEqual([`${headings['model_leader']}: Add one specialist`])
    expect(lane('add_one').querySelector('[data-differ-model]')).toBeNull()
    // Each figure: their label and their figure's own words; the mark carries core's heading for its status as its hover.
    expect([...lane('add_one').querySelectorAll('[data-differ-figure]')].map((e) => e.textContent)).toEqual(['existing capacity: 80 tickets/week', 'capacity target: 90 tickets/week'])
    expect([...lane('add_one').querySelectorAll('[data-differ-status]')].map((e) => e.getAttribute('title'))).toEqual([headings['same'], headings['moves']])
    // Core's status words are never drawn per figure: only in the mark's hover and once in the legend.
    expect(lane('add_one').textContent).not.toContain(headings['same'])
    expect(pic.textContent!.split(headings['same']).length - 1).toBe(1)
    expect(pic.textContent!.split(headings['moves']).length - 1).toBe(1)
    expect(pic.querySelector('[data-testid="team-differ-legend"]')?.textContent).toBe(`${headings['moves']}${headings['same']}`)
    expect(pic.querySelectorAll('[data-differ-leader-label]')).toHaveLength(1)
    expect(pic.querySelector('[data-differ-aim-heading]')?.textContent).toBe('At least 100 a week')
  })

  it('only a figure that changes which option is most likely is emphasised', () => {
    const emph = { ...bea, effects: bea.effects.map((e) => (e.quantity === 'capacity_target' ? { ...e, status: 'changes' as const } : e)) }
    show(withShared([paul, emph]))
    const lane = screen.getByTestId('team-differ').querySelector<HTMLElement>('[data-differ-option="hold"]')!
    const row = (st: string) => lane.querySelector<HTMLElement>(`[data-differ-fig-status="${st}"]`)!
    expect(row('changes').className).toContain('font-medium')
    expect(row('same').className).not.toContain('font-medium')
    expect(screen.getByTestId('team-differ-legend').textContent).toContain(headings['changes'])
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

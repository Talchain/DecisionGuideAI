/**
 * R17 (core 35a1f4c, API.md v1.16-v1.19): the words core now sends, drawn verbatim and never composed here.
 *  - per-person effect rows: "<label>: <value>", and no status that the "Where you differ" lane already shows;
 *  - "Where you differ": a `changes` figure with no clear leader stands in core's `no_leader` lane, the model side in `no_model_leader`;
 *  - the view form: core's figure limit and its words, `private_view_prompt`, the trigger caption;
 *  - the Analysis tab: D6's silent line once per aim, D5 and D8 under core's headings.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { ViewsPanel } from '../team/ViewsPanel'
import { Failure, Rests, Tipping } from '../../olumiView/ViewChances'
import { tippingOf } from '../../olumiView/layout'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', n), 'utf8'))
type Eff = { quantity: string; status?: 'changes' | 'moves' | 'same'; refused?: string; goal?: string; leader?: string | null; model_leader?: string | null }
type Sh = Omit<View['collab']['shared'][number], 'effects'> & { effects: Eff[] }
const fx = read('effects.view3.json')
const shared = fx.collab.shared as unknown as Sh[]
const paul = shared.find((s) => s.by === 'Paul')!
const words = { no_leader: 'NO-LEADER words (theirs)', no_model_leader: 'NO-MODEL-LEADER words' }
const headings = { ...(fx.collab as unknown as { effect_headings: Record<string, string> }).effect_headings, ...words }
const viewOf = (list: Sh[], over: Partial<View['collab']> = {}): View =>
  ({ ...fx, collab: { ...fx.collab, effect_headings: headings, shared: list, ...over } } as unknown as View)
const show = (v: View) => render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
const bea: Sh = { ...paul, id: 99, by: 'Bea', by_id: 'p_bea', effects: paul.effects.map((e) => (e.leader === 'add_one' ? { ...e, leader: 'hold' } : e)) }
afterEach(cleanup)

describe('per-person effect rows read "<label>: <value>" and do not repeat what the lane shows', () => {
  it('each row is its label, a colon, then the value (never a hanging fragment)', () => {
    show(viewOf([paul]))
    const rows = [...document.querySelectorAll('[data-effect-leader], [data-effect-model-leader], [data-effect-most]')]
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.textContent, r.outerHTML).toMatch(/^.+: .+/)
  })
  it('CATCH: with two people placed, the status line is left to the lane picture; with one person (no picture) it stays', () => {
    show(viewOf([paul, bea]))
    expect(screen.getByTestId('team-differ')).toBeTruthy()
    expect(document.querySelectorAll(`[data-testid="team-revealed-${paul.id}-effects"] [data-effect-status]`)).toHaveLength(0)
    // nor the leader rows the lanes already carry; the move (not in a lane) stays
    const rowsOf = `[data-testid="team-revealed-${paul.id}-effects"]`
    expect(document.querySelectorAll(`${rowsOf} [data-effect-leader], ${rowsOf} [data-effect-model-leader], ${rowsOf} [data-effect-no-leader]`)).toHaveLength(0)
    expect(document.querySelectorAll(`${rowsOf} [data-effect-most]`).length).toBeGreaterThan(0)
    cleanup()
    show(viewOf([paul]))
    expect(screen.queryByTestId('team-differ')).toBeNull()
    expect(document.querySelectorAll(`[data-testid="team-revealed-${paul.id}-effects"] [data-effect-status]`).length).toBeGreaterThan(0)
  })
})

describe('a changes figure with no clear leader is placed, in core\'s words', () => {
  const noLead = (s: Sh): Sh => ({ ...s, effects: s.effects.map((e) => (e.quantity === 'capacity_target' ? { ...e, status: 'changes' as const, leader: null, model_leader: null } : e)) })
  it('CATCH: the no_leader lane holds the person; the model side says no_model_leader; both verbatim', () => {
    show(viewOf([paul, noLead(bea)]))
    const pic = screen.getByTestId('team-differ')
    const lane = pic.querySelector<HTMLElement>('[data-differ-option="__no_leader__"]')!
    expect(lane.querySelector('[data-differ-option-heading]')?.textContent).toBe(words.no_leader)
    // Paul's own `per_specialist` is a changes figure with no leader (hidden before R17), so he stands there too.
    expect([...lane.querySelectorAll('[data-differ-by]')].map((e) => e.textContent)).toEqual(['Paul', 'Bea'])
    expect([...pic.querySelectorAll('[data-differ-no-model-leader]')].map((e) => e.textContent)).toEqual([words.no_model_leader])
  })
  it('a moves/same figure with a null leader stays unplaced (only changes matters here)', () => {
    const quiet = { ...bea, effects: bea.effects.map((e) => (e.quantity === 'capacity_target' ? { ...e, leader: null } : e.quantity === 'per_specialist' ? { ...e, status: 'moves' as const } : e.leader === 'add_one' ? { ...e, leader: 'hold' } : e)) }
    show(viewOf([paul, quiet]))
    const lane = document.querySelector<HTMLElement>('[data-differ-option="__no_leader__"]')!
    expect([...lane.querySelectorAll('[data-differ-by]')].map((e) => e.textContent)).toEqual(['Paul'])
  })
})

describe('the view form uses core\'s limit and words', () => {
  const form = (over: Partial<View['collab']>) => viewOf([], { mine: [], ...over })
  it('private_view_prompt shows while writing; null shows nothing', () => {
    show(form({ private_view_prompt: 'PRIVATE words from core' } as never))
    expect(screen.getByTestId('team-view-private-prompt').textContent).toBe('PRIVATE words from core')
    cleanup()
    show(form({ private_view_prompt: null } as never))
    expect(screen.queryByTestId('team-view-private-prompt')).toBeNull()
  })
  it('max_view_figures and view_figures_limit_text replace the hard-coded three and its sentence', () => {
    // D3 (re-pinned): the boxes are core's `collab.view_figure_cards`; this fixture's two figure cards are given as core's list.
    const two = (fx.model?.cards ?? []).filter((c) => c.figure?.edit).slice(0, 2).map((c) => ({ id: c.id, label: c.heading }))
    const v = { ...form({ max_view_figures: 1, view_figures_limit_text: 'LIMIT words from core', view_figure_cards: two } as never), version: { n: 1 } } as unknown as View
    const givable = two.map((x) => v.model!.cards.find((c) => c.id === x.id)!)
    expect(givable.length, 'fixture has two figure cards').toBeGreaterThan(1)
    show(v)
    fireEvent.click(screen.getByTestId('team-view-more')) // DL ruling 9 Nov: the figure fields are behind "Add figures to your view"
    const inputs = givable.map((c) => screen.getByTestId(`team-view-figure-${c.id}`) as HTMLInputElement)
    fireEvent.change(inputs[0]!, { target: { value: '5' } })
    expect(screen.getByTestId('team-view-figures-cap').textContent).toBe('LIMIT words from core')
    expect(inputs[1]!.disabled).toBe(true)
  })
})

describe('the Analysis tab: D6 silent line, D5 and D8', () => {
  const run = (over: object) => ({ ...(fx.model!.run as object), ...over }) as unknown as NonNullable<NonNullable<View['model']>['run']>
  it('D6: a silent line is drawn once for an aim with no crossing, never for one with a line', () => {
    const r = run({ tipping: [], tipping_heading: 'Would have to be true', tipping_aims: [
      { aim: 'a1', lines: [], silent: [{ crossing: null, reason: 'holds', text: 't', line: 'SILENT one' }, { crossing: null, reason: 'holds', text: 't', line: 'SILENT two' }] },
      { aim: 'a2', lines: ['x'], silent: [{ crossing: null, reason: 'holds', text: 't', line: 'NOT drawn' }] }] })
    expect(tippingOf(r)!.silent).toEqual([{ aim: 'a1', line: 'SILENT one' }])
    render(<Tipping run={r} />)
    expect(screen.getByTestId('view-run-tipping').textContent).toContain('SILENT one')
    expect(screen.getByTestId('view-run-tipping').textContent).not.toContain('NOT drawn')
  })
  it('D5 and D8: core\'s sentence verbatim under core\'s heading, hover as title; nothing when empty', () => {
    const r = run({ failure_heading: 'Could go wrong', failure: [{ id: 'f1', line: 'FAIL sentence', hover: 'FAIL hover', aim: 'a', option: 'o', figures: [] }],
      rests_heading: 'Rests on guesses', rests: [{ id: 'r1', kind: 'goal', line: 'REST sentence', hover: 'REST hover', aim: 'a', option: 'o', olumi_share: 0.9, person_share: 0.1, unassigned: 0 }] })
    render(<><Failure run={r} /><Rests run={r} /></>)
    const f = screen.getByTestId('view-run-failure'), t = screen.getByTestId('view-run-rests')
    expect(f.textContent).toBe('Could go wrongFAIL sentence')
    expect(f.querySelector('[data-view-fact]')?.getAttribute('title')).toBe('FAIL hover')
    expect(t.textContent).toBe('Rests on guessesREST sentence')
    expect(t.textContent).not.toMatch(/0\.9|90/)
    cleanup()
    render(<><Failure run={run({ failure: [], failure_heading: 'x' })} /><Rests run={run({ rests: [] })} /></>)
    expect(screen.queryByTestId('view-run-failure')).toBeNull()
    expect(screen.queryByTestId('view-run-rests')).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { RevealPanel } from '../team/RevealPanel'
import { TeamSpreadStrip } from '../team/TeamSpreadStrip'
import { TeamTab } from '../team/TeamTab'
import { spreadsOf } from '../team/model'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamFigure, TeamViewRow } from '../team/types'

/**
 * The figures a member gave with a view, in the shape olumi-core serves them (API.md "Figures on a private view"): `{ quantity, unit, version, value }`
 * for one number, `{ quantity, unit, version, low, high, range_kind? }` for a range. There is no `kind`: a point is told from a range by `value`
 * versus `low` and `high` (review 00008 #1). These tests use core's shape; the earlier ones fabricated a `kind` core never sends.
 */
const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const point = (quantity: string, value: number): TeamFigure => ({ quantity, unit: 'ticket/week', version: 1, value })
const range = (quantity: string, low: number, high: number, range_kind?: 'bounds' | 'plausible'): TeamFigure => ({ quantity, unit: 'ticket/week', version: 1, low, high, ...(range_kind ? { range_kind } : {}) })
const view = (over: Partial<TeamViewRow> & Pick<TeamViewRow, 'id' | 'by'>): TeamViewRow => ({ mine: false, revealed: true, text: 'words', skip: false, ...over })
const revealed = (views: TeamViewRow[]) => scenario({ reveal: { state: 'revealed', at: 'x' }, views })

describe('a revealed figure in core\'s own shape', () => {
  it('a point is read by its `value`: the reveal panel shows it and does not throw', () => {
    const s = revealed([view({ id: 1, by: 'Ada', figures: [point('per_specialist', 17.5)] }), view({ id: 2, by: 'Bea' })])
    expect(() => render(<RevealPanel sid="s_a" scenario={s} onWrote={async () => true} />)).not.toThrow()
    expect(screen.getByTestId('team-revealed-figures-1').textContent).toBe('Ada’s own figure: Tickets added per specialist: 17.5 ticket/week')
  })
  it('a figure is shown in the unit it was given in (core keeps it with the figure); a dimensionless one has none', () => {
    const s = revealed([view({ id: 1, by: 'Ada', figures: [{ quantity: 'per_specialist', unit: '1', version: 1, value: 0.5 }, { quantity: 'per_specialist', value: 3 }] })])
    render(<RevealPanel sid="s_a" scenario={s} onWrote={async () => true} />)
    expect(screen.getByTestId('team-revealed-figures-1').textContent).toBe('Ada’s own figure: Tickets added per specialist: 0.5Ada’s own figure: Tickets added per specialist: 3')
  })
  it('a range is read by `low` and `high`: both ends are shown, with the member\'s own reading of it kept (range_kind is optional)', () => {
    const s = revealed([view({ id: 1, by: 'Ada', figures: [range('per_specialist', 10, 40, 'bounds')] }), view({ id: 2, by: 'Bea', figures: [range('per_specialist', 12, 20)] })])
    render(<RevealPanel sid="s_a" scenario={s} onWrote={async () => true} />)
    expect(screen.getByTestId('team-revealed-figures-1').textContent).toBe('Ada’s own figure: Tickets added per specialist: 10 to 40 ticket/week')
    expect(screen.getByTestId('team-revealed-figures-2').textContent).toBe('Bea’s own figure: Tickets added per specialist: 12 to 20 ticket/week')
  })
  it('two people\'s figures for one quantity make a spread: the range by its two ends, the point as a point, the order core gave', () => {
    const s = revealed([view({ id: 1, by: 'Ada', figures: [range('per_specialist', 10, 40, 'bounds')] }), view({ id: 2, by: 'Bea', figures: [point('per_specialist', 17.5)] })])
    const sp = spreadsOf(s)
    expect(sp).toHaveLength(1)
    expect(sp[0]!.positions).toEqual([
      { holder: 'Ada', kind: 'interval', low: 10, high: 40, rangeKind: 'bounds' },
      { holder: 'Bea', kind: 'point', value: 17.5 },
    ])
    render(<TeamSpreadStrip spread={sp[0]!} />)
    const strip = screen.getByTestId('team-spread-per_specialist')
    expect(within(strip).getByTestId('team-spread-row-per_specialist-0').textContent).toBe('10 to 40')
    expect(within(strip).getByTestId('team-spread-row-per_specialist-0').getAttribute('data-kind')).toBe('interval')
    expect(within(strip).getByTestId('team-spread-row-per_specialist-1').getAttribute('data-kind')).toBe('point')
  })
  it('the whole tab: a revealed range and a revealed point from core\'s view reach the spread', async () => {
    const state = revealed([view({ id: 1, by: 'Ada', figures: [range('per_specialist', 10, 40)] }), view({ id: 2, by: 'Bea', figures: [point('per_specialist', 17.5)] })])
    setTeamFetch(fakeApi(() => ({ json: state })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    const strip = await screen.findByTestId('team-spread-per_specialist')
    expect(within(strip).getByTestId('team-spread-row-per_specialist-0').textContent).toBe('10 to 40')
    expect(within(strip).getByTestId('team-spread-row-per_specialist-1').textContent).toBe('17.5')
    expect(screen.queryByTestId('team-differ-empty')).toBeNull()
  })
  it('a figure this page cannot read (neither a value nor a range) is not drawn and does not break the panel', () => {
    const odd = [{ quantity: 'per_specialist', unit: 'ticket/week', version: 1 }, { quantity: 'per_specialist', unit: 'x', version: 1, low: 9, high: 1 }, { quantity: 'per_specialist', value: 'seven' }, null] as unknown as TeamFigure[]
    const s = revealed([view({ id: 1, by: 'Ada', figures: odd }), view({ id: 2, by: 'Bea', figures: [point('per_specialist', 4)] })])
    expect(() => render(<RevealPanel sid="s_a" scenario={s} onWrote={async () => true} />)).not.toThrow()
    expect(spreadsOf(s)).toEqual([])
    expect(screen.queryByTestId('team-revealed-figures-1')).toBeNull()
    expect(screen.getByTestId('team-revealed-figures-2')).toBeTruthy()
  })
})

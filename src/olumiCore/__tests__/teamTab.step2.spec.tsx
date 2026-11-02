import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { RevealPanel, askAboutViews, MAX_ASK_CHARS } from '../team/RevealPanel'
import { TeamSpreadStrip, projectPercent } from '../team/TeamSpreadStrip'
import { spreadsOf } from '../team/model'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamScenario, TeamViewRow } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const view = (over: Partial<TeamViewRow> & Pick<TeamViewRow, 'id' | 'by'>): TeamViewRow => ({ mine: false, revealed: true, text: '', skip: false, ...over })

describe('Team tab, step 2: reveal together', () => {
  it('cannot reveal until every member has a view, and says who it is waiting for', async () => {
    const state = scenario({ waiting: ['Bea'], reveal: { state: 'open', at: null }, views: [view({ id: 7, by: 'Ada', mine: true, revealed: false, text: 'mine' })] })
    setTeamFetch(fakeApi(() => ({ json: state })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-reveal-wait')
    expect(screen.getByTestId('team-reveal-wait').textContent).toBe('Waiting for Bea.')
    expect((screen.getByTestId('team-reveal-go') as HTMLButtonElement).disabled).toBe(true)
  })

  it('reveals in one write by any member, then shows every view attributed, a skip as a skip, and the words exactly as stored', async () => {
    let state: TeamScenario = scenario({ waiting: [], reveal: { state: 'ready', at: null }, views: [view({ id: 7, by: 'Ada', mine: true, revealed: false, text: 'add one, but ask  Bea' })] })
    const api = fakeApi((method, path) => {
      if (method === 'POST' && path.endsWith('/reveal')) {
        state = { ...state, waiting: ['Ada', 'Bea'], reveal: { state: 'revealed', at: '2026-11-01T18:37:58.523Z' }, views: [view({ id: 7, by: 'Ada', mine: true, text: 'add one, but ask  Bea' }), view({ id: 8, by: 'Bea', skip: true })] }
        return { json: { revealed: [7, 8] } }
      }
      return { json: state }
    })
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-reveal-ready')
    fireEvent.click(screen.getByTestId('team-reveal-go'))
    await screen.findByTestId('team-revealed')
    expect(api.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(['/api/scenarios/s_75ba67edc0e5/reveal'])
    expect(screen.getByTestId('team-revealed-7').textContent).toContain('add one, but ask  Bea')
    expect(screen.getByTestId('team-revealed-7').textContent).toContain('Ada (you)')
    expect(screen.getByTestId('team-revealed-8').textContent).toContain('Chose not to answer.')
    // After the reveal the control is gone: the round is shared.
    expect(screen.queryByTestId('team-reveal-go')).toBeNull()
    // Design QA 2 and 3: the empty composer is gone, replaced by what Ada gave; the promise is said once, in the words of after the reveal.
    expect(screen.queryByTestId('team-view-composer')).toBeNull()
    expect(screen.getByTestId('team-view-revealed').textContent).toContain('Views revealed together')
    expect(screen.getByTestId('team-view-revealed-text').textContent).toBe('add one, but ask  Bea')
    expect(screen.getAllByTestId('team-privacy')).toHaveLength(1)
    expect(screen.getByTestId('team-privacy-view').textContent).toBe('Revealed to everyone, Olumi included.')
    expect(screen.queryByTestId('team-privacy-figures')).toBeNull()
    // The CEE page's "Use X's N" apply is not here: a change to the model goes through Olumi's proposal.
    expect(screen.queryByRole('button', { name: /^use /i })).toBeNull()
  })

  it('shows core\'s refusal if the reveal is not allowed', async () => {
    const state = scenario({ waiting: [], reveal: { state: 'ready', at: null } })
    setTeamFetch(fakeApi((method) => (method === 'POST' ? { status: 409, json: { error: 'the model changed underneath' } } : { json: state })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-reveal-go'))
    expect((await screen.findByTestId('team-reveal-error')).textContent).toBe('the model changed underneath')
  })
})

describe('asking Olumi where we differ sends the words and never the figures', () => {
  const two = [
    view({ id: 1, by: 'Ada', text: 'hire now', figures: [{ quantity: 'per_specialist', low: 10, high: 30 }] }),
    view({ id: 2, by: 'Bea', text: 'wait a quarter', figures: [{ quantity: 'per_specialist', value: 17.5 }] }),
  ]
  it('quotes each person\'s words verbatim and contains no figure', () => {
    const q = askAboutViews(two)!
    expect(q).toContain('Ada: hire now')
    expect(q).toContain('Bea: wait a quarter')
    expect(q).not.toMatch(/17\.5|10 to 30|per_specialist/)
  })
  it('needs two spoken views, and is not offered when the words would not fit in one message (never truncated)', () => {
    expect(askAboutViews([two[0]!])).toBeNull()
    expect(askAboutViews([view({ id: 1, by: 'Ada', text: 'a' }), view({ id: 2, by: 'Bea', skip: true })])).toBeNull()
    expect(askAboutViews([view({ id: 1, by: 'Ada', text: 'x'.repeat(MAX_ASK_CHARS) }), two[1]!])).toBeNull()
  })
  it('the button sends it', () => {
    const asked = vi.fn()
    const s = scenario({ views: two, reveal: { state: 'revealed', at: 'x' } })
    render(<RevealPanel sid="s_a" scenario={s} onWrote={async () => true} onAskOlumi={asked} />)
    fireEvent.click(screen.getByTestId('team-ask-differ'))
    expect(asked).toHaveBeenCalledWith(askAboutViews(two))
  })
})

describe('where you differ: each person\'s own figure, ends and all', () => {
  const s = scenario({
    reveal: { state: 'revealed', at: 'x' },
    version: { id: 4, n: 1, form: { records: [{ id: 'per_specialist', family: 'quantity', label: 'Tickets added per specialist', unit: 'ticket/week', assertion: { kind: 'interval', low: 10, high: 30 } } as never] } },
    views: [
      view({ id: 1, by: 'Ada', text: 'hire', figures: [{ quantity: 'per_specialist', low: 10, high: 40 }] }),
      view({ id: 2, by: 'Bea', text: 'wait', figures: [{ quantity: 'per_specialist', value: 17.5 }] }),
    ],
  })
  it('lists a quantity once two people gave a figure for it, in the order views came, with the model drawn apart', () => {
    const sp = spreadsOf(s)
    expect(sp).toHaveLength(1)
    expect(sp[0]!.positions.map((p) => p.holder)).toEqual(['Ada', 'Bea'])
    expect(sp[0]!.model).toEqual({ kind: 'interval', low: 10, high: 30 })
    expect(sp[0]!.unit).toBe('ticket/week')
  })
  it('draws a range by its two ends, never a middle, and a point as a point; wording is only the figures', () => {
    render(<TeamSpreadStrip spread={spreadsOf(s)[0]!} />)
    const strip = screen.getByTestId('team-spread-per_specialist')
    const ada = within(strip).getByTestId('team-spread-row-per_specialist-0')
    expect(ada.getAttribute('data-kind')).toBe('interval')
    expect(ada.textContent).toBe('10 to 40 ticket/week')
    // Two end ticks and the bar between them: three marks, none of them a dot at the middle.
    expect(ada.querySelectorAll('.rounded-full.border').length).toBe(0)
    expect(ada.querySelectorAll('span[aria-hidden="true"]').length).toBe(3)
    const bea = within(strip).getByTestId('team-spread-row-per_specialist-1')
    expect(bea.getAttribute('data-kind')).toBe('point')
    expect(bea.querySelectorAll('.rounded-full.border').length).toBe(1)
    expect(within(strip).getByTestId('team-spread-model-per_specialist').textContent).toBe('10 to 30 ticket/week')
    expect(strip.textContent).not.toMatch(/average|mean|midpoint|consensus|most people/i)
    expect(strip.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Ada 10 to 40 ticket/week. Bea 17.5 ticket/week. The model holds 10 to 30 ticket/week.')
  })
  it('is geometry only: a linear place on the extent, centred when there is no extent', () => {
    expect(projectPercent(10, 10, 30)).toBe(0)
    expect(projectPercent(30, 10, 30)).toBe(100)
    expect(projectPercent(20, 10, 30)).toBe(50)
    expect(projectPercent(5, 5, 5)).toBe(50)
  })
  it('draws nothing for one person\'s figure (there is nothing to compare), and reads honestly when no figures came', () => {
    const one = scenario({ reveal: { state: 'revealed', at: 'x' }, views: [view({ id: 1, by: 'Ada', text: 'hire', figures: [{ quantity: 'q', value: 1 }] }), view({ id: 2, by: 'Bea', text: 'wait' })] })
    expect(spreadsOf(one)).toEqual([])
    render(<RevealPanel sid="s_a" scenario={one} onWrote={async () => true} />)
    // one person's figure exists, so it is not said that none came
    expect(screen.getByTestId('team-differ-empty').textContent).toContain('Fewer than two people gave a figure')
    cleanup()
    render(<RevealPanel sid="s_a" scenario={scenario({ reveal: { state: 'revealed', at: 'x' }, views: [view({ id: 1, by: 'Ada', text: 'hire' }), view({ id: 2, by: 'Bea', text: 'wait' })] })} onWrote={async () => true} />)
    expect(screen.getByTestId('team-differ-empty').textContent).toContain('No figures came with these views')
  })
  it('refuses a malformed range rather than drawing one (low above high)', () => {
    const bad = scenario({ reveal: { state: 'revealed', at: 'x' }, views: [
      view({ id: 1, by: 'Ada', text: 'a', figures: [{ quantity: 'q', low: 9, high: 1 }] }),
      view({ id: 2, by: 'Bea', text: 'b', figures: [{ quantity: 'q', value: 4 }] }),
    ] })
    expect(spreadsOf(bad)).toEqual([])
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamCommitmentRow, TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const commitment = (over: Partial<TeamCommitmentRow> = {}): TeamCommitmentRow => ({
  id: 12, at: '2026-11-01T18:38:11.959Z', by: 'Ada', action: 'Hire one specialist from January', owner: 'Bea', owner_id: '5',
  expect: 'Weekly capacity above 100 by March', reconsider: 'If the new hire is under 15 a week by April', keeps: ['lead_doubt'], outcomes: [], ...over,
})
const withFacts = (s: TeamScenario): TeamScenario => ({ ...s, version: { ...s.version!, facts: [
  { id: 'F3', value: 'about 50%', text: 'The chance that ‘Add one specialist’ meets ‘At least 100 a week’, in this model on current information.', about: { kind: 'chance' } },
  { id: 'F4', value: 'between 89.7 and 110 ticket/week (middle 99.9)', text: 'Under ‘Add one specialist’, ‘total capacity’ is likely to be in this range (8 draws in 10). It leaves out: How the team feels about a new hire.', about: { kind: 'range', option: 'add_one', goal: 'capacity_goal', low: 89.6795181966731, high: 109.91851476864522, median: 99.93, unit: 'ticket/week' } },
] } })

describe('Team tab, step 4: the commitment that keeps dissent open', () => {
  it('needs the action, an owner chosen from the team (unset), what they expect and when to reconsider, and keeps only the dissent ticked', async () => {
    let state: TeamScenario = scenario()
    const api = fakeApi((method, path, body) => {
      if (method === 'POST' && path.endsWith('/commitments')) { const b = body as Record<string, unknown>; state = { ...state, commitments: [commitment({ action: String(b.action), keeps: b.keeps as string[] })] }; return { status: 201, json: { commitment: 12 } } }
      return { json: state }
    })
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-commitment-open'))
    const save = screen.getByTestId('team-commitment-save') as HTMLButtonElement
    expect((screen.getByTestId('team-c-owner') as HTMLSelectElement).value).toBe('')
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'hire one specialist from January' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'capacity above 100 by March' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'if under 15 a week by April' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: '5' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(screen.getByTestId('team-c-keep-lead_doubt').querySelector('input')!)
    fireEvent.click(save)
    await screen.findByTestId('team-commitment-12')
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({ action: 'hire one specialist from January', owner: '5', expect: 'capacity above 100 by March', reconsider: 'if under 15 a week by April', keeps: ['lead_doubt'] })
    // Read back: the words come from core, and the kept disagreement is named by its words in the model.
    expect(screen.getByTestId('team-commitment-keeps-12').textContent).toContain('our team lead: A new hire may unsettle the team.')
  })

  it('offers only approved disagreement to keep, says it is not yet confirmed by its holder, and draws the holder\'s tell and the unserved fields disabled', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario() })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-commitment-open'))
    const keep = screen.getByTestId('team-c-keep-lead_doubt')
    expect(keep.textContent).toContain('Not yet confirmed by its holder (our team lead). Only our team lead can confirm these words.')
    expect(screen.queryByText(/^Confirmed/)).toBeNull()
    expect((screen.getByTestId('team-c-tell').querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true)
    for (const id of ['team-c-option', 'team-c-review']) expect((screen.getByTestId(id) as HTMLInputElement).disabled).toBe(true)
  })

  it('without a model on a version there is nothing to commit to, and no form', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ version: null }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-commitment-unapproved')).textContent).toContain('Confirm the model in the chat first')
    expect(screen.queryByTestId('team-commitment-open')).toBeNull()
  })

  it('the expectation is written before the model\'s range: the range is not in the form, and shows with a saved commitment, as Olumi\'s', async () => {
    setTeamFetch(fakeApi(() => ({ json: withFacts(scenario({ commitments: [commitment()] })) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    const band = await screen.findByTestId('team-commitment-band')
    expect(band.textContent).toContain('The model’s range, version 1 (Olumi’s')
    // Design QA 6 and Codex 5: the band keeps its two figures in plain words, with no jargon and no raw fact sentence, and says what it leaves out quietly.
    expect(screen.getByTestId('team-commitment-band-line-F4').textContent).toBe('Under ‘Add one specialist’, 8 runs in 10 land between 89.7 and 110 ticket/week, in this model.')
    expect(screen.getByTestId('team-commitment-band-low-F4').textContent).toBe('89.7')
    expect(screen.getByTestId('team-commitment-band-high-F4').textContent).toBe('110')
    expect(screen.getByTestId('team-commitment-band-leaves-F4').textContent).toBe('Leaves out: How the team feels about a new hire')
    expect(band.textContent).not.toMatch(/draws|likely to be in this range/)
    expect(band.textContent).not.toContain('about 50%')   // a chance is not a range
    fireEvent.click(screen.getByTestId('team-commitment-open'))
    expect(screen.getByTestId('team-commitment-form').textContent).not.toMatch(/8 runs in 10|8 draws in 10/)
    expect(screen.getByTestId('team-commitment-form').textContent).toContain('Write what you expect first; the model’s range appears after you save.')
  })

  it('shows core\'s refusal (for instance a kept disagreement the model no longer holds) and keeps what was typed', async () => {
    const state = scenario()
    setTeamFetch(fakeApi((method) => (method === 'POST' ? { status: 400, json: { error: '"nope" is not a disagreement in the current model' } } : { json: state })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'a' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'b' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'c' } })
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    expect((await screen.findByTestId('team-commitment-error')).textContent).toBe('"nope" is not a disagreement in the current model')
    expect((screen.getByTestId('team-c-action') as HTMLTextAreaElement).value).toBe('a')
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

describe('Team tab, step 6: disagreements held, and not called confirmed', () => {
  it('shows the holder\'s words, says it is in the model and not yet confirmed by its holder, and offers a control that does nothing (disabled)', async () => {
    const api = fakeApi(() => ({ json: scenario() }))
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    const row = await screen.findByTestId('team-dissent-lead_doubt')
    expect(row.textContent).toContain('our team lead: A new hire may unsettle the team.')
    expect(screen.getByTestId('team-dissent-state-lead_doubt').textContent).toBe('In the model: yes. Confirmed by its holder: not yet.')
    expect(row.textContent).toContain('Only our team lead can confirm these words.')
    const button = screen.getByTestId('team-dissent-confirm-lead_doubt') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })
  it('shows nothing when the confirmed model holds no disagreement, or when there is no confirmed model', async () => {
    const base = scenario()
    setTeamFetch(fakeApi(() => ({ json: { ...base, version: { ...base.version!, form: { records: base.version!.form.records.filter((r) => r.family !== 'dissent') } } } })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    expect(screen.queryByTestId('team-dissent')).toBeNull()
  })
})

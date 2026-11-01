import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { useTeamStore } from '../team/store'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamCommitmentRow, TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null })
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const commitment = (over: Partial<TeamCommitmentRow> = {}): TeamCommitmentRow => ({
  id: 12, at: 'x', by: 'Ada', action: 'Hire', owner: 'Bea', owner_id: '5', expect: 'above 100', reconsider: 'under 15', keeps: ['lead_doubt'], outcomes: [], ...over,
})

describe('Team tab, step 5: the outcome review', () => {
  it('records what happened in the team\'s words with versus and the reconsider point both unset until chosen, and shows it back', async () => {
    let state: TeamScenario = scenario({ commitments: [commitment()] })
    const api = fakeApi((method, path, body) => {
      if (method === 'POST' && path.endsWith('/commitments/12/outcomes')) {
        const b = body as Record<string, unknown>
        state = { ...state, commitments: [commitment({ outcomes: [{ id: 3, at: 'y', by: 'Bea', happened: String(b.happened), versus: b.versus as never, reconsider_triggered: b.reconsider_triggered as boolean, note: (b.note as string) ?? null }] })] }
        return { status: 201, json: { outcome: 3 } }
      }
      return { json: state }
    })
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-outcome-open-12'))
    const save = screen.getByTestId('team-o-12-save') as HTMLButtonElement
    expect(screen.getByTestId('team-o-12-versus').querySelectorAll('input:checked')).toHaveLength(0)
    expect(screen.getByTestId('team-o-12-triggered').querySelectorAll('input:checked')).toHaveLength(0)
    fireEvent.change(screen.getByTestId('team-o-12-happened'), { target: { value: 'Reached 104  by March' } })
    fireEvent.click(screen.getByLabelText('Better than expected'))
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('No, it did not'))
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await screen.findByTestId('team-outcome-3')
    const post = api.calls.find((c) => c.method === 'POST')!
    expect(post.path).toBe('/api/scenarios/s_75ba67edc0e5/commitments/12/outcomes')
    expect(post.body).toMatchObject({ happened: 'Reached 104  by March', versus: 'better', reconsider_triggered: false })
    expect(post.body).not.toHaveProperty('note')
    expect((post.body as { op: string }).op).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(screen.getByTestId('team-outcome-3').textContent).toContain('Bea · Better than expected · reconsider point not triggered')
    expect(screen.getByTestId('team-outcome-happened-3').textContent).toBe('Reached 104  by March')
  })

  it('draws the team\'s verdict on each kept disagreement disabled, and says the team (not Olumi) will give it', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ commitments: [commitment()] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    const v = await screen.findByTestId('team-verdicts-12')
    expect(v.textContent).toContain('the team will give it, not Olumi')
    expect(v.textContent).toContain('our team lead: A new hire may unsettle the team.')
    expect((v.querySelector('select') as HTMLSelectElement).disabled).toBe(true)
  })

  it('shows several outcomes, latest first as core sends them, none editable', async () => {
    const outcomes = [
      { id: 4, at: 'b', by: 'Ada', happened: 'second', versus: 'mixed' as const, reconsider_triggered: true, note: 'a note' },
      { id: 3, at: 'a', by: 'Bea', happened: 'first', versus: 'better' as const, reconsider_triggered: false, note: null },
    ]
    setTeamFetch(fakeApi(() => ({ json: scenario({ commitments: [commitment({ outcomes })] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    const first = await screen.findByTestId('team-outcome-4')
    expect(first.nextElementSibling?.getAttribute('data-testid')).toBe('team-outcome-3')
    expect(first.textContent).toContain('a note')
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
  })

  it('shows core\'s refusal in its words', async () => {
    const s = scenario({ commitments: [commitment()] })
    setTeamFetch(fakeApi((method) => (method === 'POST' ? { status: 400, json: { error: 'happened must not be blank' } } : { json: s })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-outcome-open-12'))
    fireEvent.change(screen.getByTestId('team-o-12-happened'), { target: { value: 'x' } })
    fireEvent.click(screen.getByLabelText('Mixed'))
    fireEvent.click(screen.getByLabelText('Yes, it came up'))
    fireEvent.click(screen.getByTestId('team-o-12-save'))
    expect((await screen.findByTestId('team-o-12-error')).textContent).toBe('happened must not be blank')
  })
})

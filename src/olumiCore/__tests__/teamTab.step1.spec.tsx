import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
let state: TeamScenario
let api: ReturnType<typeof fakeApi>
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }

beforeEach(() => {
  reset()
  state = scenario()
  api = fakeApi((method, path, body) => {
    if (method === 'POST' && path.endsWith('/views')) {
      const b = body as { text?: string; skip?: boolean }
      state = { ...state, waiting: state.waiting.filter((n) => n !== 'Ada'), views: [{ id: 7, by: 'Ada', mine: true, revealed: false, text: b.skip ? '' : b.text ?? '', skip: b.skip === true }] }
      return { status: 201, json: { contribution: 7 } }
    }
    return { json: state }
  })
  setTeamFetch(api.fetchImpl)
})
afterEach(() => { cleanup(); setTeamFetch(null); reset(); vi.unstubAllEnvs() })

describe('Team tab, step 1: members, your view, the held count', () => {
  it('says who is here and where each person stands, and says the two privacy promises in exactly the plan\'s words', async () => {
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-member-1')
    expect(screen.getByTestId('team-member-1').textContent).toContain('Ada (you)')
    expect(screen.getByTestId('team-member-1').getAttribute('data-state')).toBe('waiting')
    expect(screen.getByTestId('team-member-5').textContent).toContain('Bea')
    // Design QA 3: the promise is shown once, before the reveal, and says nothing about figures nobody can enter yet.
    expect(screen.getAllByTestId('team-privacy')).toHaveLength(1)
    expect(screen.getByTestId('team-privacy-view').textContent).toBe('Your view is private until the reveal.')
    expect(screen.queryByTestId('team-privacy-figures')).toBeNull()
  })

  it('reads the scenario by core\'s id, derived from the DGAI uuid, with nothing sent that is not the page\'s own', async () => {
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    expect(api.calls.every((c) => c.path === '/api/scenarios/s_75ba67edc0e5')).toBe(true)
  })

  it('holds a view exactly as typed, shows it back to its owner, and then offers no way to edit it', async () => {
    render(<TeamTab scenarioUuid={UUID} />)
    const box = (await screen.findByTestId('team-view-text')) as HTMLTextAreaElement
    expect((screen.getByTestId('team-view-give') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'add one specialist, but watch morale' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await screen.findByTestId('team-view-held')
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({ text: 'add one specialist, but watch morale' })
    expect(screen.getByTestId('team-view-held-text').textContent).toBe('add one specialist, but watch morale')
    expect(screen.queryByTestId('team-view-text')).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.getByTestId('team-member-1').getAttribute('data-state')).toBe('held')
    expect(screen.getByTestId('team-held-count').textContent).toBe('1 of 2 in')
  })

  it('can say "I would rather not answer this", which counts as given and sends no words', async () => {
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-view-skip'))
    await screen.findByTestId('team-view-held')
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({ skip: true })
    expect(screen.getByTestId('team-view-held').textContent).toContain('You chose not to answer')
  })

  it('shows core\'s refusal in core\'s words and keeps what was typed', async () => {
    setTeamFetch(fakeApi((method) => (method === 'POST' ? { status: 400, json: { error: 'text must not be blank' } } : { json: state })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'a view' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    expect((await screen.findByTestId('team-view-error')).textContent).toBe('text must not be blank')
    expect((screen.getByTestId('team-view-text') as HTMLTextAreaElement).value).toBe('a view')
  })

  it('does not show another person\'s private view: the tab renders only what core returns, and core returns none before the reveal', async () => {
    state = scenario({ waiting: ['Ada'], views: [] })
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    expect(screen.getByTestId('team-member-5').getAttribute('data-state')).toBe('held')
    expect(screen.queryByTestId('team-view-held')).toBeNull()
    expect(screen.getByTestId('team-held-count').textContent).toBe('1 of 2 in')
  })

  it('has nothing to read before core knows the scenario', async () => {
    render(<TeamTab scenarioUuid={'11111111-2222-4333-8444-555555555555'} />)
    expect((await screen.findByTestId('team-none')).textContent).toContain('Start a model in the chat first')
    expect(api.calls).toHaveLength(0)
  })

  it('"Check for new views" reads again', async () => {
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    const before = api.calls.length
    state = { ...state, waiting: ['Ada'] }
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(screen.getByTestId('team-member-5').getAttribute('data-state')).toBe('held'))
    expect(api.calls.length).toBe(before + 1)
  })
})

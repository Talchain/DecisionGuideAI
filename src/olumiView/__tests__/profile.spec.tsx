/**
 * The AI profile at the foot of the composer (ViewProfile.tsx; olumi-core profiles, 10 Nov): core's words drawn verbatim, a choice made
 * before the brief is sent with it, a choice on a scenario saved at once to its own route, and nothing drawn from a shape core did not send.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import { profileForBrief, useViewProfile, ViewProfile } from '../ViewProfile'
import { writes } from '../client'

const WORDS = { profile: 'olumi', heading: 'Answered by', choices: [{ id: 'olumi', label: 'Olumi' }, { id: 'claude', label: 'Claude' }, { id: 'chatgpt', label: 'ChatGPT' }] }
type Seen = { method: string; url: string; body: unknown }
function core(answer: (url: string, body: unknown) => unknown = () => WORDS) {
  const seen: Seen[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body))
    seen.push({ method: init?.method ?? 'GET', url: String(url), body })
    if (String(url) === '/api/me') return new Response(JSON.stringify({ me: { id: '7' } }), { status: 200 })
    return new Response(JSON.stringify(answer(String(url), body)), { status: 200 })
  }) as unknown as typeof fetch)
  return seen
}
afterEach(() => { cleanup(); setTeamFetch(null); useViewProfile.setState({ view: null, sid: null, chosen: null, saving: false, said: null }) })
const radios = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>('[role="radio"]')]

describe('before a brief: core\'s words, the choice held and sent with the brief', () => {
  it('draws core\'s heading and three names verbatim, the host\'s profile chosen', async () => {
    const seen = core()
    const { container } = render(<ViewProfile sid={null} held={false} />)
    await waitFor(() => expect(radios(container).length).toBe(3))
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual(['GET /api/profiles'])
    expect(container.querySelector('[data-view="profile.heading"]')!.textContent).toBe('Answered by')
    expect(radios(container).map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([['Olumi', 'true'], ['Claude', 'false'], ['ChatGPT', 'false']])
  })
  it('a choice is held here (no write) and goes with the brief; no choice sends none, so core uses the host\'s', async () => {
    const seen = core((url) => (url === '/api/scenarios' ? { scenario: 's_000000000001', job: null, proposal: null, status_url: null } : WORDS))
    const { container } = render(<ViewProfile sid={null} held={false} />)
    await waitFor(() => expect(radios(container).length).toBe(3))
    expect(profileForBrief()).toBeNull()
    await act(async () => { fireEvent.click(radios(container)[1]!) })
    expect(radios(container).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(seen.filter((s) => s.method === 'POST')).toEqual([])
    await writes.create('A brief.', 'op-brief-00000001', profileForBrief())
    expect(seen.find((s) => s.url === '/api/scenarios')!.body).toEqual({ brief: 'A brief.', op: 'op-brief-00000001', profile: 'claude' })
    await writes.create('Another.', 'op-brief-00000002', null)
    expect(seen.filter((s) => s.url === '/api/scenarios').at(-1)!.body).toEqual({ brief: 'Another.', op: 'op-brief-00000002' })
  })
})

describe('on a scenario: its own profile, a choice saved at once', () => {
  it('reads the scenario\'s profile and posts a choice to its route with an op; the answer is drawn', async () => {
    const seen = core((url, body) => (url.endsWith('/profile') && body !== undefined ? { ...WORDS, profile: (body as { profile: string }).profile } : { ...WORDS, profile: 'claude' }))
    const { container } = render(<ViewProfile sid="s_000000000001" held={false} />)
    await waitFor(() => expect(radios(container)[1]?.getAttribute('aria-checked')).toBe('true'))
    expect(seen[0]).toEqual({ method: 'GET', url: '/api/scenarios/s_000000000001/profile', body: undefined })
    await act(async () => { fireEvent.click(radios(container)[2]!) })
    await waitFor(() => expect(radios(container)[2]!.getAttribute('aria-checked')).toBe('true'))
    const post = seen.find((s) => s.method === 'POST')!
    expect(post.url).toBe('/api/scenarios/s_000000000001/profile')
    expect(post.body).toEqual({ profile: 'chatgpt', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) })
  })
  it('held (a write in flight): every arm is disabled, and a tap changes nothing', async () => {
    const seen = core()
    const { container } = render(<ViewProfile sid="s_000000000001" held={true} />)
    await waitFor(() => expect(radios(container).length).toBe(3))
    expect(radios(container).every((r) => r.disabled)).toBe(true)
    await act(async () => { fireEvent.click(radios(container)[1]!) })
    expect(seen.filter((s) => s.method === 'POST')).toEqual([])
  })
  it('an answer in another shape (an older core) draws nothing, never a guessed control', async () => {
    core(() => ({ schema: 'olumi.view/3', chat: [] }))
    const { container } = render(<ViewProfile sid="s_000000000001" held={false} />)
    await act(async () => { await new Promise((ok) => setTimeout(ok, 20)) })
    expect(container.querySelector('[data-testid="view-profile"]')).toBeNull()
  })
})

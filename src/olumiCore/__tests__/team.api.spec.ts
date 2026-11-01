import { afterEach, describe, expect, it } from 'vitest'
import { setTeamFetch, teamApi, TeamApiError, newOp } from '../team/api'
import { fakeApi } from './teamFixtures'

afterEach(() => { setTeamFetch(null) })

describe('the Team tab talks to core through the /api proxy', () => {
  it('sends a view exactly as typed (no trim, no capital, no full stop) as JSON, and a skip as skip', async () => {
    const api = fakeApi(() => ({ json: { contribution: 7 } }))
    setTeamFetch(api.fetchImpl)
    await teamApi.giveView('s_a1', '  we should wait a quarter ')
    await teamApi.skipView('s_a1')
    expect(api.calls[0]).toMatchObject({ method: 'POST', path: '/api/scenarios/s_a1/views', body: { text: '  we should wait a quarter ' } })
    expect(api.calls[0]!.headers['content-type']).toBe('application/json')
    expect(api.calls[1]!.body).toEqual({ skip: true })
  })
  it('sends evidence with its op, and leaves `source` out when there is none', async () => {
    const api = fakeApi(() => ({ json: { evidence: 3 } }))
    setTeamFetch(api.fetchImpl)
    await teamApi.addEvidence('s_a1', { text: 'Our October export: 2 in 100 unsubscribed.', source: null, concerns: [], stance: 'unclear' }, 'op-1')
    expect(api.calls[0]!.body).toEqual({ text: 'Our October export: 2 in 100 unsubscribed.', concerns: [], stance: 'unclear', op: 'op-1' })
  })
  it('says what core said when it refuses (the person\'s words), and a fixed sentence when it cannot be reached', async () => {
    setTeamFetch(fakeApi(() => ({ status: 409, json: { error: 'there are not two members who have each given a view yet' } })).fetchImpl)
    await expect(teamApi.reveal('s_a1')).rejects.toMatchObject({ name: 'TeamApiError', status: 409, message: 'there are not two members who have each given a view yet' })
    setTeamFetch((async () => { throw new TypeError('network') }) as typeof fetch)
    // A write whose answer never came may have been saved: it is never worded as "nothing was sent", and it is marked uncertain.
    await expect(teamApi.reveal('s_a1')).rejects.toMatchObject({ status: 0, uncertain: true, message: expect.stringContaining('may have been saved') })
    await expect(teamApi.read('s_a1')).rejects.toMatchObject({ status: 0, uncertain: false, message: expect.stringContaining('could not be read') })
    expect(new TeamApiError(0, 'x')).toBeInstanceOf(Error)
  })
  it('makes an op core accepts (8 to 64 letters, digits and hyphens)', () => {
    expect(newOp()).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })
})

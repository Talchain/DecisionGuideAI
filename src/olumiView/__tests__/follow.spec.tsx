/** When the View is read: for the scenario on screen, and again when the scenario changes; off the lane, never. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import { useViewFollows } from '../follow'

const UUID = '00000000-0000-4000-8000-0123456789ab', OTHER = '00000000-0000-4000-8000-ba9876543210'
const view = { schema: 'olumi.view/3', id: 's_0123456789ab', title: 't', commit: 't', signature: 't', you: 'Paul', members: [], version: null, model: { cards: [] }, proposal: null,
  collab: { alone: true, heading: '', open: false, shared: [], mine: [], placeholder: '', can_reveal: false, waiting: null, commitments: [], owners: [] }, evidence: [], chat: [] }
const paths: string[] = []

beforeEach(() => {
  paths.length = 0
  setTeamFetch((async (u: unknown) => { paths.push(String(u)); return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false })
})
afterEach(() => { setTeamFetch(null) })

it('reads the scenario on screen once, and the next scenario when the page moves to it', async () => {
  const { rerender } = renderHook(({ uuid }) => useViewFollows(true, uuid), { initialProps: { uuid: UUID } })
  await waitFor(() => expect(paths).toEqual(['/api/scenarios/s_0123456789ab/view?schema=3']))
  rerender({ uuid: UUID })
  rerender({ uuid: OTHER })
  await waitFor(() => expect(paths).toEqual(['/api/scenarios/s_0123456789ab/view?schema=3', '/api/scenarios/s_ba9876543210/view?schema=3']))
})

it('off the core lane it reads nothing', async () => {
  renderHook(() => useViewFollows(false, UUID))
  await new Promise((r) => setTimeout(r, 20))
  expect(paths).toEqual([])
})

// Pre-screen row 10 (DL 10 Nov): a scenario reopened with its last View still held is read at once, and on the latest version.
import { renderHook as mountHook } from '@testing-library/react'
import { useViewStore as store10 } from '../store'
import { useViewFollows as follows10 } from '../follow'
describe('row 10: a reopened scenario is read at once', () => {
  const keep = { refresh: store10.getState().refresh, look: store10.getState().look, use: store10.getState().use }
  afterEach(() => { store10.setState({ ...keep, uuid: null, sid: null, view: null, at: null, status: 'none' } as never) })
  const hold = (at: number | null) => {
    const calls: string[] = []
    store10.setState({ uuid: 'u1', sid: 's_1', view: { id: 's_1' }, at, status: 'ready',
      refresh: async () => { calls.push('refresh'); return true }, look: async (n: number | null) => { calls.push(`look:${n}`); return null }, use: async () => { calls.push('use') } } as never)
    return calls
  }
  it('the same scenario, its View held: read again at once (not left to the next poll)', () => {
    const calls = hold(null); mountHook(() => follows10(true, 'u1'))
    expect(calls).toEqual(['refresh'])
  })
  it('a past version was left open: back on the latest', () => {
    const calls = hold(3); mountHook(() => follows10(true, 'u1'))
    expect(calls).toEqual(['look:null'])
  })
  it('contrast: another scenario, or off the lane, goes through use / reads nothing', () => {
    const a = hold(null); mountHook(() => follows10(true, 'u2')); expect(a).toEqual(['use'])
    const b = hold(null); mountHook(() => follows10(false, 'u1')); expect(b).toEqual([])
  })
})

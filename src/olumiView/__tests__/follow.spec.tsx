/** When the View is read: for the scenario on screen, and again when the scenario changes; off the lane, never. */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import { useViewFollows } from '../follow'

const UUID = '00000000-0000-4000-8000-0123456789ab', OTHER = '00000000-0000-4000-8000-ba9876543210'
const view = { schema: 'olumi.view/2', id: 's_0123456789ab', title: 't', commit: 't', signature: 't', you: 'Paul', members: [], version: null, model: { cards: [] }, proposal: null,
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
  await waitFor(() => expect(paths).toEqual(['/api/scenarios/s_0123456789ab/view']))
  rerender({ uuid: UUID })
  rerender({ uuid: OTHER })
  await waitFor(() => expect(paths).toEqual(['/api/scenarios/s_0123456789ab/view', '/api/scenarios/s_ba9876543210/view']))
})

it('off the core lane it reads nothing', async () => {
  renderHook(() => useViewFollows(false, UUID))
  await new Promise((r) => setTimeout(r, 20))
  expect(paths).toEqual([])
})

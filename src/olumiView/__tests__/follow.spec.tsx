/** When the View is read again (review 00053 #1): an approval that leaves the canvas's nodes and links as they were still moves it. */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import { useTeamStore } from '../../olumiCore/team/store'
import type { TeamScenario } from '../../olumiCore/team/types'
import { useViewStore } from '../store'
import { useViewFollows } from '../follow'

const UUID = '00000000-0000-4000-8000-0123456789ab', SID = 's_0123456789ab'
const view = { schema: 'olumi.view/2', id: SID, title: 't', commit: 't', signature: 't', you: 'Paul', members: [], version: null, model: { cards: [] }, proposal: null,
  collab: { alone: true, heading: '', open: false, shared: [], mine: [], placeholder: '', can_reveal: false, waiting: null, commitments: [], owners: [] }, evidence: [], chat: [] }
let reads = 0
const approvedAt = (id: number) => useTeamStore.setState({ uuid: UUID, scenario: { version: { id, n: id, form: { records: [] } } } as unknown as TeamScenario })

beforeEach(() => {
  reads = 0
  setTeamFetch((async () => { reads++; return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false })
  approvedAt(1)
})
afterEach(() => { setTeamFetch(null); useTeamStore.setState({ uuid: null, scenario: null }) })

it('an approval that leaves the canvas as it was (an aim\'s bound) reads the View again', async () => {
  renderHook(({ key }) => useViewFollows(true, UUID, key), { initialProps: { key: 'same' } })
  await waitFor(() => expect(reads).toBe(1))
  act(() => { approvedAt(2) })
  await waitFor(() => expect(reads).toBe(2))
})

it('a change to the canvas\'s model reads it again; nothing else does', async () => {
  const { rerender } = renderHook(({ key }) => useViewFollows(true, UUID, key), { initialProps: { key: 'a' } })
  await waitFor(() => expect(reads).toBe(1))
  rerender({ key: 'a' })
  rerender({ key: 'b' })
  await waitFor(() => expect(reads).toBe(2))
  await new Promise((r) => setTimeout(r, 20))
  expect(reads).toBe(2)
})

it('off the core lane it reads nothing', async () => {
  renderHook(() => useViewFollows(false, UUID, 'a'))
  act(() => { approvedAt(3) })
  await new Promise((r) => setTimeout(r, 20))
  expect(reads).toBe(0)
})

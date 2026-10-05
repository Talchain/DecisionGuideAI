/**
 * J9 × the read (Codex, #2529 r1): on a signed-in page the pointer (`olumi-canvas-current-scenario-id`) names a scenario
 * once CEE has ADMITTED its read, written by `useServerGraphHydration`. A COMPLETED refusal stores nothing in either
 * storage. An admitted OWN link survives a routeless reload even when the browser's own row read never arrives (only
 * the hook runs here: no `loadScenario`). Guests are unchanged: the hook never writes their pointer. Imports only base
 * modules: the admitted row is RED on the base, the refusal rows guard against a write moved into the refusal branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import * as hydration from '../../hydrate/serverGraphHydration'
import type { HydrationOutcome } from '../../hydrate/serverGraphHydration'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { useDraftStore } from '../../stores/draftStore'
import { __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

let user: { id: string } | null = { id: 'account-b' }
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user }) }))

const S = '11111111-2222-4333-8444-555555555555'
const PREVIOUS = '99999999-2222-4333-8444-555555555555'
const POINTER = 'olumi-canvas-current-scenario-id'
const ADMITTED: HydrationOutcome[] = ['merged', 'unchanged', 'absent', 'mergeRefused']
const REFUSED: HydrationOutcome[] = ['notReadable', 'refused', 'signInRequired', 'unavailable', 'unusable']

const signIn = () => localStorage.setItem('sb-abcdefghijklmnopqrst-auth-token', JSON.stringify({ access_token: 't', refresh_token: 'r', user: { id: 'account-b' } }))
const keysNaming = (store: Storage, id: string) =>
  Array.from({ length: store.length }, (_, i) => store.key(i) as string).filter((k) => k.includes(id) || (store.getItem(k) ?? '').includes(id))

async function routeReadEnds(outcome: HydrationOutcome): Promise<void> {
  vi.spyOn(hydration, 'hydrateCanvasFromServer').mockResolvedValue(outcome)
  renderHook(() => useServerGraphHydration(S))
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  useServerGraphRetryStore.getState().clear()
  useDraftStore.getState().resetDraft()
  user = { id: 'account-b' }
  // The deep-link claim has run: the route is the scenario on screen (store only).
  useCanvasStore.setState({ currentScenarioId: S, nodes: [], edges: [] } as never)
})
afterEach(() => { vi.restoreAllMocks() })

describe('J9 — a signed-in page stores the pointer only for a read CEE admitted', () => {
  it.each(REFUSED)('⭐ refused (%s), completed: neither storage names S; a remembered pointer is left as it was', async (outcome) => {
    scenarios.setCurrentScenarioId(PREVIOUS)
    signIn()
    await routeReadEnds(outcome)
    expect(localStorage.getItem(POINTER)).toBe(PREVIOUS)
    expect(keysNaming(localStorage, S)).toEqual([])
    expect(keysNaming(sessionStorage, S)).toEqual([])
  })

  it.each(ADMITTED)('admitted (%s), with no browser row read at all: the pointer is S, so a routeless reload opens S', async (outcome) => {
    scenarios.setCurrentScenarioId(PREVIOUS)
    signIn()
    await routeReadEnds(outcome)
    expect(localStorage.getItem(POINTER)).toBe(S)
    expect(scenarios.getCurrentScenarioId()).toBe(S) // what the next page's store seeds from
  })

  it('admitted, but the user has already moved on (the store names another scenario): the pointer is not pulled back', async () => {
    scenarios.setCurrentScenarioId(PREVIOUS)
    signIn()
    vi.spyOn(hydration, 'hydrateCanvasFromServer').mockImplementation(async () => {
      useCanvasStore.setState({ currentScenarioId: PREVIOUS } as never) // a navigation lands while the read is in flight
      return 'merged'
    })
    renderHook(() => useServerGraphHydration(S))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) })
    expect(localStorage.getItem(POINTER)).toBe(PREVIOUS)
  })

  it('CONTROL — a guest page: the hook writes no pointer, admitted or not (guests keep "store only, never the pointer")', async () => {
    await routeReadEnds('merged')
    expect(localStorage.getItem(POINTER)).toBeNull()
  })
})

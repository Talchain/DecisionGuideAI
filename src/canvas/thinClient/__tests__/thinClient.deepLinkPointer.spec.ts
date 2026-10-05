/**
 * J1 J9 (#87 5998666452): account B opens a link to A's scenario S in a fresh browser; CEE refuses it, and afterwards
 * B's browser storage must not name S. #2511's thin branch in `coldLoadDeepLink.applyColdLoadPlan` wrote the pointer
 * (`olumi-canvas-current-scenario-id` = S) when it claimed the route, before any read was admitted. Prod before #2511
 * wrote nothing there for a fresh browser.
 *
 * The rule pinned: on a signed-in page the claim gives the route to the STORE only and writes nothing; the pointer
 * names a scenario once its row is admitted (`useScenario.loadScenario`, #2503). Imports only base modules, so the
 * rows run unchanged on the base, where the first is RED.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { claimColdLoadDeepLink, __resetColdLoadDeepLinkForTests } from '../../hydrate/coldLoadDeepLink'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

const S = '11111111-2222-4333-8444-555555555555' // A's scenario, in B's link
const OWN = '99999999-2222-4333-8444-555555555555' // a scenario this browser opened before
const POINTER = 'olumi-canvas-current-scenario-id'
const SESSION_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const PRISTINE = useCanvasStore.getState()

const allKeys = (): string[] => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const keysNaming = (id: string) => allKeys().filter((k) => k.includes(id) || (localStorage.getItem(k) ?? '').includes(id))

/** A new page load: the store as module load seeds it (`currentScenarioId` from the pointer), nothing on the canvas. */
function newPage(): void {
  __resetColdLoadDeepLinkForTests()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
}
const signedIn = () => localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: 't', refresh_token: 'r', user: { id: 'account-b' } }))

beforeEach(() => {
  localStorage.clear()
  newPage()
})
afterEach(() => { localStorage.clear() })

describe('J9 — a signed-in page\'s deep-link claim writes nothing', () => {
  it('⭐ B, fresh browser, link to S: the store takes S, and NO key names S (the pointer stays unwritten)', () => {
    signedIn()
    newPage()
    expect(claimColdLoadDeepLink(S)).toBe('applied')
    expect(useCanvasStore.getState().currentScenarioId).toBe(S) // the route is the scenario on screen
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(keysNaming(S)).toEqual([])
  })

  it('a browser that remembers its own scenario: a link to S gives S to the store and leaves the pointer as it was', () => {
    scenarios.setCurrentScenarioId(OWN)
    signedIn()
    newPage()
    expect(useCanvasStore.getState().currentScenarioId).toBe(OWN) // PRECONDITION: the store seeded from the pointer
    expect(claimColdLoadDeepLink(S)).toBe('applied')
    expect(useCanvasStore.getState().currentScenarioId).toBe(S)
    expect(localStorage.getItem(POINTER)).toBe(OWN)
    expect(keysNaming(S)).toEqual([])
  })

  it('CONTROL — a guest\'s fresh-browser link is unchanged: nothing remembered, nothing written (#2383)', () => {
    newPage()
    claimColdLoadDeepLink(S)
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(keysNaming(S)).toEqual([])
  })
})

/**
 * GAP-3 — THE LEAK ROWS (DL ruling after Acceptance's #2511 witness W1, #87 5997867420).
 *
 * This file imports ONLY modules that exist on the base (staging before GAP-3), so each row runs unchanged there and
 * is RED on it. The shape measured: a browser where A was signed in BEFORE #2511 keeps A's whole model in its slots.
 * A session that ends without a sign-out (a refresh token that fails while the browser is closed runs no identity
 * boundary) leaves the epoch unchanged, so the next GUEST page reads those slots as its own.
 *
 * Every slot is written by its REAL writer on a guest page (a pre-#2511 signed-in page wrote exactly these bytes:
 * unstamped before the first boundary), and read back by the REAL guest reader. `canvas-storage` is not one of them:
 * no deployed guest boot reads it (a production canvas boot returns before `loadState`); see `preThinPurge.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { isThinClientSession, loadThinLayout, saveThinLayout, __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { keyedAutosaveKey, loadAutosave, loadScenarios, saveAutosave, saveScenarios, type Scenario } from '../../store/scenarios'
import { listSnapshots, saveSnapshot } from '../../persist'
import { appendVersion, loadVersions } from '../../versions/versionStorage'
import { clearUserScopedState } from '../../../lib/auth/userScopedState'

const A_SCENARIO = '11111111-2222-4333-8444-555555555555'
const A_LABEL = 'Enterprise prospect signing likelihood'
const SESSION_KEY = 'sb-testproject-auth-token'

const nodesOfA = (): Node[] => [
  { id: 'enterprise_prospect_signing_likelihood', type: 'factor', position: { x: 10, y: 20 }, data: { label: A_LABEL } } as Node,
  { id: 'goal_revenue', type: 'goal', position: { x: 300, y: 20 }, data: { label: 'Quarterly revenue' } } as Node,
]
const edgesOfA = (): Edge[] => [{ id: 'e1', source: 'enterprise_prospect_signing_likelihood', target: 'goal_revenue' } as Edge]

/** Every stored key, by index (never `allKeys()`, which depends on the Storage implementation). */
const allKeys = (): string[] => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const signIn = () => localStorage.setItem(SESSION_KEY, '{"access_token":"t","user":{"id":"a"}}')
/** The session ends WITHOUT a sign-out: supabase-js drops the stored session, no identity boundary runs. */
const sessionLapses = () => {
  localStorage.removeItem(SESSION_KEY)
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
}

/** A's model, written by every real guest-path writer, as a pre-#2511 signed-in page wrote it. */
function seedAsPreThinPage(): void {
  saveAutosave({ timestamp: Date.now() + Math.random(), scenarioId: A_SCENARIO, nodes: nodesOfA(), edges: edgesOfA() })
  localStorage.setItem(keyedAutosaveKey(A_SCENARIO), localStorage.getItem('olumi-canvas-autosave') as string)
  expect(saveSnapshot({ nodes: nodesOfA(), edges: edgesOfA() as never })).toBe(true)
  expect(appendVersion({ id: 'v1', name: 'Before pricing', createdAt: Date.now(), origin: 'manual', nodes: nodesOfA() as never, edges: edgesOfA() as never }).success).toBe(true)
  const entry: Scenario = { id: A_SCENARIO, name: 'Pricing decision', createdAt: 1, updatedAt: 2, graph: { nodes: nodesOfA(), edges: edgesOfA() } }
  saveScenarios([entry])
}

const keysNamingA = () => allKeys().filter((k) => (localStorage.getItem(k) ?? '').includes(A_LABEL))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
})
afterEach(() => { vi.restoreAllMocks() })

describe('GAP-3 — A\'s pre-thin model never reaches a later guest', () => {
  it('PRECONDITION — the seed is real: a guest page reads A\'s model back from every slot', () => {
    seedAsPreThinPage()
    expect(loadAutosave()?.nodes.map((n) => n.id)).toEqual(['enterprise_prospect_signing_likelihood', 'goal_revenue'])
    expect(listSnapshots()).toHaveLength(1)
    expect(loadVersions().map((v) => v.id)).toEqual(['v1'])
    expect(loadScenarios()[0].graph.nodes).toHaveLength(2)
    expect(keysNamingA().length).toBeGreaterThanOrEqual(5)
  })

  it('A signs in once after the upgrade, the session lapses with no sign-out, a guest opens Olumi: nothing of A\'s model is restored', () => {
    seedAsPreThinPage()
    signIn()
    expect(isThinClientSession()).toBe(true) // any signed-in page asks this before it restores or writes anything
    sessionLapses()
    expect(isThinClientSession()).toBe(false)

    expect(loadAutosave()).toBeNull()
    expect(listSnapshots()).toEqual([])
    expect(loadVersions()).toEqual([])
    expect(loadScenarios().map((s) => ({ id: s.id, name: s.name, nodes: s.graph.nodes.length }))).toEqual([
      { id: A_SCENARIO, name: 'Pricing decision', nodes: 0 },
    ])
    expect(keysNamingA()).toEqual([])
  })
})

describe('GAP-3 — sign-out removes the signed-in layout (Acceptance, #2511 witness W2)', () => {
  it('the layout key, keyed by label-derived node ids, does not survive the identity boundary', () => {
    signIn()
    saveThinLayout(A_SCENARIO, nodesOfA())
    expect(loadThinLayout(A_SCENARIO)).not.toBeNull() // PRECONDITION: the real writer wrote it
    clearUserScopedState()
    expect(loadThinLayout(A_SCENARIO)).toBeNull()
    expect(allKeys().filter((k) => k.includes('enterprise_prospect_signing_likelihood'))).toEqual([])
  })
})

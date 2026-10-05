/**
 * GAP-3 — THE PRE-THIN PURGE: scope, once-per-epoch, and what it must never touch (DL ruling, #87; HIGH).
 *
 * The leak itself (A's pre-thin model reaching a later guest) is pinned in `thinClient.preThinLeak.spec.ts`, which runs
 * unchanged on the base. Here: a guest page purges nothing; a second signed-in load under the same epoch is a no-op; a
 * new identity epoch re-arms it; a refused removal is retried; a scenario-list entry keeps its id, name and metadata;
 * and the keys a signed-in user still needs (run history, the pointer, the guest-copy keys, the layout, the
 * draft-import slot) survive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { isThinClientSession, LAYOUT_KEY_PREFIX, saveThinLayout, __resetThinClientForTests } from '../thinClient'
import {
  PRE_THIN_MODEL_KEYS,
  PRE_THIN_MODEL_PREFIXES,
  PRE_THIN_PURGE_EPOCH_KEY,
  PRE_THIN_PURGE_MARKER_KEY,
  PRE_THIN_SCENARIO_LIST_KEY,
  purgePreThinModelCopies,
} from '../preThinPurge'
import { __resetPersistenceSessionForTests, setPersistenceSessionActive } from '../../../lib/persistenceSession'
import { IDENTITY_EPOCH_KEY, keyedAutosaveKey, saveAutosave, saveScenarios, type Scenario } from '../../store/scenarios'
import { loadState, saveSnapshot, saveState } from '../../persist'
import { appendVersion, VERSIONS_STORAGE_KEY } from '../../versions/versionStorage'
import { STORAGE_KEY as RUN_HISTORY_KEY } from '../../store/runHistory'
import { PENDING_GUEST_COPY_KEY, readCurrentScenarioPointer, readPendingGuestCopy } from '../../../lib/pendingGuestCopy'
import { clearUserScopedState } from '../../../lib/auth/userScopedState'

const A = '11111111-2222-4333-8444-555555555555'
const GUEST = '99999999-2222-4333-8444-555555555555'
const SESSION_KEY = 'sb-testproject-auth-token'

const nodes = (label: string): Node[] => [
  { id: 'n1', type: 'factor', position: { x: 1, y: 2 }, data: { label } } as Node,
  { id: 'n2', type: 'goal', position: { x: 3, y: 4 }, data: { label: `${label} goal` } } as Node,
]
const edges = (): Edge[] => [{ id: 'e1', source: 'n1', target: 'n2' } as Edge]

/** Every stored key, by index (never `allKeys()`, which depends on the Storage implementation). */
const allKeys = (): string[] => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const signIn = () => localStorage.setItem(SESSION_KEY, '{"access_token":"t","user":{"id":"a"}}')

/** Every model-copy class, each by its REAL writer on a guest page, under scenario `id`. */
function seedModelCopies(id: string, label: string): void {
  saveAutosave({ timestamp: Date.now() + Math.random(), scenarioId: id, nodes: nodes(label), edges: edges() })
  localStorage.setItem(keyedAutosaveKey(id), localStorage.getItem('olumi-canvas-autosave') as string)
  expect(saveState({ nodes: nodes(label), edges: edges() as never })).toBe(true)
  expect(saveSnapshot({ nodes: nodes(label), edges: edges() as never })).toBe(true)
  expect(appendVersion({ id: `v-${id}`, name: label, createdAt: Date.now(), origin: 'manual', nodes: nodes(label) as never, edges: edges() as never }).success).toBe(true)
  const entry: Scenario = {
    id, name: `${label} decision`, createdAt: 1, updatedAt: 2, last_run_at: '2026-10-05T00:00:00Z',
    framing: { title: `${label} decision` }, graph: { nodes: nodes(label), edges: edges() },
  }
  saveScenarios([entry])
}

/** The keys a signed-in user still needs, each written raw under its owner's constant. */
function seedKeptKeys(): Record<string, string> {
  const kept: Record<string, string> = {
    [RUN_HISTORY_KEY]: JSON.stringify([{ id: 'run-1', ts: 1, hash: 'h', report: {}, graph: { nodes: nodes('Run'), edges: [] } }]),
    'olumi-canvas-current-scenario-id': GUEST,
    [PENDING_GUEST_COPY_KEY]: GUEST,
  }
  for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v)
  return kept
}

const modelKeys = () => allKeys().filter((k) =>
  (PRE_THIN_MODEL_KEYS as readonly string[]).includes(k) || PRE_THIN_MODEL_PREFIXES.some((p) => k.startsWith(p)))
const listGraphNodeCounts = () =>
  (JSON.parse(localStorage.getItem(PRE_THIN_SCENARIO_LIST_KEY) ?? '[]') as Scenario[]).map((s) => s.graph.nodes.length)
const snapshotOf = () => Object.fromEntries(allKeys().sort().map((k) => [k, localStorage.getItem(k)]))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
})
afterEach(() => { vi.restoreAllMocks() })

describe('GAP-3 — every key is its writer\'s key (no literal drifts from the code that writes it)', () => {
  it('the epoch is scenarios.IDENTITY_EPOCH_KEY; versions, keyed slots and the layout are their owners\' keys', () => {
    expect(PRE_THIN_PURGE_EPOCH_KEY).toBe(IDENTITY_EPOCH_KEY)
    expect(PRE_THIN_MODEL_KEYS).toContain(VERSIONS_STORAGE_KEY)
    expect(keyedAutosaveKey(A).startsWith(PRE_THIN_MODEL_PREFIXES[0])).toBe(true)
    expect(PRE_THIN_MODEL_KEYS).not.toContain(RUN_HISTORY_KEY)
    saveThinLayout(A, nodes('x'))
    expect(allKeys()).toEqual([LAYOUT_KEY_PREFIX + A])
  })

  it('PRECONDITION — the seed writes every class: main + keyed slot, canvas-storage, a snapshot (+ name), versions, a list graph', () => {
    seedModelCopies(A, 'Alpha')
    const keys = modelKeys()
    expect(keys).toEqual(expect.arrayContaining(['olumi-canvas-autosave', keyedAutosaveKey(A), VERSIONS_STORAGE_KEY]))
    expect(localStorage.getItem('canvas-storage')).toContain('Alpha') // written too: the kept-row below needs it
    expect(keys.filter((k) => k.startsWith('canvas-snapshot-')).length).toBeGreaterThanOrEqual(1)
    expect(listGraphNodeCounts()).toEqual([2])
  })
})

describe('GAP-3 — a signed-in page purges; a guest page does not', () => {
  it('CONTRAST — guest page: asking the predicate removes nothing, every byte stays', () => {
    seedModelCopies(A, 'Alpha')
    const before = snapshotOf()
    expect(isThinClientSession()).toBe(false)
    expect(snapshotOf()).toEqual(before)
    expect(localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY)).toBeNull()
  })

  it('signed in (stored session): the first answer purges every model copy; list entries keep id, name and metadata', () => {
    seedModelCopies(A, 'Alpha')
    signIn()
    expect(isThinClientSession()).toBe(true)
    expect(modelKeys()).toEqual([])
    const [entry] = JSON.parse(localStorage.getItem(PRE_THIN_SCENARIO_LIST_KEY) as string) as Scenario[]
    expect(entry).toEqual({
      id: A, name: 'Alpha decision', createdAt: 1, updatedAt: 2, last_run_at: '2026-10-05T00:00:00Z',
      framing: { title: 'Alpha decision' }, graph: { nodes: [], edges: [] },
    })
  })

  it('signed in (published persistence session, no stored token): purges too — the predicate is the one trigger', () => {
    seedModelCopies(A, 'Alpha')
    setPersistenceSessionActive(true)
    expect(isThinClientSession()).toBe(true)
    expect(modelKeys()).toEqual([])
  })

  it('canvas-storage survives: the signed-in draft-import offer reads it, and no deployed guest boot does (Codex, #2525 r1)', () => {
    seedModelCopies(A, 'Alpha')
    const draft = localStorage.getItem('canvas-storage')
    signIn()
    expect(isThinClientSession()).toBe(true)
    expect(localStorage.getItem('canvas-storage')).toBe(draft)
    expect(loadState()?.nodes).toHaveLength(2) // the offer's own reader (`lib/loginDraftImport.ts`) still finds the draft
    expect(PRE_THIN_MODEL_KEYS).not.toContain('canvas-storage')
  })

  it('what a signed-in user still needs survives: run history (Compare), the pointer, the guest-copy key, the layout', () => {
    seedModelCopies(A, 'Alpha')
    const kept = seedKeptKeys()
    saveThinLayout(A, nodes('Alpha'))
    const layout = localStorage.getItem(LAYOUT_KEY_PREFIX + A)
    signIn()
    expect(isThinClientSession()).toBe(true)
    for (const [k, v] of Object.entries(kept)) expect(localStorage.getItem(k)).toBe(v)
    expect(localStorage.getItem(LAYOUT_KEY_PREFIX + A)).toBe(layout)
    expect(readCurrentScenarioPointer()).toBe(GUEST)
    expect(readPendingGuestCopy()).toBe(GUEST)
  })
})

describe('GAP-3 — once per identity epoch', () => {
  it('a second signed-in load under the same epoch is a no-op: a slot written since is left alone', () => {
    seedModelCopies(A, 'Alpha')
    signIn()
    expect(purgePreThinModelCopies().ran).toBe(true)
    localStorage.setItem('olumi-canvas-autosave', '{"marker":"written after the purge"}')
    const before = snapshotOf()
    expect(purgePreThinModelCopies()).toEqual({ ran: false, removed: [], strippedEntries: 0 })
    expect(isThinClientSession()).toBe(true)
    expect(snapshotOf()).toEqual(before)
  })

  it('an identity boundary (fresh epoch) re-arms it: a guest-era slot under the new epoch is purged at the next sign-in', () => {
    seedModelCopies(A, 'Alpha')
    signIn()
    expect(isThinClientSession()).toBe(true)
    const firstMark = localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY)
    localStorage.removeItem(SESSION_KEY)
    clearUserScopedState() // sign-out: a fresh epoch, then the sweep
    const epoch = localStorage.getItem(IDENTITY_EPOCH_KEY)
    expect(epoch).not.toBe(firstMark)
    __resetThinClientForTests()
    seedModelCopies(GUEST, 'Guest') // a guest page under the new epoch
    expect(modelKeys().length).toBeGreaterThan(0)
    signIn()
    expect(isThinClientSession()).toBe(true)
    expect(modelKeys()).toEqual([])
    expect(listGraphNodeCounts()).toEqual([0])
    expect(localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY)).toBe(epoch)
  })

  it('a refused removal leaves the marker unwritten, so the next signed-in page finishes the job', () => {
    seedModelCopies(A, 'Alpha')
    signIn()
    const realRemove = Storage.prototype.removeItem
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'olumi-canvas-autosave') throw new DOMException('denied', 'SecurityError')
      return realRemove.call(this, key)
    })
    const first = purgePreThinModelCopies()
    expect(first.ran).toBe(true)
    expect(first.removed).not.toContain('olumi-canvas-autosave')
    expect(localStorage.getItem('olumi-canvas-autosave')).toContain('Alpha') // PRECONDITION: the refusal held
    expect(localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY)).toBeNull()
    spy.mockRestore()
    expect(purgePreThinModelCopies().removed).toEqual(['olumi-canvas-autosave'])
    expect(modelKeys()).toEqual([])
    expect(localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY)).toBe('before-first-boundary')
  })

  it('an unreadable epoch touches nothing (whose copies these are cannot be known)', () => {
    seedModelCopies(A, 'Alpha')
    const before = snapshotOf()
    const realGet = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === IDENTITY_EPOCH_KEY) throw new DOMException('denied', 'SecurityError')
      return realGet.call(this, key)
    })
    expect(purgePreThinModelCopies()).toEqual({ ran: false, removed: [], strippedEntries: 0 })
    vi.restoreAllMocks()
    expect(snapshotOf()).toEqual(before)
  })
})

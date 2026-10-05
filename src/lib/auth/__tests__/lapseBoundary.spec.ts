/**
 * LAPSE-BOUNDARY (DL ruling on #2525, Codex r1 P1-3; HIGH): a signed-in session that ends WITHOUT a sign-out is an
 * identity boundary. Measured shape: the next page is a GUEST's, and before this it read the previous account's
 * transcript and run history (`?run=` → Results with driver labels) because no boundary had run.
 *
 * Every key is written by its REAL writer on a signed-in page, and read back by the REAL guest reader. DL rows:
 * a lapse leaves the guest none of A's transcript, run history or model; a guest who never signed in loses nothing; a
 * normal sign-out is unchanged (no second sweep); plus a signed-in boot (no sweep) and the boot order in `main.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LAPSE_BOUNDARY_BOUND_MS, runLapseBoundaryIfNeeded, sessionLapsedHere, SIGNED_IN_HERE_KEY, __resetLapseBoundaryForTests } from '../lapseBoundary'
import { CHUNK_STALL_BOUND_MS } from '../../staleBuildRecovery'
import { clearUserScopedState, USER_SCOPED_STORAGE_KEYS } from '../userScopedState'
import { isThinClientSession, loadThinLayout, saveThinLayout, __latchThinClientForTests, __resetThinClientForTests } from '../../../canvas/thinClient/thinClient'
import { __resetPersistenceSessionForTests, setPersistenceSessionActive } from '../../persistenceSession'
import { loadTranscript, saveTranscript, __resetTranscriptTombstonesForTests } from '../../../canvas/conversation/utils/transcriptStore'
import { loadRuns, saveRuns, type StoredRun } from '../../../canvas/store/runHistory'
import { IDENTITY_EPOCH_KEY } from '../../../canvas/store/scenarios'
import type { ConversationMessage } from '../../../canvas/conversation/types'

const A = '11111111-2222-4333-8444-555555555555'
const A_LABEL = 'Enterprise prospect signing likelihood'
const SESSION_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const SESSION = JSON.stringify({ access_token: 't', refresh_token: 'r', user: { id: 'account-a' } })

const allKeys = (): string[] => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const snapshot = () => Object.fromEntries(allKeys().sort().map((k) => [k, localStorage.getItem(k)]))
const keysNamingA = () => allKeys().filter((k) => (localStorage.getItem(k) ?? '').includes(A_LABEL))

const message = (content: string): ConversationMessage =>
  ({ id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date('2026-10-05T16:00:00Z') }) as ConversationMessage
const run = (): StoredRun =>
  ({ id: 'run-a', ts: 1, hash: 'hash-a', adapter: 'auto', seed: 1, summary: `Leader driven by ${A_LABEL}`, graphHash: 'g',
    report: { drivers: [{ label: A_LABEL }] }, drivers: [{ label: A_LABEL }] }) as unknown as StoredRun

/** A signed-in page: it asks the predicate (as every signed-in page does at boot), then writes A's work. */
function signedInPageWritesWork(): void {
  localStorage.setItem(SESSION_KEY, SESSION)
  expect(isThinClientSession()).toBe(true)
  saveTranscript(A, [message(`The biggest driver is ${A_LABEL}.`)])
  saveRuns([run()])
  saveThinLayout(A, [{ id: 'enterprise_prospect_signing_likelihood', position: { x: 1, y: 2 } }])
  expect(loadTranscript(A)?.messages).toHaveLength(1) // PRECONDITION: the real writers wrote
  expect(loadRuns()).toHaveLength(1)
}

/** The session ends WITHOUT a sign-out; the next load is a new page. */
function sessionLapsesAndNextPageLoads(): void {
  localStorage.removeItem(SESSION_KEY)
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  __resetTranscriptTombstonesForTests()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  sessionLapsesAndNextPageLoads()
  __resetLapseBoundaryForTests()
})
afterEach(() => { vi.restoreAllMocks() })

describe('LAPSE-BOUNDARY — the marker', () => {
  it('a signed-in page records it; a guest page does not', () => {
    expect(isThinClientSession()).toBe(false)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    localStorage.setItem(SESSION_KEY, SESSION)
    expect(isThinClientSession()).toBe(true)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBe('1')
  })

  it('the identity boundary\'s own sweep removes it (a normal sign-out leaves no lapse behind)', () => {
    expect(USER_SCOPED_STORAGE_KEYS).toContain(SIGNED_IN_HERE_KEY)
    localStorage.setItem(SESSION_KEY, SESSION)
    expect(isThinClientSession()).toBe(true)
    clearUserScopedState()
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
  })
})

describe('LAPSE-BOUNDARY — the DL rows', () => {
  it('PRECONDITION (the defect): after a lapse with no boundary, a guest page reads A\'s transcript and run history', () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    expect(isThinClientSession()).toBe(false)
    expect(loadTranscript(A)?.messages[0].content).toContain(A_LABEL)
    expect(loadRuns()[0].hash).toBe('hash-a')
    expect(sessionLapsedHere()).toBe(true)
  })

  it('⭐ a lapse: the boot runs the boundary — the guest gets none of A\'s transcript, run history, layout; a fresh epoch', async () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    expect(await runLapseBoundaryIfNeeded()).toBe(true)
    expect(loadTranscript(A)).toBeNull()
    expect(loadRuns()).toEqual([])
    expect(loadThinLayout(A)).toBeNull()
    expect(keysNamingA()).toEqual([])
    expect(localStorage.getItem(IDENTITY_EPOCH_KEY)).toBeTruthy()
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    expect(await runLapseBoundaryIfNeeded()).toBe(false) // once: the guest's own later work is never swept
  })

  it('CONTRAST — a guest who never signed in: nothing runs, every byte stays (their own transcript and runs)', async () => {
    saveTranscript(A, [message(`Guest notes on ${A_LABEL}.`)])
    saveRuns([run()])
    const before = snapshot()
    expect(await runLapseBoundaryIfNeeded()).toBe(false)
    expect(snapshot()).toEqual(before)
  })

  it('CONTRAST — a normal sign-out is unchanged: its sweep runs once, and the next guest boot sweeps nothing more', async () => {
    signedInPageWritesWork()
    localStorage.removeItem(SESSION_KEY)
    clearUserScopedState() // the sign-out
    sessionLapsesAndNextPageLoads()
    saveTranscript(A, [message('A guest, after the sign-out.')])
    const before = snapshot()
    expect(await runLapseBoundaryIfNeeded()).toBe(false)
    expect(snapshot()).toEqual(before)
  })

  it('CONTRAST — a boot that is still signed in (stored session): no sweep', async () => {
    signedInPageWritesWork()
    __resetThinClientForTests()
    const before = snapshot()
    expect(await runLapseBoundaryIfNeeded()).toBe(false)
    expect(snapshot()).toEqual(before)
  })

  it('a boundary that cannot load leaves the page as it was and never rejects (the app still renders)', async () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    const before = snapshot()
    await expect(runLapseBoundaryIfNeeded(() => Promise.reject(new Error('chunk failed')))).resolves.toBe(false)
    expect(snapshot()).toEqual(before)
  })
})

describe('LAPSE-BOUNDARY — Codex #2530 r1', () => {
  it('a session stored by another tab WHILE the boundary loads: decided again after the await, nothing is swept', async () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    expect(sessionLapsedHere()).toBe(true) // PRECONDITION: a lapse when the boot looked
    const before = snapshot()
    const ran = await runLapseBoundaryIfNeeded(async () => {
      localStorage.setItem(SESSION_KEY, SESSION) // the other tab signs in during the chunk load
      return import('../userScopedState')
    })
    expect(ran).toBe(false)
    expect(loadTranscript(A)?.messages).toHaveLength(1)
    expect(loadRuns()).toHaveLength(1)
    expect(snapshot()).toEqual({ ...before, [SESSION_KEY]: SESSION })
  })

  it('⭐ NO FALSE LAPSE (Codex #2530 r2): the canvas asks while the SDK is still removing A\'s token — nothing is recorded', async () => {
    localStorage.setItem(SESSION_KEY, SESSION)
    expect(isThinClientSession()).toBe(true)
    __latchThinClientForTests() // production: the page stays thin after its first signed-in answer
    clearUserScopedState() // AuthContext.signOut: the boundary runs BEFORE the SDK's logout request returns
    expect(isThinClientSession()).toBe(true) // a canvas render during that wait: A's token is still stored
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    localStorage.removeItem(SESSION_KEY) // the SDK finishes the sign-out
    sessionLapsesAndNextPageLoads()
    saveTranscript(A, [message('A guest, after the sign-out.')])
    const before = snapshot()
    expect(await runLapseBoundaryIfNeeded()).toBe(false) // the guest's own work is never swept
    expect(snapshot()).toEqual(before)
  })

  it('⭐ NO FALSE LAPSE (Codex #2530 r2): the canvas mirror outlives the sign-out (Profile → sign out → canvas) — nothing is recorded', async () => {
    localStorage.setItem(SESSION_KEY, SESSION)
    expect(isThinClientSession()).toBe(true)
    __latchThinClientForTests()
    localStorage.removeItem(SESSION_KEY)
    clearUserScopedState()
    setPersistenceSessionActive(true) // CanvasMVP's mirror left true on unmount
    expect(isThinClientSession()).toBe(true)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
  })
})

describe('LAPSE-BOUNDARY — a boundary chunk that never settles never blanks the app (Review Desk, #2530)', () => {
  it('⭐ a never-settling chunk: resolves false WITHIN the bound, nothing swept, the record stays for the next boot', async () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    const before = snapshot()
    const started = Date.now()
    await expect(runLapseBoundaryIfNeeded(() => new Promise(() => { /* never settles */ }), 60)).resolves.toBe(false)
    expect(Date.now() - started).toBeLessThan(1_000)
    expect(snapshot()).toEqual(before)
    expect(sessionLapsedHere()).toBe(true) // the next boot decides again
  }, 2_000)

  it('a chunk that arrives AFTER the bound never sweeps (the app is already mounted)', async () => {
    signedInPageWritesWork()
    sessionLapsesAndNextPageLoads()
    const before = snapshot()
    let swept = false
    const late = () => new Promise<{ clearUserScopedState: () => void }>((resolve) => {
      setTimeout(() => resolve({ clearUserScopedState: () => { swept = true } }), 120)
    })
    await expect(runLapseBoundaryIfNeeded(late, 40)).resolves.toBe(false)
    await new Promise((r) => setTimeout(r, 200))
    expect(swept).toBe(false)
    expect(snapshot()).toEqual(before)
  }, 2_000)

  it('the bound sits well inside AppPoC\'s own chunk bound', () => {
    expect(LAPSE_BOUNDARY_BOUND_MS).toBeGreaterThan(0)
    expect(LAPSE_BOUNDARY_BOUND_MS * 4).toBeLessThanOrEqual(CHUNK_STALL_BOUND_MS)
  })
})

describe('LAPSE-BOUNDARY — boot order (main.tsx)', () => {
  it('AppPoC\'s loader runs the boundary BEFORE it imports the app (every route is inside AppPoC)', async () => {
    // Bound to the SOURCE ORDER, as `participantTokenHygiene.spec.ts` binds main.tsx's: main.tsx self-boots and cannot be
    // mounted, and the ordering IS the guarantee.
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    const factory = src.match(/const AppPoC = lazyWithStallBound\(([^\n]+)\n/)
    expect(factory).not.toBeNull() // POSITIVE CONTROL: the one AppPoC loader exists
    const body = factory![1]
    const boundaryAt = body.indexOf('await runLapseBoundaryIfNeeded()')
    const appAt = body.indexOf("import('./poc/AppPoC')")
    expect(boundaryAt).toBeGreaterThan(-1)
    expect(appAt).toBeGreaterThan(boundaryAt)
    expect(body).toMatch(/^async \(\) => \{ await runLapseBoundaryIfNeeded\(\); return import\('\.\/poc\/AppPoC'\); \}/)
  })
})

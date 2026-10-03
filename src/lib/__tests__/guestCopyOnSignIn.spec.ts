/**
 * ACCOUNTS B3 — sign-in transition → copy → open the COPY.
 *
 * Bound by identity: the request names the captured guest id, the canvas adopts
 * the id the server returned, and the guest's local Run cannot follow it (a row
 * through the REAL canvas store and real localStorage, not a mock that writes the
 * asserted fields itself).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  GUEST_COPIED_EVENT,
  createSignInTransitionTracker,
  handleAuthObservation,
  runPendingGuestCopy,
  type GuestCopiedDetail,
} from '../guestCopyOnSignIn'
import { PENDING_GUEST_COPY_KEY } from '../pendingGuestCopy'
import type { GuestCopyOutcome } from '../../services/guestCopyService'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'
const AUTOSAVE_KEY = 'olumi-canvas-autosave'
const GUEST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'
const OTHER = '9f8b7a6c-1234-4def-8abc-0123456789ab'
const TOKEN = 'eyJ.header.sig'

const now = (run: () => void) => run()

function requestReturning(outcome: GuestCopyOutcome) {
  return vi.fn(async () => outcome)
}

let events: GuestCopiedDetail[] = []
const onCopied = (e: Event) => { events.push((e as CustomEvent<GuestCopiedDetail>).detail) }

beforeEach(() => {
  localStorage.clear()
  events = []
  window.addEventListener(GUEST_COPIED_EVENT, onCopied)
})

afterEach(() => {
  window.removeEventListener(GUEST_COPIED_EVENT, onCopied)
  vi.restoreAllMocks()
})

describe('createSignInTransitionTracker', () => {
  it('a page that started signed out: the first session is a TRANSITION; a later SIGNED_IN (tab focus) is not', () => {
    const t = createSignInTransitionTracker(false)
    expect(t.observe(false)).toBe('none') // INITIAL_SESSION, no session
    expect(t.observe(true)).toBe('transition') // SIGNED_IN
    expect(t.observe(true)).toBe('none') // gotrue's SIGNED_IN on focus / recovery
    expect(t.observe(true)).toBe('none') // TOKEN_REFRESHED
  })

  it('magic-link race: verifyOtp finished before INITIAL_SESSION, so the FIRST event carries the session — still a transition', () => {
    const t = createSignInTransitionTracker(false)
    expect(t.observe(true)).toBe('transition')
  })

  it('a page that started signed in is RESTORED once (retry only), never a transition', () => {
    const t = createSignInTransitionTracker(true)
    expect(t.observe(true)).toBe('restored')
    expect(t.observe(true)).toBe('none')
  })

  it('sign out, then sign in again in the same page → a new transition', () => {
    const t = createSignInTransitionTracker(true)
    t.observe(true)
    expect(t.observe(false)).toBe('none') // SIGNED_OUT
    expect(t.observe(true)).toBe('transition')
  })
})

describe('handleAuthObservation', () => {
  it('transition: captures the guest pointer and copies it ONCE, with the session token', async () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const request = requestReturning({ kind: 'retry_later', reason: 'copy_unavailable' })

    const run = handleAuthObservation('transition', TOKEN, { request }, now)

    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBe(GUEST) // synchronous, before any navigation
    await run
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(GUEST, TOKEN)
  })

  it('restored: copies what an earlier attempt left pending and captures NOTHING new', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, OTHER) // the signed-in user's own decision
    const request = requestReturning({ kind: 'retry_later', reason: 'copy_unavailable' })

    await handleAuthObservation('restored', TOKEN, { request }, now)

    expect(request).toHaveBeenCalledWith(GUEST, TOKEN)
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBe(GUEST)
  })

  it('restored with nothing pending: no request at all (a returning user is not re-copied)', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, OTHER)
    const request = requestReturning({ kind: 'not_copyable' })

    expect(handleAuthObservation('restored', TOKEN, { request }, now)).toBeNull()
    expect(request).not.toHaveBeenCalled()
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('none, or no token: nothing captured, nothing sent', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const request = requestReturning({ kind: 'not_copyable' })

    expect(handleAuthObservation('none', TOKEN, { request }, now)).toBeNull()
    expect(handleAuthObservation('transition', null, { request }, now)).toBeNull()
    expect(request).not.toHaveBeenCalled()
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('the request is SCHEDULED out of the auth callback, not sent inside it', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const request = requestReturning({ kind: 'retry_later', reason: 'x' })
    const queued: Array<() => void> = []

    void handleAuthObservation('transition', TOKEN, { request }, (run) => { queued.push(run) })

    expect(request).not.toHaveBeenCalled()
    queued.forEach((run) => run())
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('runPendingGuestCopy — outcomes', () => {
  it('copied: clears the slot, adopts the NEW id while the pointer still names the guest, and announces it', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const adopt = vi.fn(async () => true)

    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'copied', scenarioId: COPY, created: true }), adopt })

    expect(run).toEqual({ kind: 'copied', sourceScenarioId: GUEST, scenarioId: COPY, created: true, adopted: true })
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
    expect(adopt).toHaveBeenCalledWith(GUEST, COPY, expect.any(Function))
    expect(events).toEqual([{ sourceScenarioId: GUEST, scenarioId: COPY, created: true }])
  })

  it('CONTRAST: copied after the user already opened something else → NOT pulled away (no adopt), still announced', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, OTHER)
    const adopt = vi.fn(async () => true)

    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'copied', scenarioId: COPY, created: false }), adopt })

    expect(run).toMatchObject({ kind: 'copied', adopted: false })
    expect(adopt).not.toHaveBeenCalled()
    expect(events).toEqual([{ sourceScenarioId: GUEST, scenarioId: COPY, created: false }])
  })

  it('not_copyable: terminal — clears the slot; no adopt, no announcement', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const adopt = vi.fn(async () => true)

    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'not_copyable' }), adopt })

    expect(run).toEqual({ kind: 'not_copyable', sourceScenarioId: GUEST })
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
    expect(adopt).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it('retry_later: KEEPS the slot (503 before the SQL is applied, network, 401…); no adopt, no announcement', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const adopt = vi.fn(async () => true)

    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'retry_later', reason: 'copy_unavailable' }), adopt })

    expect(run).toEqual({ kind: 'retry_later', sourceScenarioId: GUEST, reason: 'copy_unavailable' })
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBe(GUEST)
    expect(adopt).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it('concurrent calls share ONE request (two auth events in a tick, StrictMode double mount)', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    let release: (o: GuestCopyOutcome) => void = () => {}
    const request = vi.fn(() => new Promise<GuestCopyOutcome>((resolve) => { release = resolve }))

    const a = runPendingGuestCopy(TOKEN, { request, adopt: async () => true })
    const b = runPendingGuestCopy(TOKEN, { request, adopt: async () => true })
    release({ kind: 'not_copyable' })
    await Promise.all([a, b])

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(GUEST, TOKEN)
  })

  it('CONTRAST: a DIFFERENT token (another sign-in) never joins the first run', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    const releases: Array<(o: GuestCopyOutcome) => void> = []
    const request = vi.fn(() => new Promise<GuestCopyOutcome>((resolve) => { releases.push(resolve) }))

    const a = runPendingGuestCopy('token-a', { request, adopt: async () => true })
    const b = runPendingGuestCopy('token-b', { request, adopt: async () => true })
    releases.forEach((release) => release({ kind: 'retry_later', reason: 'x' }))
    await Promise.all([a, b])

    expect(request.mock.calls.map((c) => (c as unknown[])[1])).toEqual(['token-a', 'token-b'])
  })

  it('STALE: the account changed while the request ran → nothing cleared, adopted or announced', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    const adopt = vi.fn(async () => true)
    let current = true
    const request = vi.fn(async () => { current = false; return { kind: 'copied', scenarioId: COPY, created: true } as GuestCopyOutcome })

    const run = await runPendingGuestCopy(TOKEN, { request, adopt, isCurrent: () => current })

    expect(run).toEqual({ kind: 'stale', sourceScenarioId: GUEST })
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBe(GUEST)
    expect(adopt).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it('a late answer never deletes a DIFFERENT id captured while it ran', async () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    const request = vi.fn(async () => {
      localStorage.setItem(PENDING_GUEST_COPY_KEY, OTHER) // replaced mid-flight
      return { kind: 'not_copyable' } as GuestCopyOutcome
    })

    await runPendingGuestCopy(TOKEN, { request, adopt: async () => true })

    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBe(OTHER)
  })
})

describe('runPendingGuestCopy — the REAL canvas store adopts the copy, and the guest Run cannot follow it', () => {
  it('pointer → the copy; the guest autosave (graph + analysis) is gone; the store holds the copy id', async () => {
    const { useCanvasStore } = await import('../../canvas/store')
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST)
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
      timestamp: Date.now(),
      scenarioId: GUEST,
      nodes: [{ id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Win' } }],
      edges: [],
      analysis: { hash: 'guest-run-hash', report: { decision: 'guest' } },
    }))
    useCanvasStore.setState({ currentScenarioId: GUEST })

    // Default adopt: no `adopt` dep, so the real `adoptScenario` runs.
    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'copied', scenarioId: COPY, created: true }) })

    expect(run).toMatchObject({ kind: 'copied', adopted: true })
    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBe(COPY)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(COPY)
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it('CONTRAST: the user opened ANOTHER decision (live store moved, disk pointer not) → adoption declines; that canvas is untouched', async () => {
    const { useCanvasStore } = await import('../../canvas/store')
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST)
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST) // useScenario.loadScenario does not write the pointer
    const opened = [{ id: 'b_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B' } }]
    useCanvasStore.setState({ currentScenarioId: OTHER, nodes: opened as never })

    const run = await runPendingGuestCopy(TOKEN, { request: requestReturning({ kind: 'copied', scenarioId: COPY, created: true }) })

    expect(run).toMatchObject({ kind: 'copied', adopted: false })
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect(useCanvasStore.getState().nodes).toEqual(opened)
    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBe(GUEST)
  })
})

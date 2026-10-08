/**
 * LAPSE-BOUNDARY IN PLACE (Codex, #2534 r2 P1-2). A page that BOOTS with A's stored session, which the SDK then drops
 * (its refresh failed), ran no boundary: the provider's owner starts null, so `adopt(null)` is no owner change. The
 * guest on that page read A's local keys until a reload, and the record left behind turned the NEXT tab's boot into a
 * lapse that swept that guest's own work. The boundary now runs here, when the initial restore ends with the session
 * gone, before the guest can work.
 *
 * Driven through the REAL provider in the deployed posture, Supabase mocked at its transport (as
 * `AuthContext.optionalAuth.lapseRecord.spec.tsx`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { runLapseBoundaryIfNeeded, SIGNED_IN_HERE_KEY, __resetLapseBoundaryForTests } from '../../lib/auth/lapseBoundary'
import { loadTranscript, saveTranscript, __resetTranscriptTombstonesForTests } from '../../canvas/conversation/utils/transcriptStore'
import type { ConversationMessage } from '../../canvas/conversation/types'
import { __resetThinClientForTests } from '../../canvas/thinClient/thinClient'
import { __resetPersistenceSessionForTests } from '../../lib/persistenceSession'
import { crossIdentityBoundaryInThisTab } from '../../canvas/store/scenarios'

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signInWithPassword, signOut: vi.fn(async () => ({ error: null })), signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() } },
  getProfile: vi.fn(async () => ({ data: null, error: null })),
  getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })),
}))
vi.mock('../../lib/monitoring', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/monitoring')>()),
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}))
vi.mock('../../lib/posthog', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/posthog')>()),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
  trackEvent: vi.fn(),
}))

const A_SCENARIO = 'aaaaaaaa-1111-4111-8111-111111111111'
const A_LABEL = 'Enterprise prospect signing likelihood'
const GUEST_SCENARIO = 'cccccccc-1111-4111-8111-111111111111'
const TOKEN_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const storedSession = (id: string) => JSON.stringify({ access_token: `t-${id}`, refresh_token: `r-${id}`, user: { id } })
const session = (id: string) => ({ user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {} }, access_token: `fixture-${id}` })
const message = (content: string): ConversationMessage =>
  ({ id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date('2026-10-05T19:00:00Z') }) as ConversationMessage

/** Every key, in either storage, whose name or value carries A's exact label or A's scenario id. */
const keysNamingA = (): string[] => [localStorage, sessionStorage].flatMap((store) =>
  Array.from({ length: store.length }, (_, i) => store.key(i) as string)
    .filter((k) => [k, store.getItem(k) ?? ''].some((v) => v.includes(A_LABEL) || v.includes(A_SCENARIO))))

/** What each render of the app saw: whether auth had resolved (the guest UI waits on it) and which keys named A. */
let renders: Array<{ loading: boolean; namingA: string[] }> = []

async function renderProvider(): Promise<{ fire: (event: string, s: unknown) => Promise<void>; signIn: (id: string) => Promise<void> }> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  let localSignIn: ((email: string, password: string) => Promise<unknown>) | undefined
  function Probe() {
    const auth = useAuth()
    localSignIn = auth.signInWithPassword
    renders.push({ loading: auth.loading, namingA: keysNamingA() })
    return null
  }
  await act(async () => {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
  })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  const callback = onAuthStateChange.mock.calls[0]?.[0] as ((event: string, s: unknown) => void) | undefined
  return {
    fire: async (event, s) => { await act(async () => { callback?.(event, s) }) },
    signIn: async id => {
      signInWithPassword.mockImplementationOnce(async () => {
        callback?.('SIGNED_IN', session(id))
        return { data: { session: session(id) }, error: null }
      })
      await act(async () => { await localSignIn!(`${id}@example.com`, 'fixture-password') })
    },
  }
}

/** A's earlier page: signed in, wrote A's transcript; the browser closes with A's (now expired) session stored. */
function aLeftThisBrowserSignedIn(): void {
  localStorage.setItem(TOKEN_KEY, storedSession('account-a'))
  saveTranscript(A_SCENARIO, [message(`The biggest driver is ${A_LABEL}.`)])
  expect(loadTranscript(A_SCENARIO)?.messages).toHaveLength(1) // PRECONDITION: the real writer wrote
  expect(keysNamingA().length).toBeGreaterThan(0)
  __resetTranscriptTombstonesForTests()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
}

describe('LAPSE-BOUNDARY in place — the restore ends with the session gone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    crossIdentityBoundaryInThisTab('lapse-inplace-case', null)
    __resetLapseBoundaryForTests()
    __resetThinClientForTests()
    __resetPersistenceSessionForTests()
    __resetTranscriptTombstonesForTests()
    renders = []
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  /** supabase-js on a failed refresh: removes the stored session, then answers null. */
  const restoreFailsAndDropsTheSession = () => getSession.mockImplementation(async () => {
    localStorage.removeItem(TOKEN_KEY)
    return { data: { session: null }, error: null }
  })

  it('⭐ the boundary runs on THIS page before the guest can act: no resolved render sees a key naming A; the record is gone', async () => {
    aLeftThisBrowserSignedIn()
    restoreFailsAndDropsTheSession()
    await renderProvider()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull() // PRECONDITION: the SDK dropped it
    const resolved = renders.filter((r) => !r.loading)
    expect(resolved.length).toBeGreaterThan(0) // PRECONDITION: the guest UI was released
    expect(resolved.map((r) => r.namingA)).toEqual(resolved.map(() => []))
    expect(keysNamingA()).toEqual([])
    expect(loadTranscript(A_SCENARIO)).toBeNull()
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
  })

  it('⭐ so the NEXT tab\'s boot is not a lapse: the guest\'s own work on this page survives it (Codex r2 P1-2)', async () => {
    aLeftThisBrowserSignedIn()
    restoreFailsAndDropsTheSession()
    await renderProvider()
    saveTranscript(GUEST_SCENARIO, [message('A guest, working on this page.')])
    expect(await runLapseBoundaryIfNeeded(() => Promise.reject(new Error('chunk failed')), 40)).toBe(false) // a second tab
    expect(await runLapseBoundaryIfNeeded()).toBe(false)
    expect(loadTranscript(GUEST_SCENARIO)?.messages).toHaveLength(1)
  })

  it('and a sign-in later on this page (B) is recorded, so B\'s own lapse is caught', async () => {
    aLeftThisBrowserSignedIn()
    restoreFailsAndDropsTheSession()
    const { signIn } = await renderProvider()
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    await signIn('account-b')
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBe('1')
  })

  it('CONTRAST — the restore only timed out (the session is still stored): nothing runs, A\'s work stays', async () => {
    aLeftThisBrowserSignedIn()
    getSession.mockImplementation(() => new Promise(() => { /* a hung refresh */ }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await renderProvider()
      await act(async () => { vi.advanceTimersByTime(60_000) })
    } finally { vi.useRealTimers() }
    expect(localStorage.getItem(TOKEN_KEY)).toBe(storedSession('account-a'))
    expect(loadTranscript(A_SCENARIO)?.messages).toHaveLength(1)
    expect(renders.some((r) => !r.loading)).toBe(true) // PRECONDITION: the restore timeout fired and released the UI
  })

  it('V2 P1: a definitive failed restore is a lapse even when the SDK retained its token; A\'s private work is cleared', async () => {
    aLeftThisBrowserSignedIn()
    getSession.mockResolvedValue({ data: { session: null }, error: { message: 'network' } })
    await renderProvider()
    expect(localStorage.getItem(TOKEN_KEY)).toBe(storedSession('account-a'))
    expect(loadTranscript(A_SCENARIO)).toBeNull()
    expect(keysNamingA()).toEqual([])
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    expect(localStorage.getItem('olumi-canvas-identity-epoch')).toMatch(/\|owner:none$/)
  })

  it('CONTRAST — the restore succeeds (the same person): nothing runs, A\'s work stays', async () => {
    aLeftThisBrowserSignedIn()
    getSession.mockResolvedValue({ data: { session: session('account-a') }, error: null })
    await renderProvider()
    expect(loadTranscript(A_SCENARIO)?.messages).toHaveLength(1)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBe('1')
  })

  it('CONTRAST — a guest who never signed in: nothing runs, their work stays', async () => {
    saveTranscript(GUEST_SCENARIO, [message('A guest who never signed in.')])
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    await renderProvider()
    expect(loadTranscript(GUEST_SCENARIO)?.messages).toHaveLength(1)
  })
})

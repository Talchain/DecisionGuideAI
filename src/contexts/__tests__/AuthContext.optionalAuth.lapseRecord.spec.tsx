/**
 * LAPSE-BOUNDARY × the auth provider (Codex, #2530 r1 P1-2 and r2): after an identity boundary on a page, the thin
 * predicate is latched and never answers afresh, so a NEW sign-in on that same page is recorded by the provider's
 * adoption of the session. Only adoption: a stored token or the canvas mirror can outlive a sign-out (r2's false lapse).
 *
 * Driven through the REAL provider in the deployed posture, Supabase mocked at its transport (as
 * `AuthContext.optionalAuth.identityBoundary.spec.tsx`, which still pins the FIRST sign-in byte-identical).
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
const supabaseSignOut = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signOut: supabaseSignOut, signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() } },
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

const SCENARIO = 'bbbbbbbb-1111-4111-8111-111111111111'
const session = (id: string) => ({ user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {} }, access_token: `fixture-${id}` })
const message = (content: string): ConversationMessage =>
  ({ id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date('2026-10-05T17:00:00Z') }) as ConversationMessage

async function renderProvider(): Promise<{ fire: (event: string, s: unknown) => Promise<void>; signOut: () => Promise<unknown> }> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  let signOut: (() => Promise<unknown>) | undefined
  let owner: string | undefined
  function Probe() {
    const auth = useAuth()
    signOut = auth.signOut
    owner = auth.user?.id
    return null
  }
  await act(async () => {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
  })
  expect(owner, 'each case must actually adopt A before testing its session boundary').toBe('account-a')
  const callback = onAuthStateChange.mock.calls[0][0] as (event: string, s: unknown) => void
  return {
    fire: async (event, s) => { await act(async () => { callback(event, s) }) },
    signOut: async () => { let r: unknown; await act(async () => { r = await signOut!() }); return r },
  }
}

describe('LAPSE-BOUNDARY × provider: a sign-in adopted after a boundary on this page is recorded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    // This file keeps one module registry: clearing disk alone leaves the preceding case's held epoch in memory,
    // which correctly rejects A's next bootstrap as unmatched. Establish the new case's own current page era first.
    crossIdentityBoundaryInThisTab('lapse-record-test-page', null)
    __resetLapseBoundaryForTests()
    __resetThinClientForTests()
    __resetPersistenceSessionForTests()
    __resetTranscriptTombstonesForTests()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    supabaseSignOut.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('⭐ A signs out, B signs in on the SAME page: B is recorded, so B\'s lapse is still a boundary', async () => {
    const { fire, signOut } = await renderProvider()
    await signOut() // the boundary
    await fire('SIGNED_OUT', null)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    await fire('SIGNED_IN', session('account-b'))
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBe('1')
    saveTranscript(SCENARIO, [message('B\'s notes.')])
    // B's session lapses (no sign-out); the next page boots.
    __resetTranscriptTombstonesForTests()
    expect(await runLapseBoundaryIfNeeded()).toBe(true)
    expect(loadTranscript(SCENARIO)).toBeNull()
  })

  it('A → B on this page (no sign-out between): the boundary runs, then B is recorded', async () => {
    const { fire } = await renderProvider()
    await fire('SIGNED_IN', session('account-b'))
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBe('1')
  })

  it('CONTROL: a sign-out with no new sign-in records nothing (the next guest boot is not a lapse)', async () => {
    const { fire, signOut } = await renderProvider()
    await signOut()
    await fire('SIGNED_OUT', null)
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
    expect(await runLapseBoundaryIfNeeded()).toBe(false)
  })

  it('CONTROL: a refresh of the same owner, with no boundary on the page, records nothing via the provider', async () => {
    const { fire } = await renderProvider()
    await fire('TOKEN_REFRESHED', session('account-a'))
    expect(localStorage.getItem(SIGNED_IN_HERE_KEY)).toBeNull()
  })
})

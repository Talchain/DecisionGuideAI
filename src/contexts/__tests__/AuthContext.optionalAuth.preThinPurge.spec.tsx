/**
 * GAP-3 × the auth provider (Codex, #2525 r1 P1-4): a page that BOOTS signed in removes the browser's pre-thin model
 * copies whichever route it opens. Before this, only a canvas asked the thin predicate, so a signed-in browser that
 * opened only Profile kept A's pre-#2511 slots for the next guest.
 *
 * Driven through the REAL provider in the deployed posture (`VITE_AUTH_MODE = "guest"`), Supabase mocked at its
 * transport, nothing else mounted: no canvas, no other caller of the predicate. Imports only modules that exist on the
 * base, so the boot row is RED there. The first-sign-in non-boundary (storage byte-identical) is pinned, unchanged, in
 * `AuthContext.optionalAuth.identityBoundary.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { loadAutosave, saveAutosave } from '../../canvas/store/scenarios'
import { __resetThinClientForTests } from '../../canvas/thinClient/thinClient'
import { __resetPersistenceSessionForTests } from '../../lib/persistenceSession'

const getSession = vi.fn()
const onAuthStateChange = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signOut: vi.fn(), signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() } },
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

const MAIN = 'olumi-canvas-autosave'
const A_LABEL = 'Enterprise prospect signing likelihood'
const STORED_SESSION_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const STORED_SESSION = JSON.stringify({ access_token: 'fixture', refresh_token: 'fixture-r', user: { id: 'account-a' } })
const DECISION_RECORD_OWNER = 'decisionRecord.v2:owner'
const allKeys = (): string[] => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string)
const snapshot = () =>
  Object.fromEntries(allKeys().filter((k) => k !== DECISION_RECORD_OWNER).sort().map((k) => [k, localStorage.getItem(k)]))

/** A's model as a pre-#2511 signed-in page wrote it: the real writer, before the first boundary (unstamped). */
function seedPreThinSlot(): void {
  saveAutosave({
    timestamp: Date.now() + Math.random(),
    scenarioId: 'aaaaaaaa-1111-4111-8111-111111111111',
    nodes: [{ id: 'enterprise_prospect_signing_likelihood', type: 'factor', position: { x: 0, y: 0 }, data: { label: A_LABEL } }] as never,
    edges: [],
  })
  expect(localStorage.getItem(MAIN)).toContain(A_LABEL) // PRECONDITION: the real writer wrote it
}

/** A page with no canvas (the Profile shape): only the provider is mounted. */
async function bootPageWithoutCanvas(): Promise<void> {
  const { AuthProvider } = await import('../AuthContext')
  await act(async () => {
    render(<MemoryRouter><AuthProvider><div>Profile</div></AuthProvider></MemoryRouter>)
  })
}

describe('GAP-3 × auth provider: a page that boots signed in purges, whatever it renders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    __resetThinClientForTests()
    __resetPersistenceSessionForTests()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('PRECONDITION: the deployed guest posture', async () => {
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
  })

  it('a page with a stored session and no canvas removes A\'s pre-thin slot; a later guest restores nothing', async () => {
    seedPreThinSlot()
    localStorage.setItem(STORED_SESSION_KEY, STORED_SESSION)
    getSession.mockResolvedValue({ data: { session: { user: { id: 'account-a', email: 'a@example.com', app_metadata: {}, user_metadata: {} }, access_token: 'fixture' } } })
    await bootPageWithoutCanvas()
    expect(localStorage.getItem(MAIN)).toBeNull()

    // The session then lapses with no sign-out; the next page is a guest's.
    localStorage.removeItem(STORED_SESSION_KEY)
    __resetThinClientForTests()
    __resetPersistenceSessionForTests()
    expect(loadAutosave()).toBeNull()
    expect(allKeys().filter((k) => (localStorage.getItem(k) ?? '').includes(A_LABEL))).toEqual([])
  })

  it('CONTRAST: a guest page boots with no stored session — the provider touches nothing (byte-identical)', async () => {
    seedPreThinSlot()
    getSession.mockResolvedValue({ data: { session: null } })
    const before = snapshot()
    await bootPageWithoutCanvas()
    expect(snapshot()).toEqual(before)
    expect(loadAutosave()?.nodes).toHaveLength(1) // still the guest's own slot
  })
})

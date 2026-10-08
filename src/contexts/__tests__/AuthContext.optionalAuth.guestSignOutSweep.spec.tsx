/**
 * P48 E (8 Oct 2026) — a GUEST's explicit Sign out is an identity boundary.
 *
 * Witnessed on staging (UI 044f1a2d): guest A chats, presses Account menu → Sign out, the next person presses
 * "Continue without an account" — the screen is clean, but A's transcript (`olumi-canvas-transcript`, keyed by A's
 * scenario) and `olumi.guestWork.v1:<A>` (with A's words) were still in localStorage. `OptionalAuthProvider.signOut`
 * returned at once when there was no session, so the one boundary (`clearUserScopedState` → `sweepUserScopedStorage`,
 * which already enumerates every user-scoped key and prefix) never ran.
 *
 * DL ruling: purge on an explicit Sign out ONLY. "Continue without an account" is never a boundary — a browser cannot
 * tell a returning guest from a new one, so purging there would wipe the returning guest's own work (CONTROL row 2).
 *
 * Driven through the REAL provider with the Supabase client mocked at its transport, as the sibling
 * `AuthContext.optionalAuth.identityBoundary.spec.tsx`. Bound by storage (no key holds A's marker or A's id), not by a
 * spy alone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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
const boundary = vi.hoisted(() => ({ calls: 0, owners: [] as Array<string | null | undefined> }))
vi.mock('../../lib/auth/userScopedState', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/auth/userScopedState')>()
  return {
    ...real,
    clearUserScopedState: (nextOwner?: string | null) => {
      boundary.calls += 1
      boundary.owners.push(nextOwner)
      real.clearUserScopedState(nextOwner)
    },
  }
})

const A_SID = 'f6da8174-d3f3-4db6-978c-62ac076fd870'
const MARKER = 'Isolation marker Q7 heron'
const EPOCH = 'olumi-canvas-identity-epoch'
const DECISION_RECORD_OWNER = 'decisionRecord.v2:owner'

/** The keys witnessed holding guest A's work after A's Sign out (p48-iso-c, 8 Oct), in their served shapes. */
function seedGuestA(): void {
  localStorage.setItem('olumi-canvas-current-scenario-id', A_SID)
  localStorage.setItem('olumi-canvas-autosave', JSON.stringify({ timestamp: 1_000, scenarioId: A_SID, nodes: [], edges: [] }))
  localStorage.setItem('olumi-canvas-transcript', JSON.stringify({ [A_SID]: { savedAt: '2026-10-08T10:10:58.669Z', messages: [{ id: 'm1', role: 'user', content: MARKER }] } }))
  localStorage.setItem(`olumi.guestWork.v1:${A_SID}`, JSON.stringify({ scenarioId: A_SID, title: 'Grow quarterly revenue', firstMessage: MARKER }))
  localStorage.setItem(`olumi.guestWorkSeen.v1:${A_SID}`, '1')
  localStorage.setItem('olumi.import.serverAcknowledged.v1', JSON.stringify({ scenarioId: A_SID }))
}
const keysHoldingA = () =>
  Object.keys(localStorage).filter(k => k.includes(A_SID) || (localStorage.getItem(k) ?? '').includes(A_SID) || (localStorage.getItem(k) ?? '').includes(MARKER))
const snapshot = () =>
  Object.fromEntries(Object.keys(localStorage).filter(k => k !== DECISION_RECORD_OWNER).sort().map(k => [k, localStorage.getItem(k)]))
const session = (id: string) => ({ user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {} }, access_token: 'fixture' })

async function renderGuestProvider(): Promise<{ signOut: () => Promise<unknown> }> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  let signOut: (() => Promise<unknown>) | undefined
  function Probe() {
    signOut = useAuth().signOut
    return null
  }
  await act(async () => {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
  })
  return { signOut: async () => { let r: unknown; await act(async () => { r = await signOut!() }); return r } }
}

describe('P48 E: a guest\'s explicit Sign out sweeps the guest\'s browser state', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    boundary.calls = 0
    boundary.owners = []
    const { __resetLapseBoundaryForTests } = await import('../../lib/auth/lapseBoundary')
    __resetLapseBoundaryForTests()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    supabaseSignOut.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('PRECONDITION: the guest posture, and the seed really holds A (the absence below is not vacuous)', async () => {
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
    seedGuestA()
    expect(keysHoldingA().length).toBeGreaterThanOrEqual(6)
  })

  it('⭐ guest A presses Sign out → no key in this browser holds A\'s words or A\'s scenario id; a fresh epoch is written', async () => {
    const { signOut } = await renderGuestProvider()
    seedGuestA()
    const result = await signOut()
    expect(result).toEqual({ error: null })
    expect(boundary.calls).toBe(1)
    expect(boundary.owners).toEqual([null])
    expect(keysHoldingA()).toEqual([])
    expect(localStorage.getItem(EPOCH)).toBeTruthy()
    // Still nothing to sign out of at Supabase: the guest had no session.
    expect(supabaseSignOut).not.toHaveBeenCalled()
  })

  it('CONTROL: a returning guest who did NOT sign out keeps their own work across a reload (no boundary on boot)', async () => {
    seedGuestA()
    const before = snapshot()
    await renderGuestProvider()
    cleanup()
    await renderGuestProvider() // the reload: a fresh mount of the same browser
    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
  })

  it('CONTROL: a signed-in user\'s keys survive their own reload (a same-owner restore is not a boundary)', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    await renderGuestProvider()
    seedGuestA()
    const before = snapshot()
    cleanup()
    await renderGuestProvider()
    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
  })
})

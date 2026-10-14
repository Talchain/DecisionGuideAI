/**
 * CAN-F2w — the identity boundary in the GUEST posture (the deployed staging posture, `VITE_AUTH_MODE = "guest"`).
 *
 * Codex (#2484): `OptionalAuthProvider.adopt` exposed the next identity without clearing the previous one's state or
 * rotating the autosave epoch, so after A → B (or A → none, another tab signing out) A's model stayed restorable for
 * B. The real-auth provider has had that boundary (`lastSignedInUserId`); this one had none.
 *
 * Driven through the REAL provider with the Supabase client mocked at its transport. Bound by the boundary's own
 * effects on storage (the epoch key, A's autosave slot), not by a spy alone. The two NON-boundaries (a first sign-in,
 * a same-owner refresh) must leave storage BYTE-IDENTICAL (DL 0df0e1 condition).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
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
const boundary = vi.hoisted(() => ({ calls: 0 }))
vi.mock('../../lib/auth/userScopedState', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/auth/userScopedState')>()
  return {
    ...real,
    clearUserScopedState: (nextOwner?: string | null) => {
      boundary.calls += 1
      real.clearUserScopedState(nextOwner)
    },
  }
})

const EPOCH = 'olumi-canvas-identity-epoch'
const MAIN = 'olumi-canvas-autosave'
const A_SLOT = JSON.stringify({ timestamp: 1_000, scenarioId: 'aaaaaaaa-1111-4111-8111-111111111111', nodes: [], edges: [] })
const session = (id: string) => ({ user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {} }, access_token: 'fixture' })
/**
 * Every key, except the decision-record store's own owner record: `observeDecisionRecordOwner` rewrites it on EVERY
 * sign-in, before and after this change (its own owner tracking, #2469), so it is not the boundary's to keep.
 */
const DECISION_RECORD_OWNER = 'decisionRecord.v2:owner'
const snapshot = () =>
  Object.fromEntries(Object.keys(localStorage).filter((k) => k !== DECISION_RECORD_OWNER).sort().map((k) => [k, localStorage.getItem(k)]))

async function renderGuestProvider(): Promise<{ fire: (event: string, s: unknown) => Promise<void>; signOut: () => Promise<unknown> }> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  let signOut: (() => Promise<unknown>) | undefined
  function Probe() {
    signOut = useAuth().signOut
    return null
  }
  await act(async () => {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
  })
  expect(onAuthStateChange).toHaveBeenCalledTimes(1)
  const callback = onAuthStateChange.mock.calls[0][0] as (event: string, s: unknown) => void
  return {
    fire: async (event, s) => { await act(async () => { callback(event, s) }) },
    signOut: async () => { let r: unknown; await act(async () => { r = await signOut!() }); return r },
  }
}

describe('CAN-F2w × guest posture: the identity boundary', () => {
  // ONE module instance for the whole file (no `vi.resetModules`): the boundary under test and the page's epoch must be
  // the same `scenarios` module, as they are in a real page. Each case starts as a fresh page load instead.
  beforeEach(async () => {
    vi.clearAllMocks() // each case fires ITS OWN provider's callback, never a previous case's
    localStorage.clear()
    boundary.calls = 0
    // A fresh page load also starts with no boundary seen on it (`lapseBoundary.ts` keeps that per page).
    const { __resetLapseBoundaryForTests } = await import('../../lib/auth/lapseBoundary')
    __resetLapseBoundaryForTests()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    supabaseSignOut.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('PRECONDITION: the guest posture', async () => {
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
  })

  it('⭐ A → B on this page is a boundary: A\'s slot is gone and a fresh epoch is written before B is exposed', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    expect(boundary.calls).toBe(0)
    await fire('SIGNED_IN', session('account-b'))
    expect(boundary.calls).toBe(1)
    expect(localStorage.getItem(MAIN)).toBeNull()
    expect(localStorage.getItem(EPOCH)).toBeTruthy()
  })

  it('⭐ A → B: the cleanup runs BEFORE B is observed, so B owns its decision records (Codex final round P0)', async () => {
    // The boundary resets the decision-record store, whose reset returns its owner to null. Observing B first and
    // cleaning after left B's next record captured as ownerId:null — refused on commit, and erased on B's next load.
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    await fire('SIGNED_IN', session('account-b'))
    expect(boundary.calls).toBe(1)
    expect(JSON.parse(localStorage.getItem(DECISION_RECORD_OWNER) ?? 'null')?.ownerId).toBe('account-b')
  })

  it('⭐ A → none (the session ended in another tab) is a boundary', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    await fire('SIGNED_OUT', null)
    expect(boundary.calls).toBe(1)
    expect(localStorage.getItem(MAIN)).toBeNull()
    expect(localStorage.getItem(EPOCH)).toBeTruthy()
  })

  it('CONTROL: a FIRST sign-in (guest → A) is not a boundary — storage is byte-identical, the guest\'s work stays', async () => {
    const { fire } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    localStorage.setItem('olumi-canvas-current-scenario-id', 'aaaaaaaa-1111-4111-8111-111111111111')
    const before = snapshot()
    await fire('SIGNED_IN', session('account-a'))
    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
    expect(localStorage.getItem(EPOCH)).toBeNull()
  })

  it('a first sign-in adopts an epoch another tab rotated, without sweeping the guest\'s work', async () => {
    const { crossIdentityBoundaryInThisTab, epochThisTabMayWriteUnder } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('this-tab-before-rotation', null)
    localStorage.setItem(MAIN, A_SLOT)
    localStorage.setItem(EPOCH, 'another-tab-boundary|owner:none')
    const before = snapshot()

    boundary.calls = 0
    const { fire } = await renderGuestProvider()
    await fire('SIGNED_IN', session('account-a'))

    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
    expect(epochThisTabMayWriteUnder(), 'the signed-in tab remained stale and unable to save').toEqual({
      epoch: 'another-tab-boundary|owner:none',
    })
  })

  it('CONTROL: a same-owner refresh (A → A) is not a boundary — storage is byte-identical', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    const before = snapshot()
    await fire('TOKEN_REFRESHED', session('account-a'))
    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
  })

  it('an explicit sign-out runs the boundary ONCE (its own SIGNED_OUT event does not rotate the epoch again)', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire, signOut } = await renderGuestProvider()
    await signOut()
    const epoch = localStorage.getItem(EPOCH)
    await fire('SIGNED_OUT', null)
    expect(boundary.calls).toBe(1)
    expect(localStorage.getItem(EPOCH)).toBe(epoch)
  })
})

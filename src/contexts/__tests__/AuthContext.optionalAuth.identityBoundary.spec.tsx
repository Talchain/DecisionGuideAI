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
import React from 'react'

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
  return { ...real, clearUserScopedState: () => { boundary.calls += 1; real.clearUserScopedState() } }
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
  const callback = onAuthStateChange.mock.calls[0][0] as (event: string, s: unknown) => void
  return {
    fire: async (event, s) => { await act(async () => { callback(event, s) }) },
    signOut: async () => { let r: unknown; await act(async () => { r = await signOut!() }); return r },
  }
}

describe('CAN-F2w × guest posture: the identity boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    boundary.calls = 0
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

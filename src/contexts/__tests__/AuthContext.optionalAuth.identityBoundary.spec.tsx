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
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const supabaseSignOut = vi.fn()
const supabaseSignInWithPassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signOut: supabaseSignOut, signInWithPassword: supabaseSignInWithPassword, signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() } },
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

async function renderGuestProvider(): Promise<{ fire: (event: string, s: unknown) => Promise<void>; signOut: () => Promise<unknown>; signIn: (id: string) => Promise<void> }> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  let signOut: (() => Promise<unknown>) | undefined
  let signIn: ((email: string, password: string) => Promise<unknown>) | undefined
  function Probe() {
    const auth = useAuth()
    signOut = auth.signOut
    signIn = auth.signInWithPassword
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
    signIn: async id => {
      supabaseSignInWithPassword.mockImplementationOnce(async () => {
        callback('SIGNED_IN', session(id))
        return { data: { session: session(id) }, error: null }
      })
      await act(async () => { await signIn!(`${id}@example.com`, 'fixture-password') })
    },
  }
}

describe('CAN-F2w × guest posture: the identity boundary', () => {
  // A fresh module registry models a fresh page and releases the document-lifetime observer lock between cases.
  beforeEach(async () => {
    vi.clearAllMocks() // each case fires ITS OWN provider's callback, never a previous case's
    vi.resetModules()
    vi.doMock('../../lib/auth/userScopedState', async () => {
      const real = await vi.importActual<typeof import('../../lib/auth/userScopedState')>('../../lib/auth/userScopedState')
      return { ...real, clearUserScopedState: (nextOwner?: string | null) => {
        boundary.calls += 1
        return real.clearUserScopedState(nextOwner)
      } }
    })
    localStorage.clear()
    sessionStorage.clear()
    const { crossIdentityBoundaryInThisTab } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('current-test-page', null)
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
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('PRECONDITION: the guest posture', async () => {
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
  })

  it('⭐ A → B on this page is a boundary: A\'s slot is gone and a fresh epoch is written before B is exposed', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { signIn } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    expect(boundary.calls).toBe(0)
    await signIn('account-b')
    expect(boundary.calls).toBe(1)
    expect(localStorage.getItem(MAIN)).toBeNull()
    expect(localStorage.getItem(EPOCH)).toBeTruthy()
  })

  it('⭐ A → B: the cleanup runs BEFORE B is observed, so B owns its decision records (Codex final round P0)', async () => {
    // The boundary resets the decision-record store, whose reset returns its owner to null. Observing B first and
    // cleaning after left B's next record captured as ownerId:null — refused on commit, and erased on B's next load.
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { signIn } = await renderGuestProvider()
    await signIn('account-b')
    expect(boundary.calls).toBe(1)
    expect(JSON.parse(localStorage.getItem(DECISION_RECORD_OWNER) ?? 'null')?.ownerId).toBe('account-b')
  })

  it('V2 P2: A → none relay locks, with no boundary or shared sweep', async () => {
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    const before = snapshot()
    await fire('SIGNED_OUT', null)
    expect(boundary.calls).toBe(0)
    expect(localStorage.getItem(MAIN)).toBe(A_SLOT)
    expect(snapshot()).toEqual(before)
    expect((await import('../../lib/auth/staleTabLock')).isStaleTabLocked()).toBe(true)
  })

  it('CONTROL: a FIRST sign-in (guest → A) is not a boundary — storage is byte-identical, the guest\'s work stays', async () => {
    const { signIn } = await renderGuestProvider()
    localStorage.setItem(MAIN, A_SLOT)
    localStorage.setItem('olumi-canvas-current-scenario-id', 'aaaaaaaa-1111-4111-8111-111111111111')
    const before = snapshot()
    await signIn('account-a')
    expect(boundary.calls).toBe(0)
    expect(snapshot()).toEqual(before)
    expect(localStorage.getItem(EPOCH)).toBe(before[EPOCH])
  })

  it('S-G2 buddy-r1: a first sign-in in an unmatched rotated era stays LOCKED, without sweeping guest work', async () => {
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
    expect(epochThisTabMayWriteUnder(), 'an unmatched first sign-in must stay LOCKED').toBeNull()
  })

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION', 'USER_UPDATED'])('S-G2 auth event %s: queued A session cannot join B era', async event => {
    const { crossIdentityBoundaryInThisTab, getIdentityWriteBlockReason } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('A-page', 'account-a')
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(EPOCH, 'another-tab-B|owner:account-b')
    localStorage.setItem(MAIN, A_SLOT)
    localStorage.setItem(DECISION_RECORD_OWNER, JSON.stringify({ ownerId: 'account-b', epoch: 'B-record-era' }))
    const before = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
    await fire(event, session('account-a'))
    expect(boundary.calls).toBe(0)
    expect(getIdentityWriteBlockReason(), 'queued A session reauthorized writes in B era').toBe('stale')
    expect(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])), 'rejected adoption must not change the current owner record').toEqual(before)
  })

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION', 'USER_UPDATED'])('V2 P2 auth event %s: matching diagnostic owner never adopts another tab epoch', async event => {
    const { crossIdentityBoundaryInThisTab, getIdentityWriteBlockReason } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('prior-page', null)
    const { fire } = await renderGuestProvider()
    localStorage.setItem(EPOCH, 'another-tab-A|owner:account-a')
    await fire(event, session('account-a'))
    expect(boundary.calls).toBe(0)
    expect(getIdentityWriteBlockReason()).toBe('stale')
    expect((await import('../../lib/auth/staleTabLock')).isStaleTabLocked()).toBe(true)
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

  it('S-G2 background neighbour: delayed SIGNED_OUT after guest first-sign-in B preserves B decision owner and record', async () => {
    const { crossIdentityBoundaryInThisTab } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('old-A-tab', 'account-a')
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    // Another tab signs A out, then the current guest first-signs-in as B. First sign-in keeps the guest era.
    localStorage.setItem(EPOCH, 'current-guest-era|owner:none')
    const { observeDecisionRecordOwner, useDecisionRecordStore } = await import('../../components/results/modals/decisionRecordStore')
    observeDecisionRecordOwner('account-b') // the real owner adoption called by B's first SIGNED_IN
    const record = { optionId: 'B-option', optionLabel: 'B reasoning', optionNumber: 1, confidence: 70,
      rationale: 'B words', expectation: 'B expectation', assumptionToWatch: 'B assumption',
      revisitTrigger: '2026-12-01', analysisHash: 'B-hash', savedAt: 1234, remote: null }
    expect(useDecisionRecordStore.getState().saveRecord('B-scenario', record)).not.toBeNull()
    const before = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))

    await fire('SIGNED_OUT', null) // a suspended A tab finally receives the original sign-out

    expect(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
      'observer lock must not revoke B or erase the current record').toEqual(before)
    expect(useDecisionRecordStore.getState().byScenario, 'the stale tab resets only its own memory').toEqual({})
    observeDecisionRecordOwner('account-b')
    expect(useDecisionRecordStore.getState().byScenario['B-scenario']).toEqual(record)
  })

  it('V2 P2: relayed A→B locks and cannot adopt or write B decision records', async () => {
    const { crossIdentityBoundaryInThisTab } = await import('../../canvas/store/scenarios')
    crossIdentityBoundaryInThisTab('old-A-tab', 'account-a')
    getSession.mockResolvedValue({ data: { session: session('account-a') } })
    const { fire } = await renderGuestProvider()
    localStorage.setItem(EPOCH, 'current-B-era|owner:account-b')
    const { observeDecisionRecordOwner, useDecisionRecordStore } = await import('../../components/results/modals/decisionRecordStore')
    observeDecisionRecordOwner('account-b')
    const record = { optionId: 'B-option', optionLabel: 'B reasoning', optionNumber: 1, confidence: 70,
      rationale: 'B words', expectation: 'B expectation', assumptionToWatch: 'B assumption',
      revisitTrigger: '2026-12-01', analysisHash: 'B-hash', savedAt: 1234, remote: null }
    expect(useDecisionRecordStore.getState().saveRecord('B-scenario', record)).not.toBeNull()
    localStorage.setItem('olumi-signed-in-here.v1', '1') // B's existing sign-in also records the lapse marker
    const before = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
    await fire('SIGNED_IN', session('account-b'))
    expect(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))).toEqual(before)
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    expect((await import('../../lib/auth/staleTabLock')).isStaleTabLocked()).toBe(true)
    expect(useDecisionRecordStore.getState().saveRecord('B-scenario', { ...record, rationale: 'B next words' })).toBeNull()
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

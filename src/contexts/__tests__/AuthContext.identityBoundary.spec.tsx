/**
 * S-G2 round 2: require-login uses the real AuthProvider. A null-session boot is not a session ending on this page.
 * Each fresh module registry is one tab, with its own held epoch and provider history; localStorage is shared.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const supabaseSignOut = vi.fn()
const supabaseSignInWithPassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signOut: supabaseSignOut, signInWithPassword: supabaseSignInWithPassword } },
  getProfile: vi.fn(async () => ({ data: null, error: null })),
  getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })),
}))
vi.mock('../../lib/monitoring', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/monitoring')>()),
  setSentryUser: vi.fn(), clearSentryUser: vi.fn(),
}))
vi.mock('../../lib/posthog', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/posthog')>()),
  identifyUser: vi.fn(), resetPostHog: vi.fn(), trackEvent: vi.fn(),
}))

const EPOCH = 'olumi-canvas-identity-epoch'
const MAIN = 'olumi-canvas-autosave'
const GUEST_EPOCH = 'held-guest-era|owner:none'
const session = (id: string) => ({
  user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {} }, access_token: 'fixture',
})
const graph = {
  scenarioId: 'cccccccc-0000-4000-8000-00000000000c',
  nodes: [{ id: 'guest-work', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'Guest work' } }],
  edges: [], timestamp: 1234,
} as import('../../canvas/store/scenarios').AutosaveData

async function bootTab(initialSession: ReturnType<typeof session> | null = null, failedStoredRestore = false, retainStoredToken = false) {
  vi.resetModules()
  if (failedStoredRestore) {
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify({ access_token: 'stored-A', refresh_token: 'stored-A-refresh' }))
    localStorage.setItem('olumi-signed-in-here.v1', '1')
    getSession.mockImplementation(async () => {
      if (!retainStoredToken) localStorage.removeItem('sb-fixture-auth-token')
      return { data: { session: null }, error: new Error('restore failed') }
    })
  } else getSession.mockResolvedValue({ data: { session: initialSession } })
  const callbackIndex = onAuthStateChange.mock.calls.length
  const scenarios = await import('../../canvas/store/scenarios')
  const lock = await import('../../lib/auth/staleTabLock')
  const { AuthProvider, useAuth } = await import('../AuthContext')
  const { isGuestAuth } = await import('../../lib/poc')
  expect(isGuestAuth).toBe(localStorage.getItem('feature.requireLogin') !== '1')
  let signOut: (() => Promise<unknown>) | undefined
  let signIn: ((email: string, password: string) => Promise<unknown>) | undefined
  let owner: string | null = null
  function Probe() {
    const auth = useAuth()
    signOut = auth.signOut
    signIn = auth.signInWithPassword
    owner = auth.user?.id ?? null
    return null
  }
  await act(async () => { render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>) })
  const callback = onAuthStateChange.mock.calls[callbackIndex]?.[0] as (event: string, s: unknown) => void
  expect(callback).toBeTypeOf('function')
  return {
    scenarios, lock,
    owner: () => owner,
    fire: async (event: string, s: unknown) => { await act(async () => { callback(event, s) }) },
    signOut: async () => { await act(async () => { await signOut!() }) },
    signIn: async (id: string) => {
      supabaseSignInWithPassword.mockImplementationOnce(async () => {
        callback('SIGNED_IN', session(id))
        return { data: { session: session(id) }, error: null }
      })
      await act(async () => { await signIn!(`${id}@example.com`, 'fixture-password') })
    },
  }
}

describe('S-G2 × real AuthProvider identity boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('feature.requireLogin', '1')
    localStorage.setItem(EPOCH, GUEST_EPOCH)
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    supabaseSignOut.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('R2 P0: opening a second signed-out require-login tab does not rotate or lock the first; it can save', async () => {
    const first = await bootTab()
    const beforeSecondBoot = localStorage.getItem(EPOCH)
    const second = await bootTab()
    await second.fire('INITIAL_SESSION', null)

    expect(localStorage.getItem(EPOCH), 'getSession(null) and INITIAL_SESSION(null) are not identity boundaries').toBe(beforeSecondBoot)
    expect(first.lock.checkStaleTabLock(), 'opening another signed-out tab wrongfully locked this tab').toBe(false)
    expect(first.scenarios.saveAutosave(graph), 'the first signed-out tab must remain able to save').toBe(true)
    expect(JSON.parse(localStorage.getItem(MAIN) ?? 'null')?.scenarioId).toBe(graph.scenarioId)
  }, 20_000)

  it('V2 P1 CONTROL: a never-signed-in null boot leaves guest work and epoch untouched', async () => {
    localStorage.setItem(MAIN, JSON.stringify(graph))
    await bootTab()
    expect(localStorage.getItem(MAIN), 'a null boot that never held a user is a no-op').toBe(JSON.stringify(graph))
    expect(localStorage.getItem(EPOCH)).toBe(GUEST_EPOCH)
  }, 20_000)

  for (const posture of ['real', 'optional'] as const) {
    for (const order of ['storage-first', 'SDK-relay-first'] as const) {
      it(`V2 Core ${posture} ${order}: own sign-out stays usable, observer locks without changing epoch or witness`, async () => {
        if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
        const acting = await bootTab(session('account-a'))
        const observer = await bootTab(session('account-a'))
        const before = localStorage.getItem(EPOCH)
        await acting.signOut()
        const after = localStorage.getItem(EPOCH)
        expect(after).not.toBe(before)
        expect(after).toMatch(/\|owner:none$/)
        expect(acting.lock.checkStaleTabLock()).toBe(false)
        if (order === 'storage-first') expect(observer.lock.checkStaleTabLock()).toBe(true)
        const shared = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
        await observer.fire('SIGNED_OUT', null)
        expect(observer.lock.isStaleTabLocked(), 'SIGNED_OUT before the storage check must latch the observer lock').toBe(true)
        expect(observer.scenarios.getIdentityWriteBlockReason(), 'observer never joins the sign-out era').toBe('stale')
        expect(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])), 'observer never rotates or sweeps').toEqual(shared)
        expect(acting.lock.checkStaleTabLock()).toBe(false)
        expect(acting.scenarios.saveAutosave(graph)).toBe(true)
      }, 20_000)
    }

    it(`V2 P2 ${posture}: SIGNED_OUT before any epoch storage locks without rotating or sweeping`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const observer = await bootTab(session('account-a'))
      localStorage.setItem(MAIN, JSON.stringify(graph))
      const before = localStorage.getItem(EPOCH)
      await observer.fire('SIGNED_OUT', null)
      expect(observer.lock.isStaleTabLocked()).toBe(true)
      expect(localStorage.getItem(EPOCH)).toBe(before)
      expect(localStorage.getItem(MAIN)).toBe(JSON.stringify(graph))
    }, 20_000)

    it(`V2 P1 ${posture}: first stored-session restore lapse rotates owner:none and locks old A tabs`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const oldA = await bootTab(session('account-a'))
      const before = localStorage.getItem(EPOCH)
      const detector = await bootTab(null, true)
      expect(localStorage.getItem(EPOCH)).not.toBe(before)
      expect(localStorage.getItem(EPOCH)).toMatch(/\|owner:none$/)
      expect(detector.lock.checkStaleTabLock()).toBe(false)
      expect(oldA.lock.checkStaleTabLock()).toBe(true)
    }, 20_000)

    it(`V2 P1 ${posture}: definitive failed restore rotates even if the SDK retained its stored token`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const oldA = await bootTab(session('account-a'))
      const before = localStorage.getItem(EPOCH)
      const detector = await bootTab(null, true, true)
      expect(localStorage.getItem('sb-fixture-auth-token')).not.toBeNull()
      expect(localStorage.getItem(EPOCH)).not.toBe(before)
      expect(localStorage.getItem(EPOCH)).toMatch(/\|owner:none$/)
      expect(detector.lock.checkStaleTabLock()).toBe(false)
      expect(oldA.lock.checkStaleTabLock()).toBe(true)
    }, 20_000)

    it(`V2 P1/P2 ${posture}: delayed SIGNED_OUT after a lapse leaves the current guest unlocked and its work untouched`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const oldA = await bootTab(session('account-a'))
      const detector = await bootTab(null, true)
      expect(detector.scenarios.saveAutosave(graph)).toBe(true)
      const before = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
      await oldA.fire('SIGNED_OUT', null)
      expect(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))).toEqual(before)
      expect(oldA.lock.isStaleTabLocked()).toBe(true)
      expect(detector.lock.checkStaleTabLock()).toBe(false)
      expect(detector.scenarios.saveAutosave(graph)).toBe(true)
    }, 20_000)

    it(`V2 ${posture} CONTROL: local first sign-in preserves guest work; another guest's relay locks`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const acting = await bootTab()
      const guestObserver = await bootTab()
      expect(acting.lock.checkStaleTabLock(), 'a second guest tab must not lock the first guest').toBe(false)
      expect(guestObserver.lock.checkStaleTabLock(), 'the second guest tab boots usable').toBe(false)
      localStorage.setItem(MAIN, JSON.stringify(graph))
      const epoch = localStorage.getItem(EPOCH)
      await acting.signIn('account-a')
      expect(acting.owner()).toBe('account-a')
      expect(acting.lock.checkStaleTabLock()).toBe(false)
      expect(localStorage.getItem(EPOCH)).toBe(epoch)
      expect(localStorage.getItem(MAIN)).toBe(JSON.stringify(graph))
      await guestObserver.fire('SIGNED_IN', session('account-a'))
      expect(guestObserver.lock.isStaleTabLocked()).toBe(true)
      expect(localStorage.getItem(EPOCH)).toBe(epoch)
      expect(localStorage.getItem(MAIN)).toBe(JSON.stringify(graph))
    }, 20_000)

    it(`V2 ${posture} CONTROL: fresh boot, refresh, own sign-out and reload stay usable`, async () => {
      if (posture === 'optional') localStorage.removeItem('feature.requireLogin')
      const acting = await bootTab(session('account-a'))
      const epoch = localStorage.getItem(EPOCH)
      expect(acting.lock.checkStaleTabLock()).toBe(false)
      await acting.fire('TOKEN_REFRESHED', session('account-a'))
      expect(localStorage.getItem(EPOCH)).toBe(epoch)
      expect(acting.lock.checkStaleTabLock()).toBe(false)
      await acting.signOut()
      const signedOutEpoch = localStorage.getItem(EPOCH)
      await acting.fire('SIGNED_OUT', null)
      expect(localStorage.getItem(EPOCH)).toBe(signedOutEpoch)
      expect(acting.lock.checkStaleTabLock()).toBe(false)
      const reloaded = await bootTab()
      expect(reloaded.lock.checkStaleTabLock()).toBe(false)
      expect(reloaded.scenarios.saveAutosave(graph)).toBe(true)
    }, 20_000)
  }

  it('V2 P1: the loaded bootstrap lapse rotates owner:none and locks an old tab', async () => {
    const old = await bootTab(session('account-a'))
    vi.resetModules()
    const { SIGNED_IN_HERE_KEY, runLapseBoundaryIfNeeded } = await import('../../lib/auth/lapseBoundary')
    const boundary = await import('../../lib/auth/userScopedState')
    localStorage.setItem(SIGNED_IN_HERE_KEY, '1')
    const before = localStorage.getItem(EPOCH)
    expect(await runLapseBoundaryIfNeeded(async () => boundary)).toBe(true)
    expect(localStorage.getItem(EPOCH)).not.toBe(before)
    expect(localStorage.getItem(EPOCH)).toMatch(/\|owner:none$/)
    expect(old.lock.checkStaleTabLock()).toBe(true)
  }, 20_000)
})

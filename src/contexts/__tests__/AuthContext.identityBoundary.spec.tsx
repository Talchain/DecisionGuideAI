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

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signOut: supabaseSignOut } },
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

async function bootTab(initialSession: ReturnType<typeof session> | null = null) {
  vi.resetModules()
  getSession.mockResolvedValue({ data: { session: initialSession } })
  const callbackIndex = onAuthStateChange.mock.calls.length
  const scenarios = await import('../../canvas/store/scenarios')
  const lock = await import('../../lib/auth/staleTabLock')
  const { AuthProvider, useAuth } = await import('../AuthContext')
  const { isGuestAuth } = await import('../../lib/poc')
  expect(isGuestAuth, 'this must exercise the real require-login provider').toBe(false)
  let signOut: (() => Promise<unknown>) | undefined
  let owner: string | null = null
  function Probe() {
    const auth = useAuth()
    signOut = auth.signOut
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

  it('R2 CONTROL: null boot keeps the existing local sweep, while leaving its epoch untouched', async () => {
    localStorage.setItem(MAIN, JSON.stringify(graph))
    await bootTab()
    expect(localStorage.getItem(MAIN), 'the pre-existing null-session local sweep remains in scope').toBeNull()
    expect(localStorage.getItem(EPOCH)).toBe(GUEST_EPOCH)
  }, 20_000)

  it('R2 CONTROL: first sign-in does not retag the guest era; A signing out still locks A in the other tab', async () => {
    const first = await bootTab()
    const second = await bootTab()
    const beforeSignIn = localStorage.getItem(EPOCH)
    await first.fire('SIGNED_IN', session('account-a'))
    await second.fire('SIGNED_IN', session('account-a'))
    expect(first.owner()).toBe('account-a')
    expect(second.owner()).toBe('account-a')
    expect(localStorage.getItem(EPOCH)).toBe(beforeSignIn)
    expect(localStorage.getItem(EPOCH)).toMatch(/\|owner:none$/)

    await first.signOut()
    const afterSignOut = localStorage.getItem(EPOCH)
    expect(afterSignOut).not.toBe(beforeSignIn)
    expect(first.lock.checkStaleTabLock()).toBe(false)
    expect(second.lock.checkStaleTabLock(), 'A signed out after first sign-in in a guest era; the other A tab must lock').toBe(true)

    await second.fire('SIGNED_OUT', null)
    expect(localStorage.getItem(EPOCH), 'SIGNED_OUT relay must still cross by joining the genuine sign-out era').toBe(afterSignOut)
    expect(second.lock.checkStaleTabLock(), 'joining after the lock latched cannot silently release it').toBe(true)
  }, 20_000)

  it('R2 CONTROL: a null auth relay after A was signed in on this page rotates and locks A in another tab', async () => {
    const first = await bootTab(session('account-a'))
    const second = await bootTab(session('account-a'))
    const before = localStorage.getItem(EPOCH)
    await first.fire('SIGNED_OUT', null)
    expect(localStorage.getItem(EPOCH)).not.toBe(before)
    expect(first.lock.checkStaleTabLock()).toBe(false)
    expect(second.lock.checkStaleTabLock()).toBe(true)
  }, 20_000)

  it('R2 CONTROL: the loaded bootstrap lapse still rotates its epoch and locks an old tab', async () => {
    const old = await bootTab(session('account-a'))
    vi.resetModules()
    const { SIGNED_IN_HERE_KEY, runLapseBoundaryIfNeeded } = await import('../../lib/auth/lapseBoundary')
    const boundary = await import('../../lib/auth/userScopedState')
    localStorage.setItem(SIGNED_IN_HERE_KEY, '1')
    const before = localStorage.getItem(EPOCH)
    expect(await runLapseBoundaryIfNeeded(async () => boundary)).toBe(true)
    expect(localStorage.getItem(EPOCH)).not.toBe(before)
    expect(old.lock.checkStaleTabLock()).toBe(true)
  }, 20_000)
})

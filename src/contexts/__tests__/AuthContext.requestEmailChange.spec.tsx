/**
 * The REAL AuthContext.requestEmailChange, through the REAL provider in the DEPLOYED posture (VITE_AUTH_MODE=guest →
 * OptionalAuthProvider), with only the supabase client replaced (DL CR P2 on #2434). It must call
 * `supabase.auth.updateUser` with exactly `({ email }, { emailRedirectTo: <origin>/#/auth/confirm })` and hand back
 * Supabase's error object itself, not a copy or a success.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const updateUser = vi.fn()
const getSession = vi.fn()
const onAuthStateChange = vi.fn()
let updateUserPresent = true

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      get updateUser() {
        return updateUserPresent ? updateUser : undefined
      },
      getSession,
      onAuthStateChange,
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
  getProfile: vi.fn(async () => ({ data: null, error: null })),
  getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })),
}))
vi.mock('../../lib/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/monitoring')>()),
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}))
vi.mock('../../lib/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/posthog')>()),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
  trackEvent: vi.fn(),
}))

async function realRequestEmailChange(): Promise<(email: string) => Promise<{ error: unknown }>> {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  const seen: { fn?: (email: string) => Promise<{ error: unknown }> } = {}
  function Probe() {
    seen.fn = useAuth().requestEmailChange
    return null
  }
  await act(async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    )
  })
  if (!seen.fn) throw new Error('requestEmailChange was not exposed')
  return seen.fn
}

describe('AuthContext.requestEmailChange (real provider, deployed guest posture)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    updateUserPresent = true
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('PRECONDITION: the deployed posture (isGuestAuth true)', async () => {
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
  })

  it('calls updateUser ONCE with exactly ({ email }, { emailRedirectTo: <origin>/#/auth/confirm })', async () => {
    const request = await realRequestEmailChange()
    expect(await request('new@olumi.test')).toEqual({ error: null })
    expect(updateUser.mock.calls).toEqual([[{ email: 'new@olumi.test' }, { emailRedirectTo: `${window.location.origin}/#/auth/confirm` }]])
  })

  it('hands back Supabase\'s OWN error object (identity), never a success', async () => {
    const supabaseError = Object.assign(new Error('rate limited'), { status: 429 })
    updateUser.mockResolvedValue({ data: { user: null }, error: supabaseError })
    const request = await realRequestEmailChange()
    const result = await request('new@olumi.test')
    expect(result.error).toBe(supabaseError)
  })

  it('a build without updateUser reports an error and calls nothing', async () => {
    updateUserPresent = false
    const request = await realRequestEmailChange()
    const result = await request('new@olumi.test')
    expect(result.error).toBeInstanceOf(Error)
    expect(updateUser).not.toHaveBeenCalled()
  })
})

/**
 * PR4 — OPTIONAL REAL AUTH: the guest posture must offer a REAL front door.
 *
 * ── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * `AuthProvider` short-circuited on `isGuestAuth` and handed the app a context
 * whose sign-in members were:
 *
 *     signInWithMagicLink: async () => ({ error: null })
 *     signInWithGoogle:    async () => ({ error: null })
 *
 * Staging deploys `VITE_AUTH_MODE = "guest"`, so those were the DEPLOYED
 * implementations. Both login buttons made no network call at all and reported
 * SUCCESS — `LoginPage` reads `{ error: null }` and renders "you'll receive a
 * sign-in link shortly" for an email that was never sent. A button that does
 * nothing may not report success.
 *
 * ── WHAT "OPTIONAL" MEANS, AND WHY EACH HALF NEEDS ITS OWN TEST ───────────
 * Two claims, two harms, so they are asserted separately (one predicate
 * guarding two opposite harms is the estate's recurring defect):
 *   • REAL   — a sign-in call reaches Supabase and its failure is propagated.
 *              Harm if wrong: the product lies about having sent an email.
 *   • OPTIONAL — a visitor who never signs in still gets the guest identity,
 *              `authenticated: true` and `loading: false` on the FIRST render.
 *              Harm if wrong: every guest is bounced to /login by AuthGuard and
 *              the whole PoC becomes unreachable.
 *
 * ── BINDING ───────────────────────────────────────────────────────────────
 * The assertions bind to the Supabase client method BY NAME (`signInWithOtp`,
 * `signInWithOAuth`) and to the returned error BY IDENTITY (the same object
 * reference the client produced), never by a value predicate some other object
 * could satisfy.
 *
 * ── STATE-CLASS ───────────────────────────────────────────────────────────
 * Fresh: `getSession` resolves to no session in every case here. The
 * session-adoption path is covered by its own case with an explicit session.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signInWithPassword = vi.fn()
const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const supabaseSignOut = vi.fn()

// ⚠ THIS EXISTS BECAUSE THE FIRST VERSION OF THE STUB-BUILD CASE WAS VACUOUS.
// It made `signInWithOtp` a spy that THREW, which is not what a stubbed build
// looks like: there the method is genuinely ABSENT, so the capability guard is
// what should fire. A throwing spy left the method present, exercised the catch
// block instead, and the test passed on the wrong object entirely. Toggling
// presence through a getter is the only way to model the real stub.
let otpMethodPresent = true
let oauthMethodPresent = true
let passwordMethodPresent = true

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      get signInWithOtp() {
        return otpMethodPresent ? signInWithOtp : undefined
      },
      get signInWithOAuth() {
        return oauthMethodPresent ? signInWithOAuth : undefined
      },
      get signInWithPassword() {
        return passwordMethodPresent ? signInWithPassword : undefined
      },
      getSession,
      onAuthStateChange,
      signOut: supabaseSignOut,
    },
  },
  getProfile: vi.fn(async () => ({ data: null, error: null })),
  getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })),
}))

// Boot-time side-effect modules the provider imports. Spread the original so
// this is not a hand-maintained allowlist that silently drops a new export.
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

/** Renders the real provider in the real guest posture and exposes the context. */
async function renderGuestProvider() {
  const { AuthProvider, useAuth } = await import('../AuthContext')

  const seen: {
    signInWithMagicLink?: (email: string) => Promise<{ error: unknown }>
    signInWithGoogle?: () => Promise<{ error: unknown }>
    signInWithPassword?: (email: string, password: string) => Promise<{ error: unknown }>
    signOut?: () => Promise<{ error: unknown }>
  } = {}

  function Probe() {
    const ctx = useAuth()
    seen.signInWithMagicLink = ctx.signInWithMagicLink
    seen.signInWithGoogle = ctx.signInWithGoogle
    seen.signInWithPassword = ctx.signInWithPassword
    seen.signOut = ctx.signOut
    return (
      <div>
        <span data-testid="user-id">{ctx.user?.id ?? 'none'}</span>
        <span data-testid="authenticated">{String(ctx.authenticated)}</span>
        <span data-testid="loading">{String(ctx.loading)}</span>
      </div>
    )
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

  return seen
}

describe('AuthContext × guest posture — the front door is REAL', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    // The deployed staging posture, verbatim from netlify.toml.
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    // Reset the presence toggles: a case that hid a method must not leak that
    // into the next one, or a later assertion passes for the wrong reason.
    otpMethodPresent = true
    oauthMethodPresent = true
    passwordMethodPresent = true
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    signInWithOtp.mockResolvedValue({ data: {}, error: null })
    signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    signInWithPassword.mockResolvedValue({ data: {}, error: null })
    supabaseSignOut.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('PRECONDITION: this test runs in the guest posture (isGuestAuth true)', async () => {
    // Pins the precondition IN-TEST. Without this the cases below could pass
    // by accidentally exercising the real-auth provider, and the suite would
    // be green about a branch it never entered.
    const { isGuestAuth } = await import('../../lib/poc')
    expect(isGuestAuth).toBe(true)
  })

  it('magic link calls supabase.auth.signInWithOtp — not a no-op', async () => {
    const ctx = await renderGuestProvider()
    await act(async () => {
      await ctx.signInWithMagicLink!('someone@example.com')
    })
    expect(signInWithOtp).toHaveBeenCalledTimes(1)
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'someone@example.com' }),
    )
  })

  it('magic link propagates the Supabase error BY IDENTITY — never reports success', async () => {
    // The exact shape staging returns today: HTTP 500, SMTP unconfigured.
    const smtpFailure = Object.assign(new Error('Error sending magic link email'), {
      status: 500,
      code: 'unexpected_failure',
    })
    signInWithOtp.mockResolvedValue({ data: {}, error: smtpFailure })

    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithMagicLink!('someone@example.com')
    })
    // Identity, not a value predicate: it must be the very object the client
    // produced, so a synthesised look-alike error cannot satisfy this.
    expect(result!.error).toBe(smtpFailure)
  })

  it('Google calls supabase.auth.signInWithOAuth with the google provider', async () => {
    const ctx = await renderGuestProvider()
    await act(async () => {
      await ctx.signInWithGoogle!()
    })
    expect(signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })

  it('Google propagates the Supabase error BY IDENTITY — never reports success', async () => {
    const providerDisabled = Object.assign(
      new Error('Unsupported provider: provider is not enabled'),
      { status: 400 },
    )
    signInWithOAuth.mockResolvedValue({ data: {}, error: providerDisabled })

    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithGoogle!()
    })
    expect(result!.error).toBe(providerDisabled)
  })

  /**
   * ── OWNER PASSWORD SIGN-IN (#667 review blocker 2) ────────────────────────
   * `callSignInWithPassword` shipped with ZERO coverage. The reviewer's mutant
   * R1 replaced its body's Supabase call with `const error = null; void
   * password;` — a silent-success no-op — and the whole suite stayed GREEN,
   * including all 15 cases of THIS file, whose own title is "the front door is
   * REAL". Complete manifest at the time (`rg -a signInWithPassword src`, 17
   * hits): every spec-side occurrence was a `vi.fn()` in the two LoginPage
   * specs, which mock this module wholesale. Nothing bound the context
   * implementation to Supabase.
   *
   * These are the password twins of the four magic-link/Google cases above,
   * written to the same rule: bind to the client method BY NAME and to the
   * returned error BY IDENTITY.
   */
  it('password sign-in calls supabase.auth.signInWithPassword — not a no-op', async () => {
    const ctx = await renderGuestProvider()
    await act(async () => {
      await ctx.signInWithPassword!('owner@example.com', 'correct-horse')
    })
    expect(signInWithPassword).toHaveBeenCalledTimes(1)
    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@example.com', password: 'correct-horse' }),
    )
  })

  it('password sign-in propagates the Supabase error BY IDENTITY — never reports success', async () => {
    // The exact shape Supabase returns for a wrong password AND for an unknown
    // address — one 400 for both, which is what makes the surface's single
    // failure state enumeration-safe.
    const badCredentials = Object.assign(new Error('Invalid login credentials'), {
      status: 400,
      code: 'invalid_credentials',
    })
    signInWithPassword.mockResolvedValue({ data: {}, error: badCredentials })

    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithPassword!('owner@example.com', 'wrong')
    })
    expect(result!.error).toBe(badCredentials)
  })

  it('a build whose Supabase client LACKS signInWithPassword reports UNAVAILABLE, never success', async () => {
    // ⚠ NOT hypothetical. `scripts/supabase-stub-decision.mjs` aliases the SDK
    // to `src/stubs/supabase-stub.mjs` on every guest build unless
    // `VITE_STUB_SUPABASE=0`, and `netlify.toml` sets that opt-out ONLY under
    // `[context.staging.environment]` — production inherits `[build.environment]`
    // alone. That stub USED TO implement `signInWithPassword` and answer
    // `{ error: null }`, converting the honest capability failure the other two
    // routes give into a silent success. The stub no longer implements it (that
    // absence is the mechanism); this pins the guard that makes the absence
    // honest rather than fatal.
    passwordMethodPresent = false
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithPassword!('owner@example.com', 'correct-horse')
    })
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(result!.error).toBeInstanceOf(Error)
    expect((result!.error as Error).message).toMatch(/unavailable in this build/i)
    // Same cross-module seam as the magic-link case: LoginPage consumes
    // `>= 500` to decide "our fault, say so" — and since round 2 it routes a
    // 501 to the server-fault copy rather than blaming the owner's password.
    expect((result!.error as { status?: number }).status).toBeGreaterThanOrEqual(500)
  })

  it('a password client that THROWS is classified as a fault, not as bad credentials', async () => {
    // A network failure or CSP block carries no `status`. Left bare it would
    // fall into the surface's enumeration-safe branch and be reported to the
    // owner as a wrong password — a fault dressed up as their mistake.
    signInWithPassword.mockImplementation(() => {
      throw new TypeError('Failed to fetch')
    })
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithPassword!('owner@example.com', 'correct-horse')
    })
    expect((result!.error as { status?: number }).status).toBeGreaterThanOrEqual(500)
  })

  it('the bundled stub implements NO sign-in method — absence is what keeps it honest', async () => {
    // A DERIVED guard on the artefact itself, not a mirror of it. The stub is
    // the module a production build actually gets; if a later edit adds any
    // sign-in method back, the capability guards above stop firing and a build
    // with no Supabase client starts reporting success again.
    const { createClient } = await import('../../stubs/supabase-stub.mjs')
    const auth = createClient().auth
    const signInMethods = Object.keys(auth).filter(k => /^signIn/i.test(k))
    expect(
      signInMethods,
      `the Supabase stub implements sign-in method(s) ${signInMethods.join(', ')} — on a stubbed build they cannot reach Supabase, so anything they return is a lie`,
    ).toEqual([])
    // Positive control: the probe can see methods when they exist.
    expect(Object.keys(auth)).toContain('getSession')
  })

  it('password signIn/signUp report the removal as an ERROR, not as guest success', async () => {
    const { AuthProvider, useAuth } = await import('../AuthContext')
    let captured: { error: unknown } | undefined
    function Probe() {
      const { signIn } = useAuth()
      React.useEffect(() => {
        void signIn('a@b.com', 'pw').then(r => {
          captured = r
        })
      }, [signIn])
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
    expect(captured!.error).toBeInstanceOf(Error)
  })

  it('a build whose Supabase client LACKS signInWithOtp reports UNAVAILABLE, never success', async () => {
    // src/stubs/supabase-stub.mjs implements NEITHER signInWithOtp NOR
    // signInWithOAuth — the method is ABSENT, not throwing. Modelling it as a
    // throwing spy would exercise the catch block and prove nothing about the
    // capability guard.
    otpMethodPresent = false
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithMagicLink!('someone@example.com')
    })
    expect(signInWithOtp).not.toHaveBeenCalled()
    expect(result!.error).toBeInstanceOf(Error)
    expect((result!.error as Error).message).toMatch(/unavailable in this build/i)
    // ⚠ CROSS-MODULE SEAM, pinned here because nothing else binds the two ends.
    // This module PRODUCES the status; `LoginPage.isServerFault` CONSUMES it as
    // `>= 500` to decide between "our fault, say so" and the enumeration-safe
    // link-sent branch. Two authorities answering two different questions with
    // nothing holding them together is how a fix gets silently un-made: drop
    // the status here and the surface would go back to reporting an
    // unavailable build as a sent email, with every test still green.
    expect((result!.error as { status?: number }).status).toBeGreaterThanOrEqual(500)
  })

  it('a client that THROWS is classified as a fault, not as a possible unknown address', async () => {
    // A network failure, a CSP block or a rejected promise carries no `status`.
    // Left bare, LoginPage's enumeration-safe default would file it under
    // "might be an unknown address" and report a sent link — the same lie, via
    // a different door. The catch block stamps 5xx so the surface can be honest.
    signInWithOtp.mockImplementation(() => {
      throw new TypeError('Failed to fetch')
    })
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithMagicLink!('someone@example.com')
    })
    expect((result!.error as { status?: number }).status).toBeGreaterThanOrEqual(500)
  })

  it('a RESOLVED 422 keeps its status — the enumeration-safe outcome is untouched', async () => {
    const unknownAddress = Object.assign(new Error('Signups not allowed for otp'), {
      status: 422,
      code: 'otp_disabled',
    })
    signInWithOtp.mockResolvedValue({ data: {}, error: unknownAddress })
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithMagicLink!('someone@example.com')
    })
    expect((result!.error as { status?: number }).status).toBe(422)
  })

  it('a THROWN 422 also keeps its status — asFault must not promote it to a server fault', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE A MUTANT SURVIVED. Deleting `asFault`'s
    // already-has-a-status guard left the whole suite GREEN: the resolved-422
    // case above never reaches `asFault` at all, because it returns through the
    // `if (error)` branch. supabase-js can REJECT rather than resolve, and on
    // that path an overwrite would make the page announce a server fault for
    // every unregistered address — the enumeration leak, reintroduced by the
    // very code written to stop the lie. The opposite-direction twin of the
    // thrown-network-error case; neither alone pins the guard.
    const thrown422 = Object.assign(new Error('Signups not allowed for otp'), {
      status: 422,
      code: 'otp_disabled',
    })
    signInWithOtp.mockImplementation(() => {
      throw thrown422
    })
    const ctx = await renderGuestProvider()
    let result: { error: unknown } | undefined
    await act(async () => {
      result = await ctx.signInWithMagicLink!('someone@example.com')
    })
    expect((result!.error as { status?: number }).status).toBe(422)
  })
})

describe('AuthContext × guest posture — auth stays OPTIONAL', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubEnv('VITE_AUTH_MODE', 'guest')
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('a visitor who never signs in keeps the guest identity and passes AuthGuard', async () => {
    await renderGuestProvider()
    expect(screen.getByTestId('user-id').textContent).toBe('guest')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
  })

  it('loading is false on the FIRST render — no auth spinner is ever shown to a guest', async () => {
    // AuthGuard renders a full-screen spinner while `loading` is true. A guest
    // build must never reach that state, not even for one frame, or the PoC
    // gains a flash of loading UI it does not have today.
    const { AuthProvider, useAuth } = await import('../AuthContext')
    const loadingByRender: boolean[] = []
    function Probe() {
      const { loading } = useAuth()
      loadingByRender.push(loading)
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
    expect(loadingByRender.length).toBeGreaterThan(0)
    expect(loadingByRender[0]).toBe(false)
    expect(loadingByRender).not.toContain(true)
  })

  it('a REAL session, when one exists, replaces the guest identity', async () => {
    // This is what makes the posture optional-but-real rather than
    // guest-forever: signing in has to actually change who you are.
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'real-user-uuid', email: 'real@example.com', app_metadata: {}, user_metadata: {} },
          access_token: 'irrelevant-here',
        },
      },
    })
    await renderGuestProvider()
    expect(screen.getByTestId('user-id').textContent).toBe('real-user-uuid')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
  })

  it('a guest with no session is not signed out through Supabase (nothing to sign out of)', async () => {
    const ctx = await renderGuestProvider()
    await act(async () => {
      await ctx.signOut!()
    })
    expect(supabaseSignOut).not.toHaveBeenCalled()
  })

  it('a REAL session IS signed out through Supabase', async () => {
    // The opposite-direction twin of the case above. Together they prove the
    // branch discriminates; either alone is consistent with signOut being
    // unconditionally dead or unconditionally live.
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'real-user-uuid', email: 'real@example.com', app_metadata: {}, user_metadata: {} },
          access_token: 'irrelevant-here',
        },
      },
    })
    supabaseSignOut.mockResolvedValue({ error: null })
    const ctx = await renderGuestProvider()
    await act(async () => {
      await ctx.signOut!()
    })
    expect(supabaseSignOut).toHaveBeenCalledTimes(1)
  })
})

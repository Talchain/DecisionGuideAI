/**
 * STORED-SESSION RESOLUTION — the provider must be able to say "I don't know yet".
 *
 * ── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * `OptionalAuthProvider` hardcoded `loading: false`. It had no way to express
 * "a session is being restored", so on EVERY reload a signed-in owner was
 * handed the guest identity first:
 *
 *     user = { id: 'guest' }  ->  isPersistenceActive(true, guest) === false
 *     ->  ScenarioListPage renders the arrival screen:
 *         "This is an invite-only pilot. Sign in if you have an account."
 *
 * and only then flipped to their real hub. The severe case is the
 * return-after-an-hour case: the access token needs refreshing, so that window
 * is a network round-trip, and if the refresh FAILS the user stays on that
 * screen with no error at all — indistinguishable from being silently signed
 * out, on top of work they can still see nothing of.
 *
 * ── TWO OPPOSITE HARMS, SO THREE SEPARATE CASES ───────────────────────────
 * One predicate guarding two opposite harms is this estate's recurring defect,
 * so each direction is asserted on its own and neither is inferred from the
 * other passing:
 *
 *   1. RETURNING OWNER — must never see the arrival screen, including while a
 *      token refresh is in flight. Harm if wrong: a pilot user concludes the
 *      product logged them out and lost their work.
 *   2. FRESH GUEST — must reach the product with NO added delay, NO spinner,
 *      NO gate. Asserted explicitly, per render, never inferred from (1).
 *      Harm if wrong: guest is the supported pilot experience and every
 *      colleague arriving at the link pays for a probe they do not need.
 *   3. FAILED RESTORE — must end in a CLEAR signed-out state with an error.
 *      Harm if wrong: the silence being fixed is merely relocated from the
 *      arrival screen into an indefinite "expecting a session" limbo.
 *
 * ── BINDING (trap 19 / trap 3b) ───────────────────────────────────────────
 * These render the REAL provider, the REAL `AuthGuard`, and the REAL
 * `ScenarioListPage` behind the same route shape `poc/AppPoC.tsx` mounts, and
 * bind to the arrival screen by its EXACT sentence — not by a value predicate
 * another element could satisfy. If the guest branch moves to another
 * component, or the guard stops consuming `loading`, these go red.
 *
 * `useScenario` is mocked for its data access only: its `isPersistenceActive`
 * is DERIVED here from the real `useAuth()` through the canonical
 * `lib/persistenceActive` predicate, so the chain auth -> predicate -> branch
 * stays real. Each case asserts that precondition in-test, so a fixture that
 * silently stops reproducing the identity cannot leave a green tautology
 * behind (trap 13b).
 *
 * ── STATE-CLASS ───────────────────────────────────────────────────────────
 * Case 1 and 3 are RETURNING (a session in storage, written by a previous
 * visit). Case 2 is FRESH (empty storage). Named because a seeded session is
 * not evidence about a fresh user and vice versa.
 *
 * ── RUNG ──────────────────────────────────────────────────────────────────
 * jsdom: presence/absence in the DOM tree. These prove which BRANCH mounts and
 * in what order; they prove nothing about paint, layout or perceived time. The
 * "no measurable delay" claim in case 2 is a claim about RENDER ORDER — the
 * guest branch is present on the first commit, before any promise resolves —
 * not a claim about milliseconds on a real machine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ---------------------------------------------------------------------------
// The stored-session fixture key, DERIVED the way the SDK derives it.
// ---------------------------------------------------------------------------
// `@supabase/supabase-js` builds the default storage key at
// `dist/main/SupabaseClient.js`:
//
//     const defaultStorageKey =
//       `sb-${new URL(this.authUrl).hostname.split('.')[0]}-auth-token`
//
// Recomputing it here from a URL — rather than hardcoding a literal — means the
// fixture and the production probe agree by construction on the SHAPE, and the
// spec says out loud where the shape came from.
const FIXTURE_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'
const STORED_SESSION_KEY = `sb-${new URL(`${FIXTURE_SUPABASE_URL}/auth/v1`).hostname.split('.')[0]}-auth-token`

const OWNER_ID = '550e8400-e29b-41d4-a716-446655440000'
const ARRIVAL_SENTENCE = 'This is an invite-only pilot. Sign in if you have an account.'

/**
 * A stored session shaped like the one gotrue persists
 * (`helpers.setItemAsync` -> `JSON.stringify(session)`), with an access token
 * that expired an hour ago — the return-after-an-hour case, where `getSession`
 * must make a network round-trip to refresh before it can answer.
 *
 * The token values are obvious non-secrets and exist only to make the shape
 * realistic.
 */
function storedSessionValue() {
  return JSON.stringify({
    access_token: 'fixture-not-a-real-token',
    refresh_token: 'fixture-not-a-real-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: OWNER_ID, email: 'owner@example.com' },
  })
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getSession = vi.fn()
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      onAuthStateChange: (...a: unknown[]) => onAuthStateChange(...(a as [])),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
  getProfile: vi.fn(async () => ({ data: null, error: null })),
  getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })),
}))

// `useScenario`'s DATA access is mocked; its predicate is not. `isPersistenceActive`
// is derived from the real auth context through the canonical helper, so this
// mock cannot quietly decide the branch these tests are about.
vi.mock('../../hooks/useScenario', async () => {
  const { useAuth } = await import('../AuthContext')
  const { isPersistenceActive } = await import('../../lib/persistenceActive')
  return {
    useScenario: () => {
      const { authenticated, user } = useAuth()
      return {
        createScenario: vi.fn(),
        deleteScenario: vi.fn(),
        isPersistenceActive: isPersistenceActive(authenticated, user),
      }
    },
  }
})

const listScenarios = vi.fn(async () => [])
vi.mock('../../services/scenarioService', () => ({
  listScenarios: (...a: unknown[]) => listScenarios(...(a as [])),
  pinScenario: vi.fn(async () => undefined),
  archiveScenario: vi.fn(async () => undefined),
  duplicateScenario: vi.fn(async () => 'dup'),
}))

// Boot-time side-effect modules. Spread the original so this is not a
// hand-maintained allowlist that silently drops a new export (trap 12).
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

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** Every value of `loading` this render pass exposed, in order. */
const loadingPerRender: boolean[] = []
/** Every value of `user.id` this render pass exposed, in order. */
const userIdPerRender: Array<string | undefined> = []

async function renderMountPath() {
  const { AuthProvider, useAuth } = await import('../AuthContext')
  const AuthGuard = (await import('../../components/auth/AuthGuard')).default
  const ScenarioListPage = (await import('../../pages/ScenarioListPage')).default

  function Recorder() {
    const ctx = useAuth()
    loadingPerRender.push(ctx.loading)
    userIdPerRender.push(ctx.user?.id)
    return null
  }

  // The same route shape `poc/AppPoC.tsx` mounts: ScenarioListPage at "/" as a
  // CHILD of the pathless <Route element={<AuthGuard />}>. Binding to the mount
  // path, not to the page in isolation.
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Recorder />
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/" element={<ScenarioListPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

/** A promise whose resolution this test controls — models the refresh round-trip. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

describe('OptionalAuthProvider — stored-session resolution', () => {
  beforeEach(() => {
    loadingPerRender.length = 0
    userIdPerRender.length = 0
    localStorage.clear()
    getSession.mockReset()
    onAuthStateChange.mockReset()
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  // ── PRECONDITION (trap 13b) ────────────────────────────────────────────
  // The whole defect rides on the canonical predicate answering DIFFERENTLY
  // for the guest identity and for a real owner. If it ever stopped
  // discriminating, every case below would pass while proving nothing.
  it('precondition: the canonical predicate discriminates guest from owner', async () => {
    const { isPersistenceActive } = await import('../../lib/persistenceActive')
    expect(isPersistenceActive(true, { id: 'guest' })).toBe(false)
    expect(isPersistenceActive(true, { id: OWNER_ID })).toBe(true)
  })

  // ── DIRECTION 1 — RETURNING OWNER (state-class: returning) ─────────────
  it('never shows the arrival screen to a returning owner while the token refreshes', async () => {
    localStorage.setItem(STORED_SESSION_KEY, storedSessionValue())
    const gate = deferred<{ data: { session: unknown }; error: null }>()
    getSession.mockReturnValue(gate.promise)

    await act(async () => {
      await renderMountPath()
    })

    // The refresh round-trip is still in flight. THIS is the window the defect
    // lived in, and the arrival screen must not be reachable inside it.
    expect(screen.queryByText(ARRIVAL_SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue without an account' })).not.toBeInTheDocument()

    // ...and the guest identity was never offered as a SETTLED answer.
    //
    // ⚠ THIS IS DELIBERATELY NOT `expect(userIdPerRender).not.toContain('guest')`,
    // and the difference is the point. The provider still exposes the guest
    // placeholder as `user` while it resolves — `user` has no "unknown" value
    // and inventing one would break every guest consumer that expects an object.
    // What must never happen is a consumer being handed `guest` while being
    // told the answer is FINAL. So the invariant is the PAIRING: on any render
    // that reads guest, `loading` must be true. Asserting the weaker "guest
    // never appears" would have failed against correct code and pushed the fix
    // in the wrong direction.
    expect(userIdPerRender.length).toBe(loadingPerRender.length)
    const settledGuestRenders = userIdPerRender
      .map((id, i) => ({ id, loading: loadingPerRender[i], i }))
      .filter(r => r.id === 'guest' && r.loading === false)
    expect(settledGuestRenders).toEqual([])
    // ...and the fixture really did exercise the window, rather than skipping
    // straight past it (trap 13b: pin the precondition, or this is vacuous).
    expect(loadingPerRender).toContain(true)

    await act(async () => {
      gate.resolve({
        data: {
          session: {
            access_token: 'fixture-not-a-real-token',
            user: { id: OWNER_ID, email: 'owner@example.com' },
          },
        },
        error: null,
      })
      await gate.promise
    })

    await waitFor(() => {
      expect(screen.queryByText(ARRIVAL_SENTENCE)).not.toBeInTheDocument()
    })
    // The owner's own hub mounted — the branch actually flipped, so the absence
    // above is not the absence of any render at all.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Olumi home' })).toBeInTheDocument()
    })
  })

  // ── DIRECTION 2 — FRESH GUEST (state-class: fresh) ─────────────────────
  // Asserted on its own. A guest pays NOTHING: no probe to wait on, no
  // spinner, no auth UI, and `loading` false on every single render.
  it('a fresh guest reaches the product on the first render with no wait and no auth UI', async () => {
    // Storage is empty (beforeEach). The probe never resolves — if the guest
    // path waited on it even briefly, this test could not pass.
    getSession.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      await renderMountPath()
    })

    // The guest's destination is present...
    expect(screen.getByRole('heading', { name: 'Strategic reasoning' })).toBeInTheDocument()
    expect(screen.getByText(ARRIVAL_SENTENCE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue without an account' })).toBeInTheDocument()

    // ...and it was there on the FIRST commit, before anything could resolve.
    expect(loadingPerRender.length).toBeGreaterThan(0)
    expect(loadingPerRender[0]).toBe(false)
    // Per render, not just at settle: a single frame of `loading: true` is a
    // visible flash of AuthGuard's spinner that the PoC does not have today.
    expect(loadingPerRender).not.toContain(true)

    // No gate, no interstitial, no error state.
    expect(screen.queryByTestId('auth-restoring')).not.toBeInTheDocument()
    expect(screen.queryByTestId('session-restore-failed')).not.toBeInTheDocument()
  })

  // ── CASE 3 — FAILED RESTORE (state-class: returning) ───────────────────
  it('a failed restore ends in a clear signed-out state with an error, not limbo', async () => {
    localStorage.setItem(STORED_SESSION_KEY, storedSessionValue())
    getSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', message: 'Invalid Refresh Token' },
    })

    await act(async () => {
      await renderMountPath()
    })

    // Resolution actually happened: no indefinite "expecting a session" limbo.
    await waitFor(() => {
      expect(loadingPerRender[loadingPerRender.length - 1]).toBe(false)
    })
    expect(screen.queryByTestId('auth-restoring')).not.toBeInTheDocument()

    // The user is TOLD, rather than being dropped silently onto the arrival
    // screen as if they had never signed in.
    const failed = await screen.findByTestId('session-restore-failed')
    expect(failed).toBeInTheDocument()
    expect(screen.getByText(/we couldn.t restore your session/i)).toBeInTheDocument()

    // Both doors still work: sign in again, or carry on as a guest.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue without an account' })).toBeInTheDocument()
  })

  // ── CASE 3b — the limbo this must not become ───────────────────────────
  // The failure mode a naive fix creates: `getSession` never settles, so the
  // spinner never ends. Bounded resolution is the point of the fix, so it gets
  // its own case rather than being assumed.
  it('a restore that never settles resolves to the signed-out state rather than spinning forever', async () => {
    localStorage.setItem(STORED_SESSION_KEY, storedSessionValue())
    getSession.mockReturnValue(new Promise(() => {}))

    vi.useFakeTimers()
    try {
      await act(async () => {
        await renderMountPath()
      })

      // Inside the window the app legitimately does not know yet.
      expect(screen.queryByText(ARRIVAL_SENTENCE)).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })

      expect(screen.getByTestId('session-restore-failed')).toBeInTheDocument()
      expect(loadingPerRender[loadingPerRender.length - 1]).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

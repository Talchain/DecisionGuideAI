/**
 * LINK-TRACK R1 item 7 — THE PILOT'S AUTH ROUTE HAD NO FRONT DOOR.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Password sign-in works on staging's Supabase project and is the pilot's
 * ratified auth route (BRIEF-LINK-TRACK-R1 item 7). The login page offered
 * only magic link and Google — and magic link is the route that does NOT
 * work: staging has no SMTP, which is why this page carries a `send-failed`
 * state at all. So an owner sent a link today reached a page with no control
 * they could complete.
 *
 * Meanwhile `AuthContext` declared `signIn(email, password)` as a "legacy
 * compat" no-op returning `new Error('Password auth removed')`. This lane did
 * NOT make that no-op real: quietly turning a no-op into a working call is how
 * a surface starts reporting success for something it never did (the same
 * module's header records a silent-success twin that told users a link was on
 * its way while making no network call). A new capability got a new name —
 * `signInWithPassword` — and `signIn`/`signUp` are untouched.
 *
 * ── WHAT THESE CASES PIN ───────────────────────────────────────────────────
 * Cases bind by identity to `data-testid`s the form owns, never to a role +
 * label that a future copy edit could satisfy from elsewhere on the page
 * (CLAUDE.md trap 19). jsdom proves WIRING, never pixels (trap 3) — the visual
 * claim is not made here.
 *
 * ⚠ ENUMERATION IS THE RISK THIS PAGE WAS BUILT AROUND, so it is asserted
 * directly: every failure cause must reach ONE state with ONE sentence. A
 * failure message that differs by cause tells an attacker which addresses
 * exist, and the magic-link half of this page goes to real lengths to avoid
 * exactly that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockSignInWithMagicLink = vi.fn()
const mockSignInWithGoogle = vi.fn()
const mockSignInWithPassword = vi.fn()
/**
 * Whether the provider has adopted a real session yet. Mutable because the
 * whole point of the success path is that it depends on this flipping: the
 * page waits for the provider rather than navigating off the resolved promise.
 */
let mockAuthenticated = false
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: mockAuthenticated,
    signInWithMagicLink: mockSignInWithMagicLink,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithPassword: mockSignInWithPassword,
  }),
}))

import LoginPage from '../LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  )
}

/**
 * The same page inside a REAL router with real destinations, so "the owner
 * ends up in the app" is proven by the router actually rendering the
 * destination — not by spying on `useNavigate`, which would prove only that a
 * function was called.
 */
function renderLoginRouted(initialEntries: unknown[] = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries as never}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="app-root">workspace</div>} />
        <Route path="/scenarios/abc" element={<div data-testid="app-deep-link">deep</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillCredentials(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } })
  fireEvent.change(screen.getByTestId('owner-password-input'), { target: { value: password } })
}

async function submitPassword() {
  await act(async () => {
    fireEvent.submit(screen.getByTestId('owner-password-form'))
  })
}

describe('LINK-R1 item 7 — owner password sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticated = false
    mockSignInWithMagicLink.mockResolvedValue({ error: null })
    mockSignInWithGoogle.mockResolvedValue({ error: null })
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('renders a password field and a sign-in submit', () => {
    renderLogin()
    expect(screen.getByTestId('owner-password-input')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('owner-password-submit')).toBeInTheDocument()
  })

  it('calls signInWithPassword with the shared email and the typed password', async () => {
    renderLogin()
    fillCredentials('owner@example.com', 'hunter2-but-longer')
    await submitPassword()

    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    expect(mockSignInWithPassword).toHaveBeenCalledWith('owner@example.com', 'hunter2-but-longer')
  })

  /**
   * ⚠ A TRIM ASSERTION HERE WOULD BE THEATRE, AND IT WAS — REMOVED AFTER A
   * MUTANT SURVIVED IT.
   *
   * The first version of this file asserted the handler trims the email, using
   * `'  owner@example.com  '`. A mutant that sent the RAW value survived: the
   * shared field is `type="email"`, and the HTML value-sanitisation algorithm
   * strips leading/trailing whitespace before React ever sees it (jsdom
   * implements this). So no input reachable through this form can distinguish
   * a trimming handler from a non-trimming one — the test could not fail, and
   * a test that cannot fail is not a test (CLAUDE.md trap 13).
   *
   * What IS observable, and what is asserted instead: both routes are handed
   * the SAME value for the same typed input. That is the property that
   * actually matters — two auth routes must not disagree about who is signing
   * in — and it is one a future edit can genuinely break.
   *
   * ⚠ ROUND 2 (review N3): this case's DISCRIMINATING POWER is narrower than
   * the paragraph above implies, and the reviewer measured it. Its fixture
   * `'Owner@Example.com'` carries no whitespace, so `email === trimmed` and a
   * mutant that passed the RAW value to one route survives. It pins AGREEMENT
   * between the two routes, which is real; it does NOT pin trimming, and no
   * test reachable through a `type="email"` field can.
   */
  it('hands BOTH routes the same email for the same typed input', async () => {
    // ⚠ TWO RENDERS, deliberately. Either successful submit now LEAVES the
    // form — password sign-in goes to the signed-in state, magic link to
    // `link-sent` — so no single render can exercise both routes. Feeding the
    // same typed input to two fresh renders pins exactly the property that
    // matters: the two routes must not disagree about who is signing in.
    const TYPED = 'Owner@Example.com'

    const first = renderLogin()
    fillCredentials(TYPED, 'pw')
    await submitPassword()
    first.unmount()

    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: TYPED } })
    await act(async () => {
      fireEvent.submit(screen.getByTestId('magic-link-form'))
    })

    const passwordEmail = mockSignInWithPassword.mock.calls[0][0]
    const magicLinkEmail = mockSignInWithMagicLink.mock.calls[0][0]
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    expect(mockSignInWithMagicLink).toHaveBeenCalledTimes(1)
    expect(passwordEmail).toBe(magicLinkEmail)
  })

  it('sends NOTHING and shows the email error when the address is malformed', async () => {
    renderLogin()
    fillCredentials('not-an-email', 'pw')
    await submitPassword()

    expect(mockSignInWithPassword).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument()
  })

  it('sends NOTHING on an empty password (the submit is disabled, and the handler agrees)', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'owner@example.com' },
    })
    expect(screen.getByTestId('owner-password-submit')).toBeDisabled()

    await submitPassword()
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('reports failure, and CLEARS the password so a retry cannot resend a stale value', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), { status: 400 }),
    })
    renderLogin()
    fillCredentials('owner@example.com', 'wrong')
    await submitPassword()

    expect(screen.getByTestId('owner-password-error')).toBeInTheDocument()
    expect((screen.getByTestId('owner-password-input') as HTMLInputElement).value).toBe('')
  })

  /**
   * ⚠ ROUND 2 — THIS CASE USED TO ENFORCE A LIE, AND IT IS THE CLEAREST
   * example in this file of trap 21 (two questions under one predicate).
   *
   * It collapsed 400 / 429 / 500 / 501 into one message and asserted
   * `messages.size === 1` — so the suite actively DEFENDED reporting a server
   * outage and a rate limit as "your password didn't match". Three of the four
   * were false. The enumeration property it was written to protect is real, but
   * it is a property of ONE PAIR: a wrong password and an unknown address, both
   * Supabase 400 `Invalid login credentials`. Those are what an attacker would
   * diff. A 5xx, a 501 and a 429 are returned identically whether or not the
   * address exists, so distinguishing them reveals nothing — which is exactly
   * why the magic-link half of this same page has had a `send-failed` state
   * since #666.
   *
   * The pair is now asserted directly, and the three non-enumeration causes get
   * their own cases below.
   */
  it('a wrong password and an unknown address are BYTE-IDENTICAL — enumeration stays closed', async () => {
    const enumerationSurface = [
      Object.assign(new Error('Invalid login credentials'), { status: 400 }), // wrong password
      Object.assign(new Error('Invalid login credentials'), { status: 400 }), // unknown address
    ]

    const messages = new Set<string>()
    for (const error of enumerationSurface) {
      mockSignInWithPassword.mockResolvedValue({ error })
      const view = renderLogin()
      fillCredentials('owner@example.com', 'pw')
      await submitPassword()
      messages.add(screen.getByTestId('owner-password-error').textContent ?? '')
      view.unmount()
    }

    expect(
      messages.size,
      `the failure message differs between a wrong password and an unknown address, which leaks which addresses exist: ${[...messages].join(' | ')}`,
    ).toBe(1)
  })

  it('a 500 is reported as OUR fault — never as "your password didn’t match"', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('boom'), { status: 500 }),
    })
    renderLogin()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByTestId('owner-password-server-error')).toBeInTheDocument()
    expect(screen.queryByTestId('owner-password-error')).toBeNull()
    expect(screen.getByTestId('owner-password-server-error').textContent ?? '').toMatch(
      /problem on our side/i,
    )
  })

  it('a 501 capability-absent build is reported as OUR fault, not as bad credentials', async () => {
    // This is the status `AuthContext.signInUnavailable` stamps when the
    // bundled Supabase client has no `signInWithPassword` at all. Telling the
    // owner their password was wrong would send them hunting for a password
    // problem that does not exist.
    mockSignInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Sign-in is unavailable in this build'), { status: 501 }),
    })
    renderLogin()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByTestId('owner-password-server-error')).toBeInTheDocument()
    expect(screen.queryByTestId('owner-password-error')).toBeNull()
  })

  it('a 429 is reported as a rate limit AND does not wipe a correct password', async () => {
    // The actively harmful case: the old copy blamed the credentials and
    // cleared the field, so a rate-limited owner retyped a CORRECT password
    // into more rate-limiting — on the pilot's only working route, with no
    // reset path.
    mockSignInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('slow down'), { status: 429 }),
    })
    renderLogin()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByText(/wait a moment before trying again/i)).toBeInTheDocument()
    expect(screen.queryByTestId('owner-password-error')).toBeNull()
    expect((screen.getByTestId('owner-password-input') as HTMLInputElement).value).toBe(
      'correct-horse',
    )
  })

  /**
   * ── THE SUCCESS PATH (review blocker 1) ───────────────────────────────────
   * Measured at `e5d54d6a` by the reviewer, by execution: after a SUCCESSFUL
   * submit, `[email, password, submit, magic-link, google].disabled` read
   * `[true, true, true, true, true]` and stayed that way — every control dead,
   * a "Signing in…" spinner, no route change, forever. The in-file comment
   * blamed the AuthProvider's `onAuthStateChange`; nothing in `AuthContext`
   * navigates on sign-IN, and `/login` sits outside `AuthGuard`, so nothing
   * else was going to move either.
   *
   * These bind to the DESTINATION rendering, not to a `useNavigate` spy.
   */
  it('a correct password lands the owner IN THE APP once the provider adopts the session', async () => {
    mockAuthenticated = true // the session the successful call just created
    renderLoginRouted()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByTestId('app-root')).toBeInTheDocument()
    expect(screen.queryByTestId('owner-password-form')).toBeNull()
  })

  it('returns the owner to the route AuthGuard bounced them from, not to the root', async () => {
    // AuthGuard redirects with `state: { from: location }`. Ignoring it would
    // silently discard a deep link on every protected route.
    mockAuthenticated = true
    renderLoginRouted([{ pathname: '/login', state: { from: { pathname: '/scenarios/abc' } } }])
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByTestId('app-deep-link')).toBeInTheDocument()
  })

  it('does not dead-end while the session is still landing — Continue is live and routes', async () => {
    // The provider has NOT adopted the session yet. The old page left the owner
    // on a disabled form here indefinitely; there must always be a live control.
    mockAuthenticated = false
    renderLoginRouted()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.getByTestId('owner-password-signed-in')).toBeInTheDocument()
    const cont = screen.getByTestId('owner-password-continue') as HTMLButtonElement
    expect(cont.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(cont)
    })
    expect(screen.getByTestId('app-root')).toBeInTheDocument()
  })

  it('leaves no disabled-control dead end on success — the measured defect, inverted', async () => {
    // The reviewer's measurement as an assertion: after success, the disabled
    // form is not what the owner is looking at.
    mockAuthenticated = false
    renderLogin()
    fillCredentials('owner@example.com', 'correct-horse')
    await submitPassword()

    expect(screen.queryByTestId('owner-password-input')).toBeNull()
    expect(screen.queryByTestId('owner-password-submit')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/signing in…/i)
  })

  /**
   * ── `Enter` IN THE SHARED EMAIL FIELD (review N1) ─────────────────────────
   * The field sits outside both forms so there is one source of truth for the
   * address. At `e5d54d6a` it also had no `form=` attribute, so `input.form`
   * was `null`: it belonged to no form and implicit submission had nothing to
   * submit — a dead key.
   *
   * ⚠ jsdom does NOT implement implicit submission (measured: a synthetic
   * `Enter` keydown on an associated input fires zero `submit` events), so the
   * keypress itself cannot be proven here — trap 3. What IS the mechanism, and
   * what is asserted, is OWNERSHIP, bound by element identity: per the HTML
   * form-owner rules, Enter in a text control submits the form it is
   * associated with, and association is exactly what was missing.
   */
  it('the shared email field is OWNED by the password form, so Enter has somewhere to go', () => {
    renderLogin()
    const emailField = screen.getByPlaceholderText('you@example.com') as HTMLInputElement
    const passwordForm = screen.getByTestId('owner-password-form')

    expect(emailField.form, 'the email field belongs to no form — Enter is a dead key').not.toBeNull()
    expect(emailField.form).toBe(passwordForm)
  })

  it('leaves the magic-link route intact and reachable', async () => {
    // The password form is the pilot route; it must not be added by deleting
    // the other one (trap 13b — the fix must not pass by removing a control).
    renderLogin()
    expect(screen.getByTestId('magic-link-form')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('offers NO sign-up and NO password reset — both would be controls with nothing behind them', () => {
    // Owners are pre-provisioned and there is no SMTP. A "create account" or
    // "forgot password" control here would be guarantee theatre.
    renderLogin()

    // ⚠ POSITIVE CONTROL (review N4). This is a bare-absence probe over
    // `document.body.textContent`, and an absence probe with nothing proving it
    // can see a PRESENCE is vacuous (trap 13): at pristine, where no password
    // form existed at all, it passed. Asserting the form IS rendered in the
    // SAME test means a render that produced nothing can no longer be read as
    // "no sign-up offered".
    expect(
      screen.getByTestId('owner-password-form'),
      'the password form did not render — the absence assertion below would pass vacuously',
    ).toBeInTheDocument()
    expect(screen.getByTestId('owner-password-input')).toBeInTheDocument()

    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/create an account|sign up|forgot (your )?password|reset password/i)
  })
})

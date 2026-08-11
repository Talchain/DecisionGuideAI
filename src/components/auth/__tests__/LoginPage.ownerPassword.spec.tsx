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
import { MemoryRouter } from 'react-router-dom'

const mockSignInWithMagicLink = vi.fn()
const mockSignInWithGoogle = vi.fn()
const mockSignInWithPassword = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: false,
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
   */
  it('hands BOTH routes the same email for the same typed input', async () => {
    renderLogin()
    fillCredentials('Owner@Example.com', 'pw')
    await submitPassword()
    await act(async () => {
      fireEvent.submit(screen.getByTestId('magic-link-form'))
    })

    const passwordEmail = mockSignInWithPassword.mock.calls[0][0]
    const magicLinkEmail = mockSignInWithMagicLink.mock.calls[0][0]
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

  it('gives BYTE-IDENTICAL failure copy for every cause — enumeration stays closed', async () => {
    // The discriminating property, and the one a well-meaning later edit is
    // most likely to break by "improving" the message for a server fault.
    const causes = [
      Object.assign(new Error('Invalid login credentials'), { status: 400 }), // wrong password
      Object.assign(new Error('Invalid login credentials'), { status: 400 }), // unknown address
      Object.assign(new Error('boom'), { status: 500 }), // our fault
      Object.assign(new Error('no signInWithPassword'), { status: 501 }), // capability absent
      Object.assign(new Error('slow down'), { status: 429 }), // rate limited
    ]

    const messages = new Set<string>()
    for (const error of causes) {
      mockSignInWithPassword.mockResolvedValue({ error })
      const view = renderLogin()
      fillCredentials('owner@example.com', 'pw')
      await submitPassword()
      messages.add(screen.getByTestId('owner-password-error').textContent ?? '')
      view.unmount()
    }

    expect(
      messages.size,
      `the password failure message varies by cause, which leaks which addresses exist: ${[...messages].join(' | ')}`,
    ).toBe(1)
  })

  it('does not claim a redirect it never performs on success', async () => {
    renderLogin()
    fillCredentials('owner@example.com', 'pw')
    await submitPassword()

    // Navigation is the AuthProvider's job (onAuthStateChange). This surface
    // must not print a "redirecting…" promise it does not keep.
    expect(screen.queryByTestId('owner-password-error')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/redirect/i)
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
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/create an account|sign up|forgot (your )?password|reset password/i)
  })
})

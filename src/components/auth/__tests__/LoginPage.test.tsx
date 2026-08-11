import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

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

function renderLogin(initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithMagicLink.mockResolvedValue({ error: null })
    mockSignInWithGoogle.mockResolvedValue({ error: null })
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('renders sign-in heading and email input', () => {
    renderLogin()
    expect(screen.getByText('Sign in to Olumi')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows validation error on blur for invalid email', () => {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: 'bad' } })
    fireEvent.blur(input)
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument()
  })

  it('calls signInWithMagicLink on valid submit', async () => {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: 'user@example.com' } })

    await act(async () => {
      fireEvent.submit(screen.getByTestId('magic-link-form'))
    })

    expect(mockSignInWithMagicLink).toHaveBeenCalledWith('user@example.com')
  })

  it('shows link-sent state after successful magic link', async () => {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: 'user@example.com' } })

    await act(async () => {
      fireEvent.submit(screen.getByTestId('magic-link-form'))
    })

    expect(screen.getByText(/if this email is registered/i)).toBeInTheDocument()
  })

  it('calls signInWithGoogle when Google button clicked', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(mockSignInWithGoogle).toHaveBeenCalled()
  })

  it('shows expired link message when URL has error=expired', () => {
    renderLogin(['/login?error=expired'])
    expect(screen.getByText(/link has expired/i)).toBeInTheDocument()
  })
})

/**
 * PR4 — A SERVER FAULT IS NOT A "LINK SENT".
 *
 * The anti-enumeration branch used to swallow EVERY non-rate-limit error into
 * the link-sent state. That is right for anything that could distinguish a
 * registered address from an unregistered one, and wrong for a fault on our
 * side: staging's Supabase has no SMTP configured, so `signInWithOtp` answers
 * HTTP 500 `unexpected_failure` ("Error sending magic link email") for an
 * address that DOES exist — and the page told the user their link was on its
 * way. The predicate guarded two opposite harms with one branch: a gap (we
 * leak which addresses exist) and a lie (we claim to have sent nothing).
 *
 * Two parameters now, not one:
 *   • status >= 500 → OUR fault. Say so. Reveals nothing about the address,
 *     because it is returned identically for every address.
 *   • anything else → link-sent, unchanged. Enumeration safety is untouched.
 *
 * The two cases below are opposite-direction twins deliberately: one proves
 * the fault is reported, the other proves the enumeration guard did not get
 * traded away to buy it.
 */
describe('LoginPage × server faults are reported, enumeration stays closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithMagicLink.mockResolvedValue({ error: null })
    mockSignInWithGoogle.mockResolvedValue({ error: null })
  })

  async function submit(email = 'user@example.com') {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: email } })
    await act(async () => {
      fireEvent.submit(screen.getByTestId('magic-link-form'))
    })
  }

  it('a 500 from Supabase (SMTP unconfigured) is NOT reported as a sent link', async () => {
    mockSignInWithMagicLink.mockResolvedValue({
      error: Object.assign(new Error('Error sending magic link email'), {
        status: 500,
        code: 'unexpected_failure',
      }),
    })
    await submit()
    expect(screen.queryByText(/if this email is registered/i)).not.toBeInTheDocument()
    expect(screen.getByText(/couldn.t send/i)).toBeInTheDocument()
  })

  it("a build with no sign-in capability (501) is NOT reported as a sent link", async () => {
    mockSignInWithMagicLink.mockResolvedValue({
      error: Object.assign(new Error('Sign-in is unavailable in this build'), {
        status: 501,
      }),
    })
    await submit()
    expect(screen.queryByText(/if this email is registered/i)).not.toBeInTheDocument()
    expect(screen.getByText(/couldn.t send/i)).toBeInTheDocument()
  })

  it('an unknown-address error STILL shows link-sent — enumeration stays closed', async () => {
    // The opposite-direction twin. Supabase answers 422 `otp_disabled` when the
    // address has no account and shouldCreateUser is false; distinguishing that
    // on screen would tell an attacker which addresses are registered.
    mockSignInWithMagicLink.mockResolvedValue({
      error: Object.assign(new Error('Signups not allowed for otp'), {
        status: 422,
        code: 'otp_disabled',
      }),
    })
    await submit()
    expect(screen.getByText(/if this email is registered/i)).toBeInTheDocument()
    expect(screen.queryByText(/couldn.t send/i)).not.toBeInTheDocument()
  })

  it('a rate-limit error still shows the rate-limit message, not a server fault', async () => {
    mockSignInWithMagicLink.mockResolvedValue({
      error: Object.assign(new Error('For security purposes, too many requests'), {
        status: 429,
      }),
    })
    await submit()
    expect(screen.getByText(/wait a moment/i)).toBeInTheDocument()
  })

  it('a 429 whose WORDING says nothing about rates is still a rate limit', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE A MUTANT SURVIVED. Changing the status check
    // from 429 killed nothing: every other rate-limit fixture also matched the
    // message fallback, so the status branch was carrying no test weight and a
    // refactor could have deleted it silently. Supabase does not guarantee the
    // wording; it does guarantee the status.
    mockSignInWithMagicLink.mockResolvedValue({
      error: Object.assign(new Error('Request throttled, retry shortly'), { status: 429 }),
    })
    await submit()
    expect(screen.getByText(/wait a moment/i)).toBeInTheDocument()
  })

  it('a failed Google sign-in is surfaced, not discarded', async () => {
    // `handleGoogleClick` used to `await signInWithGoogle()` and throw the
    // result away, so a disabled provider produced a button that visibly did
    // nothing at all.
    mockSignInWithGoogle.mockResolvedValue({
      error: Object.assign(new Error('Unsupported provider: provider is not enabled'), {
        status: 400,
      }),
    })
    renderLogin()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    })
    expect(screen.getByText(/couldn.t start google sign-in/i)).toBeInTheDocument()
  })
})

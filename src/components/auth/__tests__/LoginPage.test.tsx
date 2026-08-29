/**
 * ⚠ SCOPE CHANGED 29 Aug 2026. This file used to be mostly magic-link and
 * Google OAuth coverage. Both routes were REMOVED from the page: staging's
 * Supabase project has no SMTP, and `"google": false` at
 * `GET /auth/v1/settings` — so neither could complete, and the Google click
 * ejected the user out of the app onto a raw JSON 400 (supabase-js navigates
 * itself and resolves `{error:null}`, so the page's `oauth-failed` state could
 * never fire).
 *
 * The tests that exercised those controls are GONE rather than rewritten:
 * there is nothing left to assert about them, and the ABSENCE is pinned by
 * `LoginPage.onlyWorkingRoutes.spec.tsx` — deliberately in its own file, so
 * the guarantee has a named home rather than hiding in a general suite.
 *
 * The server-fault and rate-limit classification those deleted tests covered
 * is NOT lost: `isServerFault`/`isRateLimited` are still exercised end-to-end
 * on the password route by `LoginPage.ownerPassword.spec.tsx`
 * ("a 500 …", "a 501 …", "a 429 …"), which is the route that still exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockSignInWithPassword = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: false,
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
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('renders sign-in heading, email input and the password submit', () => {
    renderLogin()
    expect(screen.getByText('Sign in to Olumi')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByTestId('owner-password-submit')).toBeInTheDocument()
  })

  it('shows validation error on blur for invalid email', () => {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.blur(input)
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
  })

  /**
   * STAYS EVEN THOUGH NO NEW LINKS ARE ISSUED. Links already sitting in an
   * inbox can still be clicked, and `/auth/callback` still routes them here
   * with `?error=expired`. Removing the banner would turn an explained dead
   * end into an unexplained one.
   */
  it('shows expired link message when URL has error=expired', () => {
    renderLogin(['/login?error=expired'])
    expect(screen.getByText(/sign-in link has expired/i)).toBeInTheDocument()
  })
})

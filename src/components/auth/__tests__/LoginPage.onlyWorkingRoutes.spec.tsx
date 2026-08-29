/**
 * THE FRONT DOOR OFFERS ONLY ROUTES THAT CAN COMPLETE (29 Aug 2026).
 *
 * Unattended team testing: a colleague picks a sign-in route with nobody
 * beside them to say "not that one". Two of the three routes this page used to
 * offer could not complete, and both were measured at the DEPLOYED staging
 * service (project `etmmuzwxtcjipwphdola`, commit 961e5e78 — the same commit
 * this branch forks from):
 *
 *   1. "Send magic link" — staging's Supabase project has no SMTP, so the link
 *      is never delivered. The page's own header has said so since #667.
 *
 *   2. "Continue with Google" — `GET /auth/v1/settings` reports
 *      `"google": false`, and `GET /auth/v1/authorize?provider=google` answers
 *      `400 {"error_code":"validation_failed","msg":"Unsupported provider:
 *      provider is not enabled"}`.
 *
 *      This one was strictly worse than a dead button, and the `oauth-failed`
 *      state written to catch it COULD NOT FIRE. supabase-js resolves
 *      `signInWithOAuth` with `{error: null}` and navigates the browser itself
 *      — the deployed bundle carries
 *      `Ub()&&!t.skipBrowserRedirect&&window.location.assign(r),{data:{...},error:null}`
 *      — so the click EJECTED the tester out of Olumi onto a raw JSON 400 from
 *      Supabase, with no in-app error and no way back but the back button.
 *
 * Password sign-in is the pilot's route and is untouched. Account creation is
 * open and auto-confirming at the API (`disable_signup:false`,
 * `mailer_autoconfirm:true`), so removing these two costs nobody a way in.
 *
 * These assertions bind by ACCESSIBLE NAME and by the magic-link form's own
 * `data-testid`, not by a value predicate another control could satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockSignInWithPassword = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: false,
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

describe('LoginPage offers only sign-in routes that can complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('offers NO magic-link control — staging cannot deliver the email', () => {
    renderLogin()
    expect(screen.queryByRole('button', { name: /magic link/i })).toBeNull()
    expect(screen.queryByTestId('magic-link-form')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/magic link/i)
  })

  it('offers NO Google control — the provider is disabled and the click left the app', () => {
    renderLogin()
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/continue with google/i)
  })

  /**
   * The OPPOSITE-DIRECTION TWIN. Absence assertions alone would also pass on a
   * page that rendered nothing at all, so this pins that the route which DOES
   * work is still here — and pins it by the same query family the absence
   * assertions use, so a harness that stopped rendering fails HERE first.
   */
  it('still offers the password route, which is the one that works', () => {
    renderLogin()
    expect(screen.getByTestId('owner-password-form')).toBeInTheDocument()
    expect(screen.getByTestId('owner-password-input')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })
})

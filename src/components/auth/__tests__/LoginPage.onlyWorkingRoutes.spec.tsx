/**
 * THE FRONT DOOR OFFERS ONLY ROUTES THAT CAN COMPLETE.
 *
 * 29 Aug 2026: the email routes were removed because the Supabase project had
 * no SMTP. 1 Oct 2026 (ACCESS & INVITES): custom SMTP is configured, invites
 * are emailed, and the two email routes return: "Email me a sign-in link" and
 * "Forgot password?". Google stays absent: the provider is disabled, and
 * supabase-js navigates the browser itself, ejecting the user onto a raw 400.
 *
 * Enumeration stays closed: an address-correlated refusal (no such user) and a
 * delivered link render the SAME "Check your inbox" state. Only a server fault
 * and a rate limit, which are not address-correlated, are named.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockSignInWithPassword = vi.fn()
const mockSignInWithMagicLink = vi.fn()
const mockRequestPasswordReset = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: false,
    signInWithPassword: mockSignInWithPassword,
    signInWithMagicLink: mockSignInWithMagicLink,
    requestPasswordReset: mockRequestPasswordReset,
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

function typeEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value } })
}

async function sentScreenText(): Promise<string> {
  const el = await screen.findByTestId('magic-link-sent')
  return el.textContent ?? ''
}

describe('LoginPage offers only sign-in routes that can complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockSignInWithMagicLink.mockResolvedValue({ error: null })
    mockRequestPasswordReset.mockResolvedValue({ error: null })
  })

  it('offers an email sign-in link and sends it to the TRIMMED address', async () => {
    renderLogin()
    typeEmail('  ada@example.com ')
    fireEvent.click(screen.getByRole('button', { name: /email me a sign-in link/i }))
    await waitFor(() => expect(mockSignInWithMagicLink).toHaveBeenCalledWith('ada@example.com'))
    expect(await sentScreenText()).toMatch(/check your inbox/i)
  })

  it('a refused (unknown) address and a delivered link are BYTE-IDENTICAL', async () => {
    renderLogin()
    typeEmail('known@example.com')
    fireEvent.click(screen.getByTestId('magic-link-submit'))
    const delivered = (await sentScreenText()).replace('known@example.com', '<email>')

    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }))
    mockSignInWithMagicLink.mockResolvedValueOnce({
      error: Object.assign(new Error('Signups not allowed for otp'), { status: 422 }),
    })
    typeEmail('stranger@example.com')
    fireEvent.click(screen.getByTestId('magic-link-submit'))
    const refused = (await sentScreenText()).replace('stranger@example.com', '<email>')

    expect(refused).toBe(delivered)
  })

  it('a 500 is named as OUR fault, never shown as a sent link', async () => {
    mockSignInWithMagicLink.mockResolvedValueOnce({
      error: Object.assign(new Error('boom'), { status: 500 }),
    })
    renderLogin()
    typeEmail('ada@example.com')
    fireEvent.click(screen.getByTestId('magic-link-submit'))
    expect(await screen.findByTestId('email-send-server-error')).toBeInTheDocument()
    expect(screen.queryByTestId('magic-link-sent')).toBeNull()
  })

  it('sends NOTHING for a malformed address and says why', () => {
    renderLogin()
    typeEmail('not-an-email')
    fireEvent.click(screen.getByTestId('magic-link-submit'))
    expect(mockSignInWithMagicLink).not.toHaveBeenCalled()
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
  })

  it('"Forgot password?" emails a reset link to the typed address', async () => {
    renderLogin()
    typeEmail('ada@example.com')
    fireEvent.click(screen.getByTestId('forgot-password'))
    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledWith('ada@example.com'))
    expect(await screen.findByTestId('reset-link-sent')).toBeInTheDocument()
    expect(mockSignInWithMagicLink).not.toHaveBeenCalled()
  })

  it('offers NO Google control: the provider is disabled and the click left the app', () => {
    renderLogin()
    // Positive control in the same render: the page did render its routes.
    expect(screen.getByTestId('magic-link-submit')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/continue with google/i)
  })

  it('still offers the password route', () => {
    renderLogin()
    expect(screen.getByTestId('owner-password-form')).toBeInTheDocument()
    expect(screen.getByTestId('owner-password-input')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('owner-password-submit')).toBeInTheDocument()
  })
})

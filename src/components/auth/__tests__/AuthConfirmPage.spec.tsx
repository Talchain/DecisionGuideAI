/**
 * /auth/confirm: invite → choose a password → hub; magic link → hub; a dead
 * link → a way to get a fresh one. Bound by test id and by the exact
 * verifyOtp arguments, not by copy another state could also render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StrictMode } from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockVerifyOtp = vi.fn()
const mockGetSession = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a), getSession: () => mockGetSession() } },
}))

const mockUpdatePassword = vi.fn()
const mockSignInWithMagicLink = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ updatePassword: mockUpdatePassword, signInWithMagicLink: mockSignInWithMagicLink }),
}))

import AuthConfirmPage from '../AuthConfirmPage'

const session = { access_token: 'a', user: { id: 'u1', email: 'invitee@example.com' } }

function renderAt(url: string, strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <AuthConfirmPage />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

describe('AuthConfirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyOtp.mockResolvedValue({ data: { session, user: session.user }, error: null })
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockUpdatePassword.mockResolvedValue({ error: null })
    mockSignInWithMagicLink.mockResolvedValue({ error: null })
  })

  it('an invite verifies its token_hash ONCE (StrictMode) and asks for a password', async () => {
    renderAt('/auth/confirm?token_hash=th1&type=invite', true)
    expect(await screen.findByTestId('auth-confirm-set-password')).toBeInTheDocument()
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1)
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'th1', type: 'invite' })
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('a short password is refused before any request; a valid one is saved, then the hub', async () => {
    renderAt('/auth/confirm?token_hash=th1&type=invite')
    const input = await screen.findByTestId('new-password-input')
    fireEvent.change(input, { target: { value: 'short' } })
    expect(screen.getByTestId('set-password-submit')).toBeDisabled()
    fireEvent.change(input, { target: { value: 'a-long-enough-password' } })
    fireEvent.click(screen.getByTestId('set-password-submit'))
    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith('a-long-enough-password'))
    fireEvent.click(await screen.findByTestId('password-saved-continue'))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('an invitee may skip the password; a reset may not', async () => {
    const { unmount } = renderAt('/auth/confirm?token_hash=th1&type=invite')
    fireEvent.click(await screen.findByTestId('set-password-skip'))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    unmount()

    renderAt('/auth/confirm?token_hash=th2&type=recovery')
    expect(await screen.findByTestId('auth-confirm-set-password')).toBeInTheDocument()
    expect(screen.queryByTestId('set-password-skip')).toBeNull()
  })

  it('a sign-in link goes straight to the hub', async () => {
    renderAt('/auth/confirm?token_hash=th3&type=magiclink')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(screen.queryByTestId('auth-confirm-set-password')).toBeNull()
  })

  it('a used or expired token shows the expired state and can email a fresh link', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: { status: 403, message: 'expired' } })
    renderAt('/auth/confirm?token_hash=old&type=magiclink')
    expect(await screen.findByTestId('auth-confirm-failed')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByTestId('expired-send-link'))
    await waitFor(() => expect(mockSignInWithMagicLink).toHaveBeenCalledWith('ada@example.com'))
    expect(await screen.findByTestId('confirm-new-link-sent')).toBeInTheDocument()
  })

  it('no token and no session is the expired state, never a silent hub', async () => {
    renderAt('/auth/confirm')
    expect(await screen.findByTestId('auth-confirm-failed')).toBeInTheDocument()
    expect(mockVerifyOtp).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('an unknown type is never passed to verifyOtp', async () => {
    renderAt('/auth/confirm?token_hash=th&type=evil')
    expect(await screen.findByTestId('auth-confirm-failed')).toBeInTheDocument()
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })
})

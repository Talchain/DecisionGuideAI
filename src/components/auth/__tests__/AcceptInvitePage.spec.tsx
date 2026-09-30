/**
 * ACCOUNTS phase 1 — the invite landing (/#/accept-invite).
 *
 * Bound to the contract the page exists for:
 *   · a link without a usable token/type never calls verify, and says so;
 *   · a real invite link calls verifyOtp EXACTLY ONCE with { token_hash, type }
 *     (single-use token — StrictMode's double effect must not burn it twice);
 *   · a 4xx from verify is "this link is no good"; anything else is our fault;
 *   · the password is saved through updateUser and only then does the tester
 *     land in the workspace.
 */
import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const verifyOtp = vi.fn()
const updateUser = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}))

import AcceptInvitePage, { MIN_PASSWORD_LENGTH } from '../AcceptInvitePage'

const TOKEN = 'pkce_0123456789abcdef0123456789abcdef'

function renderAt(url: string, strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <AcceptInvitePage />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

function sessionFor(email: string) {
  return { data: { session: { user: { email } }, user: { email } }, error: null }
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status })
}

const goodPassword = 'a'.repeat(MIN_PASSWORD_LENGTH) + 'Z9'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AcceptInvitePage — link handling', () => {
  it('no token_hash → link-invalid, and verify is never called', async () => {
    renderAt('/accept-invite?type=invite')
    expect(await screen.findByTestId('accept-invite-link-invalid')).toBeInTheDocument()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('a type other than invite/recovery (e.g. signup) → link-invalid, verify never called', async () => {
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=signup`)
    expect(await screen.findByTestId('accept-invite-link-invalid')).toBeInTheDocument()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('a real invite link calls verifyOtp EXACTLY ONCE with the token and type, even under StrictMode', async () => {
    verifyOtp.mockResolvedValue(sessionFor('tester@example.test'))
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`, true)
    expect(await screen.findByTestId('accept-invite-form')).toBeInTheDocument()
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: 'invite' })
    expect(screen.getByText('tester@example.test')).toBeInTheDocument()
  })

  it('scrubs the single-use token from the address bar before verifying', async () => {
    verifyOtp.mockResolvedValue(sessionFor('tester@example.test'))
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    await screen.findByTestId('accept-invite-form')
    expect(mockNavigate).toHaveBeenCalledWith('/accept-invite', { replace: true })
    const scrubOrder = mockNavigate.mock.invocationCallOrder[0]
    const verifyOrder = verifyOtp.mock.invocationCallOrder[0]
    expect(scrubOrder).toBeLessThan(verifyOrder)
    for (const call of mockNavigate.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(TOKEN)
    }
  })

  it('recovery links are accepted too (same page resets a password)', async () => {
    verifyOtp.mockResolvedValue(sessionFor('tester@example.test'))
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=recovery`)
    expect(await screen.findByTestId('accept-invite-form')).toBeInTheDocument()
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: 'recovery' })
    expect(screen.getByText('Choose a new password')).toBeInTheDocument()
  })

  it('a 403 from verify (expired / used) → link-invalid, no form', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: httpError(403, 'Email link is invalid or has expired') })
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    expect(await screen.findByTestId('accept-invite-link-invalid')).toBeInTheDocument()
    expect(screen.queryByTestId('accept-invite-form')).not.toBeInTheDocument()
  })

  it('a 5xx from verify → server-fault, NOT "your link expired"', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: httpError(500, 'boom') })
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    expect(await screen.findByTestId('accept-invite-server-fault')).toBeInTheDocument()
    expect(screen.queryByTestId('accept-invite-link-invalid')).not.toBeInTheDocument()
  })

  it('a thrown error from verify → server-fault', async () => {
    verifyOtp.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    expect(await screen.findByTestId('accept-invite-server-fault')).toBeInTheDocument()
  })

  it('verify succeeds but returns no session → server-fault (nothing to set a password on)', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null })
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    expect(await screen.findByTestId('accept-invite-server-fault')).toBeInTheDocument()
  })
})

describe('AcceptInvitePage — setting the password', () => {
  async function toForm() {
    verifyOtp.mockResolvedValue(sessionFor('tester@example.test'))
    renderAt(`/accept-invite?token_hash=${TOKEN}&type=invite`)
    await screen.findByTestId('accept-invite-form')
    mockNavigate.mockClear()
  }

  function fill(pw: string, confirm: string) {
    fireEvent.change(screen.getByTestId('accept-invite-password'), { target: { value: pw } })
    fireEvent.change(screen.getByTestId('accept-invite-confirm'), { target: { value: confirm } })
    fireEvent.click(screen.getByTestId('accept-invite-submit'))
  }

  it('too short → refused locally; updateUser never called', async () => {
    await toForm()
    fill('short', 'short')
    expect(await screen.findByTestId('accept-invite-error')).toHaveTextContent(`at least ${MIN_PASSWORD_LENGTH}`)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('mismatch → refused locally; updateUser never called', async () => {
    await toForm()
    fill(goodPassword, goodPassword + 'x')
    expect(await screen.findByTestId('accept-invite-error')).toHaveTextContent(/don.t match/)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('success → updateUser({ password }) THEN the workspace', async () => {
    updateUser.mockResolvedValue({ data: { user: {} }, error: null })
    await toForm()
    fill(goodPassword, goodPassword)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(updateUser).toHaveBeenCalledTimes(1)
    expect(updateUser).toHaveBeenCalledWith({ password: goodPassword })
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
  })

  it("server refuses the password (422) → shows the server's reason, stays on the page", async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: httpError(422, 'Password is known to be weak and easy to guess') })
    await toForm()
    fill(goodPassword, goodPassword)
    expect(await screen.findByTestId('accept-invite-error')).toHaveTextContent('known to be weak')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('server fault on save → our-side message, stays on the page', async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: httpError(500, 'internal detail') })
    await toForm()
    fill(goodPassword, goodPassword)
    const err = await screen.findByTestId('accept-invite-error')
    expect(err).toHaveTextContent('problem on our side')
    expect(err).not.toHaveTextContent('internal detail')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockSignInWithMagicLink = vi.fn()
const mockSignInWithGoogle = vi.fn()
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: false,
    signInWithMagicLink: mockSignInWithMagicLink,
    signInWithGoogle: mockSignInWithGoogle,
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
      fireEvent.submit(input.closest('form')!)
    })

    expect(mockSignInWithMagicLink).toHaveBeenCalledWith('user@example.com')
  })

  it('shows link-sent state after successful magic link', async () => {
    renderLogin()
    const input = screen.getByPlaceholderText('you@example.com')
    fireEvent.change(input, { target: { value: 'user@example.com' } })

    await act(async () => {
      fireEvent.submit(input.closest('form')!)
    })

    expect(screen.getByText(/receive a sign-in link/i)).toBeInTheDocument()
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

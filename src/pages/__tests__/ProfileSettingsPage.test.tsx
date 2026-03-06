import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSignOut = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    profile: { display_name: 'Test User', research_consent: true },
    signOut: mockSignOut,
  }),
}))

const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: (...args: unknown[]) => mockUpdate(...args) }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
    },
  },
}))

import ProfileSettingsPage from '../ProfileSettingsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfileSettingsPage />
    </MemoryRouter>,
  )
}

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  })

  it('renders heading and pre-filled form', () => {
    renderPage()
    expect(screen.getByText('Profile settings')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('email field is read-only', () => {
    renderPage()
    const emailInput = screen.getByDisplayValue('test@example.com')
    expect(emailInput).toHaveAttribute('readOnly')
  })

  it('saves profile on button click', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled()
    })
    // Saves the current profile values
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      display_name: 'Test User',
      research_consent: true,
    })
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument()
  })

  it('shows delete confirmation modal', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
    expect(screen.getByText('Delete your account?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type delete/i)).toBeInTheDocument()
  })

  it('delete button requires typing DELETE', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
    const confirmBtn = screen.getByRole('button', { name: /delete permanently/i })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/type delete/i), {
      target: { value: 'DELETE' },
    })
    expect(confirmBtn).not.toBeDisabled()
  })
})

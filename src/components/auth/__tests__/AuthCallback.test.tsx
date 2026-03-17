import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let authSubscriptionCb: ((event: string) => void) | null = null
const mockUnsubscribe = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authSubscriptionCb = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      },
    },
  },
}))

import AuthCallback from '../AuthCallback'

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    authSubscriptionCb = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows signing-in message', () => {
    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>,
    )
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument()
  })

  it('navigates to / on SIGNED_IN event', () => {
    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>,
    )
    authSubscriptionCb?.('SIGNED_IN')
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('redirects to login on timeout', () => {
    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>,
    )
    vi.advanceTimersByTime(11_000)
    expect(mockNavigate).toHaveBeenCalledWith('/login?error=expired', { replace: true })
  })
})

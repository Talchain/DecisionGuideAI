import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

let mockAuth = { loading: false, authenticated: false }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

import AuthGuard from '../AuthGuard'

function renderWithRoutes(initialEntries = ['/protected']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard', () => {
  it('shows spinner while loading', () => {
    mockAuth = { loading: true, authenticated: false }
    renderWithRoutes()
    // Loader2 renders an svg, no "Protected Content" or "Login Page"
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    mockAuth = { loading: false, authenticated: false }
    renderWithRoutes()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockAuth = { loading: false, authenticated: true }
    renderWithRoutes()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})

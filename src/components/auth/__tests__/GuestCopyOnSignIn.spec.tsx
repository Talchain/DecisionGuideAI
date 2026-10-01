/**
 * ACCOUNTS B3 — the shell listener: a guest → signed-in transition copies the
 * guest decision ONCE and, when the user is still on the guest decision, opens
 * the COPY. A returning user's focus/refresh events send nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

type AuthCallback = (event: string, session: { access_token: string } | null) => void
const auth = vi.hoisted(() => ({ callbacks: [] as Array<(event: string, session: unknown) => void>, stored: false, unavailable: false }))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        if (auth.unavailable) throw new Error('auth client unavailable')
        auth.callbacks.push(cb)
        return { data: { subscription: { unsubscribe: () => { auth.callbacks = auth.callbacks.filter((c) => c !== cb) } } } }
      },
    },
  },
}))
vi.mock('../../../lib/storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => auth.stored }))

const mockRequest = vi.fn()
vi.mock('../../../services/guestCopyService', () => ({
  requestGuestCopy: (...args: unknown[]) => mockRequest(...args),
}))

import GuestCopyOnSignIn from '../GuestCopyOnSignIn'

const GUEST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'
const TOKEN = 'eyJ.header.sig'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GuestCopyOnSignIn />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

function emit(event: string, session: { access_token: string } | null) {
  act(() => { auth.callbacks.forEach((cb) => (cb as AuthCallback)(event, session)) })
}

beforeEach(() => {
  localStorage.clear()
  auth.callbacks = []
  auth.stored = false
  auth.unavailable = false
  mockRequest.mockReset()
})

describe('GuestCopyOnSignIn', () => {
  it('guest on the canvas signs in → ONE copy of the guest id → the COPY opens', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    renderAt('/canvas')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: TOKEN })

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/scenario/${COPY}`))
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(mockRequest).toHaveBeenCalledWith(GUEST, TOKEN)
  })

  it('CONTRAST: signed in on the hub → copied, but no navigation (the refreshed list shows it)', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    renderAt('/')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: TOKEN })

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('where').textContent).toBe('/')
  })

  it('a returning signed-in user: restore + focus SIGNED_IN events send NOTHING when nothing is pending', async () => {
    auth.stored = true
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    renderAt('/')

    emit('INITIAL_SESSION', { access_token: TOKEN })
    emit('SIGNED_IN', { access_token: TOKEN })
    emit('SIGNED_IN', { access_token: TOKEN })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockRequest).not.toHaveBeenCalled()
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBeNull()
  })

  it('a copy kept by an earlier 503 is retried ONCE on the next signed-in page load', async () => {
    auth.stored = true
    localStorage.setItem('olumi.pendingGuestCopy.v1', GUEST)
    mockRequest.mockResolvedValue({ kind: 'retry_later', reason: 'copy_unavailable' })
    renderAt('/')

    emit('INITIAL_SESSION', { access_token: TOKEN })
    emit('SIGNED_IN', { access_token: TOKEN })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBe(GUEST)
  })

  it('auth unavailable (stubbed or failing client): the shell still renders, nothing is sent', () => {
    auth.unavailable = true
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)

    expect(() => renderAt('/canvas')).not.toThrow()
    expect(screen.getByTestId('where').textContent).toBe('/canvas')
    expect(mockRequest).not.toHaveBeenCalled()
  })
})

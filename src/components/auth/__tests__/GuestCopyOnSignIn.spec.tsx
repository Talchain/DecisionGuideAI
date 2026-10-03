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

// The real-store adoption has its own row (lib/__tests__/guestCopyOnSignIn.spec.ts).
// Here the store is stubbed so a slow dynamic import under load cannot hold one
// row's copy in flight into the next row (runs are de-duplicated module-wide).
const mockAdopt = vi.fn()
const store = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => ({ currentScenarioId: store.current, adoptScenario: mockAdopt }) },
}))

const mockRequest = vi.fn()
vi.mock('../../../services/guestCopyService', () => ({
  requestGuestCopy: (...args: unknown[]) => mockRequest(...args),
}))

import GuestCopyOnSignIn from '../GuestCopyOnSignIn'

const GUEST = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'
const TOKEN = 'eyJ.header.sig'
const OTHER = '9f8b7a6c-1234-4def-8abc-0123456789ab'

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
  mockAdopt.mockReset()
  store.current = GUEST
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
    expect(mockAdopt).toHaveBeenCalledWith(COPY)
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

  it('owner ruling: a 503 keeps the id → SIGNED_OUT → user B signs in → NO copy call for B', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    mockRequest.mockResolvedValue({ kind: 'retry_later', reason: 'copy_unavailable' })
    renderAt('/')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: 'token-a' })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBe(GUEST)

    emit('SIGNED_OUT', null)
    emit('SIGNED_IN', { access_token: 'token-b' })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(mockRequest).not.toHaveBeenCalledWith(GUEST, 'token-b')
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBeNull()
  })

  it('CONTRAST: after the sign-out a guest starts a NEW decision → the next sign-in copies THAT one', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    mockRequest.mockResolvedValue({ kind: 'retry_later', reason: 'copy_unavailable' })
    renderAt('/')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: 'token-a' })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    emit('SIGNED_OUT', null)
    localStorage.setItem('olumi-canvas-current-scenario-id', OTHER)
    emit('SIGNED_IN', { access_token: 'token-b' })

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))
    expect(mockRequest).toHaveBeenLastCalledWith(OTHER, 'token-b')
  })

  it('on an UNRELATED scenario route: copied, but no adoption and no navigation away from what the user opened', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    store.current = OTHER
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    renderAt(`/scenario/${OTHER}`)

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: TOKEN })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockAdopt).not.toHaveBeenCalled()
    expect(screen.getByTestId('where').textContent).toBe(`/scenario/${OTHER}`)
  })

  it('on /canvas but adoption DECLINED (another decision is live): no navigation', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    store.current = OTHER
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    renderAt('/canvas')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: TOKEN })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockAdopt).not.toHaveBeenCalled()
    expect(screen.getByTestId('where').textContent).toBe('/canvas')
  })

  it('account changes while the copy runs: the first account\'s late success adopts, navigates and clears NOTHING', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    let finish: (o: unknown) => void = () => {}
    mockRequest.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderAt('/canvas')

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: 'token-a', user: { id: 'user-a' } } as never)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith(GUEST, 'token-a'))
    emit('SIGNED_IN', { access_token: 'token-b', user: { id: 'user-b' } } as never)
    await act(async () => { finish({ kind: 'copied', scenarioId: COPY, created: true }); await new Promise((r) => setTimeout(r, 0)) })

    expect(mockAdopt).not.toHaveBeenCalled()
    expect(screen.getByTestId('where').textContent).toBe('/canvas')
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBe(GUEST)
  })

  it('route already names ANOTHER scenario while the store still shows the guest (its load in flight): NO adoption, no navigation', async () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', GUEST)
    store.current = GUEST
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    renderAt(`/scenario/${OTHER}`)

    emit('INITIAL_SESSION', null)
    emit('SIGNED_IN', { access_token: TOKEN })
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(mockAdopt).not.toHaveBeenCalled()
    expect(screen.getByTestId('where').textContent).toBe(`/scenario/${OTHER}`)
  })
})

/**
 * The guest model a colleague built before signing in must still be findable
 * afterwards.
 *
 * ── THE HARM ───────────────────────────────────────────────────────────────
 * Ownership is decided by a scenario's FIRST writer and never revisited
 * (`ensure_scenario_exists` inserts `ON CONFLICT (id) DO NOTHING`), so a model
 * begun as a guest is stamped `user_id = NULL` for good. `listScenarios`
 * filters on `user_id`, so it never appears in the account. The scenario's UUID
 * is the only route back to it — and the live pointer holding that UUID is
 * rewritten by the first scenario the signed-in user opens
 * (`canvas/store.ts:4654`) or creates (`canvas/store/scenarios.ts:344`).
 *
 * ── WHY THE CAPTURE SITS HERE AND NOT IN THE PROVIDER ───────────────────────
 * The defect is NOT that sign-in clears the pointer — it does not, and a fix
 * written on that assumption would be pointed at the wrong moment and would
 * still look correct. The pointer dies at the DESTINATION, so the capture must
 * happen on the success path BEFORE this page routes.
 *
 * ── WHAT THESE CASES PIN, IN BOTH DIRECTIONS ───────────────────────────────
 * A guard that only checks the capture fires would pass just as happily if it
 * fired on every render, including a FAILED sign-in — which would record a
 * stranger's scenario id against whoever next signs in on a shared browser. So
 * every positive case here has its opposite-direction twin (CLAUDE.md trap
 * 22b): captured on success, and provably NOT captured on any refusal.
 *
 * These cases use the REAL `pendingGuestClaim` module against real
 * localStorage rather than a mock, so they test the wiring and the storage
 * contract together — a mock would pass even if the key were wrong.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockSignInWithPassword = vi.fn()
let mockAuthenticated = false
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authenticated: mockAuthenticated,
    signInWithPassword: mockSignInWithPassword,
  }),
}))

import LoginPage from '../LoginPage'
import { PENDING_GUEST_CLAIM_KEY, readPendingGuestClaim } from '../../../lib/pendingGuestClaim'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'
const GUEST_SCENARIO = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  )
}

function signIn(email = 'owner@example.com', password = 'correct-horse') {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } })
  fireEvent.change(screen.getByTestId('owner-password-input'), { target: { value: password } })
  return act(async () => {
    fireEvent.submit(screen.getByTestId('owner-password-form'))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockAuthenticated = false
  mockSignInWithPassword.mockResolvedValue({ error: null })
})

/**
 * The storage-unavailable case stubs `Storage.prototype.setItem`, which is
 * GLOBAL. Without this, the stub outlives the file and a sibling spec sharing
 * the worker gets a localStorage that throws — see the twin note in
 * `lib/__tests__/pendingGuestClaim.spec.ts` for the run that measured it.
 */
afterEach(() => {
  vi.restoreAllMocks()
})

describe('LoginPage — pending guest claim capture', () => {
  it('captures the guest scenario id on a successful sign-in', async () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    renderLogin()

    await signIn()

    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  it('the captured id survives the pointer being rewritten by the destination', async () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    renderLogin()
    await signIn()

    // What `goToApp()` leads to: a scenario is opened, rewriting the pointer.
    localStorage.setItem(CURRENT_SCENARIO_KEY, '11111111-2222-4333-8444-555555555555')

    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  // ── OPPOSITE-DIRECTION TWINS ───────────────────────────────────────────────
  // Each asserts the capture does NOT happen on a refusal. Without these, a
  // capture that fired unconditionally would pass every case above.

  it('does NOT capture when the credentials are refused', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: Object.assign(new Error('bad'), { status: 400 }) })
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    renderLogin()

    await signIn()

    expect(screen.getByTestId('owner-password-error')).toBeTruthy()
    expect(readPendingGuestClaim()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_CLAIM_KEY)).toBeNull()
  })

  it('does NOT capture on a server fault', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: Object.assign(new Error('boom'), { status: 500 }) })
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    renderLogin()

    await signIn()

    expect(screen.getByTestId('owner-password-server-error')).toBeTruthy()
    expect(readPendingGuestClaim()).toBeNull()
  })

  it('does NOT capture when rate-limited', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: Object.assign(new Error('slow down'), { status: 429 }) })
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    renderLogin()

    await signIn()

    expect(readPendingGuestClaim()).toBeNull()
  })

  it('does NOT capture merely from rendering the page', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)

    renderLogin()

    expect(readPendingGuestClaim()).toBeNull()
  })

  it('records nothing when the visitor built no model before signing in', async () => {
    renderLogin()

    await signIn()

    expect(readPendingGuestClaim()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_CLAIM_KEY)).toBeNull()
  })

  it('still signs the owner in when storage is unavailable', async () => {
    // The capture is a safety net, never a precondition: a storage failure must
    // not cost the owner their sign-in.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    renderLogin()

    await signIn()

    expect(screen.getByTestId('owner-password-signed-in')).toBeTruthy()
  })
})

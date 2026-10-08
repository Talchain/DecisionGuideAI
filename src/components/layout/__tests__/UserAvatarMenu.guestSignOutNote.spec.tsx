/**
 * P48 E (8 Oct 2026) — a guest's Sign out now runs the identity boundary (`AuthContext.optionalAuth.guestSignOutSweep`),
 * so Olumi stops reopening that guest's work in this browser. The guest is told on the Sign out item itself (DL: no
 * new dialog). Signed-in users are not shown it: their work comes back when they sign in again.
 *
 * The words say what changes for the person, never where the work is stored (`src/test/guestStorageClaims.ts`: the
 * model lives on Olumi's servers, and the scenario link is another way back), so the note is swept against those bans.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GUEST_STORAGE_CLAIM_PATTERNS } from '../../../test/guestStorageClaims'

// The served guest posture's user: the sentinel, NOT null (`AuthContext` optional-auth branch).
const GUEST = { id: 'guest', email: 'guest@poc' }
const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, profile: null, signOut: vi.fn(async () => ({ error: null })) }),
}))

import { UserAvatarMenu } from '../UserAvatarMenu'

const NOTE = 'Olumi won’t reopen your guest work here automatically'

function openMenu(): void {
  render(<MemoryRouter><UserAvatarMenu /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
}

describe('P48 E: the guest Sign out item says what Sign out changes', () => {
  beforeEach(() => { auth.user = GUEST })
  afterEach(() => { cleanup() })

  it('⭐ a guest sees the note ON the Sign out item', () => {
    openMenu()
    const item = screen.getByRole('menuitem', { name: /Sign out/ })
    const note = screen.getByTestId('sign-out-guest-note')
    expect(note.textContent).toBe(NOTE)
    expect(item.contains(note)).toBe(true)
  })

  it('CONTROL: a signed-in user sees Sign out with no note', () => {
    auth.user = { id: '11111111-2222-4333-8444-555555555555', email: 'a@example.com' }
    openMenu()
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeTruthy()
    expect(screen.queryByTestId('sign-out-guest-note')).toBeNull()
  })

  it('the note makes no guest-storage claim (swept against the shared bans)', () => {
    expect(GUEST_STORAGE_CLAIM_PATTERNS.length).toBeGreaterThan(0)
    expect(GUEST_STORAGE_CLAIM_PATTERNS.filter(re => re.test(NOTE))).toEqual([])
  })
})

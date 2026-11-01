/**
 * The olumi-core lane has no accounts behind it (the Supabase address is dead on purpose), so the account chrome that leads there
 * must not be offered: a person is who their private link says. Off the lane nothing changes (the menu is the menu).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'guest', email: 'guest@poc' }, profile: null, signOut: vi.fn(async () => ({ error: null })) }),
}))

import { UserAvatarMenu } from '../../components/layout/UserAvatarMenu'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('the account menu on the olumi-core lane', () => {
  it('is a plain mark saying whose private link this page was opened with, and opens nothing that cannot work', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    vi.stubGlobal('window', Object.assign(window, { __OLUMI_CORE__: { person: { id: '1', name: 'Ada' } } }))
    render(<MemoryRouter><UserAvatarMenu size="compact" /></MemoryRouter>)
    const mark = screen.getByTestId('olumi-core-person-mark')
    expect(mark.getAttribute('aria-label')).toBe('You are using Olumi through Ada’s private link')
    expect(mark.textContent).toBe('A')
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull()
    fireEvent.click(mark)
    for (const gone of [/Profile settings/, /My scenarios/, /Sign out/, /Sign in/, /Delete account/]) expect(screen.queryByText(gone)).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('CONTROL: off the lane the account menu is the menu it was (profile, scenarios, sign out)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<MemoryRouter><UserAvatarMenu /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: /Profile settings/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /My scenarios/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeTruthy()
    expect(screen.queryByTestId('olumi-core-person-mark')).toBeNull()
  })
})

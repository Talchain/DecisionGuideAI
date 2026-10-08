import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

vi.mock('../../lib/monitoring', () => ({ initMonitoring: () => {} }))
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ loading: false, authenticated: true }),
}))
vi.mock('../../components/auth/GuestCopyOnSignIn', () => ({ default: () => null }))
vi.mock('../../components/auth/AuthGuard', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => createElement(Outlet) }
})
const stub = (id: string) => ({ default: () => createElement('button', { 'data-testid': id }, id) })
vi.mock('../../routes/CanvasMVP', () => stub('deployed-canvas'))
vi.mock('../../pages/ProfileSettingsPage', () => stub('deployed-profile'))

const EPOCH = 'olumi-canvas-identity-epoch'
beforeEach(() => { cleanup(); vi.resetModules(); localStorage.clear() })
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = '' })

it.each([['#/canvas', 'deployed-canvas'], ['#/profile', 'deployed-profile']])(
  'the real AppPoC shell mounts the blocking lock on %s', async (route, marker) => {
    localStorage.setItem(EPOCH, 'before|owner:A')
    // Capture this page's era before the real deployed shell is imported.
    await import('../../canvas/store/scenarios')
    const { default: AppPoC } = await import('../AppPoC')
    window.location.hash = route
    render(createElement(AppPoC))
    await waitFor(() => expect(screen.getByTestId(marker)).toBeInTheDocument())
    const underlying = screen.getByTestId(marker)
    const clicked = vi.fn()
    underlying.addEventListener('click', clicked)
    act(() => {
      localStorage.setItem(EPOCH, 'after|owner:B')
      fireEvent(window, new StorageEvent('storage', { key: EPOCH }))
    })
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Someone signed in or out in another tab. Reload this tab to carry on.',
    )
    fireEvent.click(underlying)
    expect(clicked).not.toHaveBeenCalled()
  },
)

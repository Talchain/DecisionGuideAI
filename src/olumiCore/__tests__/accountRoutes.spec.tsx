/**
 * On the olumi-core lane a typed, bookmarked or remembered address for a page that needs an account (profile settings, sign in,
 * "My scenarios", the shared pages) lands on the canvas: it must never reach a page that cannot work (Profile settings stuck on
 * "Saving...", a sign-in form with nothing behind it). Off the lane the same addresses are the pages they were.
 * Same harness as `src/poc/__tests__/AppPoC.routing.spec.tsx`: the lazy pages are stubbed, the router's decision is under test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

vi.mock('../../lib/monitoring', () => ({ initMonitoring: () => {} }))
vi.mock('../../contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: unknown }) => children, useAuth: () => ({ loading: false, authenticated: true }) }))
vi.mock('../../components/auth/AuthGuard', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => createElement(Outlet) }
})
const stub = (testid: string) => ({ default: () => createElement('div', { 'data-testid': testid }) })
vi.mock('../../routes/CanvasMVP', () => stub('route-canvas'))
vi.mock('../../pages/ScenarioListPage', () => stub('route-scenarios'))
vi.mock('../../pages/ProfileSettingsPage', () => stub('route-profile'))
vi.mock('../../components/auth/LoginPage', () => stub('route-login'))
vi.mock('../../pages/PanelSetupPage', () => stub('route-panel-setup'))
vi.mock('../accounts/MyScenariosPage', () => stub('route-my-scenarios'))
vi.mock('../accounts/SignInPage', () => stub('route-signin'))
vi.mock('../accounts/SignUpPage', () => stub('route-signup'))
vi.mock('../accounts/JoinPage', () => stub('route-join'))
vi.mock('../accounts/OrganisationPage', () => stub('route-organisation'))
vi.mock('../accounts/AccountPage', () => stub('route-account'))

import AppPoC from '../../poc/AppPoC'

const ACCOUNT_PAGES = [
  ['/profile', 'route-profile'], ['/login', 'route-login'], ['/scenarios', 'route-scenarios'],
  ['/scenario/00000000-0000-4000-8000-437f3c107bdd/panel', 'route-panel-setup'],
] as const

const renderAt = (hash: string) => { window.location.hash = hash; return render(createElement(AppPoC)) }

describe('account pages on the olumi-core lane', () => {
  beforeEach(() => { localStorage.clear(); window.location.hash = '' })
  afterEach(() => { localStorage.clear(); window.location.hash = ''; vi.unstubAllEnvs() })

  it.each(ACCOUNT_PAGES)('%s lands on the canvas, never the page', async (path, testid) => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    renderAt(`#${path}`)
    await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
    expect(screen.queryByTestId(testid)).not.toBeInTheDocument()
  })

  // POSITIVE CONTROL: off the lane the same addresses are the pages, so the absences above are ones this harness can see.
  it.each(ACCOUNT_PAGES)('CONTROL, off the lane: %s is its page', async (path, testid) => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    renderAt(`#${path}`)
    await waitFor(() => expect(screen.getByTestId(testid)).toBeInTheDocument())
    expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
  })

  // The retired two-scenario page (audit RIP OUT, 10 Nov): its address opens the scenario on its Compare tab, on the lane and off it.
  it.each([['1'], ['']])('VITE_OLUMI_CORE=%j: /scenario/:id/compare opens /scenario/:id?tab=compare on the canvas', async (lane) => {
    vi.stubEnv('VITE_OLUMI_CORE', lane)
    renderAt('#/scenario/00000000-0000-4000-8000-437f3c107bdd/compare')
    await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
    expect(window.location.hash).toBe('#/scenario/00000000-0000-4000-8000-437f3c107bdd?tab=compare')
  })

  // PoC accounts (src/olumiCore/accounts/): on the lane home is My scenarios; off it, home is the scenario list it was.
  it('home on the lane is My scenarios, never the canvas or the legacy list', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    renderAt('#/')
    await waitFor(() => expect(screen.getByTestId('route-my-scenarios')).toBeInTheDocument())
    expect(screen.queryByTestId('route-scenarios')).not.toBeInTheDocument()
    expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
  })
  it('CONTROL, off the lane: home is the scenario list', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    renderAt('#/')
    await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
    expect(screen.queryByTestId('route-my-scenarios')).not.toBeInTheDocument()
  })
  it.each([['/signin', 'route-signin'], ['/signup', 'route-signup'], ['/join/abcdefghijklmnop', 'route-join'], ['/organisation', 'route-organisation'], ['/account', 'route-account']] as const)(
    'on the lane %s is its account page; off the lane it goes home', async (path, testid) => {
      vi.stubEnv('VITE_OLUMI_CORE', '1')
      const lane = renderAt(`#${path}`)
      await waitFor(() => expect(screen.getByTestId(testid)).toBeInTheDocument())
      lane.unmount()
      vi.stubEnv('VITE_OLUMI_CORE', '')
      renderAt(`#${path}`)
      await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument()
    })

  it('the canvas itself, and a scenario address, are untouched on the lane', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    renderAt('#/scenario/00000000-0000-4000-8000-437f3c107bdd')
    await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
  })
})

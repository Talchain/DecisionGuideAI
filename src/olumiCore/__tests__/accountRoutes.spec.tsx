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
vi.mock('../../pages/ScenarioComparePage', () => stub('route-compare'))
vi.mock('../../pages/PanelSetupPage', () => stub('route-panel-setup'))

import AppPoC from '../../poc/AppPoC'

const ACCOUNT_PAGES = [
  ['/profile', 'route-profile'], ['/login', 'route-login'], ['/scenarios', 'route-scenarios'], ['/', 'route-scenarios'],
  ['/scenario/00000000-0000-4000-8000-437f3c107bdd/compare', 'route-compare'], ['/scenario/00000000-0000-4000-8000-437f3c107bdd/panel', 'route-panel-setup'],
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

  it('the canvas itself, and a scenario address, are untouched on the lane', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    renderAt('#/scenario/00000000-0000-4000-8000-437f3c107bdd')
    await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
  })
})

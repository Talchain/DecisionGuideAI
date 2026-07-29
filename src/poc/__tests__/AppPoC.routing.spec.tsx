// src/poc/__tests__/AppPoC.routing.spec.tsx
//
// TESTER-SAFE ROUTING. Two guarantees about the router in src/poc/AppPoC.tsx,
// both stated from the point of view of a tester on a DEPLOYED build (where
// `devRoutes` is off, because nothing sets VITE_ENABLE_DEV_ROUTES and no
// tester has the localStorage override):
//
//   1. An unrecognised URL lands on the CANVAS — never on the POC sandbox.
//   2. The developer scaffolding routes (/plot, /plot-legacy, /plc,
//      /sandbox-v1, /dev/hero-gallery) are not reachable; they land on the
//      canvas too.
//
// POSITIVE CONTROL (trap 13 — an absence assertion must first prove it can see
// a presence): every "is not reachable" case is paired with a flag-on case that
// asserts the SAME testid IS rendered. Without those, a typo in a stub or a
// route path would make every absence assertion pass by testing nothing.
//
// The lazy route modules are stubbed: what is under test is the router's
// DECISION, not the pages it mounts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

vi.mock('../../lib/monitoring', () => ({ initMonitoring: () => {} }))

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ loading: false, authenticated: true }),
}))

vi.mock('../../components/auth/AuthGuard', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => createElement(Outlet) }
})

const stub = (testid: string) => ({
  default: () => createElement('div', { 'data-testid': testid }),
})

vi.mock('../../routes/CanvasMVP', () => stub('route-canvas'))
vi.mock('../../routes/PlotWorkspace', () => stub('route-plot'))
vi.mock('../../routes/PlotShowcase', () => stub('route-plot-legacy'))
vi.mock('../../routes/PlcLab', () => stub('route-plc'))
vi.mock('../../routes/SandboxV1', () => stub('route-sandbox-v1'))
vi.mock('../../routes/HeroGallery', () => stub('route-hero-gallery'))
vi.mock('../../pages/ScenarioListPage', () => stub('route-scenarios'))

// The POC sandbox is what the catch-all renders TODAY. Stub it so "we did not
// land on the sandbox" is a crisp assertion rather than a guess about copy.
vi.mock('../components/SandboxHeader', () => ({
  default: () => createElement('div', { 'data-testid': 'poc-sandbox' }),
  __esModule: true,
}))

import AppPoC from '../AppPoC'

const DEV_ROUTE_PATHS = [
  ['/plot', 'route-plot'],
  ['/plot-legacy', 'route-plot-legacy'],
  ['/plc', 'route-plc'],
  ['/sandbox-v1', 'route-sandbox-v1'],
  ['/dev/hero-gallery', 'route-hero-gallery'],
] as const

function renderAt(hash: string) {
  window.location.hash = hash
  return render(createElement(AppPoC))
}

describe('AppPoC routing — tester-safe surface', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })
  afterEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  describe('catch-all', () => {
    it('lands a mistyped URL on the canvas, not the POC sandbox', async () => {
      renderAt('#/canvs')
      await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
    })

    it('lands a deep unknown path on the canvas', async () => {
      renderAt('#/some/unknown/deep/path')
      await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
    })

    // POSITIVE CONTROL: the sandbox stub CAN render — so the two assertions
    // above are absences the test is able to see, not vacuous passes.
    it('still renders the POC sandbox on the catch-all when dev routes are on', async () => {
      localStorage.setItem('feature.devRoutes', '1')
      renderAt('#/canvs')
      await waitFor(() => expect(screen.getByTestId('poc-sandbox')).toBeInTheDocument())
      expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
    })
  })

  describe('developer routes are gated', () => {
    it.each(DEV_ROUTE_PATHS)('%s lands on the canvas when dev routes are off', async (path, testid) => {
      renderAt(`#${path}`)
      await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument()
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
    })

    // POSITIVE CONTROL for every path above.
    it.each(DEV_ROUTE_PATHS)('%s renders its scaffold when dev routes are on', async (path, testid) => {
      localStorage.setItem('feature.devRoutes', '1')
      renderAt(`#${path}`)
      await waitFor(() => expect(screen.getByTestId(testid)).toBeInTheDocument())
    })
  })

  describe('product routes are untouched', () => {
    it('/canvas still renders the canvas', async () => {
      renderAt('#/canvas')
      await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument())
    })

    it('/scenarios still renders the scenario list', async () => {
      renderAt('#/scenarios')
      await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
    })
  })
})

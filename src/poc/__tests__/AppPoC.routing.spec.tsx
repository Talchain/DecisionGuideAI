// src/poc/__tests__/AppPoC.routing.spec.tsx
//
// TESTER-SAFE ROUTING. Three guarantees about the router in src/poc/AppPoC.tsx,
// all stated from the point of view of a tester on a DEPLOYED build (where
// `devRoutes` is off, because nothing sets VITE_ENABLE_DEV_ROUTES and no
// tester has the localStorage override):
//
//   1. An unrecognised URL lands on the SCENARIO LIST (`/`) — never on the POC
//      sandbox.
//   2. The developer scaffolding routes (/plot, /plot-legacy, /plc,
//      /sandbox-v1, /dev/hero-gallery, /test) are not reachable; they land on
//      the scenario list too.
//   3. The destination is `/` and NOT `/canvas`. This is asserted explicitly,
//      not incidentally: `/canvas` opens a blank "Untitled decision" and an
//      open canvas is a live writer (the staging hazard where an open canvas
//      recreates deleted scenario rows). A mistyped URL must land somewhere
//      read-only. Every case below therefore also asserts `route-canvas` is
//      ABSENT, so a drift back to `<Navigate to="/canvas">` reds.
//
// POSITIVE CONTROL (trap 13 — an absence assertion must first prove it can see
// a presence): every "is not reachable" case is paired with a flag-on case that
// asserts the SAME testid IS rendered. Without those, a typo in a stub or a
// route path would make every absence assertion pass by testing nothing.
//
// `/test` IS COVERED HERE BECAUSE IT WAS NOT (adversarial review of PR #530,
// finding A1). It was gated with zero coverage: un-gating AppPoC.tsx's `/test`
// route left this spec 15/15 green and `vitest run src/poc/` 34/34 green, so
// the gate on the most guessable sandbox URL in the app was unpinned — real
// today, and nothing would have noticed when it stopped being real.
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

// Every gated path, paired with the testid that proves its scaffold mounted.
// `/test` renders MainSandboxContent, whose stub marker is `poc-sandbox` — the
// same marker the catch-all uses, because they render the same POC sandbox.
// MUST stay in step with the <DevRoute>-wrapped routes in AppPoC.tsx.
const DEV_ROUTE_PATHS = [
  ['/plot', 'route-plot'],
  ['/plot-legacy', 'route-plot-legacy'],
  ['/plc', 'route-plc'],
  ['/sandbox-v1', 'route-sandbox-v1'],
  ['/dev/hero-gallery', 'route-hero-gallery'],
  ['/test', 'poc-sandbox'],
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
    it('lands a mistyped URL on the scenario list, not the POC sandbox', async () => {
      renderAt('#/canvs')
      await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
      // Destination pinned: NOT the canvas — a blank canvas is a live writer.
      expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
    })

    it('lands a deep unknown path on the scenario list', async () => {
      renderAt('#/some/unknown/deep/path')
      await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
      expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
    })

    // POSITIVE CONTROL: the sandbox stub CAN render — so the assertions above
    // are absences the test is able to see, not vacuous passes.
    it('still renders the POC sandbox on the catch-all when dev routes are on', async () => {
      localStorage.setItem('feature.devRoutes', '1')
      renderAt('#/canvs')
      await waitFor(() => expect(screen.getByTestId('poc-sandbox')).toBeInTheDocument())
      expect(screen.queryByTestId('route-scenarios')).not.toBeInTheDocument()
    })
  })

  describe('developer routes are gated', () => {
    it.each(DEV_ROUTE_PATHS)('%s lands on the scenario list when dev routes are off', async (path, testid) => {
      renderAt(`#${path}`)
      await waitFor(() => expect(screen.getByTestId('route-scenarios')).toBeInTheDocument())
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument()
      expect(screen.queryByTestId('poc-sandbox')).not.toBeInTheDocument()
      // Destination pinned: NOT the canvas.
      expect(screen.queryByTestId('route-canvas')).not.toBeInTheDocument()
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

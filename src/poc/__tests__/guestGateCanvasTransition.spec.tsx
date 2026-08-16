// src/poc/__tests__/guestGateCanvasTransition.spec.tsx
//
// THE FRESH GUEST'S FIRST CLICK. On the landing gate ("Sign in to save and
// manage your decisions"), "Continue without an account" calls
// `navigate('/canvas')` (src/pages/ScenarioListPage.tsx:387). The hash changes
// immediately — and, before this spec, the GATE STAYED ON SCREEN for the whole
// time the canvas chunk was downloading, with no spinner and no disabled
// button. A fresh guest's first click appeared to do nothing.
//
// MECHANISM. `<HashRouter future={{ v7_startTransition: true }}>`
// (AppPoC.tsx:895) wraps every navigation state update in
// `React.startTransition`. React's transition rule is that it will NOT replace
// already-revealed content with a fallback — so the single `<Suspense>` ABOVE
// `<Routes>` (AppPoC.tsx:903), which has long since committed the gate, shows
// nothing at all and React simply holds the old UI until the new tree is ready.
// `/canvas` is `lazy` (AppPoC.tsx:23) and pulls ~2.06 MB on staging
// (CanvasMVP 64 KB + ReactFlowGraph 1.94 MB + CSS), fetched as a waterfall.
// The fix gives the routed element its own boundary: a Suspense boundary that
// is NEWLY MOUNTED by the transition has no revealed content to preserve, so it
// shows its fallback at once.
//
// WHY THE LAZY IMPORT IS HELD OPEN HERE. The defect only exists while the chunk
// is in flight, so the test must be able to stand in that window. The CanvasMVP
// mock is a promise this spec resolves by hand — until it does, the route is
// exactly where a real guest on a cold cache spends those seconds.
//
// POSITIVE CONTROL (trap 13): the first case asserts the gate IS on screen
// before the click, so "the gate is gone" afterwards is an absence this spec
// can actually see rather than a query that never matched anything.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createElement } from 'react'

// The canvas chunk, held in flight until the test resolves it by hand.
const canvasChunk = vi.hoisted(() => {
  let resolve!: (mod: unknown) => void
  const promise = new Promise<unknown>(r => { resolve = r })
  return { promise, resolve }
})

vi.mock('../../lib/monitoring', () => ({ initMonitoring: () => {} }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => {} }))

// A guest: ready immediately, counts as authenticated so every route stays
// reachable (contexts/AuthContext.tsx:475), and persistence is off — which is
// the exact condition ScenarioListPage renders the gate under.
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ loading: false, authenticated: true, user: { id: 'guest', email: 'guest@poc' } }),
}))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    createScenario: async () => {},
    deleteScenario: async () => {},
    isPersistenceActive: false,
  }),
}))
vi.mock('../../services/scenarioService', () => ({
  listScenarios: async () => [],
  duplicateScenario: async () => {},
  updateScenario: async () => {},
  deleteScenario: async () => {},
  createScenario: async () => {},
}))
vi.mock('../../components/auth/GuestDraftImportBanner', () => ({
  GuestDraftImportBanner: () => null,
}))

vi.mock('../../routes/CanvasMVP', () => canvasChunk.promise as Promise<{ default: () => unknown }>)

vi.mock('../components/SandboxHeader', () => ({
  default: () => createElement('div', { 'data-testid': 'poc-sandbox' }),
  __esModule: true,
}))

import AppPoC from '../AppPoC'

const GATE_BUTTON = 'Continue without an account'

async function renderGateAndClick() {
  window.location.hash = '#/'
  render(createElement(AppPoC))
  const button = await screen.findByRole('button', { name: GATE_BUTTON }, { timeout: 5000 })
  // POSITIVE CONTROL: the gate is genuinely on screen before the click.
  expect(button).toBeInTheDocument()
  fireEvent.click(button)
  return button
}

describe('guest gate → canvas: the first click transitions without a reload', () => {
  beforeEach(() => { localStorage.clear(); window.location.hash = '' })
  afterEach(() => { localStorage.clear(); window.location.hash = '' })

  it('unmounts the gate and shows the canvas loading state while the chunk is still in flight', async () => {
    await renderGateAndClick()

    // The hash moves synchronously — this was never the broken half.
    expect(window.location.hash).toBe('#/canvas')

    // THE PIN. While the chunk is in flight the user must be shown the route's
    // own loading state, NOT the gate they just left. Bound by identity: the
    // fallback's accessible name is derived from the pathname
    // (RouteLoadingFallback.tsx:37), so this can only match the CANVAS route's
    // loading state — not some other spinner that happens to be on screen.
    await waitFor(
      () => expect(screen.getByRole('status', { name: 'Loading Canvas' })).toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.queryByRole('button', { name: GATE_BUTTON })).not.toBeInTheDocument()
  })

  it('mounts the canvas when the chunk resolves — no page reload involved', async () => {
    await renderGateAndClick()

    canvasChunk.resolve({
      default: () => createElement('div', { 'data-testid': 'route-canvas' }, 'canvas'),
    })

    await waitFor(() => expect(screen.getByTestId('route-canvas')).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByRole('button', { name: GATE_BUTTON })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/canvas')
  })
})

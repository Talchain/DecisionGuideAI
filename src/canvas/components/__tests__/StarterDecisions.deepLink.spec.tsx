/**
 * ⭐⭐ A SHAREABLE LINK OPENS ON A WORKED MODEL — `#/canvas?starter=<id>`.
 *
 * WHY A LINK AND NOT A CHANGE TO THE FRONT DOOR. The founder's ask was that the
 * first thing someone opening a shared link sees is a working model rather than
 * a chooser. Auto-opening a starter for EVERY visitor would do that — and would
 * also **trap them**: measured on the deployed build, the only route off a
 * starter board is "Olumi home", which returns to the SIGN-IN page, not to the
 * first-run screen. A guest who auto-opened a starter would land back on the
 * same starter on re-entry and could never reach "describe your own decision".
 *
 * So the link carries the behaviour and the default front door is untouched.
 * The no-param case below is the load-bearing test: it pins that an ordinary
 * visit still gets the chooser.
 *
 * ⚠ IT REUSES `handlePick`, NOT A SECOND COPY OF ITS GUARDS. That function
 * already holds the in-flight latch, the `confirmReplaceCanvas` gate, the
 * load-then-re-check-emptiness ordering and the honest failure toast. A second
 * apply path would agree with it today and drift after (CLAUDE.md trap 12) —
 * and the guard it would most likely lose is the one that stops a stale apply
 * destroying a graph that arrived while the chunk was in flight.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks -----------------------------------------------------------------

const confirmReplaceCanvasMock = vi.fn(() => true)
vi.mock('../../blueprints/loadTemplateBlueprint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../blueprints/loadTemplateBlueprint')>()
  return { ...actual, confirmReplaceCanvas: () => confirmReplaceCanvasMock() }
})

const applyStarterMock = vi.fn(async (_id: string) => ({ nodeCount: 18, edgeCount: 35 }))
const loadStarterPayloadMock = vi.fn(async (_id: string) => ({ nodes: [], edges: [] }))
vi.mock('../../starters/loadStarter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../starters/loadStarter')>()
  return {
    ...actual,
    applyStarter: (id: string) => applyStarterMock(id),
    loadStarterPayload: (id: string) => loadStarterPayloadMock(id),
  }
})

const showToastMock = vi.fn()
/**
 * ⚠ THE TOAST HOOK'S IDENTITY IS CONTROLLABLE HERE ON PURPOSE.
 *
 * `handlePick` is `useCallback(..., [showToast])` and the auto-open effect
 * depends on `handlePick`. Today `useShowToastSafe` is permanently stable
 * (`ToastContext.tsx:41,56` — both `useCallback(..., [])`), so the effect can
 * never re-run inside one mount and the once-only latch is UNREACHABLE. A
 * mutant deleting that latch therefore survived every other test here.
 *
 * Rather than ship a guard no test can see, this flag reproduces the one future
 * change that makes it load-bearing: a `showToast` that is no longer memoised.
 */
let unstableToastIdentity = false
vi.mock('../../ToastContext', () => ({
  useShowToastSafe: () => (unstableToastIdentity ? (...a: unknown[]) => showToastMock(...a) : showToastMock),
}))

import { StarterDecisions, STARTER_LOAD_FAILED_MESSAGE } from '../StarterDecisions'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

// --- helpers ---------------------------------------------------------------

function setGraph(nodeCount: number) {
  useCanvasStore.setState({
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `n${i}` },
    })) as never,
    edges: [] as never,
  })
}

function setHash(h: string) {
  window.location.hash = h
}

function clearGraph() {
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  clearGraph()
  setHash('#/canvas')
})

describe('a shared link can open straight onto a worked model', () => {
  it('⭐ PRECONDITION: the id used below is a real starter, not an invented one', () => {
    // A test that auto-opens a non-existent starter would pass the "nothing
    // happened" assertions for the wrong reason.
    expect(STARTERS.map(s => s.id)).toContain('vendor-selection')
  })

  it('⭐⭐ opens the named starter with NO click', async () => {
    setHash('#/canvas?starter=vendor-selection')
    render(<StarterDecisions />)
    await waitFor(() => expect(applyStarterMock).toHaveBeenCalledWith('vendor-selection'))
  })

  it('⛔ THE LOAD-BEARING ONE: with no param, nothing opens and the chooser stands', async () => {
    render(<StarterDecisions />)
    // Give any effect a chance to fire before asserting absence.
    await new Promise(r => setTimeout(r, 50))
    expect(applyStarterMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('starter-decisions')).toBeTruthy()
  })

  it('⛔ an unknown id opens nothing and still shows the chooser', async () => {
    setHash('#/canvas?starter=not-a-real-starter')
    render(<StarterDecisions />)
    await new Promise(r => setTimeout(r, 50))
    expect(applyStarterMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('starter-decisions')).toBeTruthy()
  })

  it('⛔ it never replaces work: a canvas with a graph ignores the param', async () => {
    setGraph(5)
    setHash('#/canvas?starter=vendor-selection')
    render(<StarterDecisions />)
    await new Promise(r => setTimeout(r, 50))
    expect(applyStarterMock).not.toHaveBeenCalled()
  })

  it('⛔⛔ THE LATCH: it still applies once when the toast hook stops being memoised', async () => {
    // With an unstable `showToast`, `handlePick` gets a new identity on every
    // render, so the auto-open effect re-runs. Only the once-only latch stops a
    // second apply. Without this case the latch is unreachable and a mutant
    // deleting it survives — which is exactly what happened.
    unstableToastIdentity = true
    try {
      setHash('#/canvas?starter=vendor-selection')
      const { rerender } = render(<StarterDecisions />)
      await waitFor(() => expect(applyStarterMock).toHaveBeenCalledTimes(1))
      clearGraph()          // a failed/partial apply leaves the canvas empty
      rerender(<StarterDecisions />)
      rerender(<StarterDecisions />)
      await new Promise(r => setTimeout(r, 60))
      expect(
        applyStarterMock,
        'the link re-applied after its effect re-ran — the once-only latch is gone',
      ).toHaveBeenCalledTimes(1)
    } finally {
      unstableToastIdentity = false
    }
  })

  it('⛔ it applies ONCE, not on every render', async () => {
    setHash('#/canvas?starter=vendor-selection')
    const { rerender } = render(<StarterDecisions />)
    await waitFor(() => expect(applyStarterMock).toHaveBeenCalledTimes(1))
    rerender(<StarterDecisions />)
    rerender(<StarterDecisions />)
    await new Promise(r => setTimeout(r, 50))
    expect(applyStarterMock).toHaveBeenCalledTimes(1)
  })

  it('⭐ it goes through the real guard: a refused confirm applies nothing', async () => {
    confirmReplaceCanvasMock.mockReturnValueOnce(false)
    setHash('#/canvas?starter=vendor-selection')
    render(<StarterDecisions />)
    await new Promise(r => setTimeout(r, 50))
    expect(applyStarterMock).not.toHaveBeenCalled()
  })
})

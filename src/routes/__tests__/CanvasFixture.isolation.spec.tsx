/**
 * ⭐⭐ THE THREE CLAIMS THE SEEDED ROUTE MAKES, PINNED WHERE THEY CAN FAIL.
 *
 * The first version of this route asserted *"it never writes"* in a docblock and
 * proved it nowhere. Its specs called `applyDraftResult` directly and asserted
 * mapping counts — they never mounted the route, so they could not have seen the
 * writer that actually causes the loss (`useAutosave`, mounted by
 * `ReactFlowGraph` inside `CanvasMVP`, keyed on `currentScenarioId`).
 *
 * ⚠ WHAT THIS SPEC BINDS TO, AND WHAT IT DOES NOT. `CanvasMVP` is replaced by a
 * PROBE that reports what it sees at mount. That is deliberate and it is a real
 * limit: this spec proves the CONTEXT the canvas is mounted into, not the canvas
 * itself. The other half — that a suspended context defeats the real writers,
 * `saveAutosave`/`clearAutosave`/`saveScenario` included — is measured against
 * those real functions in `persist/__tests__/persistenceSuspension.spec.ts`.
 * Two halves, named apart, neither claiming the other's ground.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { useCanvasStore } from '../../canvas/store'
import { isPersistenceSuspended } from '../../canvas/persist/persistenceSuspension'

/** What the canvas saw at the moment it mounted. */
const seenAtMount: Array<{ suspended: boolean; scenarioId: string | null; nodeCount: number }> = []

vi.mock('../CanvasMVP', () => ({
  default: function CanvasProbe() {
    useEffect(() => {
      seenAtMount.push({
        suspended: isPersistenceSuspended(),
        scenarioId: useCanvasStore.getState().currentScenarioId,
        nodeCount: useCanvasStore.getState().nodes.length,
      })
    }, [])
    return <div data-testid="canvas-probe" />
  },
}))

const USER_GRAPH = {
  nodes: [{ id: 'user-node-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'The user’s own work' } }],
  edges: [],
  currentScenarioId: 'the-users-real-scenario',
} as never

async function mountFixture() {
  const { default: CanvasFixture } = await import('../CanvasFixture')
  return render(
    <MemoryRouter initialEntries={['/dev/canvas-fixture/fundraising']}>
      <Routes>
        <Route path="/dev/canvas-fixture/:name" element={<CanvasFixture />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  seenAtMount.length = 0
  useCanvasStore.setState(USER_GRAPH)
})
afterEach(() => {
  expect(isPersistenceSuspended(), 'a suspension leaked out of a test').toBe(false)
})

describe('the seeded route isolates the session it borrows', () => {
  it('⭐ PRECONDITION: the probe really mounted — otherwise every claim below is vacuous', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    expect(seenAtMount.length, 'CanvasMVP never mounted; this spec measured nothing').toBeGreaterThan(0)
    unmount()
  })

  it('⛔ the canvas mounts INSIDE the suspension, not alongside it', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    expect(
      seenAtMount.every(s => s.suspended),
      'the canvas mounted with persistence still live — its own effects run before this route’s',
    ).toBe(true)
    unmount()
  })

  it('⛔ and it mounts with NO scenario id, which is what closes the server path', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    expect(
      seenAtMount.every(s => s.scenarioId === null),
      'the fixture kept the user’s scenario id — hydration would fire and autosave would stamp it',
    ).toBe(true)
    unmount()
  })

  it('⭐ the fixture graph is what the canvas actually receives', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    // Bound by NUMBER against the capture: a route that renders an empty board
    // looks exactly like one that renders a healthy board.
    expect(seenAtMount[0].nodeCount).toBe(13)
    unmount()
  })

  it('⭐⭐ THE USER’S OWN MODEL IS BACK after leaving, untouched', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    expect(useCanvasStore.getState().nodes.length).toBe(13) // the fixture is in place
    unmount()
    await waitFor(() => {
      const after = useCanvasStore.getState()
      expect(after.nodes.map(n => n.id)).toEqual(['user-node-1'])
      expect(after.currentScenarioId).toBe('the-users-real-scenario')
    })
  })

  it('⭐ persistence is live again once the route is gone', async () => {
    const { unmount } = await mountFixture()
    await screen.findByTestId('canvas-probe')
    expect(isPersistenceSuspended()).toBe(true)
    unmount()
    await waitFor(() => expect(isPersistenceSuspended()).toBe(false))
  })
})

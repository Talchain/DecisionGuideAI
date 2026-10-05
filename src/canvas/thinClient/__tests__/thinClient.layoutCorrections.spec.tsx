/**
 * THIN CLIENT — the layout hook's correction state belongs to ONE scenario (Codex #2511 r2, P2).
 *
 * `useMeasureThenLayout` keeps a height baseline (and a fallback flag) from the last layout it committed. Carried
 * across a switch, A's baseline judges B's cards: a B card with A's node id that is taller than A's was "grows", and a
 * NEW layout runs over the positions B just restored from its saved layout. In a thin session the state is reset when
 * the scenario changes; within a scenario the growth correction is unchanged (its own spec).
 *
 * The GUEST row is the catch twin: same steps, no session ⇒ the carried baseline DOES start a layout (unchanged
 * behaviour), so the thin row cannot pass because the probe never reached the correction branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useMeasureThenLayout } from '../../hooks/useMeasureThenLayout'
import { HEIGHT_GROWTH_TOLERANCE_PX } from '../../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery, type LayoutAttemptResult } from '../../layout/handleLayoutWithRecovery'
import { __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

let mockNodesInitialized = false
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) => selector({ nodeLookup: mockNodeLookup }),
}))
vi.mock('../../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn((fn: () => Promise<LayoutAttemptResult>) => { void fn() }),
}))
vi.mock('../../../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const A = 'aaaaaaaa-2222-4333-8444-555555555555'
const B = 'bbbbbbbb-2222-4333-8444-555555555555'
const card = (id: string, type: string, x: number, y: number) =>
  ({ id, type, position: { x, y }, data: { label: id, kind: type } }) as never

const setHeights = (opt: number, fac: number) => {
  mockNodeLookup = new Map([
    ['opt', { measured: { width: 320, height: opt } }],
    ['fac', { measured: { width: 320, height: fac } }],
  ])
  mockNodesInitialized = true
}

/** A is laid out at 160/108 and settles; then B (same template ids, a taller `opt`) arrives with RESTORED positions. */
function layOutAThenRestoreB(): { before: number; after: number } {
  const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout').mockImplementation(() => Promise.resolve({ laidOut: true }))
  useCanvasStore.setState({
    currentScenarioId: A,
    nodes: [card('opt', 'option', 0, 0), card('fac', 'factor', 0, 0)],
    pendingLayout: true,
    layoutRequestId: 1,
  } as never)
  const { rerender } = renderHook(() => useMeasureThenLayout())
  setHeights(160, 108)
  rerender()
  act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
  rerender()
  const before = applySpy.mock.calls.length
  expect(before, 'A’s initial layout ran (precondition)').toBeGreaterThan(0)

  act(() => {
    setHeights(160 + HEIGHT_GROWTH_TOLERANCE_PX + 40, 108)
    useCanvasStore.setState({
      currentScenarioId: B,
      nodes: [card('opt', 'option', 700, 40), card('fac', 'factor', 60, 420)],
      pendingLayout: false,
      layoutRequestId: 2,
    } as never)
  })
  rerender()
  return { before, after: applySpy.mock.calls.length }
}

beforeEach(() => {
  localStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false, layoutVersion: 0, layoutRequestId: 0 } as never)
  mockNodesInitialized = false
  mockNodeLookup = new Map()
})
afterEach(() => vi.restoreAllMocks())

describe('layout corrections do not carry across a scenario switch (thin)', () => {
  it('CATCH TWIN (guest, unchanged) — A’s baseline judges B and starts a layout over B', () => {
    const { before, after } = layOutAThenRestoreB()
    expect(after).toBe(before + 1)
  })

  it('thin ⇒ no layout runs over B’s restored positions', () => {
    localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')
    const { before, after } = layOutAThenRestoreB()
    expect(after).toBe(before)
  })
})

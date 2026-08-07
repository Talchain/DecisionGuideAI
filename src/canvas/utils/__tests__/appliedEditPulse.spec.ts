/**
 * appliedEditPulse (seamlessness R2 + graph-visuals F4) — behavioral contract
 * against the REAL canvas store with fake timers.
 *
 * The pulse must: coalesce a burst of apply events into ONE highlight over
 * the union of targets; filter stale ids at flush time (fail-closed); clear
 * both sets after PULSE_DURATION_MS; never write an empty highlight over an
 * existing one; and never touch selection or inspector state.
 *
 * F4 (Paul-ratified): the flush brings EVERY surviving pulse target into view
 * BEFORE the highlight is written — an applied edit the user cannot see is a
 * silent edit. The camera move goes through the registered fit seam
 * (focusHelpers.fitNodesOnCanvas → ReactFlowGraph), which itself skips the
 * pan when everything is already comfortably visible and honours
 * prefers-reduced-motion (F1). This spec pins the choke point: one fit call,
 * full surviving target set (nodes + pulsed edges' endpoints), before the
 * highlight write. Selection/inspector hijack remains banned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  pulseAppliedTargets,
  __resetAppliedEditPulseForTests,
  PULSE_COALESCE_MS,
  PULSE_DURATION_MS,
} from '../appliedEditPulse'
import { registerFitNodes } from '../focusHelpers'
import { useCanvasStore } from '../../store'

const node = (id: string) =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as any
const edge = (id: string) => ({ id, source: 'n1', target: 'n2' }) as any

beforeEach(() => {
  vi.useFakeTimers()
  __resetAppliedEditPulseForTests()
  useCanvasStore.setState({
    nodes: [node('n1'), node('n2')],
    edges: [edge('e1')],
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
  })
})

afterEach(() => {
  __resetAppliedEditPulseForTests()
  vi.useRealTimers()
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
  })
})

const highlighted = () => ({
  nodes: [...useCanvasStore.getState().highlightedNodes].sort(),
  edges: [...useCanvasStore.getState().highlightedEdges].sort(),
})

describe('pulseAppliedTargets', () => {
  it('pulses an in-graph node after the coalesce window', () => {
    pulseAppliedTargets({ nodeIds: ['n1'] })
    // Nothing before the window closes (coalescing, not instant)
    expect(highlighted().nodes).toEqual([])
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(highlighted().nodes).toEqual(['n1'])
  })

  it('coalesces a burst into ONE union pulse (nodes + edges)', () => {
    pulseAppliedTargets({ nodeIds: ['n1'] })
    pulseAppliedTargets({ nodeIds: ['n2'], edgeIds: ['e1'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(highlighted()).toEqual({ nodes: ['n1', 'n2'], edges: ['e1'] })
  })

  it('clears both sets after PULSE_DURATION_MS', () => {
    pulseAppliedTargets({ nodeIds: ['n1'], edgeIds: ['e1'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(highlighted().nodes).toEqual(['n1'])
    vi.advanceTimersByTime(PULSE_DURATION_MS + 1)
    expect(highlighted()).toEqual({ nodes: [], edges: [] })
  })

  it('filters ids that are not on the canvas (fail-closed, kind-scoped)', () => {
    // 'ghost' unknown; 'e1' passed as a NODE id must not pulse as a node
    pulseAppliedTargets({ nodeIds: ['n1', 'ghost', 'e1'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(highlighted().nodes).toEqual(['n1'])
  })

  it('an all-stale flush writes nothing — an existing highlight survives', () => {
    useCanvasStore.setState({ highlightedNodes: new Set(['n2']) })
    pulseAppliedTargets({ nodeIds: ['ghost'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + PULSE_DURATION_MS + 2)
    expect(highlighted().nodes).toEqual(['n2'])
  })

  it('a second pulse during an active one replaces the highlight and restarts the clear timer', () => {
    pulseAppliedTargets({ nodeIds: ['n1'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    vi.advanceTimersByTime(1000)
    pulseAppliedTargets({ nodeIds: ['n2'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(highlighted().nodes).toEqual(['n2'])
    // The ORIGINAL clear timer (due ~900ms from now) must not cut this short
    vi.advanceTimersByTime(1000)
    expect(highlighted().nodes).toEqual(['n2'])
    vi.advanceTimersByTime(PULSE_DURATION_MS)
    expect(highlighted().nodes).toEqual([])
  })

  it('fails soft when the store lacks the highlight setters (partial store doubles)', () => {
    const original = {
      setHighlightedNodes: useCanvasStore.getState().setHighlightedNodes,
      setHighlightedEdges: useCanvasStore.getState().setHighlightedEdges,
    }
    try {
      useCanvasStore.setState({
        setHighlightedNodes: undefined as any,
        setHighlightedEdges: undefined as any,
      })
      pulseAppliedTargets({ nodeIds: ['n1'] })
      // A leaked flush against a partial store must no-op, never throw
      expect(() => vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)).not.toThrow()
    } finally {
      useCanvasStore.setState(original)
    }
    // Buffer was discarded — a later flush does not resurrect the stale pulse
    vi.advanceTimersByTime(PULSE_DURATION_MS + 1)
    expect(highlighted().nodes).toEqual([])
  })

  it('never touches selection or inspector state', () => {
    const before = {
      selected: useCanvasStore.getState().nodes.map((n: any) => n.selected ?? false),
      inspector: (useCanvasStore.getState() as any).showInspectorPanel,
    }
    pulseAppliedTargets({ nodeIds: ['n1'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(useCanvasStore.getState().nodes.map((n: any) => n.selected ?? false)).toEqual(
      before.selected,
    )
    expect((useCanvasStore.getState() as any).showInspectorPanel).toBe(before.inspector)
  })
})

describe('F4 — the flush fits every surviving target into view BEFORE the pulse fires', () => {
  // Typed to the real seam signature: `ReturnType<typeof vi.fn>` is
  // Mock<any[], unknown>, which the zero-arg implementation below is not
  // assignable to. This file is now covered by `pnpm run typecheck` (which
  // compiles tsconfig.app.json); under the old narrow gate CI never saw it.
  let fitSpy: Mock<[readonly string[]], void>
  let highlightsAtFitTime: string[] | null
  let unregister: (() => void) | null = null

  beforeEach(() => {
    highlightsAtFitTime = null
    fitSpy = vi.fn((_nodeIds: readonly string[]) => {
      // Capture the highlight state AT fit time to pin the ordering.
      highlightsAtFitTime = [...useCanvasStore.getState().highlightedNodes]
    })
    unregister = registerFitNodes(fitSpy)
  })

  afterEach(() => {
    unregister?.()
    unregister = null
  })

  it('fits the full surviving union — node targets plus pulsed edges’ endpoint nodes', () => {
    pulseAppliedTargets({ nodeIds: ['n1'] })
    pulseAppliedTargets({ edgeIds: ['e1'] }) // e1 runs n1 → n2
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(fitSpy).toHaveBeenCalledTimes(1)
    expect([...fitSpy.mock.calls[0][0]].sort()).toEqual(['n1', 'n2'])
  })

  it('the fit happens BEFORE the highlight write (targets are on their way into view when they flash)', () => {
    pulseAppliedTargets({ nodeIds: ['n1', 'n2'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(fitSpy).toHaveBeenCalledTimes(1)
    expect(highlightsAtFitTime).toEqual([]) // highlight not yet written at fit time
    expect([...useCanvasStore.getState().highlightedNodes].sort()).toEqual(['n1', 'n2'])
  })

  it('stale ids never reach the fit (fail-closed, same filter as the highlight)', () => {
    pulseAppliedTargets({ nodeIds: ['n1', 'ghost'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(fitSpy).toHaveBeenCalledTimes(1)
    expect([...fitSpy.mock.calls[0][0]]).toEqual(['n1'])
  })

  it('an all-stale flush fits nothing (no highlight, no camera move)', () => {
    pulseAppliedTargets({ nodeIds: ['ghost'] })
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)
    expect(fitSpy).not.toHaveBeenCalled()
  })

  it('flush still highlights when no canvas fit is registered (fail-closed seam)', () => {
    unregister?.()
    unregister = null
    pulseAppliedTargets({ nodeIds: ['n1'] })
    expect(() => vi.advanceTimersByTime(PULSE_COALESCE_MS + 1)).not.toThrow()
    expect([...useCanvasStore.getState().highlightedNodes]).toEqual(['n1'])
  })
})

/**
 * appliedEditPulse (seamlessness R2) — behavioral contract against the REAL
 * canvas store with fake timers.
 *
 * The pulse must: coalesce a burst of apply events into ONE highlight over
 * the union of targets; filter stale ids at flush time (fail-closed); clear
 * both sets after PULSE_DURATION_MS; never write an empty highlight over an
 * existing one; and never touch selection/inspector/viewport state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pulseAppliedTargets,
  __resetAppliedEditPulseForTests,
  PULSE_COALESCE_MS,
  PULSE_DURATION_MS,
} from '../appliedEditPulse'
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

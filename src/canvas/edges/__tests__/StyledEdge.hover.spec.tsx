/**
 * Task 5 (P0.2) — StyledEdge hover popover timer cleanup: component-level test
 *
 * Mounts StyledEdge, triggers mouseEnter on the edge path, unmounts before the
 * 300ms delay elapses, and asserts that:
 *  1. No post-unmount state update occurs (no React "setState on unmounted" warning)
 *  2. clearTimeout was called during unmount cleanup (the useEffect [] cleanup fires)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { Position } from '@xyflow/react'

// ── ReactFlow mocks ──────────────────────────────────────────────────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // Render a minimal element — do NOT spread edge props onto DOM elements (unknown prop warnings)
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => [],
      getNodes: () => [],
    }),
    // E3 part 2: StyledEdge subscribes to node geometry via the store
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

// ── Store mocks ───────────────────────────────────────────────────────────────
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))

vi.mock('../../hooks/useTheme', () => ({
  useIsDark: () => false,
}))

vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))

vi.mock('../../utils/graphDisplayCalculations', () => ({
  existenceCertaintyToLineStyle: () => 'solid',
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))

vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))

vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
const defaultEdgeProps = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: {
    weight: 0.6,
    direction: 'positive' as const,
    beliefExists: 0.8,
  },
}

describe('StyledEdge — hover popover timer cleanup (component-level)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('unmounting before 300ms calls clearTimeout and does not trigger post-unmount state update', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const consoleError = vi.spyOn(console, 'error')

    const { container, unmount } = render(<StyledEdge {...defaultEdgeProps as any} />)

    // StyledEdge renders an invisible hit-path with stroke="transparent" carrying onMouseEnter.
    // This attribute is stable — use it rather than relying on DOM order.
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath).not.toBeNull()

    // Trigger mouseEnter — starts the 300ms timer inside the component
    act(() => {
      fireEvent.mouseEnter(hitPath!)
    })

    // Unmount before the 300ms timer fires
    act(() => {
      unmount()
    })

    // clearTimeout must have been called by the useEffect [] cleanup (hoverPopoverTimerRef)
    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Advance past the delay — no post-unmount setState warning should have fired
    act(() => {
      vi.advanceTimersByTime(400)
    })

    // No "Cannot update a component" or "setState on unmounted" errors
    const stateUpdateErrors = consoleError.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('unmounted')
    )
    expect(stateUpdateErrors).toHaveLength(0)
  })

  it('popover does not appear when component is unmounted before 300ms delay', () => {
    const { container, unmount } = render(<StyledEdge {...defaultEdgeProps as any} />)

    const hitPath = container.querySelector('path:not([data-testid="base-edge"])')
    expect(hitPath).not.toBeNull()

    act(() => {
      fireEvent.mouseEnter(hitPath!)
    })

    // Unmount — cleanup should cancel the pending timer
    act(() => {
      unmount()
    })

    // Advance past the delay — timer was cleared so no post-unmount update occurs
    act(() => {
      vi.advanceTimersByTime(400)
    })

    // After unmount the container should be empty (no popover rendered)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// F2 — the hover popover spoke UI defaults, and sent one to CEE
// ---------------------------------------------------------------------------
//
// Bindings: `weight = edgeData?.weight ?? 0.5` (:202) and the popover's own
// `(beliefExists ?? 0.8)` (:977) — a SECOND literal copy of the fabricated
// constant, independent of DEFAULT_EDGE_DATA. Hovering a freshly drawn edge
// rendered "Positive / 80% confident / 30%".
//
// The severe part is the chip. `NodeChip` passes `message` to
// `useGuidanceStore._dispatchAction`, which is the real turn dispatcher — so
// "Current strength is 30%." crossed the service boundary and was presented to
// CEE as the user's own assertion about their model. A fabricated number on
// screen misleads a person who can see the canvas; a fabricated number in the
// prompt misleads the model, which cannot.
describe('StyledEdge hover popover — provenance honesty', () => {
  const drawnEdge = {
    ...defaultEdgeProps,
    // USER_EDGE_DEFAULTS shape: values present, no *Source stamp.
    data: { weight: 0.3, direction: 'positive' as const, beliefExists: 0.8 },
  }

  const characterisedEdge = {
    ...defaultEdgeProps,
    data: {
      weight: 0.3,
      direction: 'positive' as const,
      beliefExists: 0.8,
      weightSource: 'user' as const,
      beliefExistsSource: 'user' as const,
    },
  }

  async function hoverAndGetPopover(props: Record<string, unknown>) {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const hitPath = container.querySelector('path[stroke="transparent"]')!
    act(() => {
      fireEvent.mouseEnter(hitPath)
      vi.advanceTimersByTime(400)
    })
    return container
  }

  beforeEach(() => {
    vi.useFakeTimers()
    useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null } as never)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('POSITIVE CONTROL: a characterised edge DOES show its numbers', async () => {
    // Without this, every assertion below would pass on a popover that
    // rendered nothing at all.
    const container = await hoverAndGetPopover(characterisedEdge)
    const popover = container.querySelector('[data-testid="edge-hover-popover"]')
    expect(popover).not.toBeNull()
    expect(popover!.textContent ?? '').toMatch(/80% confident/)
    expect(popover!.textContent ?? '').toMatch(/30%/)
  })

  it('does NOT speak the defaulted confidence or strength for a drawn edge', async () => {
    const container = await hoverAndGetPopover(drawnEdge)
    const popover = container.querySelector('[data-testid="edge-hover-popover"]')
    expect(popover).not.toBeNull()
    const text = popover!.textContent ?? ''
    expect(text).not.toMatch(/80% confident/)
    expect(text).not.toMatch(/\d+%/)
  })

  it('does NOT assert a fabricated strength in the message it sends to CEE', async () => {
    const dispatched: Array<{ message: string }> = []
    useGuidanceStore.setState({
      _dispatchAction: (opts: { message: string }) => { dispatched.push(opts) },
    } as never)

    const container = await hoverAndGetPopover(drawnEdge)
    const chip = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Adjust strength'),
    )
    expect(chip, 'the Adjust strength chip must still be offered').toBeTruthy()
    act(() => { fireEvent.click(chip!) })

    expect(dispatched).toHaveLength(1)
    // The whole point: no number nobody set may cross the wire.
    expect(dispatched[0].message).not.toMatch(/\d+%/)
    expect(dispatched[0].message).not.toMatch(/Current strength is/)
  })

  it('POSITIVE CONTROL: a characterised edge DOES send its real strength', async () => {
    const dispatched: Array<{ message: string }> = []
    useGuidanceStore.setState({
      _dispatchAction: (opts: { message: string }) => { dispatched.push(opts) },
    } as never)

    const container = await hoverAndGetPopover(characterisedEdge)
    const chip = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Adjust strength'),
    )
    act(() => { fireEvent.click(chip!) })
    expect(dispatched[0].message).toMatch(/Current strength is 30%\./)
  })
})

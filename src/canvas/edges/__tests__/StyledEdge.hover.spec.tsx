/**
 * Task 5 (P0.2) — StyledEdge hover popover timer cleanup: component-level test
 *
 * Mounts StyledEdge, triggers mouseEnter on the edge path, unmounts before the
 * 300ms delay elapses, and asserts that:
 *  1. No post-unmount state update occurs (no React "setState on unmounted" warning)
 *  2. clearTimeout was called during unmount cleanup (the useEffect [] cleanup fires)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
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

vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // ⛔ importOriginal-SPREAD, not a hand-listed replacement. A `vi.mock`
  // factory REPLACES the module, so every export added after this mock was
  // written silently vanished — adding `UNSET_EDGE_STROKE_WIDTH` took 49 tests
  // down across seven files at once. The spread makes the mock derive from the
  // real module and override only what it means to stub.
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
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
// F2 / A7 — the hover spoke UI defaults and invented percentages, and a chip in
// it sent one to CEE. ⭐ REWRITTEN for canvas visual contract v3.1 (DESIGN-GAP-
// v31 row 12): the hover is now a ONE-LINE TOOLTIP — the arrow sentence and
// only the exception clauses — and the strength, the existence reading and
// every action live in the edge inspector, one click away.
//
// What each old pin protected, and where it is held now:
//  · "an UNSTATED direction is never called Positive" — still here: the
//    tooltip's direction clause reads `statedDirection`, the same resolver the
//    stroke reads, so an unstated direction says "Direction not stated".
//  · "a STATED direction is still said" — still here (both signs).
//  · "no defaulted strength or confidence is spoken" / A7 "no ×100 percent" —
//    now STRONGER: the tooltip carries no strength figure and no percentage of
//    any kind. The signed-plus-band figure is the edge inspector's, pinned by
//    `ui/inspector-v2/__tests__/statedStrengthIsTheOneShown.spec.tsx` and
//    `EdgePanel.v62.spec.tsx`.
//  · "no fabricated strength crosses the wire" — now structural: the tooltip
//    holds no control, so a hover cannot dispatch anything at all (bound with
//    a dispatcher REGISTERED, so the absence is not a missing surface).
// ---------------------------------------------------------------------------
// ⭐ 29 Sep 2026 (Paul: the link pop-up is back, with direction and strength and
// whether each was stated or estimated): the arrow sentence keeps these pins; the
// strength is now SHOWN when a source stamp proves it (`edge-hover-strength`),
// in the data's own units and never as a percentage, and a drawn default still
// shows no figure at all.
describe('StyledEdge hover pop-up — provenance honesty', () => {
  const drawnEdge = {
    ...defaultEdgeProps,
    // USER_EDGE_DEFAULTS shape: values present, no *Source stamp.
    data: { weight: 0.3, direction: 'positive' as const, beliefExists: 0.8 },
  }
  const characterisedEdge = {
    ...defaultEdgeProps,
    data: {
      weight: 0.3, direction: 'positive' as const, beliefExists: 0.8,
      weightSource: 'user' as const, beliefExistsSource: 'user' as const,
    },
  }
  const statedPositiveEdge = {
    ...defaultEdgeProps,
    data: { ...characterisedEdge.data, directionSource: 'user' as const },
  }
  const statedNegativeEdge = {
    ...defaultEdgeProps,
    data: { ...characterisedEdge.data, direction: 'negative' as const, directionSource: 'user' as const },
  }
  const twentyPercentEdge = {
    ...defaultEdgeProps,
    data: { ...characterisedEdge.data, weight: 0.2 },
  }

  const withoutEndpoints = (t: string | null) => (t ?? '').replace(/\bn[12]\b/g, '')

  function hoverAndGetTooltip(props: Record<string, unknown>) {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const hitPath = container.querySelector('path[stroke="transparent"]')!
    act(() => {
      fireEvent.mouseEnter(hitPath)
      vi.advanceTimersByTime(400)
    })
    const tooltip = container.querySelector('[data-testid="edge-hover-popover"]') as HTMLElement | null
    // PRECONDITION for every case: the tooltip really rendered, as a tooltip —
    // else each absence below would be vacuous.
    expect(tooltip).not.toBeNull()
    expect(tooltip!.getAttribute('role')).toBe('tooltip')
    return { container, tooltip: tooltip! }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null } as never)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does NOT call an unstated direction "Positive", even when the strength IS set', () => {
    const { tooltip, container } = hoverAndGetTooltip(characterisedEdge)
    expect(container.querySelector('[data-testid="edge-hover-arrow-sentence"]')!.textContent).toBe('n1 → n2. Direction not stated in this model.')
    expect(tooltip.textContent).not.toMatch(/Positive|Negative/)
  })

  it('DOES say "Positive" when the direction was stated', () => {
    const { container } = hoverAndGetTooltip(statedPositiveEdge)
    expect(container.querySelector('[data-testid="edge-hover-arrow-sentence"]')!.textContent).toBe('n1 → n2. Positive direction in this model.')
  })

  it('DOES say "Negative" when a negative direction was stated', () => {
    const { container } = hoverAndGetTooltip(statedNegativeEdge)
    expect(container.querySelector('[data-testid="edge-hover-arrow-sentence"]')!.textContent).toBe('n1 → n2. Negative direction in this model.')
  })

  it('paints no strength bar in either direction colour (the bar left with the popover)', () => {
    for (const edge of [characterisedEdge, statedPositiveEdge, statedNegativeEdge]) {
      const { tooltip } = hoverAndGetTooltip(edge)
      expect(tooltip.querySelector('.bg-success, .bg-danger')).toBeNull()
      cleanup()
    }
  })

  it('a DRAWN default speaks no strength figure; a characterised edge speaks only its stated figure — never a confidence, band or percentage', () => {
    {
      const { tooltip, container } = hoverAndGetTooltip(drawnEdge)
      // No figure: the endpoint ids ("n1", "n2") are the only digits allowed.
      expect(withoutEndpoints(tooltip.textContent)).not.toMatch(/\d/)
      expect(container.querySelector('[data-testid="edge-hover-strength-value"]')).toBeNull()
      cleanup()
    }
    const { tooltip, container } = hoverAndGetTooltip(characterisedEdge)
    expect(container.querySelector('[data-testid="edge-hover-strength-value"]')!.textContent).toBe('0.30')
    expect(tooltip.textContent ?? '').not.toMatch(/confident|Moderate|%/i)
    expect(container.querySelector('[data-testid="edge-hover-popover-unset"]')).toBeNull()
  })

  it('A7 — a 0.2 edge hovers to "0.20" in the data\'s own units (as the inspector shows it), never "20%"', () => {
    const { tooltip } = hoverAndGetTooltip(twentyPercentEdge)
    expect(tooltip.textContent ?? '').not.toMatch(/20%/)
    expect(tooltip.textContent ?? '').toContain('0.20')
  })

  it('holds no control, so a hover can send nothing to CEE — with a dispatcher REGISTERED', () => {
    const dispatched: Array<{ message: string }> = []
    useGuidanceStore.setState({
      _dispatchAction: (opts: { message: string }) => { dispatched.push(opts) },
    } as never)
    for (const edge of [drawnEdge, characterisedEdge]) {
      const { tooltip } = hoverAndGetTooltip(edge)
      expect(tooltip.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
      expect(tooltip.style.pointerEvents).toBe('none')
      cleanup()
    }
    expect(dispatched).toHaveLength(0)
  })
})

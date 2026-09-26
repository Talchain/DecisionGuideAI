/**
 * ⭐⭐ THE EDGE OFFERS THE ROUTE THAT WORKS, NOT ONLY THE ONE THAT TALKS.
 *
 * MEASURED, and this is the whole justification. On the founder's session
 * (19 Sep 2026) the edge-strength write was assertable on **24 of his 26
 * edges** — the control worked the entire time. He spent **34 minutes and 27
 * actions**, every one a chat message or a chip click, and made not one direct
 * edit. #1782 closed half of it: the affordance sentence reaches the ACCESSIBLE
 * NAME, so a screen-reader user is told. A sighted user is not.
 *
 * ⛔ AND THE POPOVER MADE IT WORSE THAN SILENT. Hovering a causal edge opens a
 * popover after 300 ms whose only action for this exact task was a chip that
 * sends `"I want to adjust the strength of the relationship between X and Y"`
 * to CEE as chat. On an edge where the direct write lands, the product was
 * offering the slow route and hiding the fast one. That is the 34 minutes.
 *
 * ⛔ IT MUST NOT PROMISE WHERE THE WRITE CANNOT LAND. Gated on the SAME
 * predicate the panel and the accessible name already use, CALLED rather than
 * restated, so the three cannot drift into offering different things
 * (CLAUDE.md trap 12).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type React from 'react'
import { render, fireEvent, act, within } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

const openEdgeStrengthEditor = vi.fn()
vi.mock('../../utils/openEdgeStrengthEditor', () => ({
  openEdgeStrengthEditor: (...args: unknown[]) => openEdgeStrengthEditor(...args),
}))

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
const base = {
  id: 'e1',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

/**
 * ⭐ CANONICAL ENDPOINT IDS AND A SERVER-STATED TUPLE. `edgeStrengthEditIsAssertable`
 * refuses anything else, so an edge built with `n1`/`n2` would be UNASSERTABLE
 * and the "it is offered" case would be testing the refusal path by accident.
 */
const ASSERTABLE = {
  ...base,
  source: '0e4043a0', target: 'b1d7d19a',
  data: { strength_mean: 0.35, effect_direction: 'positive' as const, beliefExists: 0.8 },
}
/** Non-canonical endpoint ids — the predicate's own refusal. */
const NOT_ASSERTABLE = {
  ...base,
  source: 'n1', target: 'n2',
  data: { weight: 0.6, direction: 'positive' as const, beliefExists: 0.8 },
}

function hoverToPopover(props: Record<string, unknown>) {
  const r = render(<StyledEdge {...(props as unknown as React.ComponentProps<typeof StyledEdge>)} />)
  const hit = r.container.querySelector('path[stroke="transparent"]')!
  fireEvent.mouseEnter(hit)
  act(() => { vi.advanceTimersByTime(400) })
  return r
}

// ⭐ REWRITTEN for canvas visual contract v3.1 (DESIGN-GAP-v31 row 12): the
// hover is a one-line tooltip and "the edge inspector carries the detail".
// A single click on a connection opens that inspector (`ReactFlowGraph`
// `handleEdgeClick` → `setShowFullInspector(true)`), whose strength control is
// the direct write — the route this spec exists to keep ahead of the chat one.
//
// What survives from the founder's measurement, pinned here: the hover must
// never again offer the SLOW route alone. It now offers no route at all — no
// chat chip on any edge, and no control that could promise a write the edge
// cannot take. The direct control's own gate (`edgeStrengthEditIsAssertable`)
// is pinned in the panel, where the control now lives.
//
// ⚠ RECORDED, NOT HIDDEN: the hover no longer ADVERTISES "Set strength" to a
// sighted user. The click is the route; whether the tooltip should also name
// it is an Experience Design call (reported with this change).
describe('v3.1 — the hover offers no route; the click opens the direct control', () => {
  beforeEach(() => { vi.useFakeTimers(); openEdgeStrengthEditor.mockClear() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('⭐ PRECONDITION: the tooltip opens at all — otherwise every claim is vacuous', () => {
    for (const edge of [ASSERTABLE, NOT_ASSERTABLE]) {
      const { queryByTestId, unmount } = hoverToPopover(edge)
      expect(
        queryByTestId('edge-hover-popover'),
        'the tooltip never opened; this spec measured nothing',
      ).not.toBeNull()
      unmount()
    }
  })

  it('⛔ the slow chat route is offered on NO edge — the 34-minute failure cannot recur from the hover', () => {
    for (const edge of [ASSERTABLE, NOT_ASSERTABLE]) {
      const { getByTestId, unmount } = hoverToPopover(edge)
      const tooltip = getByTestId('edge-hover-popover')
      expect(tooltip.textContent ?? '').not.toMatch(/adjust|Ask Olumi/i)
      expect(within(tooltip).queryAllByRole('button')).toHaveLength(0)
      unmount()
    }
  })

  it('⛔ no promise the product cannot keep: the unassertable edge\'s hover names no write at all', () => {
    const { getByTestId, queryByTestId } = hoverToPopover(NOT_ASSERTABLE)
    expect(queryByTestId('edge-direct-strength-edit')).toBeNull()
    expect(getByTestId('edge-hover-popover').textContent ?? '').not.toMatch(/set (its )?strength/i)
  })
})

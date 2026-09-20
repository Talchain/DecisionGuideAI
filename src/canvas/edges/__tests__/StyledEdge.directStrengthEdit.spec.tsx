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
  const r = render(<StyledEdge {...(props as never)} />)
  const hit = r.container.querySelector('path[stroke="transparent"]')!
  fireEvent.mouseEnter(hit)
  act(() => { vi.advanceTimersByTime(400) })
  return r
}

describe('a hovered edge offers the direct edit where the write can land', () => {
  beforeEach(() => { vi.useFakeTimers(); openEdgeStrengthEditor.mockClear() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('⭐ PRECONDITION: the popover opens at all — otherwise every claim is vacuous', () => {
    const { queryByTestId } = hoverToPopover(ASSERTABLE)
    expect(
      queryByTestId('edge-hover-popover'),
      'the popover never opened; this spec measured nothing',
    ).not.toBeNull()
  })

  it('⛔ THE DIRECT CONTROL IS THERE, and it is a native button so Tab and Enter reach it', () => {
    const { getByTestId } = hoverToPopover(ASSERTABLE)
    const direct = getByTestId('edge-direct-strength-edit')
    expect(direct.tagName).toBe('BUTTON')
    expect(direct.getAttribute('aria-label')).toBeTruthy()
  })

  it('⭐⭐ CLICKING IT OPENS THE EDITOR — through the same owner the double-click uses', () => {
    const { getByTestId } = hoverToPopover(ASSERTABLE)
    fireEvent.click(getByTestId('edge-direct-strength-edit'))
    expect(
      openEdgeStrengthEditor,
      'the control rendered but opened nothing — an affordance that does not act is worse than none',
    ).toHaveBeenCalledWith('e1')
  })

  it('⛔ IT IS ABSENT where the write cannot land — no promise the product cannot keep', () => {
    const { queryByTestId, getByTestId } = hoverToPopover(NOT_ASSERTABLE)
    expect(queryByTestId('edge-hover-popover')).not.toBeNull()
    expect(
      queryByTestId('edge-direct-strength-edit'),
      'the direct control was offered on an edge whose strength edit is refused',
    ).toBeNull()
  })

  it('⭐ and the chat route survives there — it is the only route that edge has', () => {
    const { getByTestId } = hoverToPopover(NOT_ASSERTABLE)
    const popover = getByTestId('edge-hover-popover')
    expect(within(popover).getByText(/adjust strength/i)).toBeTruthy()
  })

  it('⛔ the two routes are never named the same thing side by side', () => {
    // ⚠ THIS ASSERTS THE PROPERTY, NOT A STRING. Its first version searched for
    // a literal "Adjust strength" twice, and a mutant renaming the chat chip
    // walked straight through it — the two labels differed, so the count was 1
    // and the guard passed while proving nothing about collision in general.
    // A guard watching one spelling of a class is the hand-maintained mirror
    // (CLAUDE.md trap 12); this one compares whatever the two controls say.
    const { getByTestId } = hoverToPopover(ASSERTABLE)
    const popover = getByTestId('edge-hover-popover')
    const direct = getByTestId('edge-direct-strength-edit').textContent?.trim() ?? ''
    expect(direct, 'the direct control has no visible label at all').not.toBe('')
    const everyLabel = Array.from(popover.querySelectorAll('button'))
      .map(b => b.textContent?.trim() ?? '')
    expect(
      everyLabel.filter(l => l === direct).length,
      `two controls a pixel apart both read "${direct}" — the user cannot tell the fast route from the slow one`,
    ).toBe(1)
  })
})

/**
 * ⛔ THE CONNECTOR COPY-HONESTY GUARD.
 *
 * Two claims, over every perceivable string (own text, `aria-label`, `title`) a
 * connection and its key can put in front of a person:
 *
 *   A. NO "contested". Experience Design, 23 Sep 2026: *no "contested" without
 *      attributable human disagreement.* Olumi's two review passes are not an
 *      attributable human disagreement, and no canonical carrier for one exists
 *      (spec §5 "Gated").
 *   B. NO BARE FRAGILITY FIGURE. The fragility cue paints no figure at all, and
 *      wherever the flip figure IS stated it carries the noun the code itself
 *      gives it ("flip risk" / "chance the result flips"). The founder read
 *      "Sensitive · 70%" beside "Strong boost est." as a strength.
 *
 * The corpus is the producer's full `ContestedReason` enum × both values of
 * `needs_user_input`, on a chip carrying BOTH rows, with the hover popover open,
 * plus the key in both phases — the surfaces where a contest or a flip figure
 * could be spoken. Positive controls prove the corpus is populated (an absence
 * claim with nothing to read passes on an empty container — trap 13).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { CanvasLegendPopover } from '../../components/CanvasLegendPopover'
import { Position } from '@xyflow/react'
import { CONTESTED_WORD, bareFragilityFigures, perceivableStrings } from './__helpers__/edgeCopyHonesty'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockStatus = 'complete'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => mockEdges,
      getNodes: () => [],
    }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

// One store double serves both surfaces: the key reads `results.status`,
// `nodes`, `optionNumbering` and `viewMode`.
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: mockStatus, report: mockReport },
      viewMode: 'standard',
      nodes: [],
      optionNumbering: {},
      lodRung: 'full',
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
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))

const EDGE = { strength_mean: 0.6, effect_direction: 'positive' as const, exists_probability: 0.8 }

const REASONS = [
  'sign_flip',
  'strength_band_change',
  'confidence_band_change',
  'existence_boundary_crossing',
  'raw_magnitude',
] as const

function validation(reason: string, needsUserInput: boolean) {
  return {
    status: 'contested',
    contested_reasons: [reason],
    pass1: { strength_mean: 0.6, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.2, strength_std: 0.15, exists_probability: 0.5,
      reasoning: 'The review read this differently.', basis: 'domain_prior',
      needs_user_input: needsUserInput,
    },
    max_divergence: 0.6,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
  }
}

const props = {
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
}

/** Render the edge with BOTH chip rows and the hover popover open. */
function renderEverySurface(data: Record<string, unknown>): HTMLElement {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
  const { container } = render(<StyledEdge {...(props as any)} data={data} />)
  const hit = container.querySelector('path[stroke="transparent"]')
  act(() => { fireEvent.mouseEnter(hit!) })
  act(() => { vi.advanceTimersByTime(350) })
  return container
}

beforeEach(() => {
  mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } }
  mockEdges = []
  mockStatus = 'complete'
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('A — no connector surface says "contested"', () => {
  it.each(REASONS.flatMap((r) => [false, true].map((n) => [r, n] as const)))(
    'a pending %s review disagreement (needs_user_input=%s): no perceivable string says it',
    (reason, needs) => {
      const container = renderEverySurface({ ...EDGE, validation: validation(reason, needs) })
      const strings = perceivableStrings(container)
      // Populated: the chip, the cue and the popover are all on screen.
      expect(container.querySelector('[data-testid="edge-influence-label-text"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="edge-fragile-tag"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="edge-hover-popover"]')).not.toBeNull()
      expect(strings.length).toBeGreaterThan(5)
      expect(strings.filter((s) => CONTESTED_WORD.test(s))).toEqual([])
    },
  )

  it.each(['idle', 'complete'])('the key, in phase %s, never says it either', (status) => {
    mockStatus = status
    const { container, getByTestId } = render(<CanvasLegendPopover />)
    fireEvent.click(getByTestId('btn-canvas-legend'))
    const strings = perceivableStrings(container)
    expect(strings.length).toBeGreaterThan(10)
    expect(strings.filter((s) => CONTESTED_WORD.test(s))).toEqual([])
  })
})

describe('B — no bare fragility figure', () => {
  it('the cue on the canvas paints no figure at all', () => {
    const container = renderEverySurface({ ...EDGE })
    const cue = container.querySelector('[data-testid="edge-fragile-tag"]') as HTMLElement | null
    expect(cue).not.toBeNull()
    expect(cue!.textContent ?? '').not.toMatch(/\d+\s?%/)
  })

  it('every string that speaks about fragility states the figure WITH its noun', () => {
    const container = renderEverySurface({ ...EDGE })
    const strings = perceivableStrings(container)
    const cue = container.querySelector('[data-testid="edge-fragile-tag"]') as HTMLElement
    // The cue's joined text too, because it was two spans ("Sensitive" · "42%").
    const corpus = [...strings, cue.textContent ?? '']
    // Populated: the measured figure IS stated somewhere, labelled.
    expect(corpus.some((s) => /42% (flip risk|chance the result flips)/.test(s))).toBe(true)
    const offenders = corpus.flatMap((s) => bareFragilityFigures(s).map((f) => `${f} in "${s}"`))
    expect(offenders).toEqual([])
  })

  it('the predicate can fail: it catches the shape the founder saw', () => {
    expect(bareFragilityFigures('Sensitive · 70%')).toEqual(['70%'])
    expect(bareFragilityFigures('Sensitive: 70% flip risk')).toEqual([])
    expect(bareFragilityFigures('Sensitive assumption: 70% chance the result flips if this relationship changes')).toEqual([])
    // Not a fragility string: a strength percentage is out of this rule's scope.
    expect(bareFragilityFigures('60%')).toEqual([])
    expect(CONTESTED_WORD.test('Contested relationship')).toBe(true)
  })
})

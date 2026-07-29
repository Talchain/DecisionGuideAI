/**
 * Regression tests for contested edge visual styling in StyledEdge.
 *
 * Covers:
 *  - Pending contested → dashed info stroke with divergence-scaled gap
 *  - needs_user_input → tighter dash gap + full info colour
 *  - Resolved contested → reverts to standard non-contested style
 *  - Missing max_divergence → non-contested style (no silent default)
 *  - Absent validation → standard style
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Capture BaseEdge style prop ─────────────────────────────────────────────

let capturedStyle: React.CSSProperties | undefined

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => {
      capturedStyle = props.style
      return <path data-testid="base-edge" />
    },
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
  existenceCertaintyToLineStyle: () => null,
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))

vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: () => ({
    strokeWidth: 2,
    strokeDasharray: undefined,
    stroke: '#888',
    curvature: 0.15,
  }),
}))

vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const baseProps = {
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

function makeValidation(overrides: Record<string, unknown> = {}) {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: false,
    },
    max_divergence: 0.6,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  }
}

function renderEdge(data: Record<string, unknown>) {
  capturedStyle = undefined
  render(<StyledEdge {...baseProps as any} data={data} />)
  return capturedStyle!
}

// ── The three-way pin's negative arms (ROADMAP 2.146) ───────────────────────
//
// ⚠ THESE NEGATIVE ARMS USED TO BE VACUOUS, and the slice that finally fed this
// component real data is what exposed it. Four cases below asserted
// `expect(style.stroke).not.toContain('--semantic-info')` — but the contested
// branch in StyledEdge emits `--semantic-warning`, never `--semantic-info`
// (`--semantic-info` belongs to the *highlighted* branch). So those assertions
// passed for edges that WERE styled contested: they were measuring nothing.
// Classic broken alarm — the arm that is supposed to prove "an uncontested edge
// looks untouched" could not fail.
//
// Replaced with a DIFFERENTIAL assertion instead of a second hand-written copy of
// the component's colour/dash formula (that would be a mirror, and it would drift
// the first time the formula is tuned): render the same edge data with and
// without its `validation` key and require the two to be byte-identical on every
// style channel the contested branch can touch. That is literally the brief's
// third arm — "absent `validation` renders exactly as today" — and it fails the
// moment contested styling leaks onto an edge that should not have it.

/** Every style channel the contested branch in StyledEdge can write. */
function contestedStyleSignature(s: React.CSSProperties) {
  return { stroke: s.stroke, strokeDasharray: s.strokeDasharray }
}

/**
 * Assert `data` renders IDENTICALLY to the same data with `validation` removed.
 * Returns both signatures so a caller can add a sharper assertion on top.
 */
function expectStyledAsIfNoValidation(data: Record<string, unknown>) {
  const withValidation = contestedStyleSignature(renderEdge(data))
  const { validation: _dropped, ...withoutValidation } = data
  const control = contestedStyleSignature(renderEdge(withoutValidation))
  expect(withValidation).toEqual(control)
  return { withValidation, control }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('StyledEdge — contested visual styling', () => {
  afterEach(() => {
    capturedStyle = undefined
  })

  it('pending contested edge with max_divergence renders dashed warning stroke', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6 }),
    })

    // Stroke should be the 70% mixed warning colour (contested = needs attention)
    expect(style.stroke).toContain('color-mix')
    expect(style.stroke).toContain('--semantic-warning')

    // Dash array should be divergence-scaled: width = 1.5 + 0.6*1.5 = 2.4, gap = 4 + 0.6*4 = 6
    expect(style.strokeDasharray).toBe('2.4 6')
  })

  it('needs_user_input gets tighter dash and full info colour', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({
        max_divergence: 0.8,
        pass2: {
          strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
          reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
        },
      }),
    })

    // Full warning colour for needs_user_input (contested = needs attention)
    expect(style.stroke).toBe('var(--semantic-warning)')

    // Tight dash: gap = 3 regardless of divergence; width = 1.5 + 0.8*1.5 = 2.7
    expect(style.strokeDasharray).toBe('2.7 3')
  })

  it('POSITIVE CONTROL: a contested edge does NOT render as if validation were absent', () => {
    // Without this, every negative arm below could pass by comparing two
    // identically-broken renders. This proves the differential helper CAN fail.
    const data = {
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6 }),
    }
    const withValidation = contestedStyleSignature(renderEdge(data))
    const { validation: _dropped, ...bare } = data
    const control = contestedStyleSignature(renderEdge(bare))

    expect(withValidation).not.toEqual(control)
    expect(withValidation.stroke).toContain('--semantic-warning')
    expect(control.stroke).not.toContain('--semantic-warning')
  })

  it('resolved contested edge reverts to standard non-contested style', () => {
    const { withValidation } = expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      beliefExists: 0.8,
      validation: makeValidation({ user_action: 'accepted_pass2' }),
    })
    // Kept from the original case: with beliefExists set, existenceCertainty
    // returns null (mocked) so the dash falls back to visualProps (undefined).
    expect(withValidation.strokeDasharray).toBeUndefined()
  })

  it('missing max_divergence on contested edge falls back to non-contested style', () => {
    const validation = makeValidation()
    delete (validation as any).max_divergence
    expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      validation,
    })
  })

  it('null max_divergence on contested edge falls back to non-contested style', () => {
    expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: null }),
    })
  })

  it('absent validation renders standard style', () => {
    // Degenerate arm of the same differential: with no `validation` key the two
    // renders are the same input, so this pins that the component does not read
    // anything else off the key's absence.
    expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
    })
  })

  it('agreed validation status renders standard style', () => {
    expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ status: 'agreed' }),
    })
  })

  it('max_divergence 0 produces minimal dash width (1.5) and gap (4)', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0 }),
    })

    expect(style.strokeDasharray).toBe('1.5 4')
    expect(style.stroke).toContain('color-mix')
  })

  it('max_divergence 1 produces maximum dash width (3.0) and gap (8)', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 1 }),
    })

    expect(style.strokeDasharray).toBe('3 8')
  })
})

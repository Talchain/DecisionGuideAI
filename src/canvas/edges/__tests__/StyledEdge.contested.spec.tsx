/**
 * Regression tests for contested edge visual styling in StyledEdge.
 *
 * ⭐ REWRITTEN 23 Sep 2026 — Experience Design's locked connector grammar:
 * "dash = existence certainty only" and "orange = AI review SIGN disagreement
 * only". A review disagreement no longer reaches the line except as the
 * sign-dispute orange; everything else is shown in the connection's inspector.
 *
 * Covers:
 *  - Pending contest over an AGREED sign → renders exactly as if no validation
 *  - sign_flip → the one orange, and still no contest dash
 *  - needs_user_input → no colour of its own, no dash of its own
 *  - Resolved contested → reverts to standard non-contested style
 *  - Missing max_divergence → non-contested style (no silent default)
 *  - Absent validation → standard style
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { DIRECTION_DISPUTED_STROKE } from '../edgePresentation'
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

/** The same edge data with its `validation` key removed — the control render. */
function withoutValidation(data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data }
  delete copy.validation
  return copy
}

/**
 * Assert `data` renders IDENTICALLY to the same data with `validation` removed.
 * Returns both signatures so a caller can add a sharper assertion on top.
 */
function expectStyledAsIfNoValidation(data: Record<string, unknown>) {
  const withValidation = contestedStyleSignature(renderEdge(data))
  const control = contestedStyleSignature(renderEdge(withoutValidation(data)))
  expect(withValidation).toEqual(control)
  return { withValidation, control }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('StyledEdge — contested visual styling', () => {
  afterEach(() => {
    capturedStyle = undefined
  })

  // ⭐ UPDATED 17 Aug 2026 (Paul: "orange must NOT universally mean
  // 'unvetted'") and AGAIN 23 Sep 2026 (Experience Design: "dash = existence
  // certainty only; orange = AI review sign disagreement only").
  //
  // `makeValidation`'s default reason is `strength_band_change` — the passes
  // disagree about the STRENGTH BAND and AGREE about the sign — so the edge
  // keeps its polarity. Until 23 Sep the contest then rode a divergence-scaled
  // dash (`2.4 6`), which told the reader the connection's EXISTENCE was in
  // doubt when neither pass doubted it. It now renders exactly as the same edge
  // with no `validation`: the disagreement lives in the inspector.
  it('pending contest over an AGREED sign renders exactly as if there were no validation', () => {
    const { withValidation } = expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6 }),
    })
    expect(withValidation.stroke).not.toContain('--semantic-warning')
    expect(withValidation.strokeDasharray).toBeUndefined()
  })

  it('OPPOSITE-DIRECTION TWIN: a sign_flip contest DOES take the warning stroke — and still no contest dash', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6, contested_reasons: ['sign_flip'] }),
    })
    // contract v3.1 (E12/T07, 24 Sep 2026): the SOLID Warning token (Paul 23 Sep
    // point 9), no longer a 70% color-mix — bound to the exported owner.
    expect(style.stroke).toBe(DIRECTION_DISPUTED_STROKE)
    expect(style.stroke).toContain('--semantic-warning')
    expect(style.strokeDasharray).toBeUndefined()
  })

  it('needs_user_input over an agreed sign gets NO colour and NO dash of its own', () => {
    // Used to paint full-strength orange with a tight `2.7 3` dash, whatever
    // the reason. The flag is now read by the inspector's heading.
    expectStyledAsIfNoValidation({
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
  })

  it('POSITIVE CONTROL: the differential helper CAN fail — a sign_flip does not render as if validation were absent', () => {
    // Without this, every "as if no validation" arm could pass by comparing two
    // identically-broken renders. The discriminating channel is now the STROKE,
    // on the one reason that still reaches the line.
    const disputedSign = {
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6, contested_reasons: ['sign_flip'] }),
    }
    const disputed = contestedStyleSignature(renderEdge(disputedSign))
    const control = contestedStyleSignature(renderEdge(withoutValidation(disputedSign)))
    expect(disputed).not.toEqual(control)
    expect(disputed.stroke).toContain('--semantic-warning')
    expect(control.stroke).not.toContain('--semantic-warning')
    // …and it differs on the STROKE only: the dash is existence's, and equal.
    expect(disputed.strokeDasharray).toEqual(control.strokeDasharray)
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

  // ⭐ REWRITTEN 23 Sep 2026. These two cases pinned the divergence-scaled dash
  // at its extremes (`1.5 4`, `3 8`). Divergence no longer reaches the line.
  it.each([0, 1])('max_divergence %s reaches no channel on an agreed-sign contest', (d) => {
    expectStyledAsIfNoValidation({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: d }),
    })
  })
})

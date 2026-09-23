/**
 * Regression tests for how an AI-review disagreement (`edge.data.validation`)
 * reaches the canvas stroke.
 *
 * ⭐ PAUL'S RULING, 23 Sep 2026 (D3 · Connectors):
 *  - the DASH is existence certainty ONLY — no review disagreement sets it;
 *  - ORANGE means the two drafting passes disagree about the SIGN, and nothing
 *    else — `needs_user_input` over an agreed sign no longer paints it;
 *  - so a disagreement that is NOT about the sign renders exactly as if no
 *    validation were present. It stays visible in the Edge inspector
 *    (`EdgeReviewDisagreement`), not on the line.
 *
 * Covers:
 *  - Non-sign contest (any of the four reasons, with/without needs_user_input,
 *    at any divergence) → byte-identical to the validation-absent control
 *  - sign_flip → the direction-disputed orange, and still no contest dash
 *  - A stated low existence probability still dashes, contested or not
 *  - Resolved / malformed / absent validation → standard style
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

  // ⭐ UPDATED AGAIN 23 Sep 2026 — PAUL'S RULING: the dash is existence
  // certainty only, and orange is a SIGN disagreement only. The 17 Aug note
  // below is kept for its history; its "the contest rides the dash" half is
  // what the 23 Sep ruling removes.
  //
  // ⭐ UPDATED 17 Aug 2026 — PAUL'S RULING, not a drifting expectation.
  //
  // These three cases used to assert that ANY pending contest painted the edge
  // warning-orange. That was the defect: `isContested` returned before the
  // polarity stroke was evaluated, so orange was unconditional, and on a fresh
  // AI draft the exception treatment IS the default. Paul's ruling (17 Aug):
  // "orange must NOT universally mean 'unvetted'; reserve exception styling for
  // genuinely exceptional/contested states."
  //
  // `makeValidation`'s default reason is `strength_band_change` — the passes
  // disagree about the STRENGTH BAND and AGREE about the sign — so the edge now
  // keeps its polarity and the contest rides the dash. The exception hue is
  // asserted, on its own twins, immediately below. See
  // `edgePresentation.spec.ts` for the full precedence and
  // `StyledEdge.presentationStability.spec.tsx` for the founder-witnessed harms.
  const NON_SIGN_REASONS = [
    'strength_band_change',
    'confidence_band_change',
    'existence_boundary_crossing',
    'raw_magnitude',
  ] as const

  /**
   * A realistic drafted edge: STATED polarity and strength (the provenance
   * stamps `resolveEdgeDirectionDisplay` / `resolveEdgeSignedStrengthDisplay`
   * require) and a STATED high existence probability, so the edge has a real
   * polarity colour and a real "solid" answer from the existence channel.
   * Without the stamps polarity collapses to neutral grey and "not orange"
   * would pass on the wrong colour.
   */
  function stampedEdge(overrides: Record<string, unknown> = {}) {
    return {
      weight: 0.5,
      direction: 'positive',
      weightSource: 'cee',
      directionSource: 'cee',
      beliefExists: 0.9,
      beliefExistsSource: 'cee',
      ...overrides,
    }
  }

  it('PRECONDITION: the stamped fixture renders a POLARITY colour and a solid line', () => {
    const style = renderEdge(stampedEdge())
    expect(style.stroke).toBe('var(--edge-positive)')
    expect(style.strokeDasharray).toBeUndefined()
  })

  // (a) — the ruling's core. Every non-sign reason, with AND without
  // needs_user_input, at the low/mid/high divergence the old dash scaled with:
  // byte-identical to the same edge with no `validation` at all.
  it.each(NON_SIGN_REASONS)(
    '(a) a %s contest renders SOLID and NOT orange — exactly as if validation were absent',
    (reason) => {
      for (const needs_user_input of [false, true]) {
        for (const max_divergence of [0, 0.6, 1]) {
          const data = stampedEdge({
            validation: makeValidation({
              contested_reasons: [reason],
              max_divergence,
              pass2: {
                strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
                reasoning: 'test', basis: 'domain_prior', needs_user_input,
              },
            }),
          })
          const { withValidation } = expectStyledAsIfNoValidation(data)
          expect(withValidation.strokeDasharray, `${reason} needs=${needs_user_input} d=${max_divergence}`).toBeUndefined()
          expect(withValidation.stroke).toBe('var(--edge-positive)')
          expect(withValidation.stroke).not.toContain('--semantic-warning')
        }
      }
    },
  )

  // (b) — control: the ONE orange survives.
  it('(b) OPPOSITE-DIRECTION TWIN: a sign_flip contest DOES take the warning stroke', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6, contested_reasons: ['sign_flip'] }),
    })
    expect(style.stroke).toContain('color-mix')
    expect(style.stroke).toContain('--semantic-warning')
  })

  it('(b) …and a sign_flip contest does NOT dash: the dash is existence certainty only', () => {
    const style = renderEdge(stampedEdge({
      validation: makeValidation({ max_divergence: 0.6, contested_reasons: ['sign_flip'] }),
    }))
    expect(style.stroke).toContain('--semantic-warning')
    expect(style.strokeDasharray).toBeUndefined()
  })

  it('(b) a sign_flip contest that also asks for input takes the SAME one orange', () => {
    const signFlip = (needs_user_input: boolean) => renderEdge(stampedEdge({
      validation: makeValidation({
        contested_reasons: ['sign_flip'],
        pass2: {
          strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
          reasoning: 'test', basis: 'domain_prior', needs_user_input,
        },
      }),
    })).stroke
    expect(signFlip(true)).toBe(signFlip(false))
    expect(signFlip(true)).toContain('color-mix')
  })

  // (c) — the existence channel is untouched, and now wins on a contested edge.
  it('(c) CONTROL: an uncontested edge with a stated LOW existence probability dashes 6,4', () => {
    expect(renderEdge(stampedEdge({ beliefExists: 0.3 })).strokeDasharray).toBe('6,4')
  })

  it('(c) a contested edge with a stated LOW existence probability dashes from EXISTENCE (6,4)', () => {
    for (const reasons of [['strength_band_change'], ['sign_flip']]) {
      const style = renderEdge(stampedEdge({
        beliefExists: 0.3,
        validation: makeValidation({ max_divergence: 0.6, contested_reasons: reasons }),
      }))
      expect(style.strokeDasharray, reasons.join()).toBe('6,4')
    }
  })

  it('POSITIVE CONTROL: the differential helper CAN fail — a sign_flip contest differs from its control', () => {
    // Without this, every "as if validation were absent" arm could pass by
    // comparing two identically-broken renders. The discriminating channel is
    // now the STROKE, and only for a SIGN disagreement — the whole ruling.
    const disputedSign = stampedEdge({
      validation: makeValidation({ max_divergence: 0.6, contested_reasons: ['sign_flip'] }),
    })
    const disputed = contestedStyleSignature(renderEdge(disputedSign))
    const control = contestedStyleSignature(renderEdge(withoutValidation(disputedSign)))
    expect(disputed).not.toEqual(control)
    expect(disputed.stroke).toContain('--semantic-warning')
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
})

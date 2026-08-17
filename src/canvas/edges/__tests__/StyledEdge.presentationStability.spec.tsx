/**
 * StyledEdge — the MOUNTED consumer of `edgePresentation` (P2).
 *
 * `edgePresentation.spec.ts` proves the pure rules. This file proves the
 * component actually feeds them the right state and paints the result — a
 * producer-side proof says nothing about what a user sees, and this seam has
 * form: the precedence defect it closes lived entirely in how StyledEdge
 * ORDERED its branches, not in any function.
 *
 * Two founder-witnessed harms are pinned here, each with its opposite-direction
 * twin (a fix that trades a false alarm for a silent one is not a fix):
 *
 *   H1  a contested edge rendered warning-orange unconditionally, so polarity
 *       was unreachable        ⇄  twin: a sign_flip contest MUST still alarm
 *   H2  the same edge restyled when an analysis completed, because the
 *       "needs attention" dash read `results.status`
 *                              ⇄  twin: a stated existence uncertainty MUST
 *                                 still dash
 *
 * ⚠ jsdom cannot prove visibility and this file does not try. Everything here is
 * an assertion about the STYLE VALUES StyledEdge hands to BaseEdge.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'

// ── Mutable app state, so one render can differ from the next ───────────────

let resultsStatus: 'idle' | 'complete' = 'idle'
let capturedStyle: React.CSSProperties | undefined
/** Every `results.status` the component's own store selector actually read. */
const statusesSeenByComponent: string[] = []

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
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: (statusesSeenByComponent.push(resultsStatus), resultsStatus), report: null },
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
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))
// importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12):
// a `vi.mock` factory REPLACES the module, so a hand-written list silently drops
// every export added after it was written. Only the two stubs below are
// overridden, and `existenceCertaintyToLineStyle` keeps its REAL behaviour so
// the existence-dash twin is a genuine measurement.
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: () => ({ strokeWidth: 2, strokeDasharray: undefined, stroke: '#888', curvature: 0.15 }),
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const baseProps = {
  id: 'e1', source: 'n1', target: 'n2',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left, selected: false,
}

/**
 * A realistic CEE-drafted causal edge: a STATED positive direction over a STATED
 * strength, carrying the provenance stamps `resolveEdgeDirectionDisplay` and
 * `resolveEdgeSignedStrengthDisplay` require. Without the stamps both resolvers
 * refuse and the polarity collapses to neutral grey — which would make every
 * "polarity survives" assertion below pass on the wrong colour.
 */
function draftedEdge(overrides: Record<string, unknown> = {}) {
  return {
    weight: 0.5,
    direction: 'positive',
    weightSource: 'cee',
    directionSource: 'cee',
    ...overrides,
  }
}

function contestedValidation(overrides: Record<string, unknown> = {}) {
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
    evoi_rank: null, evoi_impact: null,
    was_shown: true, user_action: 'pending',
    resolved_value: null, resolved_by: 'default',
    ...overrides,
  }
}

function renderEdge(data: Record<string, unknown>) {
  capturedStyle = undefined
  const { unmount } = render(<StyledEdge {...(baseProps as any)} data={data} />)
  const style = capturedStyle!
  unmount()
  return { stroke: style.stroke, strokeDasharray: style.strokeDasharray }
}

const POSITIVE = 'var(--edge-positive)'

afterEach(() => {
  resultsStatus = 'idle'
  capturedStyle = undefined
  statusesSeenByComponent.length = 0
})

describe('StyledEdge — the fixture itself is honest (precondition pins)', () => {
  it('the drafted-edge fixture really does render a POLARITY colour, not neutral grey', () => {
    // Pins this file's own precondition in-test (trap 13b). Every assertion
    // below distinguishes "polarity survived" from "orange won"; if the fixture
    // silently lost its provenance stamps the polarity would be neutral grey and
    // those assertions would still pass, measuring nothing.
    expect(renderEdge(draftedEdge()).stroke).toBe(POSITIVE)
  })

  it('CONTRAST CONTROL: the same edge WITHOUT provenance stamps is neutral, not green', () => {
    const stroke = renderEdge({ weight: 0.5, direction: 'positive' }).stroke
    expect(stroke).not.toBe(POSITIVE)
    expect(stroke).toContain('--edge-neutral')
  })
})

describe('H1 — orange stops being the default; polarity survives a contest', () => {
  it('a contested edge whose contest is NOT about the sign renders its polarity', () => {
    const s = renderEdge(draftedEdge({ validation: contestedValidation() }))
    expect(s.stroke).toBe(POSITIVE)
    expect(s.stroke).not.toContain('--semantic-warning')
  })

  it('…and the contest is still visible, on the dash', () => {
    expect(renderEdge(draftedEdge({ validation: contestedValidation() })).strokeDasharray).toBe('2.4 6')
  })

  it('TWIN: a sign_flip contest DOES render the exception hue', () => {
    const s = renderEdge(draftedEdge({ validation: contestedValidation({ contested_reasons: ['sign_flip'] }) }))
    expect(s.stroke).toContain('--semantic-warning')
    expect(s.stroke).not.toBe(POSITIVE)
  })

  it('TWIN: needs_user_input DOES render the exception hue at full strength', () => {
    const s = renderEdge(draftedEdge({
      validation: contestedValidation({
        pass2: {
          strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
          reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
        },
      }),
    }))
    expect(s.stroke).toBe('var(--semantic-warning)')
  })
})

describe('H2 — an edge\'s resting appearance is a function of the EDGE, not the app phase', () => {
  /**
   * ⚠ SCOPE, STATED PRECISELY. The claim is about the two RESTING style channels
   * Paul watched change — stroke colour and dash. It is NOT a claim that nothing
   * about an edge may change after analysis: label visibility deliberately does
   * (`shouldShowEdgeLabel` surfaces top-strength labels once results exist), and
   * that is a designed behaviour, not this defect.
   */
  const cases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['a plain drafted edge with no confidence set', draftedEdge()],
    ['a drafted edge with a stated existence probability', draftedEdge({ beliefExists: 0.8 })],
    ['a contested edge', draftedEdge({ validation: contestedValidation() })],
    ['a sign_flip contested edge', draftedEdge({ validation: contestedValidation({ contested_reasons: ['sign_flip'] }) })],
    ['an edge with a low existence probability', draftedEdge({ beliefExists: 0.3 })],
  ]

  it.each(cases)('%s renders identically before and after an analysis completes', (_label, data) => {
    resultsStatus = 'idle'
    const before = renderEdge(data)
    resultsStatus = 'complete'
    const after = renderEdge(data)
    expect(after).toEqual(before)
  })

  it('POSITIVE CONTROL: the harness CAN see a difference between two renders', () => {
    // Without this, every case above could pass by comparing two identically
    // broken renders — or by a mock that pins the style regardless of input.
    const a = renderEdge(draftedEdge())
    const b = renderEdge(draftedEdge({ validation: contestedValidation({ contested_reasons: ['sign_flip'] }) }))
    expect(a).not.toEqual(b)
  })

  it('POSITIVE CONTROL: the mutable results status really does reach the component', () => {
    // Without this the cases above could pass because the lever was never
    // connected — an "identical" result from a variable nobody read is the
    // vacuity this estate keeps paying for (trap 13). Asserts the component's
    // OWN store selector observed both values.
    resultsStatus = 'idle'
    renderEdge(draftedEdge())
    resultsStatus = 'complete'
    renderEdge(draftedEdge())
    expect(new Set(statusesSeenByComponent)).toEqual(new Set(['idle', 'complete']))
  })
})

describe('H2b — "needs attention" is no longer the default treatment', () => {
  it('a fresh drafted edge with NO confidence renders SOLID, not dashed', () => {
    // Was `'6 3'` for every confidence-less edge while results were incomplete —
    // i.e. every edge of every fresh AI draft.
    expect(renderEdge(draftedEdge()).strokeDasharray).toBeUndefined()
  })

  it('TWIN: an edge with a STATED low existence probability still dashes', () => {
    // Removing the fabricated uncertainty signal must not remove the real one.
    const dash = renderEdge(draftedEdge({ beliefExists: 0.3 })).strokeDasharray
    expect(dash).toBeTruthy()
    expect(dash).not.toBe('6 3')
  })

  it('the missing-confidence marker survives, and no longer depends on the app phase', () => {
    // e2e `inspector-phase1.spec.ts` T5 asserts this test id is attached.
    for (const status of ['idle', 'complete'] as const) {
      resultsStatus = status
      const { queryByTestId, unmount } = render(<StyledEdge {...(baseProps as any)} data={draftedEdge()} />)
      expect(queryByTestId('overlay-missing-confidence')).not.toBeNull()
      unmount()
    }
  })

  it('…and is absent once an existence probability IS set', () => {
    // `getEdgeConfidence` reads `beliefExists`/`belief` — the SAME field the
    // existence-certainty dash reads. The two dash branches therefore
    // partitioned on one field's presence, and the pre-run half was inventing a
    // dash for a value nobody had stated.
    const { queryByTestId, unmount } = render(<StyledEdge {...(baseProps as any)} data={draftedEdge({ beliefExists: 0.8 })} />)
    expect(queryByTestId('overlay-missing-confidence')).toBeNull()
    unmount()
  })
})

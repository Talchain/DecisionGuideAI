/**
 * StyledEdge — encoding rationalisation (23-Jul deep-audit P1.8/P2.9).
 *
 * Three mechanism pins, one per Paul-approved encoding change:
 *   1. Polarity glyph (+/−) renders whenever a non-structural edge has a
 *      direction — in Standard view AND pre-run — not only Expert+results.
 *      (directionStroke.ts's own docblock: the glyph, not the colour, carries
 *      polarity for a red-green dichromat; today it only shows Expert+results.)
 *   2. exists_probability drives a SINGLE channel — the dash — not dash AND
 *      opacity. Opacity returns to a constant; the belief dash stays.
 *   3. Stroke width means WEIGHT MAGNITUDE in BOTH phases (stable, learnable),
 *      never composite importance post-run.
 *
 * Harness mirrors StyledEdge.structural.spec.tsx. graphDisplayCalculations is
 * mocked with DISTINCT width outputs (weightMagnitude=2 ≠ importance=7) so a
 * width assertion can tell which formula the component chose; the dash mock
 * reflects the real <0.7 rule so the belief-dash pin is meaningful.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Node kind registry — switched per-test ───────────────────────────────────
const nodeKinds: Record<string, string> = {}

// ── Mutable store state — overridden per-test ────────────────────────────────
interface StoreState {
  viewMode: 'standard' | 'expert'
  resultsStatus: 'idle' | 'complete'
  report: unknown
}
const storeState: StoreState = { viewMode: 'standard', resultsStatus: 'idle', report: null }
const setStore = (over: Partial<StoreState>) => Object.assign(storeState, over)

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? { id, type: nodeKinds[id], data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
          : null,
      getEdges: () => [],
      getNodes: () =>
        Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
    }),
    useStore: (selector: any) =>
      selector({
        nodes: Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
      }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: storeState.resultsStatus, report: storeState.report },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: storeState.viewMode,
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

vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// Distinct width outputs so an assertion can tell the two formulas apart;
// dash reflects the real <0.7 rule so the belief-dash pin is meaningful.
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // ⛔ importOriginal-SPREAD, not a hand-listed replacement. A `vi.mock`
  // factory REPLACES the module, so every export added after this mock was
  // written silently vanished — adding `UNSET_EDGE_STROKE_WIDTH` took 49 tests
  // down across seven files at once. The spread makes the mock derive from the
  // real module and override only what it means to stub.
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  existenceCertaintyToLineStyle: (p: number | undefined) => (p !== undefined && p < 0.7 ? '6,4' : undefined),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 7,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const baseProps = {
  id: 'e1', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

const RESULTS_REPORT = {
  robustness: { fragile_edges: [] },
  factor_sensitivity: [{ factor_id: 'src', elasticity: 0.5 }],
}

const styleOf = (container: HTMLElement) =>
  ((container.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style)

/**
 * ⚠ FIXTURES UPDATED, ROADMAP 2.580 member 2 (not a baseline absorption).
 *
 * These fixtures used to carry `direction` with NO provenance — byte-identical
 * to the shape an edge NOBODY characterised carries
 * (`USER_EDGE_DEFAULTS.direction = 'positive'`, no source stamp). So the pins
 * read "the glyph renders for a directed edge" while in fact also asserting
 * "the glyph renders for a DEFAULTED one" — the fabrication Codex saw as "the
 * displayed graph encoded a POSITIVE relationship".
 *
 * The item-1 claim these tests exist for — the glyph shows in Standard view
 * and pre-run, not only Expert+results — is UNCHANGED and still pinned below.
 * The fixtures now STATE the direction they were always meant to describe.
 * The unstated cases are pinned separately, and as ABSENCES, in
 * `StyledEdge.directionProvenance.spec.tsx`.
 */
describe('StyledEdge — polarity glyph legibility (item 1)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    setStore({ viewMode: 'standard', resultsStatus: 'idle', report: null })
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  it('renders the + glyph in Standard view, pre-run, for a positive causal edge', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', directionSource: 'user', beliefExists: 0.8 }} />
    )
    const glyph = container.querySelector('[aria-label="Effect direction: positive"]')
    expect(glyph).not.toBeNull()
    expect(glyph!.textContent).toBe('+')
  })

  it('renders the − glyph in Standard view, pre-run, for a negative causal edge', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'negative', directionSource: 'user', beliefExists: 0.8 }} />
    )
    const glyph = container.querySelector('[aria-label="Effect direction: negative"]')
    expect(glyph).not.toBeNull()
    expect(glyph!.textContent).toBe('−')
  })

  it('still suppresses the glyph on structural edges (decision→option)', () => {
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', directionSource: 'user', beliefExists: 0.8 }} />
    )
    expect(container.querySelector('[aria-label="Effect direction: positive"]')).toBeNull()
  })
})

describe('StyledEdge — belief is a single channel: dash, not opacity (item 2)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    setStore({ viewMode: 'standard', resultsStatus: 'complete', report: RESULTS_REPORT })
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  it('low exists_probability sets the dash but NEVER dims the edge via opacity', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', beliefExists: 0.3, confidence: 0.5 }} />
    )
    const style = styleOf(container)
    // Belief still encoded via the dash channel.
    expect(style.strokeDasharray).toBe('6,4')
    // Opacity is a constant — never coupled to exists_probability.
    expect(style.opacity).toBe('')
  })

  it('high exists_probability also leaves opacity constant (no belief coupling)', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', beliefExists: 0.9, confidence: 0.5 }} />
    )
    expect(styleOf(container).opacity).toBe('')
  })
})

// `weightSource` is REQUIRED on these two fixtures. Stroke width is now
// provenance-gated: an edge whose strength nobody set draws at
// UNSET_EDGE_STROKE_WIDTH, so without the stamp these tests would be
// measuring the unset floor rather than the weight-vs-importance choice they
// exist to pin. The claim under test is unchanged.
describe('StyledEdge — stroke width means weight magnitude in both phases (item 3)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  it('pre-run: width follows weight magnitude (2), not importance (7)', () => {
    setStore({ viewMode: 'standard', resultsStatus: 'idle', report: null })
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', beliefExists: 0.8, weightSource: 'cee' }} />
    )
    expect(styleOf(container).strokeWidth).toBe('2')
  })

  it('post-run: width STILL follows weight magnitude (2), not composite importance (7)', () => {
    setStore({ viewMode: 'standard', resultsStatus: 'complete', report: RESULTS_REPORT })
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', beliefExists: 0.8, weightSource: 'cee' }} />
    )
    expect(styleOf(container).strokeWidth).toBe('2')
  })
})

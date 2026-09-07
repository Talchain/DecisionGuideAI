/**
 * P2 — THE PERSISTENT-LABEL GATE, AT THE COMPONENT, ON ALL THREE BRANCHES.
 *
 * WHY THIS FILE EXISTS: A MEASURED HOLE IN THE UNIT GUARD.
 * -------------------------------------------------------
 * `edgeLabelVisibility.persistentLabelSpeaksAStrength.spec.ts` pins the
 * SELECTOR: an edge whose strength nobody set may not pin a label. It cannot
 * pin the WIRING, and I measured that rather than assuming it. A mutant that
 * replaced all three of `StyledEdge`'s answers with a hardcoded
 * `strengthIsSet: true` — the exact "wrong value" a future branch might supply —
 * SURVIVED 65 tests across five specs, the unit guard included. The required
 * field makes OMITTING the answer a type error; nothing made ANSWERING IT
 * WRONGLY fail. This suite is that missing half.
 *
 * `topStrengthIds` has THREE branches and they are selected by graph shape, so
 * each needs its own fixture or two thirds of the wiring stays unguarded:
 *
 *   1. `causalEdges.length <= 3`  — "few edges, label them all". This is the
 *      branch that carried the defect most plainly: its own comment used to say
 *      "no provenance gate on this branch".
 *   2. `isResultsMode && report`  — post-analysis composite importance, scored
 *      from `ed?.weight ?? 0.5`, a UI default present on every edge.
 *   3. otherwise                  — the pre-analysis |strength.mean| ranker.
 *
 * ⛔ EVERY CASE IS A PAIR. The unset fixture asserts NO strength row; its twin
 * differs in ONE byte-level respect — the presence of `strength_mean`, the
 * thing that gives the strength a provenance — and asserts the row IS there.
 * The negative alone would pass on a component that rendered no labels at all
 * (CLAUDE.md trap 13b); the pair is what makes it a claim about provenance
 * rather than about labels in general.
 *
 * FIXTURE PROVENANCE, PINNED IN-TEST: `edgeValueSource` treats a raw
 * `strength_mean` as CEE evidence (`edgeValueProvenance.ts:155`) and has no
 * fallback for a bare `weight` — `DEFAULT_EDGE_DATA.weight = 0.5` is exactly the
 * UI default the gate exists to refuse. So UNSET carries `weight` and no
 * `strength_mean`; SOURCED adds `strength_mean`. The preconditions block asserts
 * both resolve as intended, so these fixtures cannot silently stop
 * discriminating.
 *
 * CLAIM TYPE: rendered DOM presence/absence, bound by test id. jsdom cannot
 * prove visibility, layout or overflow (platform trap 3) and nothing here tries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'detailed'
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

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: mockStatus, report: mockReport },
      viewMode: mockViewMode,
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
vi.mock('../../utils/graphDisplayCalculations', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
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

/**
 * NOBODY SET THE STRENGTH. `weight` is the UI default sitting on the edge with
 * no source marker; the direction IS stated, which is what makes this edge's
 * label the 23-character "Boost, strength not set" rather than the both-unset
 * sentence.
 */
const UNSET_STRENGTH = {
  weight: 0.5,
  effect_direction: 'positive' as const,
  exists_probability: 0.8,
}

/** Identical, plus the one field that gives the strength a provenance. */
const SOURCED_STRENGTH = {
  ...UNSET_STRENGTH,
  strength_mean: 0.6,
}

const strengthText = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null

const propsFor = (data: Record<string, unknown>) => ({
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
  data,
})

/** Branch 1: a single causal edge takes the `length <= 3` path. */
function graphOfOne(data: Record<string, unknown>): void {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
}

/**
 * Branches 2 and 3: five causal edges, so the `<= 3` path is NOT taken. Every
 * edge carries the SAME data, so the edge under test cannot be excluded merely
 * for ranking below a better sibling — with the gate removed, `e1` wins on the
 * id tie-break and pins a label. That is what makes these cases discriminating
 * rather than incidentally label-free.
 */
function graphOfFive(data: Record<string, unknown>): void {
  mockEdges = ['e1', 'e2', 'e3', 'e4', 'e5'].map(id => ({
    id,
    source: 'n1',
    target: `t-${id}`,
    data,
  }))
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'detailed'
  mockStatus = 'complete'
})

describe('PRECONDITIONS — the two fixtures differ in exactly the thing under test', () => {
  it('UNSET resolves show:false and SOURCED resolves show:true', () => {
    expect(resolveEdgeSignedStrengthDisplay(UNSET_STRENGTH).show).toBe(false)
    expect(resolveEdgeSignedStrengthDisplay(SOURCED_STRENGTH).show).toBe(true)
  })

  it('they differ ONLY by strength_mean — so a passing pair isolates provenance', () => {
    const { strength_mean, ...rest } = SOURCED_STRENGTH as Record<string, unknown>
    expect(strength_mean).toBe(0.6)
    expect(rest).toEqual(UNSET_STRENGTH)
  })
})

describe('branch 1 — few causal edges ("label them all")', () => {
  it('THE DEFECT: an unset-strength edge pins NO persistent label', () => {
    graphOfOne(UNSET_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(UNSET_STRENGTH) as any)} />)
    expect(strengthText(container)).toBeNull()
  })

  it('TWIN: the same edge WITH a sourced strength pins one, and it speaks the strength', () => {
    graphOfOne(SOURCED_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(SOURCED_STRENGTH) as any)} />)
    const row = strengthText(container)
    expect(row, 'the sourced twin rendered no strength row — the pair is not discriminating').not.toBeNull()
    expect(row!.textContent).toContain('boost')
    // ⚠ NOT `not.toContain('not set')` — I WROTE THAT AND IT RED, on
    // "Moderate boost (likelihood not set)". That label is correct: its
    // STRENGTH is sourced ("Moderate boost") and the parenthetical is a true
    // statement about the LIKELIHOOD, which this gate has no opinion about.
    // This is the second time in one change I reached for the defect's WORDING
    // instead of its PROPERTY (CLAUDE.md trap 13d); recorded here because the
    // over-broad version would have quietly banned a legitimate label class the
    // moment someone "fixed" it by trimming the copy.
    expect(row!.textContent).not.toContain('strength not set')
  })
})

describe('branch 2 — post-analysis composite importance', () => {
  it('THE DEFECT: an unset-strength edge pins NO persistent label', () => {
    mockReport = { enrichment: { sensitivity_analysis: { factors: [] } } }
    graphOfFive(UNSET_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(UNSET_STRENGTH) as any)} />)
    expect(strengthText(container)).toBeNull()
  })

  it('TWIN: the same graph with sourced strengths pins one for this edge', () => {
    mockReport = { enrichment: { sensitivity_analysis: { factors: [] } } }
    graphOfFive(SOURCED_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(SOURCED_STRENGTH) as any)} />)
    const row = strengthText(container)
    expect(row, 'the sourced twin rendered no strength row — the pair is not discriminating').not.toBeNull()
    expect(row!.textContent).toContain('boost')
  })
})

describe('branch 3 — pre-analysis |strength.mean| ranker', () => {
  it('THE DEFECT: an unset-strength edge pins NO persistent label', () => {
    mockReport = null
    graphOfFive(UNSET_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(UNSET_STRENGTH) as any)} />)
    expect(strengthText(container)).toBeNull()
  })

  it('TWIN: the same graph with sourced strengths pins one for this edge', () => {
    mockReport = null
    graphOfFive(SOURCED_STRENGTH)
    const { container } = render(<StyledEdge {...(propsFor(SOURCED_STRENGTH) as any)} />)
    const row = strengthText(container)
    expect(row, 'the sourced twin rendered no strength row — the pair is not discriminating').not.toBeNull()
    expect(row!.textContent).toContain('boost')
  })
})

describe('the fact is not lost — it is still one interaction away', () => {
  it('SELECTING the unset edge in Detailed view shows the full sentence the map no longer pins', () => {
    // `shouldShowEdgeLabel`'s interaction-driven triggers are unchanged by the
    // P2 gate: they are about THIS edge being selected, not about it winning a
    // persistent slot. So the sentence the canvas stopped pinning is still
    // reachable, and this asserts the exact string rather than merely "a label".
    graphOfOne(UNSET_STRENGTH)
    const { container } = render(
      <StyledEdge {...({ ...propsFor(UNSET_STRENGTH), selected: true } as any)} />,
    )
    const row = strengthText(container)
    expect(row, 'selecting the edge showed no label at all').not.toBeNull()
    expect(row!.textContent).toContain('Boost, strength not set')
  })
})

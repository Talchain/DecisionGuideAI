/**
 * ROADMAP 2.580 member 2 — THE GRAPH MUST NOT ENCODE A DIRECTION NOBODY STATED.
 *
 * Codex simulated-user review, 5 Aug 2026: "one flip sentence said hiring
 * would REDUCE a delay while the displayed graph encoded a POSITIVE
 * relationship to that delay."
 *
 * WHAT THE INVESTIGATION FOUND (and it is not what the member's wording
 * suggests): the two halves are not two readings of one edge object. The
 * SENTENCE side is a factor-level fact (`factor_sensitivity[].direction` in
 * the analysis payload, rendered as "increases/decreases the outcome"); the
 * GRAPH side is an edge-level field in the canvas store (`edge.data.direction`,
 * rendered as the green `+` / rose `−` glyph at `StyledEdge.tsx:802`). They
 * answer DIFFERENT QUESTIONS about DIFFERENT OBJECTS, which is CLAUDE.md trap
 * 21 — and aligning their defaults would be the wrong fix.
 *
 * What IS a defect, and is fixed here: `edge.data.direction` DEFAULTS to
 * `'positive'`. `USER_EDGE_DEFAULTS` sets it with no source stamp, and the
 * template-insert, blueprint-insert and two CEE-apply paths build from
 * `DEFAULT_EDGE_DATA`, which defines no `direction` key at all
 * (`edgeValueProvenance.ts`, THE WRITER MANIFEST). So the canvas drew a green
 * `+` — "positive relationship" — on edges whose direction nobody ever stated.
 * That is the fabricated half of the contradiction the reviewer saw, and it is
 * display-side.
 *
 * The gate already exists and already owns this answer:
 * `resolveEdgeDirectionDisplay` (ROADMAP 2.263). It was applied to the THREE
 * Model-tab consumers and NOT to the canvas edge — the one surface the
 * reviewer called "the displayed graph". Its own module header states rule 4,
 * "ONE OWNER. This resolver is it." This spec makes the canvas obey it.
 *
 * The hover popover in the same file was already gated, and its comment names
 * this exact hazard: "`direction` defaults to 'positive', so 'Positive' is
 * itself a fabrication on an edge nobody characterised." The glyph 200 lines
 * above it was not.
 *
 * RED-first: the two "does not render" cases below fail at bc997f50.
 *
 * ⚠ SCOPE, STATED SO IT IS NOT OVER-READ: this pins the GLYPH and its
 * `aria-label` — the symbolic/textual polarity claim. The stroke COLOUR is a
 * separate channel with its own consumers and is unchanged here; see the PR
 * body for the rowed residual.
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



/** The glyph, found by its own aria-label — bound by identity, not by text. */
const glyphFor = (container: HTMLElement, direction: 'positive' | 'negative') =>
  container.querySelector(`[aria-label="Effect direction: ${direction}"]`)

/** Any polarity glyph at all, whichever sign. */
const anyGlyph = (container: HTMLElement) =>
  container.querySelector('[aria-label^="Effect direction:"]')

describe('StyledEdge — polarity glyph is provenance-gated (ROADMAP 2.580 member 2)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    setStore({ viewMode: 'standard', resultsStatus: 'idle', report: null })
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  // ── The claim is licensed: someone stated the direction ──────────────────

  it('renders + when a USER stated a positive direction', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'positive', directionSource: 'user', beliefExists: 0.8 }}
      />
    )
    expect(glyphFor(container, 'positive')!.textContent).toBe('+')
  })

  it('renders − when a USER stated a negative direction', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'negative', directionSource: 'user', beliefExists: 0.8 }}
      />
    )
    expect(glyphFor(container, 'negative')!.textContent).toBe('−')
  })

  it('renders + on the CEE back-compat evidence (raw effect_direction, no stamp)', () => {
    // `effect_direction` is the producer wire spelling and nothing in the UI
    // fabricates it, so its presence PROVES a producer stated a direction.
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'positive', effect_direction: 'positive', beliefExists: 0.8 }}
      />
    )
    expect(glyphFor(container, 'positive')!.textContent).toBe('+')
  })

  // ── The claim is NOT licensed: these are the fabrications ────────────────

  it('DOES NOT render a glyph when `direction` is the unstated UI default', () => {
    // `USER_EDGE_DEFAULTS.direction === 'positive'` with no source stamp —
    // exactly the shape every user-drawn edge carries until someone sets it.
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, direction: 'positive', beliefExists: 0.8 }} />
    )
    expect(anyGlyph(container)).toBeNull()
  })

  it('DOES NOT render a glyph when the producer EXPLICITLY declined (effect_direction: "unknown")', () => {
    // The declining value sits BESIDE the defaulted `direction: 'positive'`,
    // which is precisely the pair that used to render a green +.
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'positive', effect_direction: 'unknown', beliefExists: 0.8 }}
      />
    )
    expect(anyGlyph(container)).toBeNull()
  })

  it('DOES NOT render a glyph when the edge carries no direction at all', () => {
    // `DEFAULT_EDGE_DATA` defines no `direction` key: the template-insert,
    // blueprint-insert and CEE-apply paths all land here.
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ weight: 0.6, beliefExists: 0.8 }} />
    )
    expect(anyGlyph(container)).toBeNull()
  })

  it('DOES NOT render a glyph for an unrecognised direction value, even with a source stamp', () => {
    // Rule 3 of the resolver: an unrecognised value fails closed.
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'sideways', directionSource: 'user', beliefExists: 0.8 }}
      />
    )
    expect(anyGlyph(container)).toBeNull()
  })

  // ── The glyph states the direction that was STATED, not one inferred ─────

  it('does not let a stated NEGATIVE direction be overridden by a positive magnitude', () => {
    // Rule 1: never infer direction from a magnitude. `weight` is unsigned and
    // positive here; the stated direction is negative and must win.
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.9, direction: 'negative', directionSource: 'cee', beliefExists: 0.8 }}
      />
    )
    expect(glyphFor(container, 'negative')!.textContent).toBe('−')
    expect(glyphFor(container, 'positive')).toBeNull()
  })

  it('still suppresses the glyph on structural edges even when the direction IS stated', () => {
    // The pre-existing structural exclusion is not weakened by the new gate.
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, direction: 'positive', directionSource: 'user', beliefExists: 0.8 }}
      />
    )
    expect(anyGlyph(container)).toBeNull()
  })
})

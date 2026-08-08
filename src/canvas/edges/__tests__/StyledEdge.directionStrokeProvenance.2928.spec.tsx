/**
 * ROADMAP 2.928 member (b) — THE STROKE MUST OBEY THE SAME RESOLVER AS THE GLYPH.
 *
 * WHAT #623 LEFT HALF-FIXED, AND WHY IT IS VISIBLE
 * -----------------------------------------------
 * ROADMAP 2.580 member 2 stopped the canvas drawing a green `+` on edges whose
 * direction nobody stated: `StyledEdge` began resolving the DISPLAY CLAIM
 * through `resolveEdgeDirectionDisplay` (ROADMAP 2.263, "ONE OWNER. This
 * resolver is it."). Its spec said so explicitly in its scope note — "this pins
 * the GLYPH and its `aria-label` … The stroke COLOUR is a separate channel and
 * is unchanged here; see the PR body for the rowed residual."
 *
 * This is that residual. `computeDirectionStroke` kept taking the RAW
 * `edgeData.direction`, which `USER_EDGE_DEFAULTS` fabricates as `'positive'`
 * with no source stamp. So on any edge whose STRENGTH is set but whose
 * DIRECTION is not, the glyph correctly disappeared and the edge kept its
 * **green polarity stroke** — the same false causal claim, in the channel
 * `directionStroke.ts`'s own header calls "the primary" cue:
 *
 *     "The +/− glyph is the second cue; these hues are the primary."
 *
 * Removing the second cue while leaving the primary one asserting is strictly
 * worse than the state before #623 for a red-green dichromat, for whom the
 * glyph was the ONLY reliable polarity channel (same header, the CVD note).
 *
 * REACHABILITY — DERIVED FROM THE WRITER MANIFEST, NOT IMAGINED
 * ------------------------------------------------------------
 * The divergence needs `weight` STAMPED and `direction` NOT. Both cases below
 * are real states from `edgeValueProvenance.ts`'s writer manifest:
 *   1. A user draws an edge (`USER_EDGE_DEFAULTS`: `direction: 'positive'`,
 *      unstamped) and then sets its strength in the inspector → `weightSource:
 *      'user'`, direction still unstamped.
 *   2. CEE sends `effect_direction: 'unknown'` — a declared 0.30.0 contract
 *      member, the producer EXPLICITLY declining — beside the ingestion-time
 *      `direction: 'positive'` collapse, with `weightSource: 'cee'`.
 * Case 2 is the sharper one: the producer said "I will not tell you the
 * direction" and the canvas painted it green anyway.
 *
 * WHAT THIS SPEC ASSERTS, AND WHY IT IS NOT TWO SEPARATE PINS
 * ----------------------------------------------------------
 * The last describe block binds the two channels to ONE resolved value: for
 * every fixture, `a polarity glyph is rendered` ⟺ `the stroke is a polarity
 * hue`. Pinning them separately would let them drift apart again and stay
 * green; the biconditional is what REDs on drift, in either direction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
} from '../../domain/edgeValueProvenance'
import { Position } from '@xyflow/react'

const nodeKinds: Record<string, string> = {}

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
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'standard',
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
// ⛔ importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12).
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
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

/** The polarity hues, by token. Light mode — `useIsDark` is mocked false. */
const POSITIVE = 'var(--edge-positive)'
const NEGATIVE = 'var(--edge-negative)'
const NEUTRAL = 'var(--edge-neutral)'
const POLARITY_HUES = [POSITIVE, NEGATIVE]

/** The rendered stroke, read off the one path BaseEdge draws. */
function strokeOf(container: HTMLElement): string {
  const edge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
  expect(edge, 'BaseEdge did not render').not.toBeNull()
  return (edge as unknown as HTMLElement).style.stroke
}

/** Any polarity glyph at all, whichever sign — bound by its own aria-label. */
const anyGlyph = (container: HTMLElement) =>
  container.querySelector('[aria-label^="Effect direction:"]')

/**
 * The fixture table. Each entry is a real edge shape from the writer manifest,
 * and `stated` is what the ONE OWNER (`resolveEdgeDirectionDisplay`) says about
 * it — asserted, not assumed, in the biconditional block below.
 */
const FIXTURES: Array<{ name: string; data: Record<string, unknown> }> = [
  {
    name: 'user stated positive, strength set',
    data: { weight: 0.6, weightSource: 'user', direction: 'positive', directionSource: 'user', beliefExists: 0.8 },
  },
  {
    name: 'user stated negative, strength set',
    data: { weight: 0.6, weightSource: 'user', direction: 'negative', directionSource: 'user', beliefExists: 0.8 },
  },
  {
    name: 'CEE raw effect_direction positive, strength set',
    data: { weight: 0.6, weightSource: 'cee', direction: 'positive', effect_direction: 'positive', beliefExists: 0.8 },
  },
  {
    name: 'DEFAULTED direction, strength set by the user',
    data: { weight: 0.6, weightSource: 'user', direction: 'positive', beliefExists: 0.8 },
  },
  {
    name: 'producer EXPLICITLY declined (effect_direction: unknown), strength set',
    data: { weight: 0.6, weightSource: 'cee', direction: 'positive', effect_direction: 'unknown', beliefExists: 0.8 },
  },
  {
    name: 'no direction key at all (DEFAULT_EDGE_DATA paths), strength set',
    data: { weight: 0.6, weightSource: 'template', beliefExists: 0.8 },
  },
  {
    name: 'unrecognised direction value with a source stamp',
    data: { weight: 0.6, weightSource: 'user', direction: 'sideways', directionSource: 'user', beliefExists: 0.8 },
  },
  {
    name: 'strength NOT set either',
    data: { weight: 0.6, direction: 'positive', directionSource: 'user', beliefExists: 0.8 },
  },
]

describe('StyledEdge — the stroke is provenance-gated (ROADMAP 2.928 member b)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  // ── The named defects ────────────────────────────────────────────────────

  it('DOES NOT paint the positive green when `direction` is the unstated UI default', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{ weight: 0.6, weightSource: 'user', direction: 'positive', beliefExists: 0.8 }}
      />
    )
    expect(strokeOf(container)).toBe(NEUTRAL)
    expect(strokeOf(container)).not.toBe(POSITIVE)
  })

  it('DOES NOT paint the positive green when the producer EXPLICITLY declined', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'cee',
          direction: 'positive', effect_direction: 'unknown', beliefExists: 0.8,
        }}
      />
    )
    expect(strokeOf(container)).toBe(NEUTRAL)
    expect(strokeOf(container)).not.toBe(POSITIVE)
  })

  it('DOES NOT paint a polarity hue for an unrecognised direction, even with a source stamp', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'user',
          direction: 'sideways', directionSource: 'user', beliefExists: 0.8,
        }}
      />
    )
    expect(POLARITY_HUES).not.toContain(strokeOf(container))
  })

  // ── The licensed claims still paint ──────────────────────────────────────

  it('still paints the positive green when a USER stated the direction', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'user',
          direction: 'positive', directionSource: 'user', beliefExists: 0.8,
        }}
      />
    )
    expect(strokeOf(container)).toBe(POSITIVE)
  })

  it('still paints the negative rose when a USER stated the direction', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'user',
          direction: 'negative', directionSource: 'user', beliefExists: 0.8,
        }}
      />
    )
    expect(strokeOf(container)).toBe(NEGATIVE)
  })

  it('still paints the positive green on the CEE back-compat evidence (raw effect_direction)', () => {
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'cee',
          direction: 'positive', effect_direction: 'positive', beliefExists: 0.8,
        }}
      />
    )
    expect(strokeOf(container)).toBe(POSITIVE)
  })

  // ── ONE RESOLVED VALUE, TWO CHANNELS ─────────────────────────────────────
  //
  // ⚠ THE TWO CHANNELS ARE NOT INTERCHANGEABLE, AND A BICONDITIONAL HERE WOULD
  // BE WRONG (CLAUDE.md trap 21 — write down the question each authority
  // answers before reconciling them). The GLYPH answers "did anyone state a
  // direction?". The STROKE answers "did anyone state a direction AND set a
  // strength?" — grey is `directionStroke.ts`'s NO-VERDICT colour and it
  // already, correctly, covers "strength nobody has set". So a stated
  // direction on an unset strength legitimately renders a glyph over a grey
  // stroke, and the last fixture in the table is exactly that case. This spec
  // was first written with a biconditional; that fixture is what refuted it.
  //
  // The two claims that ARE binding:
  //   1. SAFETY — the stroke may never assert a polarity the resolver did not
  //      license: `strokeIsPolarity ⟹ glyphRendered`. This is the direction
  //      the defect ran in, and it is the one that must never regress.
  //   2. AGREEMENT — where the strength IS set, the two channels are the same
  //      resolved value and must match exactly.
  // Both are DERIVED per fixture from the two owning resolvers, so a fixture
  // added to the table extends the coverage without anyone updating a list.

  describe('glyph and stroke derive from the SAME resolved direction', () => {
    it.each(FIXTURES)('$name', ({ data }) => {
      const directionShown = resolveEdgeDirectionDisplay(data).show
      const strengthShown = resolveEdgeSignedStrengthDisplay(data).show
      const { container } = render(<StyledEdge {...(baseProps as any)} data={data} />)

      const glyphRendered = anyGlyph(container) !== null
      const strokeIsPolarity = POLARITY_HUES.includes(strokeOf(container))

      // The glyph is bound to the ONE OWNER's verdict (ROADMAP 2.580 member 2).
      expect(glyphRendered).toBe(directionShown)

      // The stroke is bound to the SAME verdict, conjoined with the strength
      // gate it already owned. Nothing here re-derives either answer.
      expect(strokeIsPolarity).toBe(directionShown && strengthShown)

      // Claim 1, stated separately so a regression names itself: the primary
      // colour cue can never out-claim the secondary glyph cue.
      if (strokeIsPolarity) expect(glyphRendered).toBe(true)
    })
  })

  it('the table is not vacuous: it produces BOTH outcomes on BOTH channels', () => {
    // Without this, a change that suppressed every glyph and every polarity hue
    // would satisfy every row above (false === false) — a guard agreeing with
    // itself (CLAUDE.md trap 13b). Pin the discriminations the table must make.
    const rows = FIXTURES.map(({ data }) => {
      const { container, unmount } = render(<StyledEdge {...(baseProps as any)} data={data} />)
      const row = {
        polarity: POLARITY_HUES.includes(strokeOf(container)),
        glyph: anyGlyph(container) !== null,
      }
      unmount()
      return row
    })
    expect(rows.map(r => r.polarity)).toContain(true)
    expect(rows.map(r => r.polarity)).toContain(false)
    expect(rows.map(r => r.glyph)).toContain(true)
    expect(rows.map(r => r.glyph)).toContain(false)
    // …and the two channels genuinely DIVERGE somewhere, so the "different
    // questions" reading above is measured rather than asserted.
    expect(rows.some(r => r.glyph !== r.polarity)).toBe(true)
  })

  it('a structural edge keeps its structural grey and no glyph, gate or not', () => {
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'
    const { container } = render(
      <StyledEdge
        {...(baseProps as any)}
        data={{
          weight: 0.6, weightSource: 'user',
          direction: 'positive', directionSource: 'user', beliefExists: 0.8,
        }}
      />
    )
    expect(anyGlyph(container)).toBeNull()
    expect(POLARITY_HUES).not.toContain(strokeOf(container))
  })
})

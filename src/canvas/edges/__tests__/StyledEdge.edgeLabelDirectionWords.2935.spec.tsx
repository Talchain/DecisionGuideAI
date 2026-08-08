/**
 * ROADMAP 2.935 (Codex R4 finding MF5) — THE LABEL'S DIRECTION WORD MUST COME
 * FROM THE RESOLVER, NOT FROM THE SIGN OF A MAGNITUDE.
 *
 * THE DEFECT, IN THE PRODUCT'S OWN WORDS
 * --------------------------------------
 * CEE returns a NEGATIVE `strength.mean` for a harmful factor. Ingestion
 * (`mapDraftEdgeToCanvas`, and its twin in `DraftChat`) deliberately splits that
 * into two fields — "UI-SEM-023 … store unsigned magnitude":
 *
 *     const weight    = Math.max(0, Math.min(2, Math.abs(rawWeight)))
 *     const direction = directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')
 *
 * `StyledEdge` then passed that MAGNITUDE — never negative, by construction —
 * into `getEdgeLabel`, and `describeEdge` derived the user-facing word from
 * `weight >= 0`. Every causal edge in the product therefore read **"boost"**,
 * including the ones the model says REDUCE the goal. Codex captured the exact
 * string on a live negative edge: "Moderate boost (uncertain)".
 *
 * WHY EVERY EXISTING TEST WAS GREEN (this is the load-bearing part)
 * ----------------------------------------------------------------
 * `edgeLabels.spec.ts` and `canvas.edge-labels.dom.spec.tsx` DO assert
 * `describeEdge(-0.5, …) === 'Moderate drag'` — and always passed, because they
 * call the pure function with a signed number **the producer cannot emit**.
 * The negative weight exists only in the specs. That is CLAUDE.md trap
 * 16-inverse exactly: *a fixture you wrote yourself is not evidence about the
 * wire* — the code path was live and the DATA could never reach it.
 *
 * So this spec does not hand-author `data` at all. Every fixture is a REAL edge
 * from a committed CEE draft capture, pushed through the REAL exported
 * ingestion mapper, and the resulting `data` is what the component sees. If
 * ingestion ever stops producing the shape under test, `describes the fixture
 * preconditions` REDs rather than this file quietly testing nothing.
 *
 * WHAT QUESTION DOES THE LABEL ANSWER? (CLAUDE.md trap 21 — write it down
 * BEFORE reconciling two authorities that look like they disagree)
 * ----------------------------------------------------------------------
 *   · GLYPH  (`aria-label="Effect direction: …"`) — "did anyone STATE a
 *     direction?"                                     → `directionDisplay.show`
 *   · STROKE (`computeDirectionStroke`)              — "did anyone state a
 *     direction AND set a strength?" Grey is that module's no-verdict colour and
 *     already covers an unset STRENGTH, so it answers a COMPOUND question.
 *     #625 refuted a glyph⟺stroke biconditional on exactly that asymmetry.
 *   · LABEL WORD (`boost` / `drag`)                  — "did anyone STATE a
 *     direction?" — the SAME question as the glyph.
 *
 * The label word is NOT compound the way the stroke is, and the difference is
 * structural rather than a judgement call: the label carries its strength claim
 * in a SEPARATE CLAUSE of the same string ("Moderate …"), so the direction word
 * never has to double as a strength verdict. Grey has no such spare clause,
 * which is the whole reason it is overloaded. Hence a glyph⟺word biconditional
 * IS asserted here, and it is asserted with the refutation of the #625 one
 * spelled out above so no future reader reconciles the two by symmetry.
 *
 * WHAT THIS LANE DOES NOT CLAIM — the residual, stated rather than implied
 * ----------------------------------------------------------------------
 * The STRENGTH clause is untouched. `describeEdge` still prints "Moderate" for
 * a `weight` nobody set (the `DEFAULT_EDGE_DATA` 0.5 / `USER_EDGE_DEFAULTS` 0.3
 * fallthrough), which is the same fabrication class in the other clause and
 * belongs to the `resolveEdgeSignedStrengthDisplay` family that gated the
 * stroke's width and colour. It is NOT fixed here and nothing below asserts it
 * is. Rowed separately; see the PR body.
 *
 * WHY NOT "just re-sign the weight before describeEdge"
 * ----------------------------------------------------
 * Because `resolveEdgeSignedStrengthDisplay`'s own header forbids it, in
 * capitals: "⚠ THIS SIGN IS NOT A DIRECTION CLAIM, AND NOTHING MAY READ IT AS
 * ONE" — an unstated direction lands there as `+1`, so a boost/drag word read
 * off that sign would fabricate "boost" on every unstated edge and would ADD a
 * name to the KNOWN SURVIVORS list in that same header. Passing the resolved
 * `EdgeDirectionDisplay` is the treatment `getDirectionalStrengthLabel`
 * (strengthBands.ts, ROADMAP 2.263) and `computeDirectionStroke` (2.928) both
 * already carry, and it is why the parameter here is REQUIRED: there is no
 * argument that means "positive, source unknown".
 *
 * CLAIM TYPES — nothing here claims more than one of these:
 *   1. Pure-function return values (`describeEdge`, `getEdgeLabel`,
 *      `resolveEdgeDirectionDisplay`, `mapDraftEdgeToCanvas`).
 *   2. Rendered text content and attribute values read off the DOM.
 * jsdom cannot prove VISIBILITY or layout (platform trap 3). "The label reads
 * X" below means *this element's textContent is X*, nothing more.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeDirectionDisplay } from '../../domain/edgeValueProvenance'

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
          ? { id, type: nodeKinds[id], data: { label: id === 'src' ? 'Adoption friction' : 'Bottom-up growth' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
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

// `showLabel` needs `isResultsMode` (results.status === 'complete') and a
// non-standard view with the edge selected — see edgeLabelVisibility.ts.
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'detailed',
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
  existenceCertaintyToLineStyle: () => undefined,
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
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: true,
}

// ── Fixtures: real capture edges, through the real ingestion mapper ──────────

type WireEdge = Record<string, unknown>

/** Read a committed CEE draft capture and return its edge list. */
function captureEdges(file: string): WireEdge[] {
  const p = resolve(__dirname, '../../starters/data', file)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  expect(edges.length, `${file} carried no edges`).toBeGreaterThan(0)
  return edges
}

function findEdge(file: string, from: string, to: string): WireEdge {
  const hit = captureEdges(file).find(e => e.from === from && e.to === to)
  expect(hit, `${file} no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

/** The PRODUCER. Whatever ingestion writes is what the component sees. */
function ingest(wire: WireEdge): Record<string, unknown> {
  return mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>
}

/**
 * The headline case Codex captured: a CEE edge whose mean is NEGATIVE and whose
 * `effect_direction` says so, at a magnitude that lands in the "Moderate" band.
 */
const NEGATIVE_WIRE = findEdge('pricing-model.draft.json', 'fac_adoption_friction', 'out_bottom_up_growth')
/** Same file, a positive sibling — the discriminator for "not just always drag". */
const POSITIVE_WIRE = captureEdges('pricing-model.draft.json').find(
  e => e.effect_direction === 'positive' &&
    Math.abs((e as any).strength?.mean ?? 0) >= 0.3 &&
    Math.abs((e as any).strength?.mean ?? 0) < 0.7,
) as WireEdge
/**
 * UNSET direction: the producer EXPLICITLY declined. `effect_direction:
 * 'unknown'` is a declared 0.30.0 contract member. Built by taking the real
 * negative wire edge and replacing ONLY that one field, so every other byte is
 * still the producer's.
 *
 * ⚠ WHAT THIS FIXTURE ACTUALLY PRODUCES — DERIVED, and not what I first assumed.
 * `mapDraftEdgeToCanvas` extracts known fields with "no blind spread", so
 * `effect_direction` does NOT survive into `data` at all; the resolver's
 * explicit-refusal arm is therefore unreachable on THIS ingestion path and the
 * verdict arrives as `reason: 'not_set'` rather than `'unknown'`. (Its twin in
 * `DraftChat` spreads `edgeRest` and DOES carry the field through — a real
 * divergence between the two ingestion twins, out of this lane's scope and
 * rowed.) Both paths agree on the only thing a display may act on: `show:
 * false`.
 *
 * ⚠ AND THE FABRICATED VALUE IS `'negative'`, NOT `'positive'`, because the
 * mapper's fallback infers it from the negative mean. That makes this fixture
 * strictly sharper than a hand-authored one: an implementation that "fixed" the
 * defect by reading `data.direction` raw would print "drag" here and look
 * correct, while asserting a direction the producer refused to state. Only a
 * resolver-bound implementation passes.
 */
const UNSET_WIRE: WireEdge = { ...NEGATIVE_WIRE, effect_direction: 'unknown' }

const NEGATIVE_DATA = ingest(NEGATIVE_WIRE)
const POSITIVE_DATA = ingest(POSITIVE_WIRE)
const UNSET_DATA = ingest(UNSET_WIRE)

// ── DOM readers, bound by identity ──────────────────────────────────────────

/**
 * The human edge label, bound by its own test id — NOT by `[role="note"]`
 * (three components in this tree carry that role) and NOT by matching text
 * (CLAUDE.md trap 19: an assertion must bind to its object by identity, never
 * by a predicate another object could satisfy).
 */
function labelEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null
  expect(el, 'the edge influence label did not render').not.toBeNull()
  return el as HTMLElement
}

const labelText = (c: HTMLElement) => labelEl(c).textContent ?? ''
const labelTooltip = (c: HTMLElement) => labelEl(c).getAttribute('title') ?? ''
const labelAria = (c: HTMLElement) => labelEl(c).getAttribute('aria-label') ?? ''
const glyphEl = (c: HTMLElement) => c.querySelector('[aria-label^="Effect direction:"]')

/** Words that assert the edge INCREASES its target. */
const BOOST_WORDS = ['boost', 'increase', 'raises', 'push']
/** Words that assert the edge REDUCES its target. */
const DRAG_WORDS = ['drag', 'reduces', 'decrease', 'hinder']

const hasAny = (s: string, words: string[]) =>
  words.some(w => s.toLowerCase().includes(w))

function renderEdge(data: Record<string, unknown>) {
  return render(<StyledEdge {...(baseProps as any)} data={data} />)
}

describe('StyledEdge edge label — direction words (ROADMAP 2.935 / Codex MF5)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  // ── PRECONDITIONS. Pin the fixtures in-test so a discriminator can never
  //    silently stop discriminating (CLAUDE.md trap 13b, third face). If
  //    ingestion changes shape, THIS block REDs — not a downstream assertion
  //    that would otherwise pass for the wrong reason.
  describe('fixture preconditions (derived from the producer, not assumed)', () => {
    it('the negative fixture really is a negative CEE mean stored as an unsigned magnitude', () => {
      expect((NEGATIVE_WIRE as any).strength.mean).toBeLessThan(0)
      expect(NEGATIVE_WIRE.effect_direction).toBe('negative')
      // The defect's mechanism, asserted rather than described: ingestion strips
      // the sign, so no downstream reader can recover it from `weight`.
      expect(NEGATIVE_DATA.weight as number).toBeGreaterThan(0)
      expect(NEGATIVE_DATA.weight as number).toBe(Math.abs((NEGATIVE_WIRE as any).strength.mean))
      // …and lands in the "Moderate" band (0.3 ≤ |w| < 0.7), so the expected
      // strings below are the producer's doing and not a threshold accident.
      expect(NEGATIVE_DATA.weight as number).toBeGreaterThanOrEqual(0.3)
      expect(NEGATIVE_DATA.weight as number).toBeLessThan(0.7)
      // The direction survives, stamped, in its own field.
      expect(resolveEdgeDirectionDisplay(NEGATIVE_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative' }),
      )
    })

    it('the positive fixture is a stated-positive edge in the same strength band', () => {
      expect(POSITIVE_WIRE, 'no moderate positive edge in the capture').toBeDefined()
      expect(resolveEdgeDirectionDisplay(POSITIVE_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'positive' }),
      )
      expect(POSITIVE_DATA.weight as number).toBeGreaterThanOrEqual(0.3)
      expect(POSITIVE_DATA.weight as number).toBeLessThan(0.7)
    })

    it('the unset fixture reaches the resolver as UNSTATED despite a fabricated direction', () => {
      // Ingestion writes a `direction` value even here — that is the trap, and
      // the value it fabricates is `'negative'` (inferred from the mean), so a
      // raw read of this field would LOOK right on this fixture.
      expect(UNSET_DATA.direction).toBe('negative')
      // …with no source stamp, so the one owner refuses it. `not_set` rather
      // than `unknown` because this mapper drops `effect_direction` — derived,
      // see the fixture note in the header.
      expect(UNSET_DATA.directionSource).toBeUndefined()
      expect(resolveEdgeDirectionDisplay(UNSET_DATA)).toEqual({ show: false, reason: 'not_set' })
    })

    it('the three fixtures differ ONLY in direction, so any rendering difference is direction', () => {
      expect(NEGATIVE_DATA.weight).toBe(UNSET_DATA.weight)
      expect(NEGATIVE_DATA.beliefExists).toBe(UNSET_DATA.beliefExists)
    })
  })

  // ── THE NAMED DEFECT ──────────────────────────────────────────────────────

  it('does NOT call a negative CEE edge a "boost" [ROADMAP 2.935 / MF5]', () => {
    const { container } = renderEdge(NEGATIVE_DATA)
    const text = labelText(container)
    expect(hasAny(text, BOOST_WORDS), `label read "${text}"`).toBe(false)
    expect(hasAny(text, DRAG_WORDS), `label read "${text}"`).toBe(true)
  })

  it('the TOOLTIP channel does not drop the sign of a negative CEE edge', () => {
    const { container } = renderEdge(NEGATIVE_DATA)
    const tip = labelTooltip(container)
    // U+2212 MINUS SIGN — the character `describeEdge` already uses.
    expect(tip, `tooltip read "${tip}"`).toContain('−')
  })

  it('the ACCESSIBLE NAME agrees with the visible word (no sighted/AT divergence)', () => {
    const { container } = renderEdge(NEGATIVE_DATA)
    const aria = labelAria(container)
    // `aria-label` REPLACES descendant text for assistive tech, so a label whose
    // accessible name omits the word announces something different from what is
    // on screen — and, before this fix, the glyph beside it announced "Effect
    // direction: negative" while the visible text read "boost". The two channels
    // must carry the same verdict.
    expect(hasAny(aria, DRAG_WORDS), `accessible name read "${aria}"`).toBe(true)
    expect(hasAny(aria, BOOST_WORDS), `accessible name read "${aria}"`).toBe(false)
  })

  it('does NOT assert any direction word when the producer declined to state one', () => {
    const { container } = renderEdge(UNSET_DATA)
    const text = labelText(container)
    expect(hasAny(text, BOOST_WORDS), `label read "${text}"`).toBe(false)
    expect(hasAny(text, DRAG_WORDS), `label read "${text}"`).toBe(false)
    // Absence stays absence — the vocabulary `getDirectionalStrengthLabel`
    // already established for this exact case (strengthBands.ts, ROADMAP 2.263).
    expect(text).toContain('direction not stated')
  })

  // ── THE LICENSED CLAIM STILL RENDERS ──────────────────────────────────────

  it('still calls a stated-positive CEE edge a "boost"', () => {
    const { container } = renderEdge(POSITIVE_DATA)
    const text = labelText(container)
    expect(hasAny(text, BOOST_WORDS), `label read "${text}"`).toBe(true)
    expect(hasAny(text, DRAG_WORDS), `label read "${text}"`).toBe(false)
  })

  // ── THE TRIPLE: differ where they must, agree where they must ─────────────
  //
  // NON-VACUITY IS ASSERTED, NOT HOPED FOR. The table below must yield BOTH
  // outcomes — at least one pair that differs and at least one invariant that
  // holds across all three — or the final assertions in this block RED. A table
  // that collapsed to one answer for every row (the shape the defect had) can
  // therefore not pass by agreeing with itself.

  describe('negative / positive / unset render differently where they should', () => {
    const TRIPLE = [
      { name: 'stated negative', data: NEGATIVE_DATA },
      { name: 'stated positive', data: POSITIVE_DATA },
      { name: 'direction unstated', data: UNSET_DATA },
    ] as const

    it('the three direction words are pairwise DISTINCT', () => {
      const texts = TRIPLE.map(({ data }) => labelText(renderEdge(data).container))
      expect(new Set(texts).size, `labels were ${JSON.stringify(texts)}`).toBe(3)
    })

    it('the three share the SAME strength clause — only the direction moved', () => {
      // NEGATIVE and UNSET are byte-identical apart from direction (pinned
      // above), so their strength adjective must match exactly. This is the
      // "identically where they should" half: a fix that changed the strength
      // band as a side effect would RED here.
      const neg = labelText(renderEdge(NEGATIVE_DATA).container)
      const unset = labelText(renderEdge(UNSET_DATA).container)
      expect(neg.startsWith('Moderate')).toBe(true)
      expect(unset.startsWith('Moderate')).toBe(true)
    })

    it('the label word is bound to the SAME resolver the glyph reads', () => {
      // The biconditional this file's header licenses (and that #625 correctly
      // refused for glyph⟺stroke). DERIVED per row from the one owner, so a row
      // added to TRIPLE extends the coverage with no list to maintain.
      for (const { name, data } of TRIPLE) {
        const { container } = renderEdge(data)
        const stated = resolveEdgeDirectionDisplay(data).show
        const glyphRendered = glyphEl(container) !== null
        const wordAsserted = hasAny(labelText(container), [...BOOST_WORDS, ...DRAG_WORDS])
        expect(glyphRendered, `${name}: glyph`).toBe(stated)
        expect(wordAsserted, `${name}: direction word`).toBe(stated)
      }
    })

    it('the table is NOT vacuous — it produces both a stated and an unstated row', () => {
      const shown = TRIPLE.map(({ data }) => resolveEdgeDirectionDisplay(data).show)
      expect(shown).toContain(true)
      expect(shown).toContain(false)
    })
  })

  // ── IDENTITY BINDING (CLAUDE.md trap 19) ─────────────────────────────────
  //
  // The DISCRIMINATING MUTANT PAIR this block supports:
  //   · loosen the direction word for ALL edges (e.g. make `describeEdge`
  //     ignore its `direction` argument) → `does NOT call a negative CEE edge a
  //     "boost"` REDs.
  //   · loosen it for a DIFFERENT edge only (change the OTHER capture's edge,
  //     or render `POSITIVE_DATA` here) → this block stays GREEN.
  // Neither alone proves binding; the RED/GREEN pair does.

  it('reads the word off THE EDGE UNDER TEST, not whichever label rendered first', () => {
    const { container } = renderEdge(NEGATIVE_DATA)
    const el = labelEl(container)
    // Bound to the component instance by the id this render was given.
    expect(baseProps.id).toBe('e-under-test')
    // Exactly one influence label exists in this render, so `labelEl` cannot be
    // reading a sibling edge's chip.
    expect(container.querySelectorAll('[data-testid="edge-influence-label"]').length).toBe(1)
    expect(el.textContent).toContain('drag')
  })
})

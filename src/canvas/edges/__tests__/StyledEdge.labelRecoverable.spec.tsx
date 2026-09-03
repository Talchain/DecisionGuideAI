/**
 * CANVAS-BACKLOG S1 — THE CLIPPED EDGE LABEL HAD NO WAY BACK.
 *
 * THE DEFECT, AS A USER MEETS IT
 * ------------------------------
 * Paul, 31 Aug 2026, and still on screen in the 1 Sep screenshot at deployed
 * staging `30bd7f8c`: causal edge labels read "Strong boost…", "Moderate bo…",
 * "Moderate dr…". The sentence is cut and there is no route to the rest of it.
 *
 * WHY THE CUT IS STRUCTURAL, AND WHY THE FIX IS THE RECOVERY ROUTE
 * ---------------------------------------------------------------
 * The label plate is capped at `LABEL_HALF_WIDTH * 2` = 160 GRAPH units,
 * because that is exactly the box `resolvePersistentLabelPlacements` clears
 * when it dodges labels off each other and off node cards. Graph units shrink
 * with zoom; the label FONT does not, because canvas text carries
 * `labelCounterScale` so its rendered size stays at the Design System floor.
 * So at `LABEL_LEGIBLE_ZOOM` — the zoom the product's own post-layout auto-fit
 * parks at, i.e. the view in the screenshot — the plate is ~80 CSS px holding
 * 10px text: about twelve glyphs, against a vocabulary that runs 13–58
 * characters ("Moderate effect, direction not stated (likelihood not set)").
 *
 * Widening the plate is not free: `X_THRESHOLD` is DERIVED from that same
 * half-width, so a wider label is a wider exclusion box for every dodge, and
 * `edgeLabelCollision.ts` records a measured finding that three labels
 * converging on one card already have no clean assignment at the present
 * width. Shortening the vocabulary would change what a label MEANS. So the
 * sentence will be cut, and the fix is that being cut must stop being fatal.
 *
 * WHAT WAS ACTUALLY BROKEN (settled at the bytes, not inferred)
 * ------------------------------------------------------------
 * StyledEdge's own comment beside the ellipsis said, in terms:
 *
 *     "The full string stays recoverable: the container's aria-label and
 *      title both carry it."
 *
 * HALF OF THAT WAS FALSE. `aria-label` does carry it. The `title` carried
 * `edgeDescription.tooltip` — "Weight: −0.60, Belief: 85%" — the NUMBERS, and
 * never the sentence. The hover popover (`edge-hover-popover`) carries numbers
 * and a bar too. So the human sentence the user could see two thirds of was
 * reachable by assistive technology and by nobody else. CLAUDE.md's standing
 * warning that the CORRECTING comment is the one nobody re-checks, exactly.
 *
 * CLAIM TYPES — nothing here claims more than one of these:
 *   1. Rendered text content read off the DOM.
 *   2. Attribute values read off the DOM, bound to the label by test id.
 * ⚠ jsdom HAS NO LAYOUT. These tests CANNOT prove the label is clipped on
 * screen, cannot prove the ellipsis renders, and cannot prove anything is
 * legible (platform trap 3). What they prove is the RECOVERY CONTRACT: that
 * whatever the browser ends up painting, the complete sentence is present in
 * an attribute a sighted user can reach by hovering. The clipping itself is
 * measured in Chromium by `e2e/geometry/edgeLabelOverlap.measure.ts`.
 *
 * FIXTURES — real capture bytes through the real ingestion mapper, as in the
 * 2935/2950 templates. No hand-authored `data`: a fixture the author wrote is
 * a record of the author's model of the producer, not of the producer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { useEdgeLabelMode } from '../../store/edgeLabelMode'

const nodeKinds: Record<string, string> = {}

vi.mock('../../utils/openEdgeStrengthEditor', () => ({
  openEdgeStrengthEditor: vi.fn(() => true),
}))

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
          ? {
              id,
              type: nodeKinds[id],
              data: { label: id === 'src' ? 'Adoption friction' : 'Bottom-up growth' },
              position: { x: 0, y: 0 },
              measured: { width: 200, height: 80 },
            }
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

const baseProps = {
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: true,
}

// ── Fixtures: real capture edges, through the real ingestion mapper ──────────

type WireEdge = Record<string, unknown>

function findEdge(file: string, from: string, to: string): WireEdge {
  const p = resolve(__dirname, '../../starters/data', file)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  expect(edges.length, `${file} carried no edges`).toBeGreaterThan(0)
  const hit = edges.find(e => e.from === from && e.to === to)
  expect(hit, `${file} no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

const ingest = (wire: WireEdge) => mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>

/** Strength set (CEE mean, negative) AND direction stated. */
const SET_WIRE = findEdge('pricing-model.draft.json', 'fac_adoption_friction', 'out_bottom_up_growth')

/** Strength set, direction NOT stated — the product's LONGEST label. */
const DIRECTION_UNSET_WIRE: WireEdge = (() => {
  const { effect_direction: _d, ...rest } = SET_WIRE as WireEdge & { effect_direction?: unknown }
  return rest
})()

/** Neither half set — the ratified unset copy. */
const NEITHER_WIRE: WireEdge = (() => {
  const { strength: _s, ...rest } = DIRECTION_UNSET_WIRE as WireEdge & { strength?: unknown }
  return rest
})()

/**
 * Strength set, direction NOT stated, likelihood NOT supplied — the state that
 * actually paints the vocabulary's LONGEST sentence.
 *
 * ⚠ THIS FIXTURE DID NOT EXIST FOR ONE ROUND, AND THE TEST BELOW WAS NAMED
 * AFTER IT ANYWAY. `LONGEST_SENTENCE` was asserted only against its own
 * `.length`, so the test called "the LONGEST sentence … is recoverable"
 * exercised `DIRECTION_UNSET_DATA` — the 37-character sentence — and the
 * 58-character one was never rendered by anything. A test's name is a claim.
 *
 * The deletion is producer-modelled, not invented: `mapDraftEdgeToCanvas` sets
 * `beliefExists` EXPLICITLY to `undefined` when the wire carries no
 * `belief_exists` / `exists_probability` / `belief` (`applyDraftResult.ts:104`),
 * which overrides `DEFAULT_EDGE_DATA.beliefExists`, omits the
 * `exists_probability` key and omits the `beliefExistsSource` stamp — so the
 * likelihood resolves `show: false` and the label says so. That is the same
 * key-deletion technique the two fixtures above already use.
 */
const LONGEST_WIRE: WireEdge = (() => {
  const { exists_probability: _ep, ...rest } =
    DIRECTION_UNSET_WIRE as WireEdge & { exists_probability?: unknown }
  return rest
})()

const SET_DATA = ingest(SET_WIRE)
const DIRECTION_UNSET_DATA = ingest(DIRECTION_UNSET_WIRE)
const NEITHER_DATA = ingest(NEITHER_WIRE)
const LONGEST_DATA = ingest(LONGEST_WIRE)

// ── DOM readers, bound by identity (CLAUDE.md trap 19) ──────────────────────

function labelEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null
  expect(el, 'the edge influence label did not render').not.toBeNull()
  return el as HTMLElement
}

/**
 * The TEXT SPAN, not the plate. The plate also renders a provenance dot and can
 * render a suggestion glyph, so reading the plate's `textContent` would answer a
 * slightly different question than "what words are painted".
 */
function labelTextEl(container: HTMLElement): HTMLElement {
  const el = labelEl(container).querySelector(
    '[data-testid="edge-influence-label-text"]',
  ) as HTMLElement | null
  expect(el, 'the edge label text span did not render').not.toBeNull()
  return el as HTMLElement
}

const visibleText = (c: HTMLElement) => labelTextEl(c).textContent ?? ''
const hoverText = (c: HTMLElement) => labelEl(c).getAttribute('title') ?? ''
const ariaText = (c: HTMLElement) => labelEl(c).getAttribute('aria-label') ?? ''

const renderEdge = (data: Record<string, unknown>) =>
  render(<StyledEdge {...(baseProps as any)} data={data} />)

// Independent literals. Written from the ratified copy, NOT read back from
// `describeEdge`, so an assertion cannot agree with the code by construction
// (CLAUDE.md trap 12d — a derived guard proves agreement, never correctness).
//
// ⭐ RE-DERIVED when the label's likelihood moved onto `beliefExists` (the
// 3 Sep 2026 capture lane). Three of these fixtures carry a producer-stamped
// `exists_probability`, so their labels no longer append "(uncertain)" — the
// label was reporting uncertainty about a number CEE had in fact supplied. The
// sentences are SHORTER there, but the vocabulary's longest member got LONGER
// ("Moderate effect, direction not stated (likelihood not set)", 58 chars,
// against the old "Moderate effect, direction not stated (uncertain)" at 49),
// so this contract is more load-bearing than before, not less.
//
// ⚠ THE PREVIOUS SENTENCE HERE SAID 49 WAS **48**, AND ENDED "Lengths
// re-measured, not adjusted to fit." Both halves were wrong at once: the number
// was off by one AND the line asserting it had been measured had not been.
// `'Moderate effect, direction not stated (uncertain)'.length === 49` — 37 for
// the clause, 12 for " (uncertain)". A claim that a figure was measured is
// itself a claim, and it is the one nobody re-checks (CLAUDE.md trap 14). Both
// figures below are now pinned by an executing assertion rather than by a
// comment, so a future edit to the copy REDs instead of silently rotting.
const SET_SENTENCE = 'Moderate drag'
const DIRECTION_UNSET_SENTENCE = 'Moderate effect, direction not stated'
const NEITHER_SENTENCE = 'Strength not set'
/**
 * The longest sentence the vocabulary can produce — strength set, direction not
 * stated, likelihood not set. Painted by `LONGEST_DATA`, not merely declared.
 * That the vocabulary can produce nothing longer is asserted by exhaustive
 * enumeration in `domain/__tests__/edgeLabels.spec.ts`, which is where the
 * vocabulary lives; this file's job is that the sentence stays RECOVERABLE.
 */
const LONGEST_SENTENCE = 'Moderate effect, direction not stated (likelihood not set)'
/** The pre-3-Sep longest, kept only to pin the off-by-one that stood in its place. */
const RETIRED_LONGEST_SENTENCE = 'Moderate effect, direction not stated (uncertain)'

describe('StyledEdge edge label — a cut sentence stays reachable (CANVAS-BACKLOG S1)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'human' }))
  })

  // ── PRECONDITIONS. Pin the fixtures in-test, so a discriminator can never
  //    silently stop discriminating (trap 13b, third face). If ingestion or the
  //    copy changes, THIS block REDs — not a recovery assertion passing because
  //    the string it was hunting stopped existing.
  describe('fixture preconditions (derived from the producer, not assumed)', () => {
    it('the four fixtures paint the four sentences this contract is about', () => {
      expect(visibleText(renderEdge(SET_DATA).container)).toBe(SET_SENTENCE)
      expect(visibleText(renderEdge(DIRECTION_UNSET_DATA).container)).toBe(DIRECTION_UNSET_SENTENCE)
      expect(visibleText(renderEdge(NEITHER_DATA).container)).toBe(NEITHER_SENTENCE)
      // ⭐ The one that was declared but never rendered. Without this line the
      // test below is named after a sentence no fixture produces.
      expect(visibleText(renderEdge(LONGEST_DATA).container)).toBe(LONGEST_SENTENCE)
    })

    it('the sentence named LONGEST really is longer than every other fixture paints', () => {
      // Bound by COMPARISON to the other fixtures, not by a bare threshold: a
      // `> 50` assertion is satisfied by any long string and would have gone on
      // passing while the "longest" sentence was unreachable.
      for (const shorter of [SET_SENTENCE, DIRECTION_UNSET_SENTENCE, NEITHER_SENTENCE]) {
        expect(LONGEST_SENTENCE.length).toBeGreaterThan(shorter.length)
      }
      expect(LONGEST_SENTENCE.length).toBe(58)
      // The off-by-one that stood in the comment above for one round.
      expect(RETIRED_LONGEST_SENTENCE.length).toBe(49)
      expect(LONGEST_SENTENCE.length).toBeGreaterThan(RETIRED_LONGEST_SENTENCE.length)
    })

    it('the longest sentence really is long enough to be cut at the parked zoom', () => {
      // Not a layout claim — arithmetic, which is the only honest way to make a
      // width claim in jsdom. The plate is 160 graph units and the text renders
      // at the Design System 10px floor, so roughly a dozen glyphs survive.
      // Every one of these sentences is far past that, which is WHY the
      // recovery route below is load-bearing rather than decorative.
      expect(LONGEST_SENTENCE.length).toBeGreaterThan(50)
      expect(DIRECTION_UNSET_SENTENCE.length).toBeGreaterThan(35)
      expect(SET_SENTENCE.length).toBeGreaterThan(12)
      expect(NEITHER_SENTENCE.length).toBeGreaterThan(15)
    })

    it('the RETIRED sentence is genuinely retired — no fixture paints it any more', () => {
      // The comment on the recovery test below still quoted this string as if it
      // were live copy. It is not: every fixture that carries a producer
      // likelihood now suppresses "(uncertain)". Pinned so the quote cannot
      // quietly become true again without someone noticing.
      for (const data of [SET_DATA, DIRECTION_UNSET_DATA, NEITHER_DATA, LONGEST_DATA]) {
        expect(visibleText(renderEdge(data).container)).not.toBe(RETIRED_LONGEST_SENTENCE)
      }
    })
  })

  // ── THE CONTRACT ──────────────────────────────────────────────────────────

  it('the hover text carries the full sentence, not only the numbers', () => {
    const { container } = renderEdge(SET_DATA)
    const tip = hoverText(container)
    expect(tip, `hover text read "${tip}"`).toContain(SET_SENTENCE)
    // …and the numbers it already carried are still there. This fix ADDS a
    // channel; it must not spend the one that already worked.
    expect(tip, `hover text read "${tip}"`).toContain('Weight:')
  })

  it('the LONGEST sentence — the honesty copy — is recoverable', () => {
    // This is the one that matters most. "Moderate effect, direction not
    // stated (likelihood not set)" is the product refusing to claim BOTH a
    // direction and a likelihood, and it is the sentence the plate cuts
    // hardest: a user reading the first dozen glyphs sees "Moderate effe…" and
    // cannot tell that the product declined to state either.
    //
    // ⚠ THIS TEST RENDERED THE WRONG FIXTURE FOR ONE ROUND. It painted
    // `DIRECTION_UNSET_DATA` — the 37-character sentence — while its name
    // claimed the longest, and the comment above quoted the retired
    // "…(uncertain)" copy as if it were live. The 58-character worst case, the
    // one this contract exists for, was never rendered and never shown
    // recoverable. It is `LONGEST_DATA` now, pinned by identity.
    const { container } = renderEdge(LONGEST_DATA)
    const tip = hoverText(container)
    expect(visibleText(container), 'the fixture stopped painting the longest sentence').toBe(
      LONGEST_SENTENCE,
    )
    expect(tip, `hover text read "${tip}"`).toContain(LONGEST_SENTENCE)
  })

  it('the shorter direction-unset sentence stays recoverable too', () => {
    // Kept as its own case rather than folded into the one above: the two
    // differ by the likelihood clause, and a single test covering both would
    // pass on either. This is the sentence the previous round was actually
    // measuring under the other one's name.
    const { container } = renderEdge(DIRECTION_UNSET_DATA)
    const tip = hoverText(container)
    expect(tip, `hover text read "${tip}"`).toContain(DIRECTION_UNSET_SENTENCE)
  })

  it('whatever is painted is contained in the hover text, for every fixture', () => {
    // The DERIVED half of the guard, paired with the independent literals
    // above: literals answer "is this copy right?", this answers "can the two
    // channels drift?". Neither substitutes for the other (trap 12d).
    for (const [name, data] of [
      ['strength + direction set', SET_DATA],
      ['direction not stated', DIRECTION_UNSET_DATA],
      ['neither set', NEITHER_DATA],
      ['direction and likelihood both unset (the longest)', LONGEST_DATA],
    ] as const) {
      const { container } = renderEdge(data)
      const painted = visibleText(container)
      expect(painted.length, `${name}: painted nothing`).toBeGreaterThan(0)
      expect(hoverText(container), `${name}: hover text lost the painted sentence`).toContain(painted)
    }
  })

  it('binds to THIS edge’s sentence, not to any sentence', () => {
    // Trap 19: an assertion that only asked "does the title contain a
    // sentence?" would pass on a title carrying a different edge's words, or a
    // static string. The discriminating pair is the second expectation.
    const { container } = renderEdge(NEITHER_DATA)
    const tip = hoverText(container)
    expect(tip, `hover text read "${tip}"`).toContain(NEITHER_SENTENCE)
    expect(tip, `hover text read "${tip}"`).not.toContain('Moderate drag')
  })

  it('does not print the sentence twice when the sentence IS the numbers', () => {
    // In numeric mode `getEdgeLabel` returns one string for both channels, so
    // concatenating them unconditionally would render "w −0.35 • b 70%" twice
    // in one tooltip. The count is asserted, not the presence: presence passes
    // on a duplicate.
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'numeric' }))
    const { container } = renderEdge(SET_DATA)
    const painted = visibleText(container)
    const tip = hoverText(container)
    expect(painted, 'numeric mode painted nothing').not.toBe('')
    expect(tip.split(painted).length - 1, `hover text read "${tip}"`).toBe(1)
  })

  it('the assistive-tech channel still carries the sentence too', () => {
    // The half of the original comment that was TRUE. Pinned so a later change
    // cannot fix the sighted route by moving the string off the accessible name
    // — the two channels are both required, and one is not payment for the other.
    const { container } = renderEdge(DIRECTION_UNSET_DATA)
    expect(ariaText(container)).toContain(DIRECTION_UNSET_SENTENCE)
  })
})

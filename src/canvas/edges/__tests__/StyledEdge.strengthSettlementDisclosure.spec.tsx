/**
 * ⭐ THE LINE MUST NOT SPEAK A STRENGTH NOBODY STOOD BEHIND AS IF SOMEBODY DID.
 *
 * Paul's shortlist item: *an edge whose strength nobody has set should not look
 * identical to one a human deliberately set.*
 *
 * ── THE THREE STATES, AND WHICH ONE WAS UNDISCLOSED ─────────────────────────
 * Derived at staging `15edd2e2`, and note that only the middle row was broken:
 *
 *   1. NO FIGURE AT ALL     `resolveEdgeSignedStrengthDisplay(...).show === false`
 *      Line: thin (`UNSET_EDGE_STROKE_WIDTH`) + neutral grey, and the label
 *      reads "Strength not set". ALREADY DISTINGUISHED — this spec asserts it
 *      is NOT double-disclosed, because a second marker beside a label that
 *      already says the words is noise, not honesty.
 *
 *   2. A PRODUCER'S FIGURE, NO HUMAN SETTLEMENT   `.show === true` and
 *      `strengthIsHumanSettled(...) === false`
 *      Line: magnitude thickness in a POLARITY colour, label "Moderate boost".
 *      ⛔ BYTE-IDENTICAL TO ROW 3. This is the defect.
 *
 *   3. A HUMAN SETTLED IT   `strengthIsHumanSettled(...) === true`
 *      Line: magnitude thickness in a polarity colour, label "Moderate boost".
 *
 * `CanvasLegendPopover` already states rows 1 and 2 apart in prose — *"the
 * producer's figure may well be present, in which case the line is drawn at its
 * magnitude in a POLARITY colour: thick and green or rose"* — while the risk and
 * outcome cards, for that same edge, refuse to draw the figure and disclose it
 * as `est.` instead. One edge, two verdicts; the line carried the louder and
 * less honest one.
 *
 * ── ⛔ WHY THE PREDICATE IS `strengthIsHumanSettled` AND NOT `weightSource` ──
 * They answer different questions (CLAUDE.md trap 21) and they DIVERGE on a
 * state a live affordance produces: `ModelTabBody.handleResolveContested`'s
 * `accepted_pass2` branch stamps `weightSource: 'cee'` deliberately — the
 * accepted number really is the producer's — so an edge a human explicitly
 * adjudicated reads `weightSource !== 'user'` forever. Marking that edge
 * "unconfirmed" tells the person who confirmed it that nobody did.
 *
 * `THE_DIVERGENT_CASE` below IS that state, and it is the discriminating
 * fixture: a gate narrowed to `weightSource === 'user'` passes every other test
 * in this file and REDs on that one.
 *
 * ── ⛔ WHY THE MARKER FIRES ON ROW 2 AND NOT ON ROW 3 ───────────────────────
 * Not symmetry — `strengthIsHumanSettled` is documented ABSENCE-SAFE towards
 * `false`, so a payload it cannot read lands on "unconfirmed". Firing the
 * marker there UNDER-claims (it offers to confirm something already confirmed);
 * firing a "confirmed" mark on the same failure would OVER-claim a human act
 * that never happened. The honest direction is the one whose failure mode is
 * under-disclosure, and it is also the direction the cards already mark.
 *
 * ⛔ BINDING. Every assertion binds by `data-testid`, never by matching text:
 * the word "est." is a substring of nothing here but the label vocabulary runs
 * to "Moderate effect, direction not stated" and three elements in this tree
 * carry a title (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { strengthIsHumanSettled } from '../../domain/edgeStrengthSettlement'
import { edgeValueSource } from '../../domain/edgeValueProvenance'

let mockEdges: Array<Record<string, unknown>> = []

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => mockEdges, getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      viewMode: 'detailed',
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
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
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
 * ⚠ THE FOUR FIXTURES DIFFER ONLY IN SETTLEMENT. Same magnitude (0.6), same
 * stated direction, same likelihood — so every difference this file observes is
 * the predicate's doing and not a band, a colour or a hedge changing underneath.
 * (Two of them reach 0.6 by different keys, `strength_mean` vs `weight`, because
 * that is how the two real producers write it; `edgeValueSource`'s back-compat
 * rule makes both resolve `show: true`, asserted below rather than assumed.)
 */
const COMMON = { effect_direction: 'positive' as const, exists_probability: 0.8 }

/** ROW 2 — CEE supplied the figure, no human has been near it. */
const PRODUCER_UNSETTLED = { ...COMMON, strength_mean: 0.6 }

/** ROW 3a — the user typed it. `setStrength` stamps `weightSource: 'user'`. */
const USER_SET = { ...COMMON, weight: 0.6, weightSource: 'user' as const }

/**
 * ROW 3b — ⭐ THE DIVERGENT CASE. A human adjudicated a contested edge via
 * "Accept review"; the number is the producer's and is stamped as such. Any
 * gate reading `weightSource === 'user'` calls this unconfirmed. It is not.
 */
const THE_DIVERGENT_CASE = {
  ...COMMON,
  strength_mean: 0.6,
  weightSource: 'cee' as const,
  validation: { user_action: 'accepted_pass2', resolved_by: 'user' },
}

/** ROW 1 — nobody supplied a figure at all. */
const NO_FIGURE = { ...COMMON }

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

/** The strength row renders only for an edge in the persistent top-strength set. */
function renderEdge(data: Record<string, unknown>) {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
  return render(<StyledEdge {...(baseProps as any)} data={data} />).container
}

const marker = (c: HTMLElement) =>
  c.querySelector('[data-testid="estimate-marker"]') as HTMLElement | null
const strengthText = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null
const chip = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null

beforeEach(() => {
  mockEdges = []
})

describe('StyledEdge — an unconfirmed strength is disclosed ON THE LINE', () => {
  /**
   * ⛔ THE PRECONDITION, PINNED IN-TEST. Without this the file could pass with
   * every fixture resolving `show: false` (no strength spoken at all), and the
   * "identical" claim below would be true of two blanks rather than of two
   * spoken magnitudes. CLAUDE.md 13b: a discriminator must pin its own
   * precondition, or its power is a property of the fixture, not the code.
   */
  it('PRECONDITION: all three figure-bearing fixtures speak a strength, and settlement is the ONLY thing that differs', () => {
    expect(edgeValueSource(PRODUCER_UNSETTLED, 'weight')).toBe('cee')
    expect(edgeValueSource(USER_SET, 'weight')).toBe('user')
    expect(edgeValueSource(THE_DIVERGENT_CASE, 'weight')).toBe('cee')
    expect(edgeValueSource(NO_FIGURE, 'weight')).toBeNull()

    expect(strengthIsHumanSettled(PRODUCER_UNSETTLED)).toBe(false)
    expect(strengthIsHumanSettled(USER_SET)).toBe(true)
    expect(strengthIsHumanSettled(THE_DIVERGENT_CASE)).toBe(true)

    // ⭐ The divergence itself: same value provenance as row 2, opposite
    // settlement. This is what makes the two questions two questions.
    expect(edgeValueSource(THE_DIVERGENT_CASE, 'weight')).toBe(
      edgeValueSource(PRODUCER_UNSETTLED, 'weight'),
    )
    expect(strengthIsHumanSettled(THE_DIVERGENT_CASE)).not.toBe(
      strengthIsHumanSettled(PRODUCER_UNSETTLED),
    )
  })

  it("a producer's unsettled strength carries the unconfirmed marker on the edge label", () => {
    const c = renderEdge(PRODUCER_UNSETTLED)
    expect(strengthText(c), 'the strength row did not render').not.toBeNull()
    expect(marker(c), 'no unconfirmed marker on an unsettled producer strength').not.toBeNull()
  })

  it('a strength the user typed carries NO marker', () => {
    const c = renderEdge(USER_SET)
    expect(strengthText(c)).not.toBeNull()
    expect(marker(c)).toBeNull()
  })

  it('⭐ an ADJUDICATED strength carries NO marker, though its value provenance is still cee', () => {
    const c = renderEdge(THE_DIVERGENT_CASE)
    expect(strengthText(c)).not.toBeNull()
    expect(marker(c)).toBeNull()
  })

  it('an edge with NO figure is not double-disclosed — its label already says so', () => {
    const c = renderEdge(NO_FIGURE)
    expect(strengthText(c)!.textContent).toContain('not set')
    expect(marker(c)).toBeNull()
  })

  it('THE DEFECT ITSELF: the unsettled and the settled edge no longer render the same', () => {
    const unsettled = renderEdge(PRODUCER_UNSETTLED)
    const settled = renderEdge(USER_SET)

    // The words are deliberately unchanged — the band is honest and Paul's held
    // item forbids removing anything from the label.
    expect(strengthText(unsettled)!.textContent).toContain('boost')
    expect(strengthText(settled)!.textContent).toContain('boost')

    // …but the rows are no longer indistinguishable.
    expect(chip(unsettled)!.textContent).not.toBe(chip(settled)!.textContent)
  })

  it('the disclosure is recoverable: the marker names the act, and the chip title carries the sentence', () => {
    const c = renderEdge(PRODUCER_UNSETTLED)
    // The sentence a sighted user gets on hover, and the one assistive tech
    // gets — the estate's `labelRecoverable` rule, applied to this row.
    expect(marker(c), 'no marker to recover a sentence from').not.toBeNull()
    expect(marker(c)!.getAttribute('title')).toContain('not yet confirmed')
    expect(chip(c)!.getAttribute('title')).toContain('not yet confirmed')
  })
})

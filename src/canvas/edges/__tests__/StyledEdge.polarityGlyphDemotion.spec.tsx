/**
 * THE POLARITY GLYPH — keep the channel, drop the chrome.
 *
 * The founder called the green "+" marks on edges clutter. They are NOT an
 * add-node affordance (no such affordance exists: `edgeTypes = { styled }`);
 * they are the polarity glyph, and they may NOT simply be deleted.
 * `directionStroke.ts:23-32` carries a dated MEASUREMENT: the stroke palette
 * separates WORSE for a dichromat than the green/red it replaced (ΔE2000 11.7
 * vs 28.3 under deuteranopia), so "the +/− glyph, not the colour, is what
 * carries polarity for a red-green dichromat here."
 *
 * So the glyph keeps its channel and loses its chrome, and it is suppressed in
 * exactly ONE state: where the chip beside it already shows a PERSISTENT
 * strength row, because that row's WORD ("boost" / "drag") is the same datum.
 * One datum, one channel per state — the estate's trap 21 read forwards.
 *
 * ⛔ THIS IS ALSO THE SIZE RULING THE CODE ASKED FOR. StyledEdge's own comment
 * said "⭐ NEEDS A SIZE RULING. Once ruled, route it through a token." Ruled:
 * `typography.edgeLabel`, the same canvas token its four sibling edge-label
 * sites already use. 16px fixed becomes 10px counter-scaled — 8.0px -> 10px
 * apparent at the 0.50 auto-fit floor, and 16px -> 10px at zoom 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { typography } from '../../../styles/typography'
import { labelCarriesDirection } from '../../domain/edgeLabels'
import type {
  EdgeDirectionDisplay,
  EdgeValueDisplay,
} from '../../domain/edgeValueProvenance'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockStatus = 'complete'
/**
 * ⚠ THIS WAS HARD-MOCKED TO 'human', AND THAT IS WHY THE FIRST VERSION OF THIS
 * SUITE COULD NOT SEE THE DEFECT BELOW. `describeEdge` emits boost/drag
 * whenever the direction is stated, so EVERY human-mode branch satisfies the
 * suppression rule and the corpus structurally excluded the only class that
 * breaks it. A corpus that cannot enter a mode cannot certify the code over it.
 */
let mockLabelMode: 'human' | 'numeric' = 'human'

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
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: mockLabelMode })),
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

const EDGE_DATA = {
  strength_mean: 0.6,
  effect_direction: 'positive' as const,
  exists_probability: 0.8,
}

const props = {
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
  data: EDGE_DATA,
}

/** Bound by its accessible name — the four existing binding specs use this. */
const glyph = (c: HTMLElement) =>
  c.querySelector('[aria-label^="Effect direction:"]') as HTMLElement | null
const strengthText = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null

function pinAsTopStrength(): void {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: EDGE_DATA }]
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'standard'
  mockStatus = 'complete'
  mockLabelMode = 'human'
})

describe('polarity glyph — suppressed only where a persistent chip already says it', () => {
  it('THE DEFECT: beside a PERSISTENT strength row the glyph is gone, and the WORD carries direction', () => {
    pinAsTopStrength()
    const { container } = render(<StyledEdge {...(props as any)} />)

    // The word is doing the job…
    expect(strengthText(container)!.textContent).toMatch(/boost|drag/)
    // …so the glyph does not repeat it.
    expect(glyph(container)).toBeNull()
  })

  it('CONTROL: a TRANSIENT chip (selected, Detailed) KEEPS the glyph', () => {
    // getEdges is empty, so this edge is NOT in the persistent set; the chip
    // is interaction-driven and disappears the moment selection does.
    mockViewMode = 'detailed'
    const { container } = render(<StyledEdge {...(props as any)} selected />)

    expect(strengthText(container), 'the transient chip did not render').not.toBeNull()
    expect(glyph(container), 'the glyph must survive beside a transient chip').not.toBeNull()
  })

  it('CONTROL: pre-run (no completed analysis) keeps the glyph', () => {
    mockStatus = 'idle'
    const { container } = render(<StyledEdge {...(props as any)} />)

    expect(strengthText(container)).toBeNull()
    expect(glyph(container)).not.toBeNull()
  })

  it('CONTROL: an edge with no chip at all keeps the glyph', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(strengthText(container)).toBeNull()
    expect(glyph(container)).not.toBeNull()
  })

  it('THE SIZE RULING: the glyph carries no inline size, weight, colour or chip surface', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const el = glyph(container)!

    expect(el.style.fontSize).toBe('')
    expect(el.style.fontWeight).toBe('')
    expect(el.style.color).toBe('')
    expect(el.style.backgroundColor).toBe('')
    // The chip surface goes too — it was chrome around a single character.
    expect(el.style.padding).toBe('')
    expect(el.style.borderRadius).toBe('')
  })

  it('THE SIZE RULING: the glyph is routed through the canvas token, READ from typography.ts', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const el = glyph(container)!

    // Read, never restated — a hand-copied class string is the mirror defect
    // this estate keeps paying for.
    for (const token of typography.edgeLabel.split(/\s+/).filter(Boolean)) {
      expect(el.className, `missing token ${token}`).toContain(token)
    }
  })

  it('the glyph still says which direction it means', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(glyph(container)!.getAttribute('aria-label')).toBe('Effect direction: positive')
    expect(glyph(container)!.textContent).toBe('+')
  })
})

/**
 * NUMERIC MODE — the class the human-only corpus could not reach.
 *
 * ⛔ THIS GUARDS THE DICHROMAT CHANNEL. `formatNumericLabel`
 * (`domain/edgeLabels.ts:242-255`) prints the magnitude through `signPrefix`
 * (`:221-223`), which emits U+2212 for a stated NEGATIVE and NOTHING for a
 * stated positive. So a numeric-positive chip reads `w 0.60 • b 85%` and
 * carries no direction at all. Suppressing the glyph there leaves polarity
 * resting on hue alone — which `directionStroke.ts:23-32` forbids in terms, on
 * a measurement: this palette separates WORSE for a dichromat than the
 * green/red it replaced (ΔE2000 11.7 vs 28.3 under deuteranopia).
 *
 * The rule is therefore NOT "always show the glyph in numeric mode" — the
 * negative case genuinely does carry direction, in the sign — but "suppress
 * only where the label actually says which way it goes".
 */
describe('polarity glyph — numeric mode suppresses only where the SIGN carries direction', () => {
  it('THE DEFECT: a numeric POSITIVE chip carries no direction, so the glyph must survive', () => {
    mockLabelMode = 'numeric'
    pinAsTopStrength()
    const { container } = render(<StyledEdge {...(props as any)} />)

    const text = strengthText(container)!.textContent ?? ''
    // Pin the precondition IN-TEST: this label really does lack a direction,
    // so the assertion below is the code's doing and not the fixture's.
    expect(text).not.toMatch(/boost|drag/)
    expect(text).not.toContain('\u2212')
    expect(glyph(container), 'polarity would rest on hue alone').not.toBeNull()
  })

  it('CONTROL: a numeric NEGATIVE chip DOES carry direction in the sign — glyph suppressed', () => {
    mockLabelMode = 'numeric'
    const negative = {
      ...props,
      data: { strength_mean: -0.6, effect_direction: 'negative' as const, exists_probability: 0.8 },
    }
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: negative.data }]
    const { container } = render(<StyledEdge {...(negative as any)} />)

    expect(strengthText(container)!.textContent).toContain('\u2212')
    expect(glyph(container)).toBeNull()
  })

  it('THE UNCOVERED CELL: numeric + stated NEGATIVE + UNSET strength renders `w not set` — no sign to carry direction', () => {
    // ⛔ WHY THIS CASE EXISTS. The numeric arm of `labelCarriesDirection` is
    // `strength.show && direction.direction === 'negative'`, and deleting the
    // `strength.show &&` conjunct survived 109 tests across six specs. This is
    // the cell that kills it: `formatNumericLabel` only reaches `signPrefix`
    // when there is a magnitude to sign, so an UNSET strength prints
    // `w not set` — a stated negative whose label says nothing about
    // direction. Without the conjunct the glyph is suppressed here and
    // polarity rests on hue alone, which `directionStroke.ts:23-32` forbids on
    // a measurement (ΔE2000 11.7 vs 28.3 under deuteranopia).
    //
    // ⚠⚠ ITS REACHABILITY ARGUMENT HAS BEEN DELETED BY P2, AND THAT IS WHY
    // THIS TEST NOW TAKES A DIFFERENT ROUTE. It used to read: "two of
    // `topStrengthIds`' three branches carry no provenance gate, so an edge
    // whose strength nobody set can still be pinned — this spec's harness takes
    // the '3 or fewer' branch, which is one of them." That sentence was an
    // accurate description of the defect P2 fixed: a pinned label must speak a
    // strength, so an unset-strength edge can no longer be `isTopStrengthEdge`
    // on ANY branch.
    //
    // ⛔ CONSEQUENCE, STATED PLAINLY BECAUSE IT COSTS SOMETHING: the guard
    // `strengthRowCarriesDirection` is `showLabel && isTopStrengthEdge &&
    // labelCarriesDirection(...)`, so `labelCarriesDirection` can no longer be
    // REACHED with an unset strength from its only production call site. This
    // render test therefore can no longer kill the `strength.show &&` mutant —
    // it would pass on the short-circuit alone. The kill has NOT been dropped:
    // it moved to a direct assertion on the exported pure function at the
    // bottom of this file, which is a better home anyway because it does not
    // depend on a render route staying reachable.
    //
    // What this case still asserts, and it is a real claim: with the label
    // summoned by SELECTION (the interaction route, which P2 deliberately left
    // alone), an unset-strength edge shows `w not set` AND keeps its polarity
    // glyph — polarity never rests on hue alone.
    mockLabelMode = 'numeric'
    mockViewMode = 'detailed'
    // Direction STATED (the producer's raw `effect_direction` proves it);
    // strength deliberately UNSOURCED — a bare `weight` with no
    // `strength_mean` and no `weight_source` resolves to `show: false`.
    const unsetStrength = {
      effect_direction: 'negative' as const,
      weight: 0.5,
      exists_probability: 0.8,
    }
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: unsetStrength }]
    const { container } = render(
      <StyledEdge {...(props as any)} data={unsetStrength} selected />,
    )

    // ── PRECONDITIONS PINNED IN-TEST ────────────────────────────────────────
    // Without these the assertion below could pass because the fixture failed
    // to produce the state, rather than because the code is right.
    const text = strengthText(container)
    expect(text, 'the selected-edge chip did not render — fixture, not code').not.toBeNull()
    // (a) the label really is the unset-strength rendering…
    expect(text!.textContent).toContain('not set')
    // (b) …so it carries NO direction: no word, and no minus sign.
    expect(text!.textContent).not.toMatch(/boost|drag/)
    expect(text!.textContent).not.toContain('\u2212')

    // ── THE CLAIM ───────────────────────────────────────────────────────────
    // Asserting the accessible name (not merely non-null) pins the OTHER
    // precondition at the same time: a direction that was never stated would
    // render no glyph at all and this would pass vacuously.
    expect(glyph(container)?.getAttribute('aria-label')).toBe('Effect direction: negative')
  })

  it('CONTROL: a numeric positive edge with NO persistent chip still shows the glyph', () => {
    mockLabelMode = 'numeric'
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(strengthText(container)).toBeNull()
    expect(glyph(container)).not.toBeNull()
  })

  it('CONTROL: human mode is unchanged — the word carries it, glyph suppressed', () => {
    mockLabelMode = 'human'
    pinAsTopStrength()
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(strengthText(container)!.textContent).toMatch(/boost|drag/)
    expect(glyph(container)).toBeNull()
  })
})

/**
 * ⛔ THE MUTANT-KILL FOR `strength.show &&`, RELOCATED — READ THE CASE ABOVE FIRST.
 *
 * The numeric arm of `labelCarriesDirection` is
 * `strength.show && direction.direction === 'negative'`, and deleting the
 * `strength.show &&` conjunct once survived 109 tests across six specs. The
 * render case that killed it reached the function with an unset strength by
 * having such an edge win a PERSISTENT label — which P2 has now made
 * impossible (a pinned label must speak a strength). Its only production call
 * site is `showLabel && isTopStrengthEdge && labelCarriesDirection(...)`, so
 * the short-circuit would carry that test whether the conjunct existed or not.
 *
 * A mutant-killer that only bites through a route the product no longer has is
 * a guard that has quietly stopped guarding (CLAUDE.md trap 13b, third face).
 * So the kill is asserted DIRECTLY against the exported pure function, where it
 * cannot decay with a render route, and where it also documents the contract
 * for any future second caller — which is exactly what a redundant-at-one-site
 * conjunct needs, because "defence in depth" and "dead code" look identical
 * until someone adds the second caller.
 */
describe('labelCarriesDirection — the numeric arm, asserted directly', () => {
  const NEG: EdgeDirectionDisplay = { show: true, direction: 'negative', source: 'cee' }
  const POS: EdgeDirectionDisplay = { show: true, direction: 'positive', source: 'cee' }
  const UNSTATED: EdgeDirectionDisplay = { show: false, reason: 'unknown' }
  const SET: EdgeValueDisplay = { show: true, value: 0.6, source: 'cee' }
  const UNSET: EdgeValueDisplay = { show: false, reason: 'not_set' }

  it('THE CONJUNCT: an UNSET strength carries no direction even when the direction is a stated NEGATIVE', () => {
    // `formatNumericLabel` only reaches `signPrefix` when there is a magnitude
    // to sign, so this label reads `w not set` — no minus, no word. Deleting
    // `strength.show &&` flips this to true and the glyph would be suppressed,
    // leaving polarity on hue alone (directionStroke.ts:23-32 forbids it).
    expect(labelCarriesDirection(UNSET, NEG, 'numeric')).toBe(false)
  })

  it('TWIN (same shape, strength SOURCED): a stated negative DOES carry direction in the sign', () => {
    // Without this the assertion above would also pass on a function that
    // returned false for everything.
    expect(labelCarriesDirection(SET, NEG, 'numeric')).toBe(true)
  })

  it('the asymmetry is deliberate: a stated POSITIVE prints no sign, so it carries nothing', () => {
    expect(labelCarriesDirection(SET, POS, 'numeric')).toBe(false)
  })

  it('an unstated direction carries nothing in EITHER mode', () => {
    expect(labelCarriesDirection(SET, UNSTATED, 'numeric')).toBe(false)
    expect(labelCarriesDirection(SET, UNSTATED, 'human')).toBe(false)
  })

  it('HUMAN mode: every stated-direction arm prints the word, unset strength included', () => {
    // "Boost, strength not set" names a direction, so the human arm is
    // `direction.show` alone — the mode asymmetry this function exists for.
    expect(labelCarriesDirection(UNSET, NEG, 'human')).toBe(true)
    expect(labelCarriesDirection(SET, POS, 'human')).toBe(true)
  })
})

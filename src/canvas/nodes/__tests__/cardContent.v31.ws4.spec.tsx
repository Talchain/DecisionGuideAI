/**
 * ⭐ CONTRACT v3.1 CARD CONTENT — Canvas WS4 (DESIGN-GAP-v31 rows #18, #20,
 * #21, #34, #35, #38, #39, #42).
 *
 * Each block names the served measurement it closes (served `eec722ab`,
 * 25 Sep) and binds by identity: the card is BaseNode's `role="group"` root
 * holding `node-title`; elements by test ids carrying the node id.
 *
 * Harness: `FactorNode.prototypeBodyAtRest.spec.tsx` (real store, real
 * composed run-currency verdict; display metadata and the popover doubled).
 *
 * CLAIM SCOPE: jsdom — DOM text, attributes, class tokens, events. Pixels are
 * measured in the browser (`/private/tmp/canvas-v31-ws4/`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { NodeCoachingMarker } from '../shared/NodeCoachingMarker'
import { COACHING_ICON_GLYPH } from '../shared/NodeCoachingIcon'
import { RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { ASSUMPTIONS_OPEN_LINE, modelHasOpenAssumptions } from '../DecisionNode'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'
import { ESTIMATE_SUBJECT_TITLE } from '../shared/EstimateMarker'
import { MessageCircleQuestion } from 'lucide-react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphBadgesEnabled: () => true }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const ID = 'fac_x'

const metadata = (rank: number | null, setSize: number | null, rankedCount: number | null, influence: number) => ({
  sensitivityRank: rank, influence, influenceProvenance: 'influence_score', influenceImportanceBasis: null,
  influenceSetSize: setSize, influenceRankedCount: rankedCount, confidence: null,
  confidenceIsDefaulted: false, confidenceIsProvisional: false, inSensitivityAnalysis: true,
  achievementProbability: null, achievementProbabilityIsModelledBasis: false, stabilityPercentage: null,
  winRate: null, isResultsMode: true, predictedOutcome: null, valueOfInformation: null, voiRank: null,
})
const TOP = () => metadata(1, 3, 3, 1)
const SECOND = () => metadata(2, 3, 3, 0.6)
const UNRANKED = () => metadata(null, 3, 3, 0.12)

const FRESH_VERDICT = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-25T00:00:00.000Z' }

const seed = (data: Record<string, unknown>, { phase, flipRows = [] }: { phase: 'pre' | 'post'; flipRows?: unknown[] }) => {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'ws4',
    ...(phase === 'post'
      ? {
          analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
          v5AnalysisFact: { scenarioId: 'ws4', analysisHash: 'run-1', hasRunAnalysisFact: true },
          hasCompletedFirstRun: true,
          results: { status: 'complete', hash: 'run-1', report: {
            option_probabilities: {
              opt_a: { status: 'computed', win_probability: 0.6 },
              opt_b: { status: 'computed', win_probability: 0.4 },
            },
            robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
            flip_thresholds: flipRows,
          } },
        }
      : {
          analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
          hasCompletedFirstRun: false, results: { status: 'idle', report: null },
        }),
  } as never)
}

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const card = () => {
  const root = screen.getByTestId('node-title').closest('[role="group"]')
  expect(root, 'the card root renders').not.toBeNull()
  return root as HTMLElement
}
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

beforeEach(() => { displayMetadata = UNRANKED() })
afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', goalConstraints: [], nodes: [], edges: [],
  } as never)
})

/** market-entry `fac_localisation_cost`, verbatim. */
const BARE_SCALE = {
  label: 'Localisation and Compliance Cost', type: 'factor', category: 'controllable',
  display_value: '0.5 scale',
  observedState: { value: 0.5, raw_value: 0.5, unit: 'scale', cap: 1, source: 'cee_inference', extractionType: 'inferred', factor_type: 'cost' },
}
/** vendor-selection `fac_annual_cost` — a real unit (contrast). */
const OWN_UNIT = {
  label: 'Annual platform cost', type: 'factor', category: 'controllable', display_value: '£60k',
  observedState: { value: 0.5, raw_value: 60000, unit: '£', cap: 120000, source: 'cee_inference', extractionType: 'inferred', factor_type: 'cost' },
}
/** A person's own bare number (contrast): never hidden from them. */
const USER_BARE = {
  label: 'Localisation and Compliance Cost', type: 'factor', category: 'controllable',
  observedState: { value: 0.3, source: 'user_override' },
}
/** pricing `fac_market_competition` — an external factor whose only figure is a 0–1 range. */
const RANGE_BARE = {
  label: 'Competitive Pressure', type: 'factor', category: 'external', display_value: '0.3 to 0.8',
  prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
}
/**
 * Review F2 (#2085), the reviewer's reproduction: an external factor whose
 * range a person could have set in the inspector (bounded 0–1, `setPriorRange`
 * writes no stamp) — no value, no `display_value`.
 */
const RANGE_UNRECORDED = {
  label: 'Competitor price moves', type: 'factor', category: 'external',
  prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6 },
}
/** A percent prior — own-unit range (contrast). */
const RANGE_PCT = {
  label: 'Feature adoption', type: 'factor', category: 'external', observedState: { unit: '%' },
  prior: { distribution: 'uniform', range_min: 0.25, range_max: 0.45 },
}
/** pricing `fac_adoption_friction` — a qualitative producer value. */
const QUALITATIVE = {
  label: 'Bottom-Up Adoption Friction', type: 'factor', category: 'controllable', display_value: 'Very high (0.8)',
  observedState: { value: 0.8, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
}
const VALUED = {
  label: 'Trial conversion', type: 'factor', category: 'controllable',
  observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
}

describe('#20 — no bare internal model scale on the card (omit, never invent)', () => {
  it('a producer "0.5 scale" value leaves NO value line and no "0.5" on the card', () => {
    seed(BARE_SCALE, { phase: 'pre' })
    renderFactor(BARE_SCALE)
    const c = card()
    expect(within(c).queryByTestId('factor-recorded-value')).toBeNull()
    expect(visibleText(c)).not.toMatch(/\b0\.5\b/)
    // Not a gap either: nothing claims the value is missing.
    expect(within(c).queryByTestId(`factor-needs-input-row-${ID}`)).toBeNull()
  })

  it('contrast — a real-unit value keeps its line ("£60,000")', () => {
    seed(OWN_UNIT, { phase: 'pre' })
    renderFactor(OWN_UNIT)
    expect(visibleText(within(card()).getByTestId('factor-recorded-value'))).toMatch(/^£60,000/)
  })

  it('contrast — a person\'s own bare number is shown to them', () => {
    seed(USER_BARE, { phase: 'pre' })
    renderFactor(USER_BARE)
    expect(visibleText(within(card()).getByTestId('factor-recorded-value'))).toMatch(/^0\.3/)
  })

  // ⛔ REVIEW F1 (#2085): the NUMBER is omitted, never its PROVENANCE. The
  // card must still say WHICH factor holds Olumi's unconfirmed estimate — the
  // same `est.` button, figure-less, opening the inspector. Bound by test id
  // AND accessible name, pre-run and post-run.
  for (const phase of ['pre', 'post'] as const) {
    it(`F1 (${phase}-run): the bare-scale Olumi estimate keeps its \`est.\` mark on the card, with no figure`, () => {
      seed(BARE_SCALE, { phase })
      renderFactor(BARE_SCALE)
      const c = card()
      const mark = within(c).getByTestId('estimate-marker')
      expect(mark.tagName).toBe('BUTTON')
      expect(within(c).getByRole('button', { name: ESTIMATE_SUBJECT_TITLE.value })).toBe(mark)
      expect(visibleText(mark)).toBe('est.')
      expect(within(c).getByTestId(`factor-value-mark-slot-${ID}`).contains(mark)).toBe(true)
      // the number stays omitted, and nothing is substituted for it
      expect(visibleText(c)).not.toMatch(/\b0\.5\b/)
      expect(within(c).queryByTestId('factor-recorded-value')).toBeNull()
      expect(within(c).queryByTestId(`factor-needs-input-row-${ID}`)).toBeNull()
      expect(visibleText(within(c).getByTestId(`factor-value-mark-only-${ID}`))).toBe('est.')
      const opened = vi.fn()
      window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
      fireEvent.click(mark)
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
      expect(opened).toHaveBeenCalledTimes(1)
    })

    it(`F1 contrast (${phase}-run): a person's bare number is never hidden — figure AND "Set by you", no figure-less row`, () => {
      seed(USER_BARE, { phase })
      renderFactor(USER_BARE)
      const c = card()
      const line = within(c).getByTestId('factor-recorded-value')
      expect(visibleText(line)).toMatch(/^0\.3/)
      expect(within(line).getByTestId(`factor-value-source-${ID}`).textContent).toContain('Set by you')
      expect(within(c).queryByTestId(`factor-value-mark-only-${ID}`)).toBeNull()
      expect(within(c).queryByTestId('estimate-marker')).toBeNull()
    })
  }

  // ⛔ REVIEW F2 (#2085): a bare 0–1 range of UNRECORDED origin stays on the
  // card with its `no source` mark — the inspector's editor is bounded 0–1 and
  // `setPriorRange` writes no stamp, so the range may be the person's. The rule
  // would omit only a range STAMPED as CEE's; no such stamp exists in the data
  // model (`prior` records no author), so there is no stamped contrast to run.
  it('F2: a person-settable 0–1 range (prior uniform 0.2–0.6, no value) IS shown, with `no source`', () => {
    seed(RANGE_UNRECORDED, { phase: 'pre' })
    renderFactor(RANGE_UNRECORDED)
    const c = card()
    const line = within(c).getByTestId(`factor-prior-range-${ID}`)
    expect(visibleText(line)).toMatch(/^Range: 0\.2 to 0\.6/)
    expect(visibleText(within(line).getByTestId(`factor-range-source-${ID}`))).toBe('no source')
  })

  // ⭐ THE STAMP F2 FOUND MISSING EXISTS FOR ONE ARM (26 Sep, design audit #3).
  // This fixture's line is the producer's own `display_value` ("0.3 to 0.8"),
  // printed verbatim — a field no editor writes — so it is known not to be a
  // number the person typed, and the card omits it (served `853feeb7`: 14
  // starter cards read "Range: 0.x to 0.y · no source", every one this arm).
  // The mark sat INSIDE the line it qualified, so it goes with it. The
  // reviewer's own reproduction above (composed from `prior`) is unchanged.
  it('audit #3: the producer\'s own bare "0.3 to 0.8" `display_value` is omitted from the card, line and mark', () => {
    seed(RANGE_BARE, { phase: 'pre' })
    renderFactor(RANGE_BARE)
    const c = card()
    expect(visibleText(c)).toContain('Competitive Pressure')
    expect(within(c).queryByTestId(`factor-prior-range-${ID}`)).toBeNull()
    expect(within(c).queryByTestId(`factor-range-source-${ID}`)).toBeNull()
    expect(visibleText(c)).not.toMatch(/0\.3 to 0\.8/)
  })

  it('contrast — an own-unit range keeps its line', () => {
    seed(RANGE_PCT, { phase: 'pre' })
    renderFactor(RANGE_PCT)
    expect(within(card()).getByTestId(`factor-prior-range-${ID}`).textContent).toMatch(/^Range: 25% to 45%/)
  })
})

describe('#35 — every value is the contract\'s 610 `strong`', () => {
  it('a qualitative value ("Very high") is ONE strong at 610, not the 500 token', () => {
    seed(QUALITATIVE, { phase: 'pre' })
    renderFactor(QUALITATIVE)
    const whole = within(card()).getByTestId(`factor-value-whole-${ID}`)
    expect(whole.tagName).toBe('STRONG')
    expect(whole.textContent).toBe('Very high')
    expect(tokens(whole).has('font-[610]')).toBe(true)
  })
})

describe('#21 — a source mark is focusable, named, 10px/400, and opens the source detail', () => {
  it('the factor\'s `est.` is a button at the contract\'s .prov type, and a click opens the inspector', () => {
    seed(QUALITATIVE, { phase: 'pre' })
    renderFactor(QUALITATIVE)
    const mark = within(card()).getByTestId('estimate-marker')
    expect(mark.tagName).toBe('BUTTON')
    expect(tokens(mark).has('text-[length:calc(10px*var(--canvas-label-scale,1))]')).toBe(true)
    expect(tokens(mark).has('font-normal')).toBe(true)
    expect(mark.textContent).toContain('est.')
    const opened = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
    fireEvent.click(mark)
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('a person\'s value carries the PERSON GLYPH, not the word "you"; its name is "Set by you"', () => {
    seed(USER_BARE, { phase: 'pre' })
    renderFactor(USER_BARE)
    const mark = within(card()).getByTestId(`factor-value-source-${ID}`)
    expect(mark.tagName).toBe('BUTTON')
    expect(mark.querySelector('[data-source-glyph="person"]')).not.toBeNull()
    expect(visibleText(mark)).toBe('')
    expect(mark.textContent).toContain('Set by you')
  })
})

describe('#38 — the turning point says its direction in words; "No turning point in this run" is the normal fallback', () => {
  const FOUND = (flip: number) => ({ node_id: ID, label: 'Trial conversion', current_value: 8, flip_value: flip, unit: '%', flip_reason: 'found', value_scale: 'display' })

  it('below: "Below 6.5%, the current model comparison changes." at rest', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND(6.5)] })
    renderFactor(VALUED)
    const tp = within(card()).getByTestId('factor-turning-point')
    expect(visibleText(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Below 6.5%, the current model comparison changes.')
  })

  it('above: "Above 9.5%, …" when the threshold is above the current value', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND(9.5)] })
    renderFactor(VALUED)
    const tp = within(card()).getByTestId('factor-turning-point')
    expect(visibleText(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Above 9.5%, the current model comparison changes.')
  })

  it('a RANKED factor whose run ATTESTED no turning point says "No turning point in this run" at Normal zoom (not only Detailed)', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'post', flipRows: [{ node_id: ID, label: 'Trial conversion', flip_reason: 'no_effect_within_bounds' }] })
    renderFactor(VALUED)
    const none = within(card()).getByTestId('factor-turning-point-none')
    expect(visibleText(none)).toBe('No turning point in this run')
  })

  it('⛔ contrast — a run that established NOTHING never says "in this run": the quiet fallback is "No turning point available"', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'post', flipRows: [] })
    renderFactor(VALUED)
    const none = within(card()).getByTestId('factor-turning-point-none')
    expect(visibleText(none)).toBe('No turning point available')
  })

  it('contrast — an UNRANKED factor shows no turning-point fallback', () => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post', flipRows: [] })
    renderFactor(VALUED)
    expect(within(card()).queryByTestId('factor-turning-point-none')).toBeNull()
  })
})

describe('#18 — no structural "branch" glyph at rest', () => {
  const n = (id: string, kind: string): Node => ({ id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id } }) as Node
  const e = (id: string, s: string, t: string): Edge => ({ id, source: s, target: t, data: {} }) as Edge

  it('a shared_mechanism finding puts NO glyph in the card\'s coaching slot', () => {
    useCanvasStore.setState({
      nodes: [n('o1', 'option'), n('o2', 'option'), n('x1', 'outcome'), n('r1', 'risk')],
      edges: [e('e1', 'o1', 'x1'), e('e2', 'o2', 'x1'), e('e3', 'x1', 'r1')],
      lodRung: 'full',
    } as never)
    const { container } = render(<NodeCoachingMarker nodeId="x1" />)
    expect(container.querySelector('[data-testid^="node-structural-marker-"]')).toBeNull()
  })
})

describe('#34 / #39 / #42 — resting copy and glyph', () => {
  it('#34: the risk unset line is the whole state label', () => {
    expect(RISK_EXPOSURE_UNSET_LINE).toBe('Likelihood and impact not set yet')
  })

  it('#39: "Assumptions open for review" is stated only when a factor carries an unconfirmed Olumi estimate', () => {
    expect(ASSUMPTIONS_OPEN_LINE).toBe('Assumptions open for review')
    expect(modelHasOpenAssumptions([{ type: 'factor', data: QUALITATIVE }])).toBe(true)
    // contrast: a person's value is not an open assumption
    expect(modelHasOpenAssumptions([{ type: 'factor', data: USER_BARE }])).toBe(false)
  })

  it('#42: the coaching glyph is the bubble with "?"', () => {
    expect(COACHING_ICON_GLYPH.Icon).toBe(MessageCircleQuestion)
  })
})

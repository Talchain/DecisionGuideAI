/**
 * ⭐⭐ ONE UNIT FORMAT ON THE GRAPH'S CARDS — served `e8ba18e6` (27 Sep 2026), a
 * fresh model drafted from a pricing brief, factor units exactly as CEE sent them.
 *
 * MEASURED ON THE SERVED CARDS (before):
 *   1. goal    "Target: 100,000 GBP MRR"                unit "GBP MRR", raw 100000
 *   2. factor  "1,000 GBP MRR added / month"            unit "GBP MRR added per month", raw 1000
 *   3. factor  "£49 / month" — ALREADY RIGHT             unit "GBP per month", raw 49
 *   4. option  "£49 / month → £54/month"                two formats on one row
 *   5. factor  "1,000 GBP MRR added / est." + "month"   the `est.` mark landed INSIDE the unit
 *
 * THE RULE (after): the card reads every unit through ONE compact owner
 * (`compactUnitParts`, the path that already turned "GBP per month" into
 * "£49 / month"), in the CARD notation (`CARD_UNIT_NOTATION`): a leading ISO code
 * with a glyph becomes the prefix, the rest of the unit stays a suffix, "per X" →
 * "/ X". So: "Target: £100,000 MRR", "£1,000 MRR added / month", and an option row
 * whose two sides share a unit states it once: "£49 → £54 / month". The figure and
 * its unit are one no-wrap run, so a mark can only follow the WHOLE unit.
 *
 * ⚠ SCOPE — THE CARDS ONLY. The right panel and the Analysis tab read the same
 * shared helpers WITHOUT the card notation and are byte-identical (product owner,
 * 27 Sep: do not change them). The CONTROL rows below pin that.
 *
 * ⚠ ONE FIXTURE VALUE IS INFERRED, NOT CAPTURED: the served row's right side read
 * "£54/month", and no UI path spells a rate with no spaces, so it is CEE's
 * `display_value` verbatim. The wire string itself was not captured (UNVERIFIED);
 * the long-form wire value of `cd6a82e4` ("59 GBP per month") is pinned alongside.
 *
 * CLAIM SCOPE: jsdom proves DOM text and structure (which element holds what, which
 * wrap classes it wears), never layout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { GoalNode, GOAL_TARGET_ROUTE_TESTID } from '../GoalNode'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import { buildOptionTargetRow, resolveBaselineOptionReference, resolveOptionTargets } from '../shared/optionTargetDisplay'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

type N = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }

const factorNode = (id: string, label: string, observedState: Record<string, unknown>): N => ({
  id, type: 'factor', position: { x: 0, y: 0 }, data: { label, type: 'factor', category: 'controllable', observedState },
})

/** `observed_state` shapes as CEE sends them on the pricing brief. */
const PRO_PLAN_PRICE = factorNode('pro_plan_price', 'Pro plan price',
  { cap: 200, unit: 'GBP per month', value: 0.245, source: 'brief_extraction', raw_value: 49, declared_scale: 'unit_interval' })
const MRR_ADDED = factorNode('mrr_added_per_month', 'MRR added per month',
  { unit: 'GBP MRR added per month', value: 0.1, source: 'cee_inference', raw_value: 1000, extractionType: 'inferred' })

const seed = (nodes: N[], ceeAnalysisReady: unknown = null) => {
  useCanvasStore.setState({
    nodes, edges: [], ceeAnalysisReady, viewMode: 'standard', lodRung: 'full',
    goalConstraints: [], goalThreshold: null, analysisStateV1: null, importPendingServerRegistration: false,
    currentScenarioId: 'card-units-one-format',
    analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
    hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
}

const nodeProps = { selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true }

const renderFactor = (n: N) => {
  seed([n])
  return render(<ReactFlowProvider><FactorNode id={n.id} type="factor" data={n.data as never} {...nodeProps} /></ReactFlowProvider>)
}

const renderGoal = (data: Record<string, unknown>) => {
  const n: N = { id: 'goal_mrr', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach MRR target', type: 'goal', ...data } }
  seed([n])
  return render(<ReactFlowProvider><GoalNode id={n.id} type="goal" data={n.data as never} {...nodeProps} /></ReactFlowProvider>)
}

/** The goal card's ONE target phrase (a route button, or a plain line) — whichever mounted. */
const goalTargetText = (): string => {
  const el = screen.queryByTestId(GOAL_TARGET_ROUTE_TESTID) ?? screen.queryByTestId('goal-target-line')
  expect(el, 'PRECONDITION: the goal card renders its target phrase').not.toBeNull()
  return el!.textContent ?? ''
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [], ceeAnalysisReady: null } as never)
})

describe('defect 1 — the goal card: a leading currency code reads as its glyph', () => {
  it('"GBP MRR", 100000 → "Target: £100,000 MRR"', () => {
    renderGoal({ goal_threshold_raw: 100000, goal_threshold_unit: 'GBP MRR' })
    expect(goalTargetText()).toBe('Target: £100,000 MRR')
  })

  it('CONTRAST — a unit with no currency code is unchanged: "subscribers", 1500 → "Target: 1,500 subscribers"', () => {
    renderGoal({ goal_threshold_raw: 1500, goal_threshold_unit: 'subscribers' })
    expect(goalTargetText()).toBe('Target: 1,500 subscribers')
  })

  it('CONTROL — the right panel / Analysis tab helper, called as they call it, is byte-identical ("100,000 GBP MRR")', () => {
    expect(formatGoalTarget(100000, 'GBP MRR')).toBe('100,000 GBP MRR')
  })
})

/** [served unit, raw, expected figure, expected unit words] — defects 2 and 3, then the contrast units. */
const FACTOR_READINGS: Array<[string, number, string, string]> = [
  ['GBP MRR added per month', 1000, '£1,000', 'MRR added / month'], // defect 2
  ['GBP per month', 49, '£49', '/ month'],                           // item 3 — the path that was already right
  ['% per month', 3, '3%', '/ month'],                               // contrast
  ['subscribers', 1500, '1,500', 'subscribers'],                     // contrast
  ['subscribers per month', 75, '75', 'subscribers / month'],        // contrast
]

describe('defects 2 + 3 — the factor card reads every unit through the ONE compact rule', () => {
  it.each(FACTOR_READINGS)('unit %j, raw %d → figure "%s" + unit "%s"', (unit, raw, figure, unitWords) => {
    const id = 'fac_reading'
    renderFactor(factorNode(id, 'A factor', { unit, value: 0.2, source: 'cee_inference', raw_value: raw, extractionType: 'inferred' }))
    expect(screen.getByTestId(`factor-value-figure-${id}`).textContent).toBe(figure)
    expect(screen.getByTestId(`factor-value-unit-${id}`).textContent).toBe(unitWords)
  })
})

describe('defect 5 — the figure and its unit are ONE no-wrap run; the mark follows the whole unit', () => {
  it('"£1,000 MRR added / month" is held whole, the `est.` mark sits after it, and the line may wrap only before the mark', () => {
    const id = MRR_ADDED.id
    renderFactor(MRR_ADDED)
    const run = screen.getByTestId(`factor-value-run-${id}`)
    expect(run.textContent).toBe('£1,000 MRR added / month')
    expect(tokens(run).has('whitespace-nowrap'), 'the figure + unit must not break inside').toBe(true)
    expect(run.contains(screen.getByTestId(`factor-value-figure-${id}`))).toBe(true)
    expect(run.contains(screen.getByTestId(`factor-value-unit-${id}`))).toBe(true)

    const row = screen.getByTestId('factor-recorded-value')
    const markSlot = within(row).getByTestId(`factor-value-mark-slot-${id}`)
    expect(within(markSlot).getByTestId('estimate-marker').textContent).toBe('est.')
    expect(run.contains(markSlot), 'the mark is never inside the unit run').toBe(false)
    // Document order: the mark FOLLOWS the run.
    expect(run.compareDocumentPosition(markSlot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A too-narrow line wraps BEFORE the mark (the row may wrap), never inside the unit (the run may not).
    expect(tokens(row).has('flex-wrap')).toBe(true)
    expect(tokens(row).has('flex-nowrap')).toBe(false)
  })
})

/** `analysis_ready.options[]` — the baseline sets nothing; the option carries CEE's own reading. */
const OPTIONS: N[] = [
  { id: 'keep_pro_price_at_49', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Keep Pro price at £49', type: 'option', is_baseline: true } },
  { id: 'set_pro_price_at_54', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Set Pro price at £54', type: 'option' } },
]
const ceeWith = (displayValue: string, raw: number) => ({
  options: [
    { id: 'keep_pro_price_at_49', is_baseline: true, interventions: {} },
    {
      id: 'set_pro_price_at_54',
      interventions: { pro_plan_price: raw / 200 },
      intervention_details: { pro_plan_price: { display_value: displayValue, normalised_value: raw / 200, raw_value: raw, unit: 'GBP per month', source: 'brief_extraction' } },
    },
  ],
})

const renderOption = (displayValue: string, raw: number) => {
  seed([PRO_PLAN_PRICE, ...OPTIONS], ceeWith(displayValue, raw))
  const o = OPTIONS[1]
  return render(<ReactFlowProvider><OptionNode id={o.id} type="option" data={o.data as never} {...nodeProps} /></ReactFlowProvider>)
}
const OPT = 'set_pro_price_at_54'
const FID = 'pro_plan_price'

describe('defect 4 — an option row uses ONE formatter on both sides, and states a shared unit once', () => {
  it.each([
    ['"£54/month" (the served right side)', '£49 → £54 / month', '£54/month', 54],
    ['"59 GBP per month" (the cd6a82e4 wire)', '£49 → £59 / month', '59 GBP per month', 59],
  ])('CEE %s: the row reads "%s"', (_name, expected, displayValue, raw) => {
    const { container } = renderOption(displayValue as string, raw as number)
    const value = container.querySelector(`[data-testid="option-change-row-value-${OPT}-${FID}"]`)
    expect(value, 'PRECONDITION: the pro_plan_price row renders on the card').not.toBeNull()
    expect(value!.textContent).toBe(expected)
    expect(container.querySelector(`[data-testid="option-change-row-before-${OPT}-${FID}"]`)!.textContent).toBe('£49')
    // The source mark is exactly where it was: the value, then (glued) the mark cluster, inside the amount cell.
    const amount = container.querySelector(`[data-testid="option-change-row-${OPT}-${FID}"]`)!
    const mark = amount.querySelector(`[data-testid="option-change-row-mark-${OPT}-${FID}"]`)
    expect(mark, 'the row keeps its source mark').not.toBeNull()
    expect(value!.contains(mark)).toBe(false)
    expect(value!.compareDocumentPosition(mark!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mark!.textContent).toContain('brief')
  })

  it('CONTROL — the right panel builds the same row WITHOUT the card notation: its reading is CEE\'s verbatim "£54/month"', () => {
    seed([PRO_PLAN_PRICE, ...OPTIONS], ceeWith('£54/month', 54))
    const cee = ceeWith('£54/month', 54).options
    const target = resolveOptionTargets(OPTIONS[1].data, cee[1]).get(FID)!
    const row = buildOptionTargetRow({
      factorId: FID,
      target,
      factorNode: PRO_PLAN_PRICE,
      baselineReference: resolveBaselineOptionReference([PRO_PLAN_PRICE, ...OPTIONS], cee, OPT),
    })
    expect(row.target).toBe('£54/month')
    expect(row.change).toBe('£49 / month → £54/month')
  })
})

/**
 * ⭐⭐ AN OPTION ROW READS "£49 / month → £59 / month", INSIDE THE CARD — served
 * `cd6a82e4`, Paul's pricing brief (26 Sep 2026).
 *
 * MEASURED ON THE SERVED BOARD (screenshots `joined-1-cd6a82e4-5f941f2/08-reloaded.png`,
 * `bf5-after-cd6a82e4/03-after-run.png`):
 *   · "Raise Pro price to £59" read "Pro plan price / 49 GBP per month → 59 GBP
 *     per month · brief", and the amount ran past the card's right border;
 *   · on a second board the same concept read "49 £/month → 59 £/month · brief".
 * Target (DESIGN-GAP-v31 #9; contract reference board): label left, amount
 * right, "£49 → £59", never past the edge. The "from" stays the factor card's
 * own visible reading (pinned identity), so the unit is stated on both sides.
 *
 * ⭐ THE FIXTURES ARE THE WIRE, NOT THE AUTHOR'S HEAD. Every value below is
 * copied from `analysis_ready` in that run's `turns.jsonl`: the flat
 * `interventions` map, its sibling `intervention_details` with CEE's own
 * `display_value: "59 GBP per month"`, a baseline option with NO interventions,
 * and the factor's `observed_state` (`unit: "GBP per month"`, `raw_value: 49`).
 * The second board's `£/month` unit is from the second screenshot.
 *
 * ⚠ WHAT jsdom CAN AND CANNOT CLAIM. jsdom has no layout: `scrollWidth` and
 * `clientWidth` are 0 for every element, so an overflow measured here would
 * agree with a broken card. The overflow claim is therefore made on the
 * STRUCTURE that decides it — the amount may break before its arrow and no
 * unbreakable run is longer than one line of the row budget
 * (`NODE_ROW_LABEL_MAX_CHARS`) — and the pixel claim belongs to a served-build
 * measurement, not to this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { NODE_ROW_LABEL_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import { formatInterventionTargetText } from '../../utils/interventionDisplay'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** `observed_state` for `pro_plan_price`, verbatim from the served turn. */
const priceFactor = (unit: string) => ({
  id: 'pro_plan_price',
  type: 'factor',
  data: {
    label: 'Pro plan price',
    type: 'factor',
    observedState: { cap: 200, unit, value: 0.245, source: 'brief_extraction', raw_value: 49, declared_scale: 'unit_interval' },
  },
})

const OPTIONS = [
  { id: 'keep_pro_price_at_49', type: 'option', data: { label: 'Keep Pro price at £49', type: 'option', is_baseline: true } },
  { id: 'raise_pro_price_to_59', type: 'option', data: { label: 'Raise Pro price to £59', type: 'option' } },
  { id: 'set_pro_price_at_54', type: 'option', data: { label: 'Set Pro price at £54', type: 'option' } },
]

/** `analysis_ready.options[]`, verbatim shape from the served turn (the baseline sets nothing). */
const wire = (unit: string, spell: (n: number) => string) => ({
  options: [
    { id: 'keep_pro_price_at_49', is_baseline: true, interventions: {} },
    {
      id: 'raise_pro_price_to_59',
      interventions: { pro_plan_price: 0.295 },
      intervention_details: { pro_plan_price: { display_value: spell(59), normalised_value: 0.295, raw_value: 59, unit } },
    },
    {
      id: 'set_pro_price_at_54',
      interventions: { pro_plan_price: 0.27 },
      intervention_details: { pro_plan_price: { display_value: spell(54), normalised_value: 0.27, raw_value: 54, unit } },
    },
  ],
})

let board: { unit: string; spell: (n: number) => string } = { unit: 'GBP per month', spell: (n) => `${n} GBP per month` }

const makeStoreState = () => ({
  hoveredOptionId: null,
  nodes: [priceFactor(board.unit), ...OPTIONS],
  edges: [],
  ceeAnalysisReady: wire(board.unit, board.spell),
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const renderOption = (id: string, label: string) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  return render(
    <ReactFlowProvider>
      <OptionNode
        id={id} type="option" data={{ label, type: 'option' } as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

const FID = 'pro_plan_price'
const value = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="option-change-row-value-${id}-${FID}"]`)
const amount = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="option-change-row-${id}-${FID}"]`)

describe('served cd6a82e4 — an option row reads its amount compactly, inside the card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    board = { unit: 'GBP per month', spell: (n) => `${n} GBP per month` }
  })

  it('Raise to £59: "£49 / month → £59 / month" — the "from" is the factor card\'s own reading', () => {
    const { container } = renderOption('raise_pro_price_to_59', 'Raise Pro price to £59')
    const v = value(container, 'raise_pro_price_to_59')
    expect(v, 'PRECONDITION: the pro_plan_price row renders on the card').not.toBeNull()
    expect(v!.textContent).toBe('£49 / month → £59 / month')
    expect(container.querySelector(`[data-testid="option-change-row-before-raise_pro_price_to_59-${FID}"]`)!.textContent).toBe('£49 / month')
  })

  it('Set at £54: "£49 / month → £54 / month" — the same grammar on the sibling card', () => {
    const { container } = renderOption('set_pro_price_at_54', 'Set Pro price at £54')
    expect(value(container, 'set_pro_price_at_54')!.textContent).toBe('£49 / month → £54 / month')
  })

  it('the second board\'s "£/month" reads the SAME string — one grammar for one concept', () => {
    board = { unit: '£/month', spell: (n) => `${n} £/month` }
    const { container } = renderOption('raise_pro_price_to_59', 'Raise Pro price to £59')
    expect(value(container, 'raise_pro_price_to_59')!.textContent).toBe('£49 / month → £59 / month')
  })

  it.each([
    ['GBP per month (compacted)', 'GBP per month', (n: number) => `${n} GBP per month`],
    // A unit the owner declines (no glyph for CHF) keeps its long spelling: the
    // amount must still never be one unbreakable run wider than a row line.
    ['CHF per month (not compacted, breaks before the arrow)', 'CHF per month', (n: number) => `${n} CHF per month`],
  ])('%s: no unbreakable run in the amount exceeds one row line', (_name, unit, spell) => {
    board = { unit, spell }
    const { container } = renderOption('raise_pro_price_to_59', 'Raise Pro price to £59')
    const v = value(container, 'raise_pro_price_to_59') as HTMLElement
    const dd = amount(container, 'raise_pro_price_to_59') as HTMLElement
    expect(dd, 'PRECONDITION: the amount cell renders').not.toBeNull()
    expect(v.textContent).toBe(unit === 'GBP per month' ? '£49 / month → £59 / month' : '49 CHF per month → 59 CHF per month')
    const runs = [...dd.querySelectorAll<HTMLElement>('.whitespace-nowrap')]
    // CONTRAST: the instrument sees the no-wrap runs that DO exist (value halves + the mark).
    expect(runs.length).toBeGreaterThan(0)
    // VISIBLE text only: a screen-reader-only name takes no width.
    const visible = (el: Element) => {
      const clone = el.cloneNode(true) as Element
      clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
      return (clone.textContent ?? '').trim()
    }
    for (const run of runs) {
      const text = visible(run)
      expect(text.length, `no-wrap run "${text}" longer than one row line (${NODE_ROW_LABEL_MAX_CHARS})`)
        .toBeLessThanOrEqual(NODE_ROW_LABEL_MAX_CHARS)
    }
  })
})

describe('served cd6a82e4 — the one compact owner, read by the row target and the goal', () => {
  it('CEE\'s "59 GBP per month" (its own figure + the carried unit) reads "£59 / month"; the digits are CEE\'s', () => {
    expect(formatInterventionTargetText({ label: 'Pro plan price', value: 0.295, unit: 'GBP per month', displayValue: '59 GBP per month' }))
      .toBe('£59 / month')
  })

  it('CONTROL — a reading that is not exactly `<figure> <carried unit>` stays verbatim (prose is never re-derived)', () => {
    expect(formatInterventionTargetText({ label: 'Pro plan price', value: 0.295, unit: 'GBP per month', displayValue: '59 GBP/month' }))
      .toBe('59 GBP/month')
    expect(formatInterventionTargetText({ label: 'Ad spend', value: 0.9, unit: '£', displayValue: '£18k' })).toBe('£18k')
  })

  it('the goal target "20,000 GBP per month" reads "£20,000 / month"', () => {
    expect(formatGoalTarget(20000, 'GBP per month')).toBe('£20,000 / month')
  })

  it('CONTROL — a plain word unit on the goal is untouched ("200 subscribers")', () => {
    expect(formatGoalTarget(200, 'subscribers')).toBe('200 subscribers')
  })
})

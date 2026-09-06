/**
 * Analysis (New) — two honesty defects found by the 28 Aug independent audit,
 * both measured on the DEPLOYED build `a9fc1564`.
 *
 * ── 1. INVENTED PRECISION ON THE CONDITIONAL-WINNER SPLIT ───────────────────
 *
 * `buildKeyInsights` interpolated `conditional_winners[0].split_value` RAW, so
 * the surface rendered `0.3007492161730507` — sixteen significant figures on a
 * Monte-Carlo split point.
 *
 * ⚠ THE RULE HERE IS DERIVED, NOT CHOSEN BY TASTE. `EnrichmentConditionalWinner
 * Schema` (`@talchain/schemas` 0.48.0, `boundary/enrichment.js:928`) types the
 * field as a BARE `z.number()` — it declares no precision, no scale and no
 * significant-figure count, so NO precision is licensed and the trailing digits
 * are estimator noise wearing the costume of resolution. Two independent
 * estate consumers of the SAME producer field already display it at two
 * decimals or fewer (`model-tab/OptionsSection.tsx:237-239` through
 * `formatSmartNumber`; `ConditionalWinnerCards.tsx:140` through
 * `toLocaleString`), and — decisively — THIS SURFACE ALREADY HOLDS THE RULE:
 * `glanceCondition` states "At most two decimals, and NO invented ones", added
 * after the deployed build printed `Customer demand passes 0.361111%` for the
 * SIBLING field `flip_value`. This call site was simply missed by it.
 *
 * ── 2. A DEAD "COULD CHANGE IF" ACTION ──────────────────────────────────────
 *
 * `AtAGlance` rendered the condition as a `<button>` unconditionally, falling
 * back to an `onOpenDrivers` prop that has ZERO passers anywhere in `src/`
 * (contrast control: `onFocusTarget` resolves to 13 files). So on a run whose
 * flip-threshold row carries no `node_id` — reachable, because `node_id` is not
 * in `EnrichmentFlipThresholdSchema` at all and `useResultsSectionData.ts:2152`
 * defaults it to `''` — the surface rendered a focusable, chevron-bearing,
 * hover-styled control wired to `undefined`.
 *
 * The fix is the rule this same file already applies to the driver rows
 * fourteen lines above: "Fail-closed: no target, no affordance. Plain text
 * beats a control that does nothing."
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY (testid / exact `inspect` row label /
 * insight id prefix), never by a value predicate another element could satisfy
 * (CLAUDE.md trap 19).
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, makeData } from './analysisNewFixtures'

afterEach(() => cleanup())

// ── shared builders ─────────────────────────────────────────────────────────

/** A run whose producer emitted one conditional-winner row at `splitValue`. */
function withConditionalWinner(
  splitValue: number,
  opts: { namesBoth?: boolean; splitUnit?: string } = {},
): ResultsSectionDataReturn {
  const base = genuineDecision()
  const namesBoth = opts.namesBoth !== false
  return {
    ...base,
    confidence: {
      ...base.confidence,
      conditionalWinners: [
        {
          factor_id: 'f_costsave',
          factor_label: 'Cost Savings Achieved',
          split_value: splitValue,
          ...(opts.splitUnit ? { split_unit: opts.splitUnit } : {}),
          winner_flips: true,
          low_bucket: { win_probability: 0.4, ...(namesBoth ? { winner_label: 'Hold price' } : {}) },
          high_bucket: { win_probability: 0.6, ...(namesBoth ? { winner_label: 'Raise price' } : {}) },
        },
      ],
    },
  } as unknown as ResultsSectionDataReturn
}

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

/**
 * The conditional-winner finding, found BY ITS ID PREFIX — never by scanning
 * for whichever finding happens to contain a number.
 */
function conditionalWinnerFinding(data: ResultsSectionDataReturn) {
  const found = vmOf(data).keyInsights.insights.find((i) =>
    i.id.startsWith('insight:conditional-winner:'),
  )
  expect(found, 'precondition: the conditional-winner finding is produced at all').toBeDefined()
  return found!
}

/** A glance condition, with or without a focus target. */
function glanceWithCondition(nodeId: string): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      flipThresholdsStatus: 'computed',
      flipThresholds: [
        {
          label: 'Cost Savings Achieved',
          node_id: nodeId,
          current_value: 0,
          flip_value: 1,
          flip_reason: 'found',
        },
      ],
    },
  } as never)
}

// ── 1. INVENTED PRECISION ───────────────────────────────────────────────────

describe('the conditional-winner split is shown at the precision the producer licenses', () => {
  it('does NOT print the raw float — the sentence rounds to at most two decimals', () => {
    // The audit's exact observed value on the deployed build `a9fc1564`.
    const finding = conditionalWinnerFinding(withConditionalWinner(0.3007492161730507))
    expect(finding.implication).toBe(
      'Above 0.3, Raise price scores higher; below it, Hold price does.',
    )
  })

  it('does NOT print the raw float in the inspect row either', () => {
    // Bound to the row by its EXACT label — a value predicate would match
    // whichever inspect row happened to hold a number.
    const finding = conditionalWinnerFinding(withConditionalWinner(0.3007492161730507))
    const splitRow = finding.inspect.find((r) => r.label === 'Split value')
    expect(splitRow, 'precondition: the Split value row exists').toBeDefined()
    expect(splitRow!.value).toBe('0.3')
  })

  it('rounds the NEUTRAL arm too — the sentence that names no option', () => {
    // The discriminating twin for the branch: `namesBoth: false` takes the
    // other implication string, which interpolated the same raw value.
    const finding = conditionalWinnerFinding(
      withConditionalWinner(0.3007492161730507, { namesBoth: false }),
    )
    expect(finding.implication).toBe('The preferred direction changes around 0.3.')
  })

  it('invents NO decimals on a whole number — "42" never becomes "42.00"', () => {
    // The opposite-direction twin: a rule that blanket-formatted to 2dp would
    // pass every assertion above and fabricate precision here instead.
    const finding = conditionalWinnerFinding(withConditionalWinner(42))
    expect(finding.implication).toBe(
      'Above 42, Raise price scores higher; below it, Hold price does.',
    )
    expect(finding.inspect.find((r) => r.label === 'Split value')!.value).toBe('42')
  })

  it('leaves a value already inside the licensed precision untouched', () => {
    const finding = conditionalWinnerFinding(withConditionalWinner(0.35))
    expect(finding.inspect.find((r) => r.label === 'Split value')!.value).toBe('0.35')
  })

  it('never rounds a real threshold away into a fabricated "0"', () => {
    // ⚠ WRITTEN AGAINST THE CONTRACT, NOT AGAINST THE FAILURE MODE IN HAND
    // (CLAUDE.md trap 13d). `split_value` is a bare `z.number()`, so it admits
    // magnitudes below the rounding step. Dropping precision is honest;
    // changing the CLAIM from "a threshold at 0.0004" to "a threshold at zero"
    // is not — and 0 is a value the reader can act on.
    const finding = conditionalWinnerFinding(withConditionalWinner(0.0004))
    const shown = finding.inspect.find((r) => r.label === 'Split value')!.value
    expect(shown).not.toBe('0')
    expect(Number(shown)).toBeCloseTo(0.0004, 6)
  })

  it('keeps the producer unit alongside the rounded value', () => {
    // Guards the fix against silently swallowing the unit while rounding.
    const finding = conditionalWinnerFinding(
      withConditionalWinner(0.3007492161730507, { splitUnit: '%' }),
    )
    expect(finding.implication).toContain('0.3 %')
  })
})

// ── 2. THE DEAD "COULD CHANGE IF" ACTION ────────────────────────────────────

describe('"Could change if" advertises an action only when it can honour one', () => {
  it('renders the condition as PLAIN TEXT when the producer sent no focus target', () => {
    // `node_id: ''` is what `useResultsSectionData` writes when the producer
    // omitted the field — the reachable state, not a synthetic one.
    const vm = vmOf(glanceWithCondition(''))
    expect(vm.atAGlance.condition, 'precondition: a condition IS rendered').not.toBeNull()
    expect(
      vm.atAGlance.condition!.targetId,
      'precondition: and it carries no target',
    ).toBeNull()

    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={vm.atAGlance} onFocusTarget={vi.fn()} />)

    const row = screen.getByTestId('analysis-new-glance-condition')
    expect(row).toHaveTextContent('Could change if')
    // The identity assertion: the row exists, the AFFORDANCE does not.
    expect(screen.queryByTestId('analysis-new-glance-condition-focus')).toBeNull()
    expect(row.tagName).not.toBe('BUTTON')
    expect(row.querySelector('button')).toBeNull()
  })

  it('KEEPS the affordance, and honours it, when the producer DID send a target', () => {
    // The discriminating twin. Without it, deleting the affordance outright
    // would satisfy the case above and silently remove a working action.
    const vm = vmOf(glanceWithCondition('node_costsave'))
    expect(vm.atAGlance.condition!.targetId).toBe('node_costsave')

    const onFocusTarget = vi.fn()
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={vm.atAGlance} onFocusTarget={onFocusTarget} />)

    const focus = screen.getByTestId('analysis-new-glance-condition-focus')
    expect(focus.tagName).toBe('BUTTON')
    fireEvent.click(focus)
    expect(onFocusTarget).toHaveBeenCalledTimes(1)
    expect(onFocusTarget).toHaveBeenCalledWith('node_costsave')
  })

  it('renders plain text when the HOST passes no focus handler at all', () => {
    // The second reachable arm of the same gate — a target the surface holds
    // but no handler to spend it on is still an action it cannot honour.
    const vm = vmOf(glanceWithCondition('node_costsave'))
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={vm.atAGlance} />)

    const row = screen.getByTestId('analysis-new-glance-condition')
    expect(row).toHaveTextContent('Could change if')
    // ⚠ The tagName assertion is what makes this bite at pristine. Asserting
    // only the absence of the focus testid would pass on the DEFECTIVE build
    // too — the testid does not exist there either — i.e. a guard agreeing
    // with itself (CLAUDE.md trap 13b).
    expect(row.tagName).not.toBe('BUTTON')
    expect(screen.queryByTestId('analysis-new-glance-condition-focus')).toBeNull()
  })
})

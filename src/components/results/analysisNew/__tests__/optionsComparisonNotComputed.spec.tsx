/**
 * Analysis (New) — "How the options compare" tells the truth about an option
 * the analysis RAN ON and could not compute, and the TWO TABS AGREE.
 *
 * ## Why this file exists beside `OptionCards.notComputed.spec.tsx`
 *
 * Two surfaces render the same options from the same `allOptions` array, and
 * they used to reach that array through two independently-written branch
 * ladders. The estate's own record of what happens then is explicit: one lane
 * fixes a surface, its neighbour keeps the defect, and both suites stay green
 * because each is correct in isolation (CLAUDE.md trap 21). So the last describe
 * block below asserts the two tabs make the SAME call on the SAME option list,
 * driven through both real builders — not that each is individually plausible.
 *
 * ## TWO DIRECTIONS (trap 22b), each with its twin in the same view model
 *
 *   · SUPPRESSION — a `'failed'` option must produce a `kind: 'not_computed'`
 *     row with NO `winReadout` and NO `winFraction`, so no renderer can
 *     coalesce its finite `0` into a `0%` and a zero-width bar.
 *   · SURVIVAL — a `'computed'` option with a genuine `0.0`, a `'partial'`
 *     option, and an option with an ABSENT status must ALL stay `kind:
 *     'analysed'` and keep their readouts.
 *
 * ## And the row must not be readable as the OTHER numberless state
 *
 * `'not_analysed'` says the option was left OUT of the comparison, attributing
 * the gap to the user's configuration. On an option the analysis ran on, that is
 * false and blames the wrong party. The badge and the reason line carry DISTINCT
 * testids for exactly this reason: a spec must not be able to pass by finding
 * the other state's sentence.
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
import { OptionsComparison } from '../sections/OptionsComparison'
import { NOT_ANALYSED_BADGE, NOT_COMPUTED_BADGE } from '../../utils/notAnalysedCopy'
import { optionComputationFailed } from '../../utils/notAnalysedOptions'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'
import type { OptionsComparisonSection, ComparisonOption } from '../analysisNewTypes'
import type { OptionResult } from '../../types'

const FAILED = 'opt-failed'
const TRUE_ZERO = 'opt-true-zero'
const HEALTHY = 'opt-healthy'
const PARTIAL = 'opt-partial'
const LEGACY = 'opt-legacy'
const NOT_ANALYSED = 'opt-not-analysed'

function option(id: string, overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id,
    label: `Label ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability: 0.4,
    nValidSamples: 10000,
    computeStatus: 'computed',
    ...overrides,
  }
}

/**
 * The full field, one option per class the producer can put on the wire.
 *
 * ⚠ `FAILED` and `TRUE_ZERO` carry the SAME `winProbability: 0` deliberately.
 * They are separated ONLY by the producer's status, so a predicate that keyed
 * on the number instead of on the classification would treat them identically —
 * and every assertion here binds by id, never by value (trap 19).
 */
const FIELD: OptionResult[] = [
  option(HEALTHY, { winProbability: 0.6 }),
  option(TRUE_ZERO, { winProbability: 0 }),
  option(PARTIAL, { winProbability: 0.25, computeStatus: 'partial', nValidSamples: 4000 }),
  (() => {
    const legacy = option(LEGACY, { winProbability: 0.3 })
    delete (legacy as { computeStatus?: unknown }).computeStatus
    return legacy
  })(),
  {
    id: FAILED,
    label: 'Migrate to Salesforce',
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    // FINITE, not absent — PLoT emits `win_probability` whenever `prob01(...)`
    // accepts the value, and `0` is in `[0, 1]`. The absence rules on this
    // surface cannot reach it, which is the whole reason the status has to be
    // carried.
    winProbability: 0,
    computeStatus: 'failed',
  },
  {
    id: NOT_ANALYSED,
    label: 'Never configured',
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
  },
]

/**
 * Drives the REAL view-model builder over the estate's own `makeData` fixture —
 * not a hand-shaped section object — so a branch that never fires shows up here
 * rather than being papered over by a fixture that already carries the right
 * `kind`.
 */
function buildRows(options: OptionResult[]): ComparisonOption[] {
  return buildAnalysisNewViewModel({
    data: makeData({ recommendation: { allOptions: options } }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).optionsComparison.rows
}

function section(rows: ComparisonOption[]): OptionsComparisonSection {
  return { rows, totalCount: rows.length }
}

/**
 * `SectionShell` is collapsed by default (`defaultOpen = false`), so the rows
 * are not in the DOM until the toggle is clicked. Asserting an ABSENCE against a
 * closed section would pass for the wrong reason — trap 13's shape, one
 * interaction along — so every render assertion below opens it first, and the
 * contrast controls in the same render prove it opened.
 */
function openSection() {
  fireEvent.click(screen.getByTestId('analysis-new-options-toggle'))
}

afterEach(() => cleanup())

describe('Analysis (New) view model — the two directions', () => {
  it('drove a NON-ZERO, expected number of rows through the real builder', () => {
    // The positive control for every assertion below: an empty `rows` would make
    // each `find(...)` return undefined and each absence assertion vacuous.
    const rows = buildRows(FIELD)
    expect(rows).toHaveLength(6)
  })

  it('SUPPRESSION — the failed option becomes `not_computed`, with no share to render', () => {
    const rows = buildRows(FIELD)
    const row = rows.find((r) => r.id === FAILED)
    expect(row?.kind).toBe('not_computed')
    // ⭐ THE SHAPE IS THE ENFORCEMENT. `winReadout` and `winFraction` do not
    // EXIST on this member, so no renderer can coalesce them into a `0%` and a
    // zero-width bar. A nullable field would put that rule in every renderer's
    // hands; the union puts it in the compiler's.
    expect(row).not.toHaveProperty('winReadout')
    expect(row).not.toHaveProperty('winFraction')
  })

  it('SUPPRESSION — and it is NOT re-badged as the other numberless state', () => {
    const rows = buildRows(FIELD)
    expect(rows.find((r) => r.id === FAILED)?.kind).toBe('not_computed')
    // The CONTRAST CONTROL: the genuinely unconfigured option in the SAME build
    // still resolves to `not_analysed`. Without it, a builder that emitted
    // `not_computed` for everything would pass the line above.
    expect(rows.find((r) => r.id === NOT_ANALYSED)?.kind).toBe('not_analysed')
  })

  it('SURVIVAL — computed-with-a-genuine-zero, partial and absent-status all stay `analysed`', () => {
    const rows = buildRows(FIELD)
    for (const id of [HEALTHY, TRUE_ZERO, PARTIAL, LEGACY]) {
      const row = rows.find((r) => r.id === id)
      expect(row?.kind, `${id} must stay analysed`).toBe('analysed')
    }
    // And the genuine zero keeps a real readout rather than being blanked —
    // `"<0.01%"` at n=10,000, the resolution-aware render that a fabricated `0%`
    // was previously indistinguishable from.
    const trueZero = rows.find((r) => r.id === TRUE_ZERO)
    expect(trueZero?.kind === 'analysed' ? trueZero.winReadout : null).toBe('<0.01%')
    expect(trueZero?.kind === 'analysed' ? trueZero.winFraction : null).toBe(0)
  })

  it('carries the producer’s reason verbatim when it sent one, appended to the sanctioned sentence', () => {
    const rows = buildRows([
      option(HEALTHY),
      { ...FIELD[4], computeStatusReason: 'Blocked by: DEGENERATE_DISTRIBUTION' },
    ])
    const row = rows.find((r) => r.id === FAILED)
    const copy = row?.kind === 'not_computed' ? row.reasonCopy : ''
    expect(copy).toContain('not a verdict on the option')
    expect(copy).toContain('Blocked by: DEGENERATE_DISTRIBUTION')
  })
})

describe('Analysis (New) render — the row says which numberless state it is', () => {
  it('renders the NOT-COMPUTED badge and reason, and not the NOT-ANALYSED ones', () => {
    const rows = buildRows(FIELD)
    render(<OptionsComparison options={section(rows)} />)
    openSection()
    const testId = 'analysis-new-options'
    expect(screen.getByTestId(`${testId}-not-computed-badge`)).toHaveTextContent(
      NOT_COMPUTED_BADGE,
    )
    const reason = screen.getByTestId(`${testId}-not-computed-reason`)
    expect(reason).toHaveTextContent('ran on this option')
    expect(reason).toHaveTextContent('not a verdict on the option')
    // CONTRAST CONTROL, same render: the genuinely unconfigured option still
    // gets its own badge and sentence, so this is not a suite that has stopped
    // seeing badges.
    expect(screen.getByTestId(`${testId}-not-analysed-badge`)).toHaveTextContent(
      NOT_ANALYSED_BADGE,
    )
    expect(screen.getByTestId(`${testId}-not-analysed-reason`)).toBeInTheDocument()
  })

  it('renders NO bar and NO win readout on the not-computed row', () => {
    const rows = buildRows([option(HEALTHY, { winProbability: 0.6 }), FIELD[4]])
    render(<OptionsComparison options={section(rows)} />)
    openSection()
    const failedRow = screen
      .getAllByTestId('analysis-new-options-row')
      .find((li) => li.getAttribute('data-option-id') === FAILED)
    expect(failedRow?.getAttribute('data-option-kind')).toBe('not_computed')
    expect(failedRow?.querySelector('[data-testid="analysis-new-options-bar"]')).toBeNull()
    expect(failedRow?.querySelector('[data-testid="analysis-new-options-win"]')).toBeNull()
    // CONTRAST CONTROL: the healthy sibling in the same render DOES have both.
    const healthyRow = screen
      .getAllByTestId('analysis-new-options-row')
      .find((li) => li.getAttribute('data-option-id') === HEALTHY)
    expect(healthyRow?.querySelector('[data-testid="analysis-new-options-bar"]')).not.toBeNull()
    expect(healthyRow?.querySelector('[data-testid="analysis-new-options-win"]')).not.toBeNull()
  })
})

describe('CROSS-TAB — the two surfaces cannot disagree about which options carry a share', () => {
  it('the Analysis (New) row kinds match the predicate OptionCards forks on', () => {
    // ⭐ ONE PREDICATE, TWO SURFACES. Asserting each tab is individually
    // plausible is exactly how one lane fixes a surface and its neighbour keeps
    // the defect while both suites stay green. This binds them to each other.
    const rows = buildRows(FIELD)
    const viewModelSaysNotComputed = new Set(
      rows.filter((r) => r.kind === 'not_computed').map((r) => r.id),
    )
    const predicateSaysFailed = new Set(
      FIELD.filter((o) => optionComputationFailed(o.computeStatus)).map((o) => o.id),
    )
    expect(viewModelSaysNotComputed).toEqual(predicateSaysFailed)
    // ...and on TRUE, not on two empty sets. Both sides agreeing on "nothing is
    // failed" would satisfy the line above while the whole feature was inert
    // (trap 13b).
    expect(predicateSaysFailed).toEqual(new Set([FAILED]))
  })
})

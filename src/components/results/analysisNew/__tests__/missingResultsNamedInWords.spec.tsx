/**
 * "Not included in this result" names results in words, never producer keys.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The row directly above "Model gaps the analysis worked around" rendered
 *
 *     Not included in this result   win_probability, sensitivity
 *
 * — `MissingFieldKey` tokens straight from `deriveResultCompleteness`, on the
 * surface whose job is to make a chain of reasoning trustworthy. Renaming the
 * LABEL (this PR's first pass) left the VALUE as plumbing, so the row still
 * leaked the machine's vocabulary one line above the row that was being fixed
 * for exactly that.
 *
 * ── WHY THIS IS NOT NEW MACHINERY ──────────────────────────────────────────
 * `ANALYSIS_NEW_COPY.status.missingResultLabels` already maps these keys to
 * human phrases and is already used by `buildStatus`. The row simply was not
 * calling it. The expectations below are DERIVED from that map rather than
 * restating its sentences, so a reword of the copy cannot leave this spec
 * certifying a string the product no longer says.
 *
 * ── THE UNMAPPED KEY IS THE OTHER DIRECTION, AND IT IS DELIBERATE ───────────
 * `recommendation_stability` is absent from the map ON PURPOSE: PLoT withholds
 * the field because ISL derives it as the leader's win probability relabelled,
 * carrying zero independent information (`withheldFieldReadBan.spec.ts`).
 * `deriveResultCompleteness` DOES add the key — always alongside
 * `robustness_level`, in one branch (`useResultCompleteness.ts:222-225`) — so
 * the unknown-key drop is load-bearing, not decorative. The same ruling is
 * already written into `buildStatus`: an unrecognised name on screen is worse
 * than the generic sentence it would replace.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { DeeperAnalysis } from '../sections/DeeperAnalysis'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { makeData } from './analysisNewFixtures'
import type { MissingFieldKey, ResultCompleteness } from '../../useResultCompleteness'

const ROW_LABEL = 'Not included in this result'
const GROUP_TITLE = 'What this run covered'

const deeperOf = (missing: MissingFieldKey[]) =>
  buildAnalysisNewViewModel({
    data: makeData({
      completeness: { status: 'partial', missing, reasons: [] } as ResultCompleteness,
    }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
  }).deeper

const coverageGroup = (missing: MissingFieldKey[]) =>
  deeperOf(missing).groups.find((g) => g.title === GROUP_TITLE)

const missingRow = (missing: MissingFieldKey[]) =>
  coverageGroup(missing)?.rows.find((r) => r.label === ROW_LABEL)

/** A producer field key: lower snake_case. Neither the gap-code regex nor
 *  `WAVE-A-COPY-SPEC`'s `/^[A-Z][A-Z0-9_]{6,}$/` can see this shape, which is
 *  why the row survived the first pass. */
const PRODUCER_KEY = /[a-z0-9]+_[a-z0-9]+/

describe('"Not included in this result" names results in words', () => {
  it('CONTROL: the probe can SEE a producer key when one is rendered', () => {
    // Points the detector at a raw key directly. Without this, every assertion
    // below could pass because the detector never matches anything.
    expect(PRODUCER_KEY.test('win_probability, sensitivity')).toBe(true)
    expect(PRODUCER_KEY.test('the win share, the sensitivity check')).toBe(false)
  })

  it('PRECONDITION: the fixture really does produce this row', () => {
    // Binds by identity — the group and the row must both exist, or every
    // assertion below is vacuously true about a row that never rendered.
    const group = coverageGroup(['win_probability', 'sensitivity'])
    expect(group, 'fixture must produce the coverage group').toBeTruthy()
    expect(missingRow(['win_probability', 'sensitivity']), 'fixture must produce the row').toBeTruthy()
  })

  it('renders no producer field key', () => {
    const row = missingRow(['win_probability', 'sensitivity'])!
    expect(row.value, `producer keys on screen: ${row.value}`).not.toMatch(PRODUCER_KEY)
  })

  it('renders the humanised phrase for every mapped key — derived from the copy map', () => {
    const keys: MissingFieldKey[] = ['win_probability', 'expected_outcome', 'sensitivity', 'top_drivers']
    const row = missingRow(keys)!
    for (const k of keys) {
      const phrase = COPY.status.missingResultLabels[k]
      expect(phrase, `copy map must carry ${k}`).toBeTruthy()
      expect(row.value).toContain(phrase)
    }
  })

  it('TWIN: a key with no human phrase drops out — the row goes rather than leaking', () => {
    // The opposite direction. `recommendation_stability` is deliberately
    // unmapped; if it were the ONLY missing key the row must not render at all,
    // rather than render an empty value or the raw token.
    expect(COPY.status.missingResultLabels.recommendation_stability).toBeUndefined()
    expect(missingRow(['recommendation_stability'])).toBeUndefined()
  })

  it('TWIN: an unmapped key alongside a mapped one leaves the mapped phrase alone', () => {
    // The pairing `deriveResultCompleteness` actually emits — both keys added
    // in one branch. The row must name the robustness check once and say
    // nothing about the withheld field.
    const row = missingRow(['robustness_level', 'recommendation_stability'])!
    expect(row.value).toBe(COPY.status.missingResultLabels.robustness_level)
    expect(row.value).not.toContain('recommendation_stability')
  })

  it('DISCRIMINATOR: the sibling coverage rows are untouched', () => {
    // If a change ever blanket-dropped or rewrote this group, this REDs while
    // the assertions above would stay green on an empty group.
    const group = coverageGroup(['win_probability'])!
    const completeness = group.rows.find((r) => r.label === 'Result completeness')
    expect(completeness?.value).toBe('partial')
  })

  it('END TO END: no producer key reaches the rendered DOM for this row', () => {
    cleanup()
    render(<DeeperAnalysis deeper={deeperOf(['win_probability', 'sensitivity'])} />)
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    const terms = Array.from(screen.getAllByRole('term'))
    const term = terms.find((n) => (n.textContent ?? '').trim() === ROW_LABEL)
    expect(term, 'the row must be on screen').toBeTruthy()
    const value = (term!.nextElementSibling?.textContent ?? '').trim()
    expect(value.length, 'the row must have a value').toBeGreaterThan(0)
    expect(value, `producer keys on screen: ${value}`).not.toMatch(PRODUCER_KEY)
  })
})

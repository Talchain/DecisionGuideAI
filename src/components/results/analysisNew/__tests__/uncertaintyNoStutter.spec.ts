/**
 * UNCERTAINTY ROWS — THE SENTENCE APPEARS EXACTLY ONCE.
 *
 * ## The defect, measured — not imagined
 *
 * Witnessed on deployed `19fe8710`, in "Uncertainty and gaps". Two of the three
 * rows printed their own sentence TWICE, once cut off mid-clause:
 *
 *     If "Operational Overhead Burden → Operational Overhead Exceeds Team
 *     Capacity"…
 *     If "Operational Overhead Burden → Operational Overhead Exceeds Team
 *     Capacity" changes significantly, "RudderStack" could become the better
 *     choice
 *
 * A cut prefix of the body is not a label; it is the body said badly. And it sat
 * directly under a sibling row that does it correctly — one section running two
 * title conventions, which is Paul's "such a lack of consistency in the design"
 * made concrete.
 *
 * ## What this corpus establishes
 *
 * The rule, in one sentence: THE SENTENCE APPEARS AS THE LABEL WHEN IT IS SHORT
 * ENOUGH TO BE ONE, AND AS THE BODY OTHERWISE — never as both, never cut.
 *
 * ## ⚠ THE DISCRIMINATING PAIR
 *
 * A threshold row and a non-threshold row take DIFFERENT branches and must be
 * pinned together. A guard that only proved "no row stutters" would be
 * satisfied by deleting every label on the surface, including the producer-
 * supplied one that is not a prefix of anything and must survive.
 */

import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'
import { manyFragileEdges } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { UncertaintyItem } from '../../types'

const uncertaintyRows = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).uncertainty.findings

const withUncertainties = (uncertainties: UncertaintyItem[]) =>
  makeData({ confidence: { evidenceGapsAssessed: true, uncertainties } })

/**
 * ⚠⚠ THE ELLIPSIS IS WHY THE OBVIOUS ASSERTION CANNOT SEE THIS DEFECT — and the
 * first draft of this file shipped that mistake, caught by its own mutant.
 *
 * `truncateAtWordBoundary` appends `'…'` (`src/utils/text.ts:24`), so the cut
 * headline is NOT a string prefix of the body: `body.startsWith(headline)` is
 * FALSE for exactly the rows that stutter. A guard written that way passes on
 * the defect it was written to catch — trap 13b, a guard agreeing with itself —
 * and mutant `M3_restore_truncated_headline` proved it by leaving this file's
 * corpus test GREEN with the truncation restored.
 *
 * So the suffix is stripped before the comparison. The predicate is the one a
 * READER applies: with the "there is more" marker taken off, does the label just
 * repeat the opening of the sentence underneath it?
 */
function isPrefixLabel(row: { headline: string; implication: string }): boolean {
  if (row.headline === '' || row.implication === '') return false
  const label = row.headline.replace(/…$/, '')
  return label.length > 0 && row.implication.startsWith(label)
}

/** The measured sentence, at its measured length. */
const LONG_SENTENCE =
  'If "Operational Overhead Burden → Operational Overhead Exceeds Team Capacity" changes significantly, "RudderStack" could become the better choice'

describe('an uncertainty row never says its own sentence twice', () => {
  it('⭐ the long non-threshold row carries NO label, and the FULL sentence survives', () => {
    const rows = uncertaintyRows(
      withUncertainties([
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: LONG_SENTENCE,
          displayText: LONG_SENTENCE,
          suggestion: 'Review this assumption',
          affectedNodes: ['n_overhead', 'n_capacity'],
        },
      ]),
    )

    expect(rows).toHaveLength(1)
    const row = rows[0]

    // The finding is the sentence. It must be present, WHOLE, and unabridged —
    // this is the assertion the whole fix exists to keep true.
    expect(row.implication).toBe(LONG_SENTENCE)
    // And it must not also appear, cut, as a label above itself.
    expect(row.headline).toBe('')
    expect(isPrefixLabel(row)).toBe(false)
  })

  it('⭐ THE OTHER HALF: a THRESHOLD row keeps its producer-supplied label AND its body', () => {
    const rows = uncertaintyRows(
      withUncertainties([
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: LONG_SENTENCE,
          displayText: LONG_SENTENCE,
          affectedNodes: ['n_overhead'],
          threshold: {
            variable: 'Operational Overhead Burden',
            direction: 'negative',
            value: 0.42,
          },
        } as UncertaintyItem,
      ]),
    )

    expect(rows).toHaveLength(1)
    // A real label — the producer's own variable name, not a prefix of the body.
    expect(rows[0].headline).toBe('Operational Overhead Burden could tip the result')
    expect(rows[0].implication).toBe(LONG_SENTENCE)
    // ⚠ AND IT IS GENUINELY NOT A PREFIX — the property that makes this branch
    // legitimate while the truncated one was not.
    expect(rows[0].implication.startsWith(rows[0].headline)).toBe(false)
  })

  it('a SHORT sentence stays in the label slot with an empty body — unchanged behaviour', () => {
    const short = 'Demand may be seasonal.'
    const rows = uncertaintyRows(
      withUncertainties([
        { code: 'GRAPH_DENSE', message: short, displayText: short },
      ]),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].headline).toBe(short)
    expect(rows[0].implication).toBe('')
  })

  it('NO row on the measured fixture renders a headline that is a prefix of its own body', () => {
    // `manyFragileEdges` is the fixture that reproduces the deployed shape.
    const rows = uncertaintyRows(manyFragileEdges())
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      if (row.headline === '' || row.implication === '') continue
      expect(
        isPrefixLabel(row),
        `row "${row.id}" repeats its label at the head of its body`,
      ).toBe(false)
    }
  })
})

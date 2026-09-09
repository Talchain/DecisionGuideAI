/**
 * ⭐⭐ THE PANEL SAID A CHECK DID NOT COME BACK, FOUR ROWS ABOVE A NUMBER
 * COMPUTED FROM THAT CHECK.
 *
 * WITNESSED on deployed staging `219cbe19`, on a live fresh journey — guest
 * session, saved example re-drafted live, analysis complete at 03:41:29Z. On
 * screen, four lines apart:
 *
 *   "This analysis is partial — the win share and the robustness check did not
 *    come back."
 *   …and the confidence line: "13 fragile edges, 0 robust edges"
 *
 * The report carried `robustness.fragile_edges` **13**, `robust_edges` 0,
 * `edge_e_values` 7. **The check ran, and its output was on screen.**
 *
 * ⚠ THE PREDICATE IS RIGHT AND ONLY THE WORD WAS WRONG, which is why nothing
 * about the completeness logic changes here. `useResultCompleteness` adds
 * `robustness_level` when `robustness.level` and
 * `robustness.recommendation_stability` are BOTH absent, and its own comment
 * gives the reason: "when both are absent, the rendered robustness state is
 * fabricated." That check is correct and stays. What was absent is the
 * summarising RATING, not the check.
 *
 * The key was always precise. Only the label over-claimed.
 */
import { describe, it, expect } from 'vitest'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

describe('a missing result is named as the thing that is missing', () => {
  it('⭐ the label names the RATING, not the check that produced it', () => {
    const label = COPY.status.missingResultLabels.robustness_level
    expect(label).toBe('the overall robustness rating')
    // Bound to the CLAIM rather than only to the string: whatever the wording
    // becomes, it must not tell the reader the CHECK did not happen when the
    // check's edge-level output is rendered beside it.
    expect(label).not.toContain('robustness check')
  })

  it('⛔ THE KEY IT IS MAPPED FROM WAS ALWAYS PRECISE — this pins the asymmetry', () => {
    // The defect was never in the completeness logic, and a future reader
    // should not "fix" that instead. `robustness_level` names a level.
    expect(Object.keys(COPY.status.missingResultLabels)).toContain('robustness_level')
  })

  it('⛔ AND THE SENTENCE READS CORRECTLY IN BOTH ARITIES', () => {
    expect(COPY.status.provisionalNaming(['the overall robustness rating'])).toBe(
      'This analysis is partial — the overall robustness rating did not come back.',
    )
    expect(
      COPY.status.provisionalNaming(['the win share', 'the overall robustness rating']),
    ).toBe(
      'This analysis is partial — the win share and the overall robustness rating did not come back.',
    )
  })

  it('⛔ "From the robustness check." IS A DIFFERENT QUESTION AND MUST SURVIVE', () => {
    // A finding's `sourceLine` names where the finding CAME FROM, which is true
    // and unaffected. Two questions under similar words (trap 21): "what did not
    // arrive?" and "where did this finding come from?". A bulk rename of the
    // phrase would have destroyed the second while fixing the first.
    const labels = Object.values(COPY.status.missingResultLabels)
    expect(labels).not.toContain('From the robustness check.')
    // CONTRAST CONTROL: the map really is populated, so the assertion above is
    // an absence in a non-empty set rather than a vacuous pass.
    expect(labels.length).toBeGreaterThan(3)
    expect(labels).toContain('the win share')
  })
})

/**
 * SURFACE A OF THE LIVE LEADER CONTRADICTION — the act-on-it fragile row.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WITNESSED, NOT INFERRED
 * ═══════════════════════════════════════════════════════════════════════════
 * On deployed staging, a fresh typed brief produced an auto-run analysis whose
 * Analysis tab rendered this row's reason VERBATIM —
 *
 *   "If the estimate changes for Technical Leadership Capacity, the leading
 *    option could change."
 *
 * — a few lines above the same panel's checks footer saying "Leading option
 * not assessed". The row consulted the leader authority ZERO times.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS SPEC LIVES HERE AND NOT WITH ITS TWO SIBLINGS
 * ═══════════════════════════════════════════════════════════════════════════
 * The other two sites are in `TriageActionCardsBody`, and their spec is
 * `results/__tests__/analysisClaimPolicy.leaderContradiction.spec.tsx` — which
 * also owns the composed-panel arm and the claim-policy lattice table.
 *
 * They are apart because `analysis-hero/__tests__/inertness.spec.ts` enforces
 * that ONLY `ResultsBody` may import anything under `analysis-hero/`, and it
 * caught the first draft of this work importing `rankActOnItRows` from the
 * results-side spec. The boundary is real, so the specs split rather than the
 * allow-list widening; the FIXTURE is shared (`__fixtures__/leaderClaim`), so
 * both halves describe the same run.
 *
 * ⚠ AND THE REASON THAT GUARD WAS MISSED LOCALLY, worth recording: the
 * pre-push sweep for affected specs grepped for the SYMBOLS this change
 * touches (`TriageActionCardsBody`, `rankActOnItRows`, `analysisClaimPolicy`).
 * `inertness.spec.ts` names none of them — it is keyed on PATHS. A structural
 * guard is invisible to a symbol grep.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOTH DIRECTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 * One control cannot cover two opposite defects. The withheld arm has a
 * `comparative_leader` twin asserting the sentence still appears verbatim, and
 * a DATA-SURVIVES arm asserting the finding itself is untouched —
 * over-suppression is a worse product than the contradiction.
 */
import { describe, expect, it } from 'vitest'
import { rankActOnItRows } from '../rankActOnItRows'
import {
  FACTOR_ID,
  FACTOR_LABEL,
  LEADER_CLAIM_RE,
  PERMITTED,
  WITHHELD,
} from '../../../__fixtures__/leaderClaim.fixtures'
import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'

/** The fragile-edge row's generated reason, located by IDENTITY (its key). */
function fragileRowReason(data: ResultsSectionDataReturn): string {
  const row = rankActOnItRows(data, { readyToBrief: false })
    .find((r) => r.key === `risk-${FACTOR_ID}`)
  expect(row, 'the fragile-edge row was never built — this arm would be vacuous')
    .toBeDefined()
  return row!.reason
}

describe('SURFACE A — the act-on-it fragile row honours the leader claim policy', () => {
  it('ANTI-VACUITY: the PERMITTED run emits the witnessed sentence verbatim', () => {
    expect(fragileRowReason(PERMITTED())).toBe(
      `If the estimate changes for ${FACTOR_LABEL}, the leading option could change.`,
    )
  })

  it('WITHHELD: the row names no leader', () => {
    expect(fragileRowReason(WITHHELD())).not.toMatch(LEADER_CLAIM_RE)
  })

  it('WITHHELD DATA SURVIVES: the factor and the finding are still there', () => {
    // The CLAIM goes, the FINDING stays. A fix that dropped the row, or
    // stopped naming the factor, would be the over-suppression defect.
    const reason = fragileRowReason(WITHHELD())
    expect(reason).toContain(FACTOR_LABEL)
    expect(reason).toContain('could change')
  })

  it('the row itself is built on BOTH arms — only its copy differs', () => {
    // Binds the two arms to the same object by key, so a suppression that
    // silently dropped the row could not pass the absence assertion above.
    const key = `risk-${FACTOR_ID}`
    for (const data of [WITHHELD(), PERMITTED()]) {
      const rows = rankActOnItRows(data, { readyToBrief: false })
      expect(rows.map((r) => r.key)).toContain(key)
      const row = rows.find((r) => r.key === key)!
      expect(row.category).toBe('risk')
      expect(row.targetNodeId).toBe(FACTOR_ID)
    }
  })
})

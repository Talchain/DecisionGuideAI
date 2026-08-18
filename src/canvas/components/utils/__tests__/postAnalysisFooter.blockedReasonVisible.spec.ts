/**
 * A disabled Rerun must say why, in text, not in a `title`.
 *
 * ── Derived at the DEPLOYED surface, staging `c71ea7e0` ────────────────────
 * `results-analysis-footer-action` rendered `disabled` with
 *   title="Olumi is not able to run this yet. Ask in the chat and it will
 *          explain what is missing."
 * and NOTHING else. The visible footer read:
 *   "Stable ranking | this result held up under the changes we tested | Rerun"
 * — a reassurance beside an unpressable control, with the reason reachable
 * only by hovering a mouse over it. On touch it is unreachable entirely.
 *
 * The blocked reason therefore LEADS the meta line, and is ADDED rather than
 * substituted: "held up under the changes we tested" answers a different
 * question and is still true.
 */

import { describe, it, expect } from 'vitest'
import { derivePostFooterMeta } from '../postAnalysisFooter'

const REASON = 'Olumi is not able to run this yet. Ask in the chat and it will explain what is missing.'
const VERDICT_REASON = 'this result held up under the changes we tested'

describe('derivePostFooterMeta — the blocked reason is visible', () => {
  it('POSITIVE CONTROL: the probe can see the pre-existing meta content', () => {
    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: VERDICT_REASON,
      reviewCards: [],
    })
    expect(meta).toContain(VERDICT_REASON)
  })

  it('blocked → the reason appears in the meta TEXT', () => {
    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: VERDICT_REASON,
      reviewCards: [],
      blockedReason: REASON,
    })
    expect(meta).toContain(REASON)
  })

  it('and it LEADS — the actionable part is not buried behind the reassurance', () => {
    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: VERDICT_REASON,
      reviewCards: [],
      blockedReason: REASON,
    })!
    expect(meta.indexOf(REASON)).toBeLessThan(meta.indexOf(VERDICT_REASON))
  })

  it('and it does NOT replace the robustness reason — both claims survive', () => {
    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: VERDICT_REASON,
      reviewCards: [],
      blockedReason: REASON,
    })
    expect(meta).toContain(VERDICT_REASON)
  })

  it('DISCRIMINATING TWIN: not blocked → the meta is byte-identical to before', () => {
    const base = {
      robustnessVerdict: 'robust' as const,
      robustnessVerdictReason: VERDICT_REASON,
      reviewCards: [{ confidence: 80 }],
    }
    expect(derivePostFooterMeta({ ...base, blockedReason: null })).toBe(derivePostFooterMeta(base))
    expect(derivePostFooterMeta({ ...base, blockedReason: '   ' })).toBe(derivePostFooterMeta(base))
  })
})

/**
 * Post-analysis footer status + meta derivation.
 *
 * Pure function — extracted from OutputsDock so the verdict mapping and
 * evidence-gap meta logic can be tested in isolation without dragging in the
 * full OutputsDock dependency tree.
 *
 * Status (single-source robustness rule — see ROBUSTNESS-VERDICT-CONTRACT):
 * a positive/negative robustness verdict may ONLY come from the display-safe
 * `robustnessVerdict` (the same field that drives the certified
 * "Robustness unknown" glyph) — NEVER from raw `recommendation_stability` /
 * `ranking_stability`. The verdict is the producer's own
 * `robustness.display_verdict` (PLoT #202, consumed lane 35 fix 3),
 * normalised fail-closed upstream:
 *   - robustnessVerdict 'robust'                → success "Stable ranking"
 *   - robustnessVerdict 'moderate' | 'fragile'  → warning "Ranking sensitive to
 *     assumptions"
 *
 * ⭐ ROADMAP 2.580 member 3 — WHY THE LABELS NAME THE RANKING.
 *
 * The verdict is derived from `recommendation_stability`, which ISL declares
 * as "P(same recommendation across samples)" and reports as "{winner} wins in
 * {x:.0%} of sampled scenarios". What held is the ORDER, in a finite sample —
 * not "the result". Codex (5 Aug 2026) saw "Stable result" beside 19 sensitive
 * assumptions and zero stable edges, and the sensitive assumptions were
 * exactly the numbers that did not hold. The labels now say which claim is
 * being made; the mapping, the fail-closed allowlist and the verdict source
 * are untouched.
 *
 * ⚠ THE LEADING META SEGMENT IS STILL THE PRODUCER'S, VERBATIM. PLoT authors
 * "this result held up under the changes we tested"
 * (`src/routes/v2/robustness-display-verdict.ts:62`), and rewording a
 * producer-owned display phrase in the consumer is exactly the divergence this
 * file's single-source rule exists to prevent. That half is a PLoT patch spec,
 * not a UI change — see the PR body.
 *   - robustnessVerdict 'not_assessed'          → neutral "Robustness not assessed"
 *     (the producer's own stated absence — rendered as stated, not upgraded
 *     and not blurred into the UI's "unknown")
 *   - missing / undefined (older PLoT builds)   → neutral "Robustness unknown"
 *
 * Meta (F7 — display honesty): the raw `stability` number is NEVER rendered.
 * It is the legacy `recommendation_stability` field, which is in fact the
 * LEADER'S WIN PROBABILITY (see the field note where the hook populates it),
 * not a stability/robustness measure — so "{N}% stability" mislabelled a win
 * probability as stability. The numeric segment has been removed entirely
 * (previously it was gated to a determinate verdict; now it never renders).
 * Only the display-safe verdict/reason and the evidence-gap text survive:
 *   - the producer's `robustnessVerdictReason` — leading segment, VERBATIM
 *     (producer-owned display phrase; never authored in the UI, never shown
 *     without its verdict)
 *   - "Evidence gaps remain" — appended when any review-card confidence < 50%
 *   - "Evidence strong"      — appended when there are gaps AND none weak
 *   - omitted entirely when there are no review cards at all
 *
 * The Lucide icon is supplied by name (`'check' | 'warning' | 'unknown'`)
 * rather than as the icon component so this helper has no React import.
 * The caller maps the name back to a `LucideIcon`.
 */

import type { RobustnessDisplayVerdict } from '@/components/results/types'

export type PostFooterIcon = 'check' | 'warning' | 'unknown'

export interface PostFooterStatus {
  icon: PostFooterIcon
  iconClass: string
  label: string
}

export interface PostFooterMetaInput {
  stability: number | null | undefined
  /**
   * The SAME display-safe verdict that drives `derivePostFooterStatus`.
   * Gates the "{N}% stability" segment: without a determinate verdict the
   * footer status is "Robustness unknown"/"Robustness not assessed", and a
   * raw stability percentage beside it would contradict that admission — so
   * the segment is suppressed unless the verdict is 'robust' | 'moderate' |
   * 'fragile'. Runtime-safe like the status: anything other than the exact
   * enum values suppresses.
   */
  robustnessVerdict: RobustnessDisplayVerdict | null | undefined
  /**
   * The producer's own display reason for the verdict
   * (`robustness.display_verdict_reason`) — rendered VERBATIM as the leading
   * meta segment. Ignored when no verdict exists (the hook never populates
   * it without one, and this helper re-checks).
   */
  robustnessVerdictReason?: string | null
  /**
   * Subset of `ResultsSectionDataReturn.confidence.topEvidenceGaps` (or
   * `evidenceGaps`) — only the `confidence` field is needed for the
   * "Evidence gaps remain" decision.
   */
  reviewCards: ReadonlyArray<{ confidence?: number | null }>
}

/**
 * Derive the footer status from the display-safe robustness verdict ONLY.
 * Raw stability must never reach this function — it is surfaced separately as
 * neutral metadata via `derivePostFooterMeta`.
 *
 * RUNTIME-SAFE (allowlist, not catch-all): ONLY the known display-safe verdict
 * enum values produce a verdict. Type safety alone is not enough — if a raw
 * stability number (e.g. 0.87), a stringified number, or any other malformed
 * value accidentally reaches this helper at runtime, it must fall NEUTRAL,
 * never fabricate a "Ranking sensitive to assumptions"/"Stable ranking" claim from an
 * uncertified source. So the only branches that emit a verdict are the exact
 * enum matches; everything else (undefined, null, unknown string, number,
 * malformed) returns "Robustness unknown".
 */
export function derivePostFooterStatus(
  robustnessVerdict: RobustnessDisplayVerdict | null | undefined,
): PostFooterStatus {
  if (robustnessVerdict === 'robust') {
    return { icon: 'check', iconClass: 'text-success', label: 'Stable ranking' }
  }
  // Known display-safe sensitive verdicts → warning, mirroring the certified
  // glyph's "Sensitive" label. Explicit allowlist (NOT a non-robust
  // catch-all) so unexpected runtime values cannot reach this branch.
  if (robustnessVerdict === 'moderate' || robustnessVerdict === 'fragile') {
    return { icon: 'warning', iconClass: 'text-warning', label: 'Ranking sensitive to assumptions' }
  }
  // The producer explicitly said robustness was not assessed — state THAT,
  // verbatim in meaning, rather than the vaguer "unknown".
  if (robustnessVerdict === 'not_assessed') {
    return { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness not assessed' }
  }
  // undefined / null / unknown string / number / malformed → neutral.
  return { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' }
}

export function derivePostFooterMeta({
  // `stability` is intentionally NOT destructured/read — see the F7 note
  // below. It remains on `PostFooterMetaInput` for caller compatibility.
  robustnessVerdict,
  robustnessVerdictReason,
  reviewCards,
}: PostFooterMetaInput): string | null {
  // F7 (display honesty): the "{N}% stability" numeric segment is REMOVED.
  // `stability` here is the legacy `recommendation_stability` field, which
  // this file's own header comment documents is in fact the LEADER'S WIN
  // PROBABILITY, not a robustness/stability measure — so rendering it as
  // "{N}% stability" mislabels a win probability as stability (same doctrine
  // #407 applied to the Advanced receipts). Only the display-safe
  // verdict/reason and the evidence-gap text survive. The `stability` input
  // is retained on the interface for caller compatibility but no longer read.
  // Removal trigger: PLoT supplies a genuine numeric robustness/stability
  // field distinct from the win probability.
  const verdictKnown =
    robustnessVerdict === 'robust' ||
    robustnessVerdict === 'moderate' ||
    robustnessVerdict === 'fragile' ||
    robustnessVerdict === 'not_assessed'
  const evidenceWeak = reviewCards.some(g => typeof g.confidence === 'number' && g.confidence < 50)
  const evidenceText = reviewCards.length === 0
    ? null
    : (evidenceWeak ? 'Evidence gaps remain' : 'Evidence strong')
  const parts: string[] = []
  // Producer reason VERBATIM, first — but only beside a known verdict (never
  // render a robustness sentence the status line cannot vouch for).
  if (
    verdictKnown &&
    typeof robustnessVerdictReason === 'string' &&
    robustnessVerdictReason.trim() !== ''
  ) {
    parts.push(robustnessVerdictReason)
  }
  if (evidenceText) parts.push(evidenceText)
  return parts.length > 0 ? parts.join(' · ') : null
}

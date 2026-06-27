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
 * `ranking_stability`. No display-safe verdict exists in the contract today,
 * so `robustnessVerdict` is undefined and the footer stays NEUTRAL
 * ("Robustness unknown") — matching the glyph rather than contradicting it
 * with a green "Stable result" derived from raw stability.
 *   - robustnessVerdict 'high'                      → success "Stable result"
 *   - robustnessVerdict 'moderate' | 'low' | 'very_low' → warning "Sensitive to assumptions"
 *   - robustnessVerdict missing / undefined         → neutral "Robustness unknown"
 *
 * Meta (unchanged): raw stability is retained ONLY as neutral metadata
 * ("{N}% stability"), never as a verdict.
 *   - "{N}% stability" — appended when stability is finite
 *   - "Evidence gaps remain" — appended when any review-card confidence < 50%
 *   - "Evidence strong"      — appended when there are gaps AND none weak
 *   - omitted entirely when there are no review cards at all
 *
 * The Lucide icon is supplied by name (`'check' | 'warning' | 'unknown'`)
 * rather than as the icon component so this helper has no React import.
 * The caller maps the name back to a `LucideIcon`.
 */

import type { RobustnessLevel } from '@/components/results/types'

export type PostFooterIcon = 'check' | 'warning' | 'unknown'

export interface PostFooterStatus {
  icon: PostFooterIcon
  iconClass: string
  label: string
}

export interface PostFooterMetaInput {
  stability: number | null | undefined
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
 * neutral metadata via `derivePostFooterMeta`. With no display-safe verdict in
 * the contract today the verdict is undefined and the footer renders the
 * neutral "Robustness unknown" state, in lock-step with the certified glyph.
 *
 * RUNTIME-SAFE (allowlist, not catch-all): ONLY the known display-safe verdict
 * enum values produce a verdict. Type safety alone is not enough — if a raw
 * stability number (e.g. 0.87), a stringified number, or any other malformed
 * value accidentally reaches this helper at runtime, it must fall NEUTRAL,
 * never fabricate a "Sensitive to assumptions"/"Stable result" claim from an
 * uncertified source. So the only branches that emit a verdict are the exact
 * enum matches; everything else (undefined, null, unknown string, number,
 * malformed) returns "Robustness unknown".
 */
export function derivePostFooterStatus(
  robustnessVerdict: RobustnessLevel | null | undefined,
): PostFooterStatus {
  if (robustnessVerdict === 'high') {
    return { icon: 'check', iconClass: 'text-success', label: 'Stable result' }
  }
  // Known display-safe non-high verdicts → sensitive, mirroring the certified
  // glyph's "Sensitive" label. Explicit allowlist (NOT a non-high catch-all)
  // so unexpected runtime values cannot reach this positive-ish branch.
  if (
    robustnessVerdict === 'moderate' ||
    robustnessVerdict === 'low' ||
    robustnessVerdict === 'very_low'
  ) {
    return { icon: 'warning', iconClass: 'text-warning', label: 'Sensitive to assumptions' }
  }
  // undefined / null / unknown string / number / malformed → neutral.
  return { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' }
}

export function derivePostFooterMeta({ stability, reviewCards }: PostFooterMetaInput): string | null {
  const stabPct =
    typeof stability === 'number' && Number.isFinite(stability)
      ? Math.round(stability * 100)
      : null
  const evidenceWeak = reviewCards.some(g => typeof g.confidence === 'number' && g.confidence < 50)
  const evidenceText = reviewCards.length === 0
    ? null
    : (evidenceWeak ? 'Evidence gaps remain' : 'Evidence strong')
  const parts: string[] = []
  if (stabPct != null) parts.push(`${stabPct}% stability`)
  if (evidenceText) parts.push(evidenceText)
  return parts.length > 0 ? parts.join(' · ') : null
}

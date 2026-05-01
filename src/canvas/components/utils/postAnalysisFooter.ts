/**
 * Post-analysis footer status + meta derivation (Brief 5.8B D8).
 *
 * Pure function — extracted from OutputsDock so the wireframe-aligned
 * stability bands and evidence-gap meta logic can be tested in isolation
 * without dragging in the full OutputsDock dependency tree.
 *
 * Bands (per the wireframe + brief D8 step 1):
 *   - stability ≥ 0.85 → success "Stable result"
 *   - stability ≥ 0.60 → warning "Sensitive to assumptions"
 *   - stability < 0.60 → danger "Provisional result"
 *   - stability missing/non-finite → danger "Fragile result" fallback
 *
 * Meta (per brief D8 step 1):
 *   - "{N}% stability" — appended when stability is finite
 *   - "Evidence gaps remain" — appended when any review-card confidence < 50%
 *   - "Evidence strong"      — appended when there are gaps AND none weak
 *   - omitted entirely when there are no review cards at all
 *
 * The Lucide icon is supplied by name (`'check' | 'warning' | 'danger'`)
 * rather than as the icon component so this helper has no React import.
 * The caller maps the name back to a `LucideIcon`.
 */

export type PostFooterIcon = 'check' | 'warning' | 'danger'

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

export function derivePostFooterStatus(stability: number | null | undefined): PostFooterStatus {
  if (typeof stability !== 'number' || !Number.isFinite(stability)) {
    return { icon: 'danger', iconClass: 'text-danger', label: 'Fragile result' }
  }
  if (stability >= 0.85) {
    return { icon: 'check', iconClass: 'text-success', label: 'Stable result' }
  }
  if (stability >= 0.60) {
    return { icon: 'warning', iconClass: 'text-warning', label: 'Sensitive to assumptions' }
  }
  return { icon: 'danger', iconClass: 'text-danger', label: 'Provisional result' }
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

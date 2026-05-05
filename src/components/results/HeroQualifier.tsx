/**
 * HeroQualifier — Brief 5.8B D2a.
 *
 * Renders a one-line qualifier sentence under the post-analysis hero
 * headline when the lowest readiness dimension falls below 70%. Pure
 * threshold map over already-computed dimension scores (0..1) — no
 * inference. Dimension keys map to per-dimension copy templates; the
 * lowest sub-threshold dimension wins.
 *
 * Dimension audit (Brief 5.8B D2a, plan §pre-build dimension audit):
 *   The post-analysis data supplies a 3-dimension set
 *   {evidence, robustness, clarity} (Hook B line 1238–1250 of
 *   useResultsSectionData.ts). The wireframe pictures a 4-dimension set
 *   {Structure, Evidence, Coverage, Verified}. Per Paul's directive
 *   ("use whatever the data supplies — do not invent dimensions"), this
 *   component consumes the 3-dimension set as-is. The D9 final review
 *   documents the divergence between wireframe and shipping data.
 */

import type { ReactNode } from 'react'
import { typography } from '@/styles/typography'
import { completenessReasonCopy, freshnessReasonCopy } from './copy/freshnessReasons'

const QUALIFIER_THRESHOLD = 0.7

/**
 * Map of dimension key → qualifier copy emitted when that dimension is
 * the lowest sub-threshold value. Order does not affect correctness —
 * the consumer picks the lowest dimension regardless.
 */
const QUALIFIER_COPY: Record<string, string> = {
  evidence: 'Confidence limited by unverified estimates',
  robustness: 'Result is sensitive to assumption shifts',
  clarity: 'Model framing has limitations',
  // Wireframe-aliased keys — present so callers using "Structure / Coverage /
  // Verified" labels can pass through cleanly without inventing data.
  structure: 'Model structure incomplete',
  coverage: 'Some factors lack data',
  verified: 'Key assumptions not yet confirmed',
}

export interface HeroQualifierProps {
  /**
   * Dimension scores keyed by dimension name (lowercase). Values are
   * 0..1 floats. Keys not present in QUALIFIER_COPY are ignored.
   * Undefined or empty input → suppresses the qualifier entirely.
   */
  dimensions?: Record<string, number> | undefined
  /**
   * P0 V5 golden-path repair (Wave 4 wiring): completeness reason
   * codes from `useResultCompleteness` when the rendered analysis is
   * source-incomplete (PLoT omitted win_probability for all options,
   * sensitivity values absent, decision review missing, etc.). When
   * non-empty, takes precedence over the dimension-threshold qualifier
   * — partial source coverage is a more critical message than a low
   * evidence dimension. Codes are mapped through the curated copy
   * table; raw codes never reach the DOM.
   */
  completenessReasons?: ReadonlyArray<string> | undefined
  /**
   * P0 V5 golden-path repair (Wave 3 wiring, third-round follow-up):
   * authoritative wire-side freshness state from
   * `useAnalysisFreshnessState`. When freshness is 'stale', surface
   * the curated stale-copy ahead of completeness and dimension
   * qualifiers — a stale result is the highest-impact warning the
   * panel can give. Reason codes route through the curated freshness
   * table; raw codes never reach the DOM. Other freshness values
   * ('fresh' / 'unknown' / 'none') do not gate this qualifier line.
   */
  freshness?: 'fresh' | 'stale' | 'unknown' | 'none' | undefined
  /**
   * Stable freshness reason code from
   * `analysis_ready.freshness_reason` or the local-fallback selector.
   * Mapped through `freshnessReasonCopy` to user-facing text.
   */
  freshnessReason?: string | null | undefined
  /**
   * Optional className appended to the rendered <p>. Used by the
   * consumer to position the qualifier inside the hero card.
   */
  className?: string
}

/**
 * Pick the dimension with the lowest score below the threshold. Returns
 * null when all dimensions are at or above the threshold (qualifier
 * suppressed) or when no recognised dimension is supplied.
 *
 * Exported for unit testing.
 */
export function pickQualifier(
  dimensions: Record<string, number> | undefined,
): { dimension: string; copy: string } | null {
  if (!dimensions) return null
  let lowestKey: string | null = null
  let lowestScore = Infinity
  for (const [key, value] of Object.entries(dimensions)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    if (value >= QUALIFIER_THRESHOLD) continue
    const normKey = key.toLowerCase()
    if (!QUALIFIER_COPY[normKey]) continue
    if (value < lowestScore) {
      lowestScore = value
      lowestKey = normKey
    }
  }
  if (!lowestKey) return null
  return { dimension: lowestKey, copy: QUALIFIER_COPY[lowestKey] }
}

export function HeroQualifier({
  dimensions,
  completenessReasons,
  freshness,
  freshnessReason,
  className = '',
}: HeroQualifierProps): ReactNode {
  // Precedence (highest to lowest impact on user trust in result):
  //   1. Stale freshness — the rendered analysis is provably out of
  //      date relative to the current model. Highest-impact warning.
  //   2. Completeness reasons — the analysis ran but source data was
  //      partial (missing win_probability, sensitivity, etc.).
  //   3. Dimension qualifiers — readiness scores below 70% on
  //      evidence / robustness / clarity / etc.
  //
  // FOLLOW-UP review (P1.2): raw reason codes are NOT exposed as DOM
  // attribute values. `data-qualifier-source` is sufficient as a
  // stable semantic test hook. Tests assert via visible copy + source
  // attribute; no test depends on raw codes.

  // 1. Stale wire freshness wins above all else.
  if (freshness === 'stale') {
    return (
      <p
        className={`${typography.panelMeta} text-warning ${className}`.trim()}
        data-testid="hero-qualifier"
        data-qualifier-source="freshness"
      >
        {freshnessReasonCopy(freshnessReason ?? null)}
      </p>
    )
  }

  // 2. Completeness reasons (Wave 4) — partial source data.
  if (completenessReasons && completenessReasons.length > 0) {
    const code = completenessReasons[0]!
    return (
      <p
        className={`${typography.panelMeta} text-warning ${className}`.trim()}
        data-testid="hero-qualifier"
        data-qualifier-source="completeness"
      >
        {completenessReasonCopy(code)}
      </p>
    )
  }

  // 3. Dimension-threshold qualifier (existing).
  const picked = pickQualifier(dimensions)
  if (!picked) return null
  return (
    <p
      className={`${typography.panelMeta} text-warning ${className}`.trim()}
      data-testid="hero-qualifier"
      data-qualifier-source="dimension"
      data-qualifier-dimension={picked.dimension}
    >
      {picked.copy}
    </p>
  )
}

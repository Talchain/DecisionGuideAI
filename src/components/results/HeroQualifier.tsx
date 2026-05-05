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
import { completenessReasonCopy } from './copy/freshnessReasons'

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
  className = '',
}: HeroQualifierProps): ReactNode {
  // P0 V5 golden-path repair (Wave 4 wiring): completeness reasons
  // take precedence over dimension qualifiers. When PLoT/CEE returned
  // source-incomplete data, the user must see why the rendered values
  // can't be relied on — even if the dimension scores happen to be
  // above threshold.
  //
  // FOLLOW-UP review (P1.2): the raw reason code is NOT exposed as a
  // DOM attribute — `data-qualifier-source` is sufficient as a stable
  // semantic test hook, and the brief's "raw codes never reach DOM"
  // rule covers attributes as well as text. Tests assert behaviour via
  // visible copy + the source attribute; no test depends on the raw
  // code anymore.
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

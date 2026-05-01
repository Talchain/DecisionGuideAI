/**
 * buildContributionBreakdown — Brief 5.8A D3c.
 *
 * Pure selector that classifies factor nodes by the provenance of their
 * observed_state.source field. Counts only — no inference. Returns the
 * three buckets the wireframe spectrum bar visualises (Estimated → Brief
 * → Verified) plus the overall total.
 *
 * The brief's "N of M inputs confirmed" wording uses `verified` for N and
 * `total` for M. The render layer applies the colour spectrum across all
 * three buckets so the user sees the AI-vs-user-vs-brief mix at a glance,
 * not just a binary verified/unverified count.
 *
 * Brief 5.6 D7 deleted the legacy contribution computation. This is a
 * fresh re-derivation per Paul's "re-derive cleanly" decision — it does
 * not consult git history. Source classification mirrors the existing
 * AI_SOURCES blocklist used by Hook B.
 */

const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate'])
const VERIFIED_SOURCES = new Set(['user', 'user_confirmed', 'user_assumption'])
const BRIEF_SOURCES = new Set(['brief_extraction'])

export interface FactorNodeLike {
  data?: {
    observed_state?: { source?: string; value?: unknown } | null
    observedState?: { source?: string; value?: unknown } | null
    source?: string
  } | null
}

export interface ContributionBreakdown {
  /** Factors whose source is brief_extraction */
  brief: number
  /** Factors whose source is an AI provider (ai, cee_inference, inferred, engine, ai_estimate) */
  estimated: number
  /** Factors whose source is user / user_confirmed / user_assumption */
  verified: number
  /** brief + estimated + verified — only factors with an observed value contribute */
  total: number
}

function getSource(node: FactorNodeLike): string | undefined {
  const data = node.data ?? undefined
  if (!data) return undefined
  const observed = data.observed_state ?? data.observedState ?? null
  return observed?.source ?? data.source ?? undefined
}

function hasValue(node: FactorNodeLike): boolean {
  const data = node.data ?? undefined
  if (!data) return false
  const observed = data.observed_state ?? data.observedState ?? null
  return observed != null && observed.value !== undefined && observed.value !== null
}

export function buildContributionBreakdown(factors: readonly FactorNodeLike[]): ContributionBreakdown {
  let brief = 0
  let estimated = 0
  let verified = 0
  for (const factor of factors) {
    if (!hasValue(factor)) continue
    const source = getSource(factor)
    if (source && VERIFIED_SOURCES.has(source)) {
      verified++
    } else if (source && BRIEF_SOURCES.has(source)) {
      brief++
    } else if (source && AI_SOURCES.has(source)) {
      estimated++
    } else {
      // Unknown / undefined source on a factor with a value — count as estimated
      // since CEE-supplied data without an explicit source most often comes from
      // an AI inference path. This matches Hook B's evidenceQuality treatment.
      estimated++
    }
  }
  return { brief, estimated, verified, total: brief + estimated + verified }
}

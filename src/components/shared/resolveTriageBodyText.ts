/**
 * resolveTriageBodyText — canonical precedence for triage-card body copy.
 *
 * Pre-analysis and post-analysis feed triage cards from different CEE
 * surfaces (verification_prompts vs m1_coaching.evidence_gaps.suggestion).
 * Both surfaces share the same visual component, so the precedence rule
 * for which field becomes the body text needs to be identical and
 * auditable in one place.
 *
 * Precedence:
 *   1. CEE coaching string (rich detail from the orchestrator)
 *   2. Deterministic derived context (influence / VoI / graph degree)
 *   3. Generic fallback string (never echoes the source pill)
 *
 * The helper returns BOTH the chosen text and the provenance, so tests
 * and future audits can verify that the right source was used.
 */

export type TriageBodySource = 'coaching' | 'context' | 'generic' | 'none'

export interface TriageBodyInput {
  /** CEE coaching string (verification_prompt or evidence_gap.suggestion). */
  coaching?: string | null
  /** Deterministic subtitle derived in the mapper from factor metadata. */
  context?: string | null
  /** Optional generic fallback used when neither coaching nor context exists. */
  generic?: string | null
}

export interface TriageBodyResult {
  text: string
  source: TriageBodySource
}

const nonEmpty = (s: string | null | undefined): s is string =>
  typeof s === 'string' && s.trim().length > 0

export function resolveTriageBodyText(input: TriageBodyInput): TriageBodyResult {
  if (nonEmpty(input.coaching)) return { text: input.coaching.trim(), source: 'coaching' }
  if (nonEmpty(input.context)) return { text: input.context.trim(), source: 'context' }
  if (nonEmpty(input.generic)) return { text: input.generic.trim(), source: 'generic' }
  return { text: '', source: 'none' }
}

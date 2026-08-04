/**
 * decisionQualityPrompts — THE wire→UI mapping site for
 * `enrichment.decision_review.decision_quality_prompts[]` entries.
 *
 * Lane 1 (P1, scientific coaching made visible): CEE's Decision Science
 * Knowledge bundle annotates prompts with provenance — `dsk_claim_id`
 * (e.g. "DSK-T-003"), `dsk_protocol_id` (e.g. "DSK-P-003") and
 * `evidence_strength` — when the LLM actually cites a DSK claim. This mapper
 * carries that provenance through to the UI shape so surfaces can render a
 * grounding line ("Grounded in: <principle> · <strength> evidence").
 *
 * HONESTY RULES (the point of the feature — a provenance badge that can be
 * wrong is worse than none):
 *  - Provenance is ID-GATED AS A UNIT: an entry with no non-empty string
 *    `dsk_claim_id` gets NO provenance fields at all — never a default id,
 *    never an inferred strength. (The no-id case is REAL on live staging:
 *    fixture r3[0].)
 *  - `evidence_strength` is carried VERBATIM only when it is a member of the
 *    attested closed vocabulary below; anything else fails closed to absent.
 *    A closed-vocabulary check IS the sanitisation for that field.
 *  - Free-text fields (and the ids, defensively) go through
 *    `sanitizeCoachingText` — the same cleanup `principle` has always had.
 *    No raw wire text reaches the DOM.
 */

import { sanitizeCoachingText } from './cleanFactorLabel'

/**
 * The attested DSK evidence-strength vocabulary (derived from the committed
 * live fixtures `src/v5/__tests__/fixtures/live-decision-review-0_30.*.json`,
 * which carry "medium" and "strong", plus "weak" per the DSK bundle contract).
 * Deliberately NOT unioned with `guidanceStore.EvidenceStrength` (which adds
 * 'mixed'): that vocabulary belongs to a different wire path, and widening
 * this one would let an unattested word render as a scientific claim.
 */
export const DSK_EVIDENCE_STRENGTHS = ['weak', 'medium', 'strong'] as const
export type DskEvidenceStrength = (typeof DSK_EVIDENCE_STRENGTHS)[number]

export interface MappedDecisionQualityPrompt {
  principle: string
  appliesBecause: string
  question: string
  /** DSK claim id VERBATIM (post-sanitise), e.g. "DSK-T-003". PRESENCE is the attestation. */
  dskClaimId?: string
  /** DSK protocol id, e.g. "DSK-P-003". Only ever present alongside dskClaimId. */
  dskProtocolId?: string
  /** Closed-vocabulary strength, verbatim. Only ever present alongside dskClaimId. */
  evidenceStrength?: DskEvidenceStrength
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

/**
 * Map raw wire prompt entries to the UI shape. Preserves the historical
 * behaviour for the three copy fields exactly (truthy check → sanitise,
 * else '') and adds the id-gated provenance carry.
 */
export function mapDecisionQualityPrompts(raw: unknown[]): MappedDecisionQualityPrompt[] {
  return raw.map((entry) => {
    const p = (entry ?? {}) as Record<string, unknown>
    const mapped: MappedDecisionQualityPrompt = {
      principle: nonEmptyString(p.principle) ? sanitizeCoachingText(p.principle) : '',
      appliesBecause: nonEmptyString(p.applies_because) ? sanitizeCoachingText(p.applies_because) : '',
      question: nonEmptyString(p.question) ? sanitizeCoachingText(p.question) : '',
    }
    // Provenance — id-gated as a unit. No claim id ⇒ nothing, regardless of
    // what else the entry carries (a strength without an attested claim is
    // not evidence of anything).
    if (nonEmptyString(p.dsk_claim_id)) {
      mapped.dskClaimId = sanitizeCoachingText(p.dsk_claim_id)
      if (nonEmptyString(p.dsk_protocol_id)) {
        mapped.dskProtocolId = sanitizeCoachingText(p.dsk_protocol_id)
      }
      const s = p.evidence_strength
      if (typeof s === 'string' && (DSK_EVIDENCE_STRENGTHS as readonly string[]).includes(s)) {
        mapped.evidenceStrength = s as DskEvidenceStrength
      }
    }
    return mapped
  })
}

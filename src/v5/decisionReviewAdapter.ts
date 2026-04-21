/**
 * decisionReviewAdapter — extract a well-formed CeeDecisionReviewPayloadV1
 * from a V5 analysis_result enrichment dictionary.
 *
 * The V5 OlumiResponse schema defines `blocks[].enrichment` as
 * `Record<string, unknown>` for forward-compatibility. CEE embeds a
 * `decision_review` key whose shape mirrors CeeDecisionReviewPayloadV1
 * (the M1 Decision Review payload from PLoT). This adapter validates the
 * shape at runtime and returns null on malformed input, letting the
 * fallback render path show a summary-only card.
 *
 * Validation is deliberately lenient: each field is checked for presence
 * and primitive type, not exhaustive schema conformance. The CEE side
 * is authoritative; the UI only needs to reject shapes that would crash
 * the panel.
 */
import type { CeeDecisionReviewPayloadV1, ReviewBlock } from '../types/cee'

const VALID_INTENTS = new Set(['selection', 'prediction', 'validation'])
const VALID_ANALYSIS_STATES = new Set(['not_run', 'ran', 'partial', 'stale'])
const VALID_READINESS_LEVELS = new Set(['ready', 'caution', 'not_ready'])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateReviewBlock(raw: unknown): ReviewBlock | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string') return null
  if (typeof raw.status !== 'string') return null
  if (typeof raw.source !== 'string') return null
  if (typeof raw.summary !== 'string') return null
  if (typeof raw.priority !== 'number') return null
  // Pass through — the panel handles optional fields (items, details, etc.)
  return raw as unknown as ReviewBlock
}

/**
 * Return a validated CeeDecisionReviewPayloadV1 when `enrichment.decision_review`
 * is well-formed; null otherwise. Null callers render summary + win_probabilities
 * from the parent analysis_result block instead.
 */
export function extractDecisionReview(
  enrichment: Record<string, unknown> | undefined,
): CeeDecisionReviewPayloadV1 | null {
  if (!enrichment) return null
  const raw = enrichment.decision_review
  if (!isRecord(raw)) return null

  const intent = raw.intent
  const analysisState = raw.analysis_state
  const readiness = raw.readiness
  const blocks = raw.blocks

  if (typeof intent !== 'string' || !VALID_INTENTS.has(intent)) return null
  if (typeof analysisState !== 'string' || !VALID_ANALYSIS_STATES.has(analysisState)) return null

  if (!isRecord(readiness)) return null
  if (typeof readiness.level !== 'string' || !VALID_READINESS_LEVELS.has(readiness.level)) return null
  if (typeof readiness.headline !== 'string') return null
  if (!Array.isArray(readiness.factors)) return null

  if (!Array.isArray(blocks)) return null
  const validatedBlocks: ReviewBlock[] = []
  for (const b of blocks) {
    const vb = validateReviewBlock(b)
    if (!vb) return null
    validatedBlocks.push(vb)
  }

  return {
    ...raw, // preserve extra fields via index signature
    intent: intent as CeeDecisionReviewPayloadV1['intent'],
    analysis_state: analysisState as CeeDecisionReviewPayloadV1['analysis_state'],
    readiness: readiness as unknown as CeeDecisionReviewPayloadV1['readiness'],
    blocks: validatedBlocks,
  }
}

/**
 * buildNarrativeBridge — Brief 5.8A D3a.
 *
 * Pure selector that produces the T1 "Decision readiness" narrative bridge
 * from already-computed counts. Returns structured segments so the render
 * layer can bold the count tokens (`<strong class="text-text-body">{N}</strong>`)
 * without parsing the copy back out of a single string.
 *
 * Counts only — no inference. The unverifiedEstimateCount and
 * relationshipsToReviewCount come straight from the existing improvement
 * categories. The hasGoalTarget flag flips on the prefix sentence.
 */

export interface NarrativeBridgeInputs {
  /** Count of factors with AI-estimated values still awaiting user confirmation */
  unverifiedEstimateCount: number
  /** Count of relationships (edges) flagged as worth reviewing */
  relationshipsToReviewCount: number
  /** False when the goal has no success target set; flips the prefix */
  hasGoalTarget: boolean
}

export interface NarrativeBridgeBridge {
  /** Number rendered bold (estimateSuffix follows) */
  estimateCount: number
  /** Suffix after the bold estimateCount, e.g. " unverified estimate" / " unverified estimates" */
  estimateSuffix: string
  /** Number rendered bold (relationshipSuffix follows) */
  relationshipCount: number
  /** Suffix after the bold relationshipCount */
  relationshipSuffix: string
  /** Final tail prose, ends with the colon that introduces the triage list */
  tail: string
}

export interface NarrativeBridge {
  /** Sentence rendered before the bridge when the goal has no success target */
  prefix: string | null
  /** Structured bridge sentence — null when nothing is worth reviewing */
  bridge: NarrativeBridgeBridge | null
  /** Meta line rendered below the bridge */
  meta: string | null
}

const NO_TARGET_PREFIX = 'No success target set, so analysis cannot show probability of success.'
const TAIL = ' worth reviewing. These are the highest-priority items to review:'
const META = 'Ranked by priority'

export function buildNarrativeBridge({
  unverifiedEstimateCount,
  relationshipsToReviewCount,
  hasGoalTarget,
}: NarrativeBridgeInputs): NarrativeBridge {
  const prefix = hasGoalTarget ? null : NO_TARGET_PREFIX
  if (unverifiedEstimateCount === 0 && relationshipsToReviewCount === 0) {
    return { prefix, bridge: null, meta: null }
  }
  return {
    prefix,
    bridge: {
      estimateCount: unverifiedEstimateCount,
      estimateSuffix: unverifiedEstimateCount === 1 ? ' unverified estimate' : ' unverified estimates',
      relationshipCount: relationshipsToReviewCount,
      relationshipSuffix: relationshipsToReviewCount === 1 ? ' relationship' : ' relationships',
      tail: TAIL,
    },
    meta: META,
  }
}

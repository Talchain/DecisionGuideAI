/**
 * buildNarrativeBridge — Brief 5.8A D3a (revised in Brief 5.8B D0 #2).
 *
 * Pure selector that produces the T1 "Decision readiness" narrative bridge
 * from already-computed counts. Returns structured segments so the render
 * layer can bold the count tokens (`<strong class="text-text-body">{N}</strong>`)
 * without parsing the copy back out of a single string.
 *
 * Counts only — no inference.
 *
 * Brief 5.8B D0 #2 changes:
 * - Dropped the no-success-target PREFIX. The T1 card already renders a
 *   discrete failing-check row ("Goal target not set" + "Set target →") for
 *   the same condition; the prose prefix duplicated it. The `hasGoalTarget`
 *   flag is preserved as an input for future use but no longer gates a
 *   prefix sentence — `prefix` always returns null.
 * - Trimmed TAIL from " worth reviewing. These are the highest-priority
 *   items to review:" to " worth reviewing." The meta line "Ranked by
 *   priority" already serves as the introducer for the unified triage queue
 *   that renders directly below this bridge.
 */

export interface NarrativeBridgeInputs {
  /** Count of factors with AI-estimated values still awaiting user confirmation */
  unverifiedEstimateCount: number
  /** Count of relationships (edges) flagged as worth reviewing */
  relationshipsToReviewCount: number
  /**
   * Reserved for future use. Kept on the input shape so consumers don't
   * have to refactor their call sites when the prefix returns. Today the
   * field is unused — the discrete failing-check row inside T1 owns the
   * goal-target signal.
   */
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
  /** Final tail prose. Brief 5.8B D0 #2: trimmed to " worth reviewing." */
  tail: string
}

export interface NarrativeBridge {
  /** Reserved — always null after Brief 5.8B D0 #2 (kept on the type for future use). */
  prefix: string | null
  /** Structured bridge sentence — null when nothing is worth reviewing */
  bridge: NarrativeBridgeBridge | null
  /** Meta line rendered below the bridge */
  meta: string | null
}

const TAIL = ' worth reviewing.'
const META = 'Ranked by priority'

export function buildNarrativeBridge({
  unverifiedEstimateCount,
  relationshipsToReviewCount,
  hasGoalTarget: _hasGoalTarget,
}: NarrativeBridgeInputs): NarrativeBridge {
  if (unverifiedEstimateCount === 0 && relationshipsToReviewCount === 0) {
    return { prefix: null, bridge: null, meta: null }
  }
  return {
    prefix: null,
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

/**
 * stageMapper — map UI ScenarioStage to V5 Stage enum.
 *
 * UI canvas tracks stage as 'frame' | 'ideate' | 'evaluate' | 'decide' | 'optimise'
 * (product lifecycle). V5 wire contract tracks stage as
 * 'frame' | 'analyse' | 'decide' | 'review' (per CEE TurnContext).
 *
 * Mapping:
 *   frame, ideate   → 'frame'   (pre-analysis: still framing / building graph)
 *   evaluate        → 'analyse' (analysis has run — reviewing outputs)
 *   decide          → 'decide'  (user actively choosing)
 *   optimise        → 'review'  (post-decide iteration)
 *
 * Defaulting to 'frame' for unknown values preserves the previous hard-coded
 * behaviour for safety.
 */
import type { StageType } from '@talchain/schemas/boundary'
import type { ScenarioStage } from '../types/scenario'

const MAP: Record<ScenarioStage, StageType> = {
  frame: 'frame',
  ideate: 'frame',
  evaluate: 'analyse',
  decide: 'decide',
  optimise: 'review',
}

export function scenarioStageToV5Stage(stage: ScenarioStage | null | undefined): StageType {
  if (!stage) return 'frame'
  return MAP[stage] ?? 'frame'
}

/**
 * Inverse map: V5 Stage → UI ScenarioStage for inbound responses.
 *
 * 'frame'   → 'frame' (no graph signal available on wire — caller can
 *              promote to 'ideate' if nodes exist)
 * 'analyse' → 'evaluate'
 * 'decide'  → 'decide'
 * 'review'  → 'optimise'
 */
const INVERSE_MAP: Record<StageType, ScenarioStage> = {
  frame: 'frame',
  analyse: 'evaluate',
  decide: 'decide',
  review: 'optimise',
}

export function v5StageToScenarioStage(stage: StageType): ScenarioStage {
  return INVERSE_MAP[stage]
}

/**
 * Derive a V5 stage for an outbound turn from canvas state.
 *
 * Inputs are read-out slices from the canvas store so the caller (sendTurn)
 * can grab state synchronously without subscribing.
 *
 * Rules — mirror useStagePill.deriveStageFromState but map to V5:
 *   - Analysis complete → 'analyse'
 *   - Has nodes, analysis not run → 'frame' (still ideating)
 *   - No nodes → 'frame'
 * If the store has a trusted currentStage (not 'frame' with nodes present),
 * prefer that.
 */
export function deriveV5Stage(input: {
  currentStage: string | null | undefined
  hasNodes: boolean
  isAnalysisComplete: boolean
}): StageType {
  const { currentStage, hasNodes, isAnalysisComplete } = input

  // Trust store stage when set + consistent with current graph state.
  if (
    currentStage
    && Object.prototype.hasOwnProperty.call(MAP, currentStage)
    && !(currentStage === 'frame' && hasNodes)
    && !((currentStage === 'frame' || currentStage === 'ideate') && isAnalysisComplete)
  ) {
    return scenarioStageToV5Stage(currentStage as ScenarioStage)
  }

  // Derive.
  if (isAnalysisComplete) return 'analyse'
  return 'frame'
}

/**
 * isFramingStage — stage gate for brief readiness pill and bias alert.
 *
 * Both ReadinessPill and BiasAlertIcon render only during the framing stage.
 * Uses the same ScenarioStage type as useStagePill. The 'frame' literal is
 * the only framing stage — no aliases or transitional states exist.
 */

import type { ScenarioStage } from '../types/scenario'

export function isFramingStage(stage: ScenarioStage): boolean {
  return stage === 'frame'
}

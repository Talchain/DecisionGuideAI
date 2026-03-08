/**
 * Decision Journey Tab — Track 1 types
 *
 * Reuses ScenarioEvent, ScenarioEventType, ScenarioStage from src/types/scenario.ts.
 * Only Journey-specific artefacts are defined here.
 */

import type { ScenarioStage } from '../../types/scenario'

/** Lucide icon names used in the timeline */
export type TimelineIconKey =
  | 'Target'
  | 'GitBranch'
  | 'Check'
  | 'X'
  | 'AlertTriangle'
  | 'Pencil'
  | 'BarChart3'
  | 'FileText'
  | 'Share2'
  | 'ArrowRight'
  | 'Gauge'
  | 'Activity'

/** Semantic colour classes for timeline entry icons */
export type TimelineColourClass =
  | 'text-info'
  | 'text-success'
  | 'text-danger'
  | 'text-text-light'
  | 'text-text-body'

/** A single rendered timeline entry derived from a ScenarioEvent */
export interface TimelineEntry {
  id: string                        // event_id
  stage: ScenarioStage              // stage at time of event
  timestamp: string                 // ISO-8601
  icon: TimelineIconKey
  colour: TimelineColourClass
  headline: string                  // human-readable description
  source: 'user' | 'ai' | 'system'
  relatedThreadEntryId?: string     // from turn_id (passive in Track 1)
  relatedNodeIds?: string[]         // from details.target_id
}

/** Stage display metadata for the UI */
export const STAGE_LABELS: Record<ScenarioStage, string> = {
  frame: 'Frame',
  ideate: 'Ideate',
  evaluate: 'Evaluate',
  decide: 'Decide',
  optimise: 'Optimise',
}

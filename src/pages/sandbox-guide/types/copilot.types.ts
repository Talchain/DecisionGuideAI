/**
 * Guide Variant - Type Definitions
 */

export type JourneyStage =
  | 'empty'
  | 'building'
  | 'inspector'
  | 'pre-run-blocked'
  | 'pre-run-ready'
  | 'post-run'
  | 'compare'

export interface GuideState {
  journeyStage: JourneyStage
  panelExpanded: boolean
  selectedElement: string | null
}

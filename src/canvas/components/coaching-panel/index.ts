/**
 * Coaching panel — public entry.
 *
 * Render-only Phase 0 surface. The later mount PR can `lazy(() => import(...))`
 * this module from the Analysis tab once Lane A's coaching wire is live.
 */
export { CoachingPanel, default } from './CoachingPanel'
export type { CoachingPanelProps } from './CoachingPanel'
export type {
  Coaching,
  CoachingSignal,
  CoachingGrounding,
  CoachingMove,
  CoachingSource,
  CoachingTargetKind,
  CoachingSuggestedAction,
  CoachingEvidenceItem,
  CoachingStaleness,
} from './types'

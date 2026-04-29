/**
 * Validation metadata types — re-export shim.
 *
 * Brief 5.7 close-out follow-up: the type definitions moved to
 * `@/types/validation` (a neutral location) so shared components
 * (ScientificEditor) can import them without depending on the canvas layer.
 * This file remains as a re-export shim to keep every existing canvas import
 * path stable.
 */

export type {
  ContestedReason,
  EstimateBasis,
  UserAction,
  ResolvedValue,
  ValidationMetadata,
} from '@/types/validation'

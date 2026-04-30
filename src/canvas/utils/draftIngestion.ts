import type { CEEDraftCoaching, CEEProvenance } from '../../adapters/cee/types'
import { useCanvasStore } from '../store'

/**
 * Commit adapter-output coaching into the canvas store. Used by both DraftChat
 * and applyDraftResult so the wiring lives in one place.
 */
export function commitDraftCoachingToStore(coaching: CEEDraftCoaching | null): void {
  useCanvasStore.getState().setDraftCoaching(coaching)
}

const PROVENANCE_VALUES: ReadonlySet<CEEProvenance> = new Set<CEEProvenance>([
  'from_brief',
  'ai_inferred',
  'user_set',
])

/**
 * Read response.edge.provenance_display (snake_case) and return a partial
 * `data` object containing the camelCase canvas field. Returns an empty object
 * when the input is missing or invalid; callers can spread the result.
 */
export function edgeProvenanceDisplayPatch(rawEdge: Record<string, unknown>): { provenanceDisplay?: CEEProvenance } {
  const v = rawEdge.provenance_display
  return typeof v === 'string' && PROVENANCE_VALUES.has(v as CEEProvenance)
    ? { provenanceDisplay: v as CEEProvenance }
    : {}
}

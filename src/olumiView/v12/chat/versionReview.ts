import { VIEW_SCHEMA, type View } from '../../client'

// Additive v3 field served by Core before the generated schema mirror includes it.
type ServedReview = {
  changes: Pick<NonNullable<View['proposal']>['changes'][number], 'id' | 'top' | 'text' | 'detail' | 'family' | 'olumi'>[]
  groups: NonNullable<View['proposal']>['groups']
  turn?: number
}

export function versionReviewOf(view: View | null | undefined) {
  if (view == null || view.schema !== VIEW_SCHEMA || view.proposal != null || view.version == null) return null
  const version = view.version as typeof view.version & { review?: ServedReview | null }
  const review = version.review
  if (review == null || !Array.isArray(review.changes) || review.changes.length === 0) return null
  return {
    version: { id: version.id, label: version.label },
    changes: review.changes,
    groups: review.groups,
    turn: typeof review.turn === 'number' ? review.turn : null,
  }
}

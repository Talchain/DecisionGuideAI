import type { CEEProvenance } from '../../../adapters/cee/types'

export function provenanceToPill(
  p: CEEProvenance | undefined,
): { label: string; borderClass: string } | null {
  if (p === 'from_brief') return { label: 'From brief', borderClass: 'border-success/30' }
  if (p === 'ai_inferred') return { label: 'AI estimate', borderClass: 'border-info/30' }
  return null
}

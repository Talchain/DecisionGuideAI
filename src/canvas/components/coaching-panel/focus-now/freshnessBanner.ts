/**
 * Focus Now — freshness → banner adapter (pure).
 *
 * Maps the canonical display freshness semantic (`classifyFreshnessForDisplay`,
 * the single source used by the live Results stale banner + StaleAnalysisBadge)
 * to the panel's one banner state. The UI never derives staleness itself (F.6);
 * it renders this verdict.
 *
 * Hard rule (mirrors analysisFreshness.ts): the cannot-confirm state must NEVER
 * be shown as stale — it gets a neutral note and offers no re-run-as-stale. Only
 * a genuine 'changed' verdict offers the re-run affordance.
 */
import type { FreshnessDisplaySemantic } from '@/canvas/store/analysisFreshness'
import type { FocusBannerState } from './focusTypes'

export function freshnessToBanner(
  semantic: FreshnessDisplaySemantic | null | undefined,
): FocusBannerState {
  switch (semantic) {
    case 'changed':
      return { kind: 'stale', canRerun: true }
    case 'cannot_confirm':
      return { kind: 'cannot_confirm' }
    case 'current':
    case 'none':
    default:
      return { kind: 'none' }
  }
}

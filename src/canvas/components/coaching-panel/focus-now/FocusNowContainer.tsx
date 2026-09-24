/**
 * FocusNowContainer — the ONE authorized live mount of the Focus Now panel.
 *
 * Wires the store-aware `useFocusNow` hook to the presentational `FocusNowPanel`.
 * It is mounted as the SECOND Analysis-tab panel (immediately after the hero) by
 * `src/components/results/ResultsBody.tsx` — the single importer the inertness
 * guard allow-lists. Any other external import is still a guard violation.
 *
 * Behaviour stays static / fail-closed: `coaching_summary` is gated off
 * (CERTIFY_SUMMARY=false), there are no server/dynamic coaching rows, no readiness
 * rows, no `bias_findings`, and no UI-authored analytical claims. Mounting it adds
 * only the six generic static hygiene rows + the certified freshness banner + row
 * actions that AUTO-SEND their (UI-authored, banned-term-safe) prompt to Olumi.
 */
import { FocusNowPanel } from './FocusNowPanel'
import { useFocusNow } from './useFocusNow'

export function FocusNowContainer({
  className,
  applicableStaticIds,
  bare = false,
}: {
  className?: string
  /** Reasoning V2: flat rows on the panel, no card. The Analysis tab omits it. */
  bare?: boolean
  /**
   * ⚠ OPTIONAL, AND ABSENCE MEANS "NO OPINION". Omitted — as ResultsBody omits
   * it — the six generic hygiene rows render exactly as before, so the
   * Analysis-tab mount is unchanged by this prop existing. The Reasoning tab
   * supplies the narrowed set because a generic nudge there would sit where the
   * prototype puts the panel's ONE primary action, and would assert a gap the
   * surface never measured (`analysisNew/focusNowApplicability.ts`).
   */
  applicableStaticIds?: readonly string[]
}) {
  const props = useFocusNow(applicableStaticIds)
  // The Analysis tab already renders AnalysisFreshnessNotice as the freshness
  // surface, so the panel suppresses its OWN stale banner here to avoid a
  // duplicate stale notice (different wording) on the same trust surface.
  return <FocusNowPanel {...props} showFreshnessBanner={false} className={className} bare={bare} />
}

export default FocusNowContainer

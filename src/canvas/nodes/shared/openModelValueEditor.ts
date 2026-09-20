import { useUIStore } from '@/stores/uiStore'
import { focusModelTarget } from '../../utils/focusHelpers'

/**
 * Open the Model tab's factors section on `nodeId` — the one route in the
 * product from a triage card to an editor that can actually save a factor
 * value.
 *
 * ⭐⭐ ONE OWNER, BECAUSE TWO COPIES OF THIS ROUTE IS HOW THE DEFECT HAPPENED.
 *
 * The post-run card (`results/TriageActionCardsBody.tsx`) moved its "Edit
 * value" act here on 19 Sep and recorded the reason: *"This act must serve
 * EVERY factor a triage card can name, and `factor-observable` is NOT in the
 * exempt set [`InspectorRouter`'s `AUTHORITY_OWNING_PANELS`] — so the
 * Inspector would serve two of the three factor categories and fail silently
 * on the third."* It then scoped itself to the post-run surface, leaving
 * `PreAnalysisPanel` on `openNodeInspector`. Two siblings, one act, two
 * destinations, and only one of them true for an observable factor. Both now
 * call this.
 *
 * ⚠ NAVIGATION IS NOT A MUTATION, so this consults no key of
 * `CANONICAL_EDIT_AUTHORITY`. The destination's own authority
 * (`useModelEditAuthority.proposeFactorValue` → `factor_value_edit`) decides
 * what saves; this only decides where the reader is standing.
 *
 * ⚠ ORDER IS LOAD-BEARING, and it is the order both precedents use.
 *  1. TAB — setting a pending section without switching points a surface
 *     nobody is on.
 *  2. SECTION — before focus, because the group arrives COLLAPSED by design
 *     and scrolling to a row inside a shut group lands the reader on a closed
 *     header.
 *  3. FOCUS — last, onto a settled outline.
 *
 * ⚠ PASS THE SECTION KEY, NOT A TESTID. `MODEL_SECTION_TARGET`
 * (`canvas/components/ModelTabBody.tsx`) maps section NAMES to targets and its
 * consumer coalesces a miss to the panel top, so a testid lands the reader at
 * the top of the outline with nothing selected — silently.
 * `triageEditActRoutesToFactors.spec.ts` asserts the argument is a KEY of that
 * map rather than any string that happens to look right.
 *
 * ⚠ THE FOCUS RESULT IS DELIBERATELY UNREAD. The tab and the section have
 * already moved, so a stale id costs the reader a scroll rather than a dead
 * press — they land on the Factors group with their row somewhere in it.
 * Identical to `OutputsDock.handleReviewTarget`, which states the same
 * reasoning for the relationships route.
 *
 * ⚠ RESIDUAL, STATED NOT BURIED: the destination's write is `'local_only'`
 * when no conversation panel is mounted to supply `sendSystemEvent`. That is
 * pre-existing on the destination and identical for every existing Model-tab
 * user; it is not introduced here.
 */
export function openModelValueEditor(nodeId: string): void {
  useUIStore.getState().setActiveOutputTab('diagnostics')
  useUIStore.getState().requestModelTabSection('factors')
  focusModelTarget(nodeId)
}

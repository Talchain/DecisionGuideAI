/**
 * ⭐ A RUN THE SERVER DECLINED WITH A QUESTION IS NOT A DEAD BUTTON (served 29 Sep, R3-B's model `823bc028`).
 *
 * "Analyse first pass" sent `run_analysis`; CEE answered 200 with no analysis and a question instead ("I can't put
 * ‘New paying subscribers’ on the same scale as ‘Incremental MRR’: what unit is it in?" + a "Give the unit" chip,
 * `run_state` still `never_run`). The reply landed in the Olumi tab while the person was on the Analysis tab, so the
 * button looked dead.
 *
 * ⛔ CORRECTED after the served check of #2323 (`21f404d7`): the first version read `results.status === 'preparing'`
 * at the turn's end and called `revealOlumiSurface()`. On the served build neither fired — the Analysis tab stayed in
 * front. Two reasons, both fixed here:
 *   · the answer test now compares the REPORT before and after the turn (a landed analysis replaces it), not a status
 *     another writer may already have moved;
 *   · the reveal FRONTS THE DOCK'S OLUMI TAB. `revealOlumiSurface` focuses a registered floating composer first and
 *     returns without touching the dock, so the tab the person is looking at never changed.
 *
 * The UI decides nothing about WHY: it only notices that no answer arrived and shows the server's own reply.
 */
import { useUIStore } from '../../stores/uiStore'
import { isAiPanelV2Enabled } from '../../flags'
import { revealOlumiSurface } from './revealOlumi'

export function runTurnEndedUnanswered(reportAtDispatch: unknown, reportNow: unknown, aborted: boolean): boolean {
  return !aborted && reportNow === reportAtDispatch
}

/** Bring the run's reply into view: the dock's Olumi tab (the Run button lives in that dock's Analysis tab). */
export function revealRunReply(): void {
  // Flag OFF is the rollback posture, where the dock redirects 'olumi' to 'results'; the floating surface is the host.
  if (!isAiPanelV2Enabled()) {
    revealOlumiSurface()
    return
  }
  useUIStore.getState().forceActivateOutputTab('olumi')
}

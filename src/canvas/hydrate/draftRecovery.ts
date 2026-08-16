/**
 * draftRecovery — ROADMAP 2.1257: in-session draft recovery after stream loss.
 *
 * THE DEFECT THIS CLOSES. When an SSE draft stream dies mid-turn, the server
 * has usually ALREADY persisted the drafted graph (CEE lets the turn finish
 * when the client hangs up, and the 2.709 first-write exemption makes the
 * commit the common case). The scenario-graph read leg is alive end to end
 * (client `adapters/cee/scenarioGraph.ts` → Netlify edge `/bff/cee` → CEE
 * `POST /assist/v1/scenarios/:id/graph`) — but until this module its ONLY
 * caller was boot hydration, so a recoverable persisted draft cost the user a
 * reload at best and a "start a new draft" at worst.
 *
 * ONE AUTHORITY. This module deliberately contains NO graph-ingestion logic of
 * its own: it delegates to `hydrateCanvasFromServer`, the exact function boot
 * hydration calls (`useServerGraphHydration` → `serverGraphHydration`), which
 * owns the adapter call, the scenario-moved guard, the identity token and the
 * position-preserving merge (`mergeServerGraphOnHydrate`). A second ingestion
 * path here would be the two-`generateGraphHash`-twins defect all over again.
 *
 * WHAT "RECOVERED" MEANS, precisely: `hydrateCanvasFromServer` returned
 * `'merged'` — the server answered with a graph for this scenario and the
 * merge APPLIED it (or found the canvas already byte-identical, which is the
 * same licence: the server's committed values are what is on screen). Every
 * other outcome is `'notRecovered'`:
 *   - `'notReadable'` (404) — CEE's deliberate "no readable graph". The
 *     standing unsettled/start-new-draft behaviour is correct and stands.
 *   - `'absent'` — the scenario exists with no graph: nothing was committed.
 *   - `'unchanged'` — the server graph is the one a PREVIOUS hydration already
 *     applied, i.e. this draft committed nothing new. Claiming recovery on it
 *     would present pre-draft state as the recovered draft.
 *   - `'mergeRefused'` / `'refused'` / `'unavailable'` / `'unusable'` /
 *     `'skipped'` — nothing landed on the canvas, so nothing may be claimed.
 *
 * PHASE SETTLEMENT. On `'merged'`, the values on the canvas are the server's
 * committed ones — the very values the next analysis is computed from — so the
 * `unsettled` phase is genuinely settled: it is released (run gate opens,
 * autosave persistence resumes via `shouldPersistGraphForScenario`). Guarded
 * by ownership: only the turn that marked the draft unsettled may release it,
 * so a stale recovery can never clear a NEWER draft's phase.
 */

import { hydrateCanvasFromServer } from './serverGraphHydration'
import { useDraftStore } from '../stores/draftStore'
import { logger } from '../../lib/logger'

export type DraftRecoveryOutcome = 'recovered' | 'notRecovered'

export interface RecoverDraftArgs {
  /** The scenario the failed draft turn was dispatched on. */
  scenarioId: string | null
  /** Supabase user id when signed in; null/'guest' handled by the adapter. */
  userId?: string | null
  /**
   * The `client_turn_id` of the turn that marked the draft unsettled. Phase
   * release is keyed on it — identity, not coincidence.
   */
  turnClientId: string
}

/**
 * Attempt to recover a stream-lost draft by reading back the scenario's
 * persisted graph. Never throws (`hydrateCanvasFromServer`'s own contract);
 * the caller chooses copy strictly from the returned outcome, AFTER it
 * returns — never before.
 */
export async function recoverDraftFromServer(
  args: RecoverDraftArgs,
): Promise<DraftRecoveryOutcome> {
  const hydration = await hydrateCanvasFromServer(args.scenarioId, {
    userId: args.userId,
  })
  logger.debug('draft_recovery.outcome', {
    scenarioId: args.scenarioId,
    hydration,
  })
  if (hydration !== 'merged') return 'notRecovered'

  // The merge applied the server's committed graph, so the unsettled state is
  // settled. Ownership-guarded release, same rule as sendTurn's finally: only
  // the turn that owns the phase may move it.
  const draft = useDraftStore.getState()
  if (
    draft.draftStreamTurnId === args.turnClientId &&
    draft.draftStreamPhase === 'unsettled'
  ) {
    draft.setDraftStreamPhase('idle', null, null)
  }
  return 'recovered'
}

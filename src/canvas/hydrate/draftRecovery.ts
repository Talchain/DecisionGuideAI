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
 * `'merged'` AND the merge actually MOVED the canvas. Every other outcome is
 * `'notRecovered'`:
 *   - `'notReadable'` (404) — CEE's deliberate "no readable graph". The
 *     standing unsettled/start-new-draft behaviour is correct and stands.
 *   - `'absent'` — the scenario exists with no graph: nothing was committed.
 *   - `'unchanged'` — CEE's identity token says the server graph is the one a
 *     PREVIOUS hydration already applied. ⛔ THIS GUARD CANNOT FIRE ON THIS
 *     PATH, which is why the zero-delta check below exists. It keys on
 *     `serverGraphIdentity`, whose ONLY non-test writer is the accepted exit of
 *     `serverGraphHydration` itself; boot returns `'notReadable'` ~230 lines
 *     above that setter on a fresh scenario, `/graph/register`'s
 *     `graph_identity_hash` is consumed for telemetry only, and a turn never
 *     writes it. So in the session where drafting happens the token is null,
 *     `isSameServerGraph` fails closed, and `'unchanged'` is unreachable. The
 *     spec that covered it SEEDS the token by hand — a guard pinned against a
 *     state no production path reaches.
 *   - ⛔ A ZERO-DELTA MERGE — `'merged'` with `changed: false`. This is the case
 *     `'unchanged'` was written to catch, arriving through the door that is
 *     actually open. This module is only ever called when the turn ended with
 *     NO graph anywhere: no preview survived and the response carried none. So
 *     the canvas cannot be holding THIS turn's draft, and a merge that moves
 *     nothing means the server is handing back the graph that was already on
 *     screen before the turn — pre-draft state, which would be narrated as the
 *     recovered draft. Measured: the server holds a readable graph within
 *     seconds of opening any model, because registration runs at boot, so this
 *     is the COMMON case rather than a corner one.
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
  /** Supabase access token when signed in; travels the same route as `userId`. */
  accessToken?: string | null
  /**
   * The `client_turn_id` of the turn that marked the draft unsettled. Phase
   * release is keyed on it — identity, not coincidence.
   */
  turnClientId: string
  signal?: AbortSignal
  /** Additional ownership checks for a missing initial draft. */
  canApply?: () => boolean
  /**
   * Whether the canvas already held a graph when THIS turn was dispatched —
   * read in `useConversation` at the dispatch scope, before any streamed
   * preview could move it. It is the only fact that separates the two states
   * `lastServerGraphHash === null` collapses together, and the recovery module
   * cannot derive it: by the time this runs, a preview may already have put
   * nodes on the canvas. Omitted (`undefined`) means "not established", which
   * fails closed exactly like a restored canvas.
   */
  hadGraphBeforeTurn?: boolean
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
  let mergeChanged: boolean | null = null
  let attributable: boolean | null = null
  const hydration = await hydrateCanvasFromServer(args.scenarioId, {
    userId: args.userId,
    accessToken: args.accessToken,
    signal: args.signal,
    canApply: args.canApply,
    onMergeApplied: (merge) => {
      mergeChanged = merge.changed
      // ⛔ CAUSAL ATTRIBUTION, WHICH `changed` ALONE IS NOT. Returned by an
      // independent review of the zero-delta fix: a canvas that was STALE or
      // unhydrated merges a graph the server already held BEFORE this turn and
      // reports `changed: true`, so the older graph gets narrated as the
      // recovered draft. The zero-delta guard closes the identical-base false
      // positive; this closes the wrong-delta one.
      //
      // The test is the server's own identity against the base this client
      // held when the read was issued — and that base is still the PRE-TURN
      // value here, because the failed turn never updated it.
      //
      //   · hashes EQUAL      → the server holds the pre-turn graph. Nothing
      //                         this turn did is on it. Not a recovery.
      //   · fetched hash NULL → a CEE that predates the field. Attribution is
      //                         IMPOSSIBLE, so nothing is claimed — fail closed.
      //   · base NULL         → ⛔ TWO DIFFERENT STATES UNDER ONE VALUE, AND MY
      //                         FIRST VERSION COLLAPSED THEM. It read null as
      //                         "nothing was authoritative before, so a graph
      //                         now is new by construction" — FALSE in this
      //                         product, and three modules say so in terms:
      //                         `structuralAdd.ts:74` ("On a restored graph
      //                         `lastServerGraphHash` is null: a reload builds a
      //                         fresh…"), `structuralRename.ts:168` ("A restore
      //                         leaves `lastServerGraphHash` [null]") and
      //                         `structuralDelete.ts:522` ("from Supabase with
      //                         NO CEE turn, so `lastServerGraphHash` is null").
      //                         The hash moves ONLY when a turn response stamps
      //                         one, so a restored canvas holds null while the
      //                         SERVER already holds a graph. A failed draft
      //                         then hydrates that pre-existing graph, the
      //                         canvas moves, and the old graph is narrated as
      //                         this turn's recovered draft — the exact lie the
      //                         wrong-delta guard closed, re-entering through
      //                         the null.
      //
      // ⭐⭐ SO THE NULL IS SPLIT BY A SECOND, INDEPENDENT FACT — NOT BY A
      // STRICTER READING OF THE SAME ONE.
      //
      //   · base NON-NULL → attributable iff the fetched hash DIFFERS from it.
      //   · base NULL     → decided by `hadGraphBeforeTurn`, captured in
      //                     `useConversation` at the DISPATCH scope:
      //                       false → the canvas was empty when this turn went
      //                               out, so nothing was there to be restored
      //                               and a server graph now is this draft's;
      //                       true  → something had already put nodes there and
      //                               it was not a turn (no hash was stamped),
      //                               i.e. a restore or reload. The server may
      //                               hold that same older graph. Claim nothing.
      //                     undefined → not established. Fails closed.
      //
      // ⚠ WHY IT IS PASSED IN RATHER THAN READ HERE, which is the whole reason
      // the first two attempts leaked. By the time this module runs, the failed
      // turn may already have applied a streamed PREVIEW, so a node count read
      // here is not a pre-turn fact at all — it was the first discriminator
      // tried, and it reported a restored canvas for a fresh one.
      // `lastAuthoritativeGraph` was the second: seeded by the scenario load,
      // but `useConversation.ts` nulls it when a streamed preview is withdrawn,
      // so it reads identically on exactly the failing path that matters. Both
      // are recorded here because each looks correct until you ask WHEN it is
      // read (CLAUDE.md trap 22f — count the rounds, and change the kind of
      // evidence rather than adding a third rule over the same cache).
      //
      // ⚠⚠ AND THE HONEST LIMIT OF THIS CHANGE, because it must not be read as
      // a demonstrated fix. I could NOT reach the reviewed scenario through
      // either drive, and the discriminating mutant (treat a null base as
      // attributable) SURVIVES both: the stream-loss path guards its merge with
      // `canApply: recoveryCanvas.nodes.length === 0`, and the truncated-stream
      // path did not narrate a restored graph as recovered either. A test
      // written on either drive passed for the WRONG REASON, so none is kept —
      // a green test that cannot fail is worse than no test. This narrowing is
      // therefore DEFENCE IN DEPTH against a hole that is real in this
      // expression but not currently reachable, not a pinned repair. If the
      // path exists, it is upstream of attribution and belongs to whichever
      // guard admits the merge.
      //
      // ⚠ AND FAILING CLOSED ON EVERY NULL WAS NOT AN OPTION, which is worth
      // stating because it is the obvious reading of the review. A scenario's
      // FIRST draft has a null base by construction, so a blanket refusal
      // disables boot recovery and first-draft recovery outright — nine tests
      // in this suite encode that behaviour deliberately. It would have traded
      // a rare false claim for the loss of every true one.
      attributable =
        merge.graphHash !== null
        && (merge.baseAtDispatch !== null
          ? merge.graphHash !== merge.baseAtDispatch
          : args.hadGraphBeforeTurn === false)
    },
  })
  logger.debug('draft_recovery.outcome', {
    scenarioId: args.scenarioId,
    hydration,
    mergeChanged,
    attributable,
  })
  if (hydration !== 'merged') return 'notRecovered'

  // `!== true` rather than `=== false`, so an unreported merge claims nothing.
  // ⚠ Stated honestly: `null` is UNREACHABLE today — the callback fires
  // immediately before the `'merged'` return — so this is a shape choice, not a
  // guard, and no test pins the null arm because none can. It is written this
  // way so that if the callback ever becomes conditional, the failure is a
  // missed recovery (recoverable, the user retries) rather than a claimed one
  // (a sentence about the user's model that is not true).
  if (mergeChanged !== true) return 'notRecovered'

  // Both are required, and they answer different questions: `mergeChanged`
  // asks whether the canvas moved, `attributable` asks whether THIS TURN is
  // why. Either alone licenses a sentence the other refutes.
  if (attributable !== true) return 'notRecovered'

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

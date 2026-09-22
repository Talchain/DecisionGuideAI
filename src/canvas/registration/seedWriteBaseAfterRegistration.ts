/**
 * ⭐⭐ A REGISTERED SCENARIO MUST HOLD A WRITE BASE, OR ITS FIRST EDIT NEVER LEAVES.
 *
 * THE DEFECT, MEASURED ON SERVED STAGING (UI `8151fba5`, 22 Sep 2026, fresh
 * guest scenario on the pricing starter): the boot read `POST …/graph` answered
 * 404 because CEE had never seen the scenario, and the registration that
 * followed was acknowledged (`…/graph/register` → 200). But the acknowledgement
 * carries only an `identity.v1` token, and the edit protocol's compare-and-set
 * needs the ANALYSIS-AFFECTING `graph_hash` — which reaches the client only on a
 * turn response (`applyV5State`) or a 200 graph read (`serverGraphHydration`).
 * Neither had happened, so `lastServerGraphHash` stayed null and
 * `useStructuralRenameEvents` held the user's first rename in its queue
 * indefinitely: no `structural_rename` turn was ever sent, and the new label
 * reached CEE only through a whole-graph re-registration — persisted, but with
 * no authorship.
 *
 * So once a registration is acknowledged, read the graph back once and adopt
 * CEE's own `graph_hash` for it. Nothing else.
 *
 * ⚠ THE HASH IS THE SERVER'S, CARRIED — NEVER COMPUTED HERE. The read route
 *   derives it with `computeAnalysisAffectingGraphHash` over the persisted
 *   bytes — the same function the turn response uses and the same one CEE's
 *   rename, delete and add gates compare against. A client-side hash could not
 *   agree with that writer except by accident.
 *
 * ⚠ ONLY THE HASH. The canvas already holds exactly what it just registered, so
 *   the read's graph is never merged, the hydration identity token is never
 *   recorded, and no verdict is restored. Those are `serverGraphHydration`'s
 *   jobs, and each carries its own acceptance rules.
 *
 * ⚠ ADOPTED ONLY FOR THE GRAPH THIS ACKNOWLEDGEMENT NAMED. `adoptServerWriteBase`
 *   in `serverGraphHydration.ts` adopts only when the graph the base describes
 *   is the graph on screen, and it proves that by an accepted merge. Here the
 *   proof is CEE-to-CEE: the read's `graph_identity_hash` must equal the ack's.
 *   The caller only seeds on an ack for the model still on screen, so equality
 *   means persisted == registered == canvas. Anything else — a turn, another
 *   tab's write, a re-registration that landed between the ack and the read —
 *   means the persisted graph is not the one we know the user is looking at,
 *   and a base for it would disarm the compare-and-set on their next delete.
 *   Such a read adopts nothing; the next acknowledgement tries again.
 *
 * ⚠ NEVER OVERWRITES A BASE, and never races one. It does nothing if a base is
 *   already held, and it re-checks at adoption time that nothing stamped one
 *   while the read was in flight — the same compare-and-set against the base at
 *   dispatch that `adoptServerWriteBase` uses, for the same reason: a turn
 *   landing mid-read is newer authority and keeps the field.
 *
 * Never throws and never rejects: the caller fires and forgets it.
 */
import { useCanvasStore } from '../store'
import { logger } from '../../lib/logger'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import type { RegisteredGraphIdentity } from '../../adapters/cee/registerScenarioGraph'

export type WriteBaseSeedOutcome =
  /** CEE's `graph_hash` for the registered graph is now the write base. */
  | 'seeded'
  /** A base was already held. Nothing was requested. */
  | 'alreadyHeld'
  /** The ack named no identity, so no read could be bound to it. Nothing requested. */
  | 'noAckIdentity'
  /** The read did not return a graph (404, 503, refusal, transport). */
  | 'notRead'
  /** The canvas moved to another scenario while the read was in flight. */
  | 'scenarioMoved'
  /** The server's graph is not the one this acknowledgement named. */
  | 'identityMismatch'
  /** CEE answered with no `graph_hash`. */
  | 'noGraphHash'
  /** Something else stamped a base while the read was in flight; it keeps it. */
  | 'superseded'

export interface SeedWriteBaseOptions {
  /** Same session read the registration used — never a render-time value. */
  readonly userId?: string | null
  readonly accessToken?: string | null
}

export async function seedWriteBaseAfterRegistration(
  scenarioId: string,
  ackIdentity: RegisteredGraphIdentity | null,
  opts: SeedWriteBaseOptions = {},
): Promise<WriteBaseSeedOutcome> {
  const outcome = await seed(scenarioId, ackIdentity, opts)
  logger.info('import_registration.write_base_seed', { scenarioId, outcome })
  return outcome
}

async function seed(
  scenarioId: string,
  ackIdentity: RegisteredGraphIdentity | null,
  opts: SeedWriteBaseOptions,
): Promise<WriteBaseSeedOutcome> {
  const baseAtDispatch = useCanvasStore.getState().lastServerGraphHash
  if (typeof baseAtDispatch === 'string' && baseAtDispatch.length > 0) return 'alreadyHeld'
  if (ackIdentity === null) return 'noAckIdentity'

  const result = await fetchScenarioGraph(scenarioId, {
    userId: opts.userId,
    accessToken: opts.accessToken,
  })
  if (result.status !== 'graph') return 'notRead'

  const live = useCanvasStore.getState()
  if (live.currentScenarioId !== scenarioId) return 'scenarioMoved'
  if (
    result.identity === null ||
    result.identity.value !== ackIdentity.value ||
    result.identity.projectionVersion !== ackIdentity.projectionVersion
  ) {
    return 'identityMismatch'
  }
  if (result.graphHash === null) return 'noGraphHash'
  if (live.lastServerGraphHash !== baseAtDispatch) return 'superseded'

  live.setLastServerGraphHash(result.graphHash)
  return 'seeded'
}

/**
 * ROADMAP 2.467 — THE IMPORT → RESET → SERVER-REGISTRATION TRAIN, client half.
 *
 * ── WHY ONE HOOK COVERS EVERY IMPORT ROUTE ─────────────────────────────────
 * This subscribes to `store.importPendingServerRegistration`, which is DERIVED
 * at every graph-replacement site (`importCanvas`, `hydrateGraphSlice`,
 * `loadScenario`, `undoDraft`) from a localStorage marker keyed on the graph's
 * STRUCTURAL identity. So it fires for:
 *   · the ImportExportDialog import,
 *   · the SnapshotManager restore (same store action),
 *   · the ScenarioSwitcher `importScenarioFromFile` route (which now marks too),
 *   · **hydrate-from-autosave after a reload or in a new tab** — ROADMAP 2.483's
 *     binding design note, and the reason a per-route call site would have been
 *     the same defect with a smaller blast radius.
 * There is no hand-maintained list of "places to register from"; there is one
 * condition, read from the graph actually on the canvas.
 *
 * ── WHAT IT SENDS, AND WHAT IT SNAPSHOTS ───────────────────────────────────
 * The canvas is projected to CEE's wire shape by `buildRegistrationGraph`, and
 * the nodes/edges used for that projection are SNAPSHOTTED and carried through
 * to the release. The marker is structural, so releasing against a canvas the
 * user has edited in the meantime would release nothing — safe, but silently.
 * Carrying the snapshot makes the release describe exactly what was registered.
 *
 * ── WHAT COUNTS AS AN ACKNOWLEDGEMENT ──────────────────────────────────────
 * Only `status: 'registered'` — a 200 carrying the `scenario_graph_registration.v1`
 * discriminator. A transport failure, an unreadable body, a 503, a 409 and a
 * 404 all leave the hold ARMED, which is the honest posture: the product goes
 * on saying it cannot confirm, exactly as the interim mitigation made it. This
 * hook can only ever make the product MORE confident, never less honest.
 *
 * ── THE INTERIM MITIGATION IS NOT LEFT FIGHTING THIS ───────────────────────
 * `importRegistrationMarker` was always specified as superseded by a real
 * handshake — "when a real registration handshake exists, the server's own
 * acknowledgement replaces this marker". This is that handshake: the module
 * stays as the STATE (it is what survives a reload), and its release is now
 * driven by CEE's ack rather than by nothing at all. One mechanism, two halves.
 */
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { getSessionIdentity } from '../../lib/supabase'
import { isPersistenceSessionActive } from '../../lib/persistenceSession'
import { logger } from '../../lib/logger'
import { registerScenarioGraph } from '../../adapters/cee/registerScenarioGraph'
import { useCanvasStore } from '../store'
import {
  releaseImportRegistration,
  markGraphServerAcknowledged,
  analyticalIdentityKey,
  isGraphServerAcknowledged,
  isSameAnalyticalModel,
  markGraphImported,
} from '../store/importRegistrationMarker'
import { setCurrentScenarioId } from '../store/scenarios'
import { buildRegistrationGraph } from './buildRegistrationGraph'
import { analysisHeldOn } from '../utils/analysisHeldOnInjectedModel'
import { resolveStarterRegistrationBrief } from '../starters/registrationBrief'
import { editDeliveryHold, useEditDeliveryHeld } from './editDeliveryHold'

/**
 * Why a registration attempt did not end in an acknowledgement.
 *
 * ⚠ DELIBERATELY NOT STORED ON THE CANVAS STORE. A first cut kept it as a
 *   store field; a complete manifest showed SIX references and ZERO readers —
 *   a write-only surface, which is the shape trap 10 exists to warn about, and
 *   which also re-rendered an unrelated pre-existing diagnostic (widening the
 *   store's state type changes how tsc PRINTS it) and reddened the typecheck
 *   gate's own self-test. It is a LOG reason until something actually renders
 *   it; the honest posture the user sees is driven by
 *   `importPendingServerRegistration` alone.
 */
export type ImportRegistrationFailure =
  /** The canvas cannot be projected without inventing a node's meaning. */
  | 'graph_not_projectable'
  /** CEE refused the bytes (422). Actionable — the file needs fixing. */
  | 'rejected'
  /** The server graph moved under us (409). Never retried. */
  | 'conflict'
  /** Transport / 503 / unreadable answer. Unknown; a later attempt may work. */
  | 'unavailable'

/** UUID shape — a non-UUID `currentScenarioId` cannot name a `scenarios` row. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Register the canvas server-side whenever it holds an unregistered import.
 *
 * Mounted once, beside the server-graph hydration hook.
 */
export function useImportRegistration(): void {
  const pending = useCanvasStore((s) => s.importPendingServerRegistration)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { user } = useAuth()
  const userId = user?.id ?? null

  /**
   * Attempts already made, keyed by THE ANALYTICAL IDENTITY THE HOLD USES.
   *
   * ⛔ IT USED TO BE `${scenarioId}:${nodeCount}:${edgeCount}`, AND THAT MADE A
   *   RE-ARMED HOLD PERMANENT. `analysisHeldOn` releases on
   *   `isGraphServerAcknowledged`, keyed on `analyticalDigest`; this guard was
   *   keyed on the two counts. A VALUE-ONLY EDIT moves the digest and touches
   *   neither count — so the re-arm effect below correctly re-armed the hold,
   *   this effect found its key already used and returned, and no second
   *   registration was ever attempted. The model stayed held for the life of
   *   the page, the pre-analysis footer refused every rerun, and the only
   *   remaining routes to a rerun were the controls that bypass the gate
   *   entirely — i.e. the unsafe one was the only one that worked.
   *
   *   Two identities for one question, which is the "two questions, one name"
   *   defect `analysisHeldOnInjectedModel.ts` exists to end, reappearing in the
   *   guard instead of in the predicate. The key is now the module's own
   *   `analyticalIdentityKey`, so the guard and the hold cannot disagree.
   *
   * ⚠ IT IS STILL A GUARD, AND STILL PER MODEL. Widening the key must not
   *   widen it to "no guard": one model that fails to register is still
   *   attempted exactly once per page life. The projection drops `position`,
   *   `selected`, `dragging` and `measured` (`CANVAS_ONLY_NODE_KEYS`), so a
   *   drag or a click cannot move the key and cannot cost a request.
   *
   * ⚠ THE COUNTS KEY REMAINS AS THE FALLBACK for a model with no identity at
   *   all — no nodes, or a graph the projection refuses. That is the only case
   *   where the old behaviour is still the right behaviour, because there is
   *   nothing finer to key on and a null key would disable the guard.
   *
   * ⚠ THIS IS AN IN-FLIGHT / NO-RETRY-LOOP GUARD, NOT THE HOLD. The hold lives
   *   in localStorage and survives the page; this ref dies with it, so a reload
   *   legitimately re-attempts a registration that failed. Without the guard, a
   *   failing registration would re-fire on every render for as long as the
   *   hold stays armed — which is forever, by design.
   */
  const attempted = useRef(new Set<string>())

  const nodesNow = useCanvasStore((s) => s.nodes)
  const edgesNow = useCanvasStore((s) => s.edges)

  /**
   * ⭐⭐ ONE WRITER — NO REGISTRATION WHILE A CANVAS EDIT IS STILL IN DELIVERY.
   *
   * Witnessed on served staging (22 Sep 2026): the optimistic write of a value
   * edit moved the digest, the re-arm effect below armed a whole-graph
   * registration, and it left in the SAME millisecond as the edit turn —
   * carrying the user's number under the old `cee_inference` stamp. CEE's CAS
   * rolled the edit back (500), and the register had already stored the number
   * as Olumi's. See `editDeliveryHold.ts` for the four signals.
   *
   * Reactive, so the re-arm effect re-evaluates — and a stood-down
   * registration is retried (below) — when delivery settles. By then an
   * applied receipt has already acknowledged the edited model
   * (`confirmOptimisticFactorEdit`) and a refusal has reverted to the
   * acknowledged one, so in both cases nothing is sent.
   */
  const editDeliveryHeld = useEditDeliveryHeld()

  /**
   * A registration that stood down for an edit in delivery, waiting to be
   * re-evaluated. Bumping `retryAfterDelivery` re-runs the registration effect
   * ONCE when delivery settles — deliberately NOT by making `editDeliveryHeld`
   * a dependency of that effect: its cleanup ABORTS the request in flight, and
   * an edit starting must never cancel a registration already on the wire (its
   * receipt is what lets the edit's own receipt chain the acknowledgement).
   */
  const deferredForDelivery = useRef(false)
  const [retryAfterDelivery, setRetryAfterDelivery] = useState(0)
  useEffect(() => {
    if (editDeliveryHeld || !deferredForDelivery.current) return
    deferredForDelivery.current = false
    setRetryAfterDelivery((n) => n + 1)
  }, [editDeliveryHeld])

  /**
   * ⚠ RELOAD RECOVERY — WITHOUT THIS, "SAFE HOLDING" BECOMES A PERMANENT WALL.
   *
   * `hydrateGraphSlice` re-derives `importPendingServerRegistration` from the
   * PENDING marker alone. After a normal acknowledgement that marker is gone,
   * so if the acknowledgement record is later lost — eviction, cleared storage,
   * private mode — a reload produces a model that is HELD (no acknowledgement)
   * and NOT pending (no marker), and this hook returned immediately. No second
   * registration was ever attempted: reproduced as one fetch where two were
   * expected. Re-arming turns that dead end into the redundant registration the
   * design always claimed it was.
   */
  useEffect(() => {
    const st = useCanvasStore.getState()
    if (st.importPendingServerRegistration) return
    // ONE WRITER: an optimistic write is not a model the server lacks — it is
    // an edit the server is about to answer. Re-arming on it is what raced the
    // edit turn. Re-evaluated when delivery settles (`editDeliveryHeld` dep).
    if (editDeliveryHold(st as never) !== null) return
    if (analysisHeldOn(st as never) === null) return
    if (isGraphServerAcknowledged(st.currentScenarioId, st.nodes as never, st.edges as never)) return
    markGraphImported(st.nodes as never, st.edges as never)
    useCanvasStore.setState({ importPendingServerRegistration: true })
    logger.info('import_registration.re_armed_after_lost_acknowledgement', {
      scenarioId: st.currentScenarioId ?? null,
    })
  }, [nodesNow, edgesNow, scenarioId, editDeliveryHeld])

  useEffect(() => {
    if (!pending) return
    // ONE WRITER: stand down BEFORE the attempt key is spent, so the same
    // model can still be offered once delivery settles.
    {
      const hold = editDeliveryHold(useCanvasStore.getState() as never)
      if (hold !== null) {
        deferredForDelivery.current = true
        logger.info('import_registration.deferred_for_edit_delivery', {
          scenarioId: scenarioId ?? null,
          hold,
        })
        return
      }
    }
    if (!scenarioId || !UUID_PATTERN.test(scenarioId)) {
      // ⭐ "THERE IS NOWHERE TO REGISTER THIS GRAPH" WAS TRUE, AND THAT MADE IT
      //    A THING TO FIX RATHER THAN A THING TO LOG. A fresh guest who opens a
      //    bundled saved example has no `currentScenarioId` at all — one is
      //    minted lazily by the FIRST TURN (`useConversation`'s mint guard) —
      //    so the registration train bailed here every single time and the only
      //    remaining route to an analysable model was a non-deterministic LLM
      //    re-draft.
      //
      // ⚠ NO RATE IS QUOTED HERE ON PURPOSE. An earlier draft of this comment
      //   said "succeeds roughly 36-57% of the time". That figure is WITHDRAWN:
      //   it dates from 24 Jul, spans two different populations, and was never
      //   measured on the path this button actually takes (it used
      //   `/assist/v1/draft-graph`; `handleRedraft` goes via
      //   `/proxy/v5/turn/stream`). It is not replaced with a newer number here
      //   because no measurement on THIS path has been made that would support
      //   one — and a comment is the worst place to park an unverified
      //   statistic, since it reads as settled and nobody re-derives it.
      //   The argument does not need a rate: a re-draft is non-deterministic,
      //   registration is not, and that alone is why this seam exists.
      //   ⚠ The same withdrawn figure is still quoted in
      //   `components/StarterProvenanceBanner.tsx` and its spec — PRE-EXISTING,
      //   deliberately not touched here to keep this candidate scoped. Rowed.
      //
      // ⚠ THE MINT RULE IS `useConversation`'S, NOT A NEW ONE, and refusing for
      //   a persisted session is the load-bearing half. Minting for a signed-in
      //   user manufactures a decision they never asked for: they have a real
      //   route to a real scenario (the Decisions page), so refusing costs them
      //   nothing and inventing one costs them their place. A guest's decisions
      //   are local and they have no such list, which is exactly why the mint is
      //   correct there and only there.
      //
      // Refusing leaves the hold ARMED, so the product goes on saying it cannot
      // confirm — the honest posture, unchanged from before this branch existed.
      if (isPersistenceSessionActive()) {
        logger.warn('import_registration.no_scenario_id', { scenarioId: scenarioId ?? null })
        return
      }
      const mintedId = crypto.randomUUID()
      logger.info('import_registration.minted_scenario_id', { scenarioId: mintedId })
      // Store AND the localStorage writer, exactly as the turn path does, so a
      // reload reuses this row rather than registering the same graph twice
      // into a second scenario the user never asked for.
      useCanvasStore.setState({ currentScenarioId: mintedId })
      setCurrentScenarioId(mintedId)
      // The effect re-runs on the new `scenarioId` and registers there. It does
      // NOT fall through: `attempted` would otherwise be keyed on a scenario
      // that was null when the key was built.
      return
    }

    // Snapshot the exact graph being registered (see the header).
    const { nodes, edges } = useCanvasStore.getState()
    const attemptKey =
      analyticalIdentityKey(scenarioId, nodes, edges) ??
      `${scenarioId}:${nodes.length}:${edges.length}`
    if (attempted.current.has(attemptKey)) return
    attempted.current.add(attemptKey)

    const projected = buildRegistrationGraph(nodes, edges)
    if (!projected.ok) {
      logger.warn('import_registration.not_projectable', {
        reason: projected.reason,
        nodeIds: projected.nodeIds,
      })
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const initialBriefText = resolveStarterRegistrationBrief(nodes)

    void (async () => {
      // ⚠ BOTH FIELDS COME FROM THE SAME READ, and that is the whole point.
      //    `useAuth().user.id` is React state — populated asynchronously by
      //    `onAuthStateChange` and defaulting to the literal 'guest' — so
      //    pairing it with a freshly-read token can put a body id and an
      //    Authorization header from DIFFERENT sessions on one request.
      //    `getSessionIdentity()` reads one session object, so the two cannot
      //    disagree. `userId` (from `useAuth`) remains the effect DEPENDENCY;
      //    it is not what is sent.
      const identity = await getSessionIdentity()
      // ONE WRITER, re-checked at the last synchronous moment before the POST:
      // an edit admitted during the await above must win. Un-spend the key so
      // the retry after delivery can offer this model again.
      if (!cancelled && editDeliveryHold(useCanvasStore.getState() as never) !== null) {
        attempted.current.delete(attemptKey)
        deferredForDelivery.current = true
        logger.info('import_registration.deferred_for_edit_delivery', { scenarioId, hold: 'late' })
        return
      }
      const result = await registerScenarioGraph(scenarioId, projected.graph, {
        userId: identity.userId,
        accessToken: identity.accessToken,
        signal: controller.signal,
        initialBriefText,
      })
      if (cancelled) return

      if (result.status !== 'registered') {
        const failure: ImportRegistrationFailure =
          result.status === 'rejected'
            ? 'rejected'
            : result.status === 'conflict'
              ? 'conflict'
              : 'unavailable'
        logger.warn('import_registration.not_acknowledged', {
          status: result.status,
          scenarioId,
        })
        // The hold stays ARMED. This is the whole discipline: anything short of
        // "CEE told us it stored this" leaves the product honest about not
        // knowing, exactly as it was before this hook existed.
        void failure
        return
      }

      // THE ACKNOWLEDGEMENT. Release the marker for the identity that was
      // registered, and re-derive the store flag from the SAME snapshot so the
      // two cannot disagree.
      // Record the POSITIVE acknowledgement first: `analysisHeldOn` releases on
      // this and never on the absence of the pending marker, so writing it
      // before the removal keeps the hold correct even if the second write is
      // dropped by storage.
      // ⚠ A LATE CALLBACK MAY NOT CONFIRM A REPLACEMENT. `nodes`/`edges` here are
      //   the snapshot taken BEFORE the await. If the user replaced the model
      //   while this request was in flight — same scenario, same ids, same
      //   endpoints, different weight — then this receipt is about the graph we
      //   SENT and says nothing about the graph now on screen. Re-read the live
      //   store and confirm the analytical identity is unchanged before
      //   admitting anything. Reproduced: A at weight 0.2 in flight, replaced by
      //   B at 0.9, A's receipt resolved, and B read as acknowledged.
      const live = useCanvasStore.getState()
      const stillCurrent =
        live.currentScenarioId === scenarioId &&
        isSameAnalyticalModel(nodes, edges, live.nodes as never, live.edges as never)
      if (!stillCurrent) {
        logger.info('import_registration.superseded', { scenarioId })
        // The receipt is real, so record it against WHAT WAS SENT — a later
        // undo back to that model is then legitimately released. The current
        // model keeps its own hold and will register on its own turn.
        markGraphServerAcknowledged(scenarioId, nodes, edges)
        releaseImportRegistration(nodes, edges)
        return
      }

      // THE ACKNOWLEDGEMENT. Memory first, so a storage refusal cannot cost the
      // release of the model on screen right now.
      markGraphServerAcknowledged(scenarioId, nodes, edges)
      const released = releaseImportRegistration(nodes, edges)
      useCanvasStore.setState({ importPendingServerRegistration: false })
      logger.info('import_registration.acknowledged', {
        scenarioId,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        markerReleased: released,
        identityProjection: result.identity?.projectionVersion ?? null,
      })
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [pending, scenarioId, userId, retryAfterDelivery])
}

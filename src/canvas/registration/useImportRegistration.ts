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
import { useEffect, useRef } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { logger } from '../../lib/logger'
import { registerScenarioGraph } from '../../adapters/cee/registerScenarioGraph'
import { useCanvasStore } from '../store'
import { releaseImportRegistration } from '../store/importRegistrationMarker'
import { buildRegistrationGraph } from './buildRegistrationGraph'

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
   * Attempts already made, keyed by `${scenarioId}:${nodeCount}:${edgeCount}`.
   *
   * ⚠ THIS IS AN IN-FLIGHT / NO-RETRY-LOOP GUARD, NOT THE HOLD. The hold lives
   *   in localStorage and survives the page; this ref dies with it, so a reload
   *   legitimately re-attempts a registration that failed. Without the guard, a
   *   failing registration would re-fire on every render for as long as the
   *   hold stays armed — which is forever, by design.
   */
  const attempted = useRef(new Set<string>())

  useEffect(() => {
    if (!pending) return
    if (!scenarioId || !UUID_PATTERN.test(scenarioId)) {
      // No addressable scenario row yet. The hold stays armed and the product
      // keeps saying it cannot confirm — which is TRUE: there is nowhere to
      // register this graph.
      logger.warn('import_registration.no_scenario_id', { scenarioId: scenarioId ?? null })
      return
    }

    // Snapshot the exact graph being registered (see the header).
    const { nodes, edges } = useCanvasStore.getState()
    const attemptKey = `${scenarioId}:${nodes.length}:${edges.length}`
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

    void (async () => {
      const result = await registerScenarioGraph(scenarioId, projected.graph, {
        userId,
        signal: controller.signal,
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
  }, [pending, scenarioId, userId])
}

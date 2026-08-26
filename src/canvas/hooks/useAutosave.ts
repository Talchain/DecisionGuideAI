/**
 * useAutosave - Automatic periodic saving of canvas state
 *
 * Saves current graph to localStorage every 30 seconds when content changes.
 * Used for recovery in case of browser crash or accidental close.
 *
 * P1 Fix: Uses hash-based dirty checking to only save when content actually changes,
 * preventing spam saves when isDirty flag is stale.
 *
 * Multi-tab safety: Uses a debounced write with timestamp check to avoid
 * racing writes when multiple tabs are open.
 *
 * Usage:
 * ```
 * useAutosave() // Call in ReactFlowGraph or similar top-level component
 * ```
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { saveAutosave, loadAutosave } from '../store/scenarios'
import { projectAutosaveData, analysisSnapshotFromStore } from '../store/autosaveProjection'
import type { AutosaveProjectionSource } from '../store/autosaveProjection'
import { EPHEMERAL_NODE_FIELDS, EPHEMERAL_EDGE_FIELDS } from '../domain/analyticalNodeFields'
import { isCanvasShapedNode } from '../utils/normalisePersistedGraph'
import { shouldPersistGraphForScenario } from '../stores/draftStore'
import { flushWorkToAutosave } from '../persist/crashFlush'

// The autosave hash now covers node/edge `data.*` BY DEFAULT (Codex P1-1) and
// EXCLUDES only the small ephemeral denylist below (transient UI/session state +
// derived caches re-computed on restore). Sets for O(1) membership.
const EPHEMERAL_NODE_SET: ReadonlySet<string> = new Set(EPHEMERAL_NODE_FIELDS)
const EPHEMERAL_EDGE_SET: ReadonlySet<string> = new Set(EPHEMERAL_EDGE_FIELDS)

/**
 * Deterministic JSON with object keys sorted at every depth. Key-order-insensitive
 * so re-serialising the same content in a different insertion order (a field
 * deleted+re-added, a re-normalised object) produces the SAME hash and never
 * fabricates a spurious save. Used only for the in-memory dirty comparison.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  return (
    '{' +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
      .join(',') +
    '}'
  )
}

/** Copy `data` minus the ephemeral denylist keys (shallow — denylist is top-level). */
function serializableData(
  data: Record<string, unknown>,
  ephemeral: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (ephemeral.has(key)) continue
    out[key] = data[key]
  }
  return out
}

const AUTOSAVE_INTERVAL_MS = 30 * 1000 // 30 seconds
const DEBOUNCE_MS = 500 // Debounce writes to reduce localStorage contention

/**
 * May this hook's STORE-SCOPED writers persist the graph right now?
 *
 * ⚠ THE PREVIEW SKIP WAS ONLY EVER WIRED ON ONE SIDE. `applyDraftResult` skips
 * its own immediate localStorage write for a streamed GRAPH_READY preview
 * (`opts.skipAutosave`, applyDraftResult.ts:318) and its comment claims that
 * "before then there is deliberately nothing on disk to restore, which is the
 * honest state". That was false in this direction: the skip covers only the
 * PAYLOAD-scoped write, while both writers in this file are STORE-scoped — they
 * re-read the store at fire time — and neither knew the phase existed. A 30 s
 * tick landing inside the settling window therefore persisted the preview
 * anyway. `draftStreamPhase` is in-memory and does not survive a reload, so it
 * came back UNMARKED with the run gate OPEN: exactly the fabrication state the
 * skip exists to prevent, reached through the other door.
 *
 * ONE AUTHORITY, NOT A SECOND COPY. This delegates to
 * `shouldPersistGraphForScenario` — the same derived read the SERVER-row choke
 * point already consults (`persistGraphNow`, hooks/useScenario.ts:219). Adding a
 * phase test of our own here would be the two-`generateGraphHash`-twins defect:
 * two spellings of one rule, drifting apart in silence. A new phase is
 * classified once, in `draftValuesAreUnsettled`'s compiler-checked switch.
 *
 * Read at FIRE time, never at registration/setup — the whole point is the phase
 * as it is at the instant of the write.
 *
 * NOT applied to `applyDraftResult`'s payload-scoped write: that path makes an
 * explicit per-call-site decision (`skipAutosave`) about a graph it was handed,
 * and the TERMINAL apply must autosave the settled values immediately even
 * while this scenario's phase is still being released.
 */
function mayPersistGraphNow(scenarioId: string | null): boolean {
  return shouldPersistGraphForScenario(scenarioId)
}

/**
 * Compute a canonical hash of graph state for autosave dirty-detection.
 *
 * HASH-BY-DEFAULT with an ephemeral denylist (Codex P1-1). The hash covers the
 * structural signals (id / kind via RF `type` / label / position; edge endpoints
 * + the legacy `confidence ?? weight` composite) PLUS every `data.*` field EXCEPT
 * the small ephemeral denylist (EPHEMERAL_NODE_FIELDS / EPHEMERAL_EDGE_FIELDS from
 * the analyticalNodeFields registry).
 *
 * WHY inverted from an allowlist (adjudicated, do not re-litigate): the previous
 * version hashed only a hand-curated PERSIST allowlist, so user-editable fields
 * never on it (`description`, `category`, `extractionType`, `factor_type`,
 * `state_space`, `uncertainty_drivers`) never flipped the dirty hash → the 30s
 * autosave skipped → the edit was lost on reload. That is the #457 loss class, one
 * allowlist-omission at a time. Hashing by default makes the safe direction the
 * default: a new field that is NOT denylisted merely causes an extra (debounced)
 * save — harmless; a user-editable field can no longer be silently dropped by
 * omission. The denylist only excludes transient UI/session state and derived
 * caches re-computed on restore, so it cannot churn per-render (the debounce
 * further bounds writes).
 *
 * `data.*` is serialised with STABLE KEY ORDER at every depth (stableStringify),
 * so a re-normalised object with identical content does not fabricate a save. The
 * hash is compared only against itself in-memory (lastSavedHashRef), so object key
 * names are immaterial; only the SET of fields and their VALUES matter.
 *
 * Exported for the drift guard's behavioural cross-check: an ephemeral field must
 * NOT flip this hash; any non-ephemeral data field MUST.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAPE — THIS PROJECTOR SEES **TWO** GRAPH SHAPES, NOT ONE (P0, 2026-08-13)
 * ─────────────────────────────────────────────────────────────────────────────
 * `scenarios.graph` holds either React-Flow-shaped bytes (`position`, `data`,
 * edge `source`/`target`) or CEE/GraphV3 bytes (`kind`/`label` top-level, edge
 * `from`/`to`, and NO `position`, `data`, `id`, `source` or `target` on edges).
 * `useScenario.loadScenario` USED TO hydrate that column into the canvas store
 * VERBATIM, so both shapes reached this function. It no longer does — it
 * normalises through `normalisePersistedGraph` first (`useScenario.ts:699`), and
 * this sentence read "hydrates … VERBATIM" in the present tense for a fortnight
 * after that stopped being true. The dual-shape reads below are now DEFENCE IN
 * DEPTH for a store that should hold one shape, not the primary mechanism; the
 * primary mechanism is the boundary. Before that fix the edge half read only
 * `e.source`, so a CEE-written row projected `undefined` endpoints and the
 * comparator threw `undefined.localeCompare(...)` DURING RENDER — React's error
 * boundary then took the whole canvas (0 nodes) on every reload of a
 * CEE-drafted decision. Witnessed on deployed `978d073c`, 3/3 on CEE rows and
 * 0/2 on React-Flow rows.
 *
 * ⚠ NOT-THROWING IS NOT THE REQUIREMENT. This hash is the autosave's dirty gate.
 * Defaulting the endpoints to a constant would stop the crash and silently break
 * dirty-detection for every CEE-shaped graph — an edge rewire would not flip the
 * hash, the save would skip, and the edit would be lost on reload (the #457 loss
 * class described above). So each field is read in BOTH spellings, and
 * `useAutosave.ceeShapedRowReload.p0.spec.ts` pins the fidelity, not just the
 * absence of a throw.
 *
 * The dual-shape read matches the estate's existing precedent for this exact
 * problem — `canvas/utils/mergeServerGraph.ts` already resolves endpoints as
 * `e.from ?? e.source` on the server-hydration path.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FORMER RESIDUAL — NOW CLOSED AT THE BOUNDARY, WHERE IT SAID IT BELONGED
 * ─────────────────────────────────────────────────────────────────────────────
 * This block used to record an open gap: for a CEE-shaped node the analytical
 * payload (`observed_state`, `display_value`, `category`, `interventions`) lives
 * at the TOP LEVEL, not under `data`, so it escaped the `data.*` hash-by-default
 * rule — an edit would not flip this hash, the save would skip, and the edit was
 * lost on reload. It correctly refused to patch that here (which would have
 * minted a fourth hand-mirrored CEE→React-Flow mapping) and named the hydration
 * boundary as the right home.
 *
 * The boundary now delivers it, for BOTH CEE classes. It could not before: the
 * shape discriminator tested `'position' in n` alone, so the **19 staging rows
 * that are GraphV3 AND carry geometry** (census 2026-08-26) were waved through
 * unprojected and hit this function with no `data` at all — `label` collapsing
 * to `''`, `kind` to `undefined`, and the entire analytical payload invisible to
 * the dirty gate. `isCanvasShapedNode` now discriminates on the React Flow
 * envelope (`data`), which is a property of the shape rather than an observation
 * about what CEE currently emits.
 *
 * ⚠ `position` REMAINS IN THIS HASH ON PURPOSE. This is the one authority in the
 * estate that SHOULD see geometry: a node move is a real change that must reach
 * the layout sidecar. Do not "align" it with the analysis-staleness owner
 * (`domain/analyticalChange.ts`), which classifies position as cosmetic — they
 * answer different questions (CLAUDE.md trap 21) and a shared window would break
 * one of them. Pinned both ways in
 * `useAutosave.geometryBearingCeeRowDirtyGate.p0.spec.ts`.
 */
export function computeGraphHash(nodes: any[], edges: any[]): string {
  const canonical = {
    nodes: nodes
      .map(n => {
        const data = (n.data ?? {}) as Record<string, unknown>
        // BYTE-STABILITY GATE. A canvas-shaped node projects through the EXACT
        // original expressions — no `??` limb is added on that branch — so the
        // signature of every graph that worked before this change is unchanged
        // to the byte. The CEE fallbacks apply only to a node that is NOT
        // canvas-shaped, i.e. one that could not have been projected correctly
        // before anyway. Verified by differential in
        // useAutosave.ceeShapedRowReload.p0.spec.ts.
        const canvasShaped = isCanvasShapedNode(n)
        return {
          id: n.id,
          kind: canvasShaped ? (n.type ?? n.data?.kind) : (n.type ?? n.data?.kind ?? n.kind),
          label: canvasShaped ? (n.data?.label ?? '') : (n.data?.label ?? n.label ?? ''),
          x: Math.round(n.position?.x ?? 0),
          y: Math.round(n.position?.y ?? 0),
          // All node data by default, minus the ephemeral denylist.
          data: serializableData(data, EPHEMERAL_NODE_SET),
        }
      })
      // Comparator coerces so a malformed element cannot throw here. The
      // PROJECTED value above is left exactly as it was, so this changes no
      // signature — it only stops `undefined.localeCompare` taking the render.
      .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? ''))),
    edges: edges
      .map(e => {
        const data = (e.data ?? {}) as Record<string, unknown>
        return {
          // Dual-shape read. React Flow edges carry `source`/`target`;
          // CEE-written rows carry `from`/`to` and NO `source`/`target` at all.
          // No trailing `?? ''`: on a canvas-shaped edge `e.source` is a string,
          // so this is byte-identical to the original `from: e.source`, and on a
          // malformed edge it stays `undefined` exactly as before. The SORT
          // below, not the projection, is what stops the throw.
          from: e.source ?? e.from,
          to: e.target ?? e.to,
          // Legacy composite kept inline to preserve exact dirty-detection for the
          // old callers; redundant with `data.confidence`/`data.weight` below.
          weight: e.data?.confidence ?? e.data?.weight ?? '',
          // All edge data by default, minus the ephemeral denylist (empty today).
          data: serializableData(data, EPHEMERAL_EDGE_SET),
        }
      })
      // Coerced for the same reason as the node comparator: this line is where
      // the P0 threw (`undefined.localeCompare`) and took the canvas.
      .sort(
        (a, b) =>
          String(a.from ?? '').localeCompare(String(b.from ?? '')) ||
          String(a.to ?? '').localeCompare(String(b.to ?? '')),
      ),
  }
  return stableStringify(canonical)
}

export function useAutosave() {
  // React #185 FIX: Use shallow comparison for object/array selectors
  // to prevent infinite re-renders when references change but contents are identical
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  // V3: Include analysis_ready and goal selection in autosave
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const selectedGoalNode = useCanvasStore(s => s.selectedGoalNode)

  // P1 Fix: Track the hash of last saved state (not just last snapshot)
  const lastSavedHashRef = useRef<string>('')

  // Debounce timer for writes
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // P1 Fix: Memoize current graph hash to avoid recomputing on every render
  const currentHash = useMemo(
    () => computeGraphHash(nodes, edges),
    [nodes, edges]
  )

  // Debounced autosave function to reduce localStorage contention in multi-tab scenarios
  // P1 Fix: Only saves if hash differs from last saved hash
  const debouncedSave = useCallback(() => {
    // Clear any pending write
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current)
    }

    writeTimerRef.current = setTimeout(() => {
      // The streamed draft's values are still in progress — see
      // `mayPersistGraphNow`. Checked HERE, inside the fired callback, rather
      // than at the interval tick: the phase can settle during the debounce, and
      // the only phase that matters is the one at the instant of the write.
      //
      // `lastSavedHashRef` is deliberately NOT advanced on this path, so the
      // skipped content stays dirty and the first tick after the draft settles
      // writes it. Declining is a deferral, not a drop.
      if (!mayPersistGraphNow(currentScenarioId)) {
        return
      }

      // P1 Fix: Skip save if content hasn't changed
      if (currentHash === lastSavedHashRef.current) {
        return
      }

      // Multi-tab safety: Check if another tab has newer data before overwriting
      const existingAutosave = loadAutosave()
      const now = Date.now()

      // Only write if no autosave exists, or our data is newer (within tolerance)
      // This prevents race conditions where multiple tabs try to write simultaneously
      if (!existingAutosave || (now - existingAutosave.timestamp) >= DEBOUNCE_MS) {
        // Shared projection (store/autosaveProjection) — the ONE place the
        // autosave payload is assembled. `now` is threaded through so the
        // instant persisted is the same one the staleness guard above compared.
        saveAutosave(
          projectAutosaveData(
            {
              nodes,
              edges,
              scenarioId: currentScenarioId,
              // Boundary cast — the store's CEEAnalysisReady is a WIDER union
              // than AutosaveData's inline shape; the restore path validates
              // before use (same justification as crashFlush's).
              ceeAnalysisReady: ceeAnalysisReady as AutosaveProjectionSource['ceeAnalysisReady'],
              selectedGoalNode,
              // Read at WRITE time from the store, not from a subscribed
              // selector. Two reasons, both deliberate:
              //  1. `saveAutosave` REPLACES — if this timer wrote without the
              //     analysis it would strip the answer `resultsComplete` had
              //     just persisted, on the next graph edit. That is the exact
              //     partial-write class this projection exists to prevent.
              //  2. Subscribing to `results` here would re-render this hook on
              //     every progress tick during a run for no benefit; the
              //     debounced callback only needs the value as it fires.
              // Note the timer CANNOT be the primary writer: its dirty check is
              // computeGraphHash(nodes, edges) and a completed analysis changes
              // neither, so it skips. `resultsComplete` does the real write.
              analysis: analysisSnapshotFromStore(useCanvasStore.getState()),
              // ROADMAP 2.932: read at WRITE time from the store (like analysis
              // above), so the periodic autosave carries the current constraints.
              goalConstraints: useCanvasStore.getState().goalConstraints ?? null,
            },
            now,
          ),
        )

        // P1 Fix: Update last saved hash after successful save
        lastSavedHashRef.current = currentHash

        if (import.meta.env.DEV) {
          console.log('[Autosave] Saved graph state', {
            nodes: nodes.length,
            edges: edges.length,
            scenarioId: currentScenarioId,
            hashChanged: true,
          })
        }
      }
    }, DEBOUNCE_MS)
  }, [nodes, edges, currentScenarioId, currentHash, ceeAnalysisReady, selectedGoalNode])

  // Periodic autosave - only saves if content changed
  useEffect(() => {
    const interval = setInterval(() => {
      // P1 Fix: Only autosave if content changed AND there's something to save
      if (currentHash !== lastSavedHashRef.current && (nodes.length > 0 || edges.length > 0)) {
        debouncedSave()
      }
    }, AUTOSAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      // Clear any pending debounced write on unmount
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current)
      }
    }
  }, [currentHash, nodes.length, edges.length, debouncedSave])

  // -----------------------------------------------------------------------
  // THE CLOSE WINDOW — flush the graph before the page goes away
  // -----------------------------------------------------------------------
  // Between two ticks of the interval above, the newest work exists ONLY in the
  // in-memory store: up to AUTOSAVE_INTERVAL_MS + DEBOUNCE_MS of edits that a
  // reload or a tab close silently destroyed. `flushWorkToAutosave` was written
  // for precisely this and is fully synchronous, but its only importer was
  // `ErrorBoundary.tsx` — a React CRASH, not a close. Neither `beforeunload`
  // handler in the tree closed it either: `useScenario.ts`'s is a navigation
  // WARNING (`preventDefault` only, it writes nothing) and
  // `useThreadPersistence.ts`'s carries the chat transcript, not the graph.
  //
  // ⚠ SYNCHRONOUS OR IT IS THEATRE. `beforeunload`/`pagehide` give no async
  // guarantee — a promise, a `setTimeout` or an `await` here would simply not
  // land. `flushWorkToAutosave` → `saveAutosave` → `localStorage.setItem` is
  // synchronous end to end and completes inside the handler, which is the only
  // reason this path can be trusted at all. Do not make it async.
  //
  // BOTH EVENTS, on purpose. `pagehide` is the reliable one (it fires on
  // bfcache entry and on mobile teardown, where `beforeunload` often does not);
  // `beforeunload` covers the desktop close/reload path. A double fire is free —
  // `saveAutosave` early-returns on a byte-identical payload.
  //
  // Reusing the crash primitive rather than re-projecting here is deliberate:
  // it already owns the shared `projectAutosaveData` projection, the structural
  // plausibility gates, and the "never clobber a good autosave with an empty
  // graph" rule. A second projection would be a hand-maintained mirror of the
  // one above (CLAUDE.md trap 12). Its provider is registered at store MODULE
  // INIT (store.ts:6146), not by the boundary, so it is safe outside one.
  useEffect(() => {
    const flushOnClose = () => {
      // Registered once and read at FIRE time, so the listener stays correct
      // across scenario switches without re-registering — and so the phase it
      // tests is the phase at the moment of the close.
      if (!mayPersistGraphNow(useCanvasStore.getState().currentScenarioId)) return
      flushWorkToAutosave()
    }

    window.addEventListener('pagehide', flushOnClose)
    window.addEventListener('beforeunload', flushOnClose)
    return () => {
      window.removeEventListener('pagehide', flushOnClose)
      window.removeEventListener('beforeunload', flushOnClose)
    }
  }, [])
}

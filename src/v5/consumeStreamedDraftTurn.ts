/**
 * consumeStreamedDraftTurn — the two-phase apply, as a pure orchestration
 * over an async iterable of stage frames (ROADMAP 2.122 / 1.204 M1).
 *
 * Deliberately React-free and store-free: it takes an iterable in and a render
 * callback, and hands back a verdict. That is what makes the required
 * cross-frame identity test provable without mounting a canvas.
 *
 * ── THE RULES IT ENFORCES ─────────────────────────────────────────────────
 *  1. **Render GRAPH_READY on arrival.** Never on a deadline, never buffered.
 *     The live cold-start spread reached 39.9 s, so any client-side "if it has
 *     not arrived by N seconds" gate would either fire on a healthy draw or be
 *     set so high it does nothing. `onGraphReady` is invoked from inside the
 *     iteration loop, and the test pins the CALL ORDER, not just the content —
 *     because a consumer that buffered every frame and rendered at the end
 *     would pass every content assertion while deleting the entire benefit.
 *     (This is #751's M9 mutant, moved to the client.)
 *  2. **Nothing may render a claim from GRAPH_READY's numbers.** The frame is
 *     `status: in_progress` and #745's contract states plainly that
 *     `graph-data-integrity` refines the numeric values after the transform.
 *     This module therefore hands the caller the graph and nothing else — no
 *     `analysis_ready`, no coaching, no freshness. The caller's renderer
 *     (`applyDraftResult`) gates every analysis side-effect on
 *     `hasAnalysisReady(...)`, which a GRAPH_READY frame cannot satisfy, so the
 *     honesty constraint holds by construction of the pre-existing gate.
 *  3. **Terminal frame wins, always.** Identity drift between the preview and
 *     the terminal payload is REPORTED (with the exact offending ids), and the
 *     caller replaces wholesale rather than merging — so "the renderer never
 *     shows a node the terminal payload lacks" is guaranteed by the replacement,
 *     not by a diff that could miss a case.
 *
 *     ⚠ This used to ALSO return a `replaceRenderedGraph: boolean`, and the
 *     adversarial review found it had **zero consumers** (repo-wide grep): the
 *     replacement actually happens through `useConversation`'s
 *     `canvasIsEmpty || streamedPreviewOwnsCanvas` route. An outcome field that
 *     reads as a guarantee and drives nothing is the guarantee-theatre class in
 *     miniature — inside a lane whose whole subject is that class. Deleted rather
 *     than wired, because the route that does the work is already pinned.
 *  4. **A failure is never a dead end.** Any abandonment returns the reason
 *     AND whether a graph is already on screen, because the fallback branch
 *     the caller must take depends on that. See `useConversation`'s
 *     `STREAMED DRAFT FALLBACK` block for why.
 */
import {
  StreamAbandonedError,
  type StageFrame,
  type StageGraph,
  type StreamAbandonReason,
} from './streamedDraftFrames'

export interface StreamedDraftHandlers {
  /** Fired once, on the opening frame (live: 271 ms). */
  onDrafting?: () => void
  /**
   * Fired ONCE, the instant a GRAPH_READY frame arrives (live median 35.8 s).
   * Must render the structure. Must NOT claim anything about the numbers.
   */
  onGraphReady: (graph: StageGraph) => void
  /** Fired when the coaching pass lands (live: 59.2 s). Enum status, not prose. */
  onCoachingReady?: (coachingStatus: string | undefined) => void
}

export interface IdentityDrift {
  nodesOnlyInPreview: string[]
  nodesOnlyInTerminal: string[]
  edgesOnlyInPreview: string[]
  edgesOnlyInTerminal: string[]
}

export type StreamedDraftOutcome =
  | {
      kind: 'complete'
      /** The buffered turn body, verbatim, exactly as `/proxy/v5/turn` returns it. */
      terminalPayload: unknown
      statusCode: number
      /** The graph handed to `onGraphReady`, or null if none was rendered. */
      renderedGraph: StageGraph | null
      /**
       * True when the terminal frame is an error (`status_code >= 400`).
       *
       * ⚠ This field used to be called `discardPreview`, and the name was an
       * instruction the caller obeyed unconditionally — which destroyed a
       * server-committed model on the measured 8 Aug 2026 journey (GRAPH_READY
       * at 96.981 s, terminal COMPLETE 504 UPSTREAM_TIMEOUT at 125.202 s, UI
       * removed the graph and said nothing was drafted while the next turn
       * could reload the committed model). The commit runs server-side around
       * the GRAPH_READY emission and ordinarily survives a late failure (CEE
       * 2.709 first-write exemption), so "terminal error" does NOT imply "no
       * model". The CALLER decides what to do with the preview, using
       * `terminalProvesCommitFailed` on the payload — removal is honest only
       * when the wire proves the commit failed.
       */
      terminalError: boolean
      /** Non-null when the preview and the terminal graph disagree on identity. */
      identityDrift: IdentityDrift | null
    }
  | {
      kind: 'abandoned'
      reason: StreamAbandonReason
      detail: string
      renderedGraph: StageGraph | null
    }

// ---------------------------------------------------------------------------
// Identity — the two shapes, keyed the only ways that are not vacuous
// ---------------------------------------------------------------------------

function graphOf(value: unknown): StageGraph | null {
  if (typeof value !== 'object' || value === null) return null
  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.nodes) || Array.isArray(obj.edges)) return obj as StageGraph
  // The terminal payload nests the graph one level down.
  if (typeof obj.graph === 'object' && obj.graph !== null) return graphOf(obj.graph)
  return null
}

/** Sorted node ids. Sorted so wire ordering cannot make an equal pair unequal. */
export function nodeIdentities(value: unknown): string[] {
  const g = graphOf(value)
  const nodes = Array.isArray(g?.nodes) ? g!.nodes : []
  return nodes
    .map((n) => (typeof n === 'object' && n !== null ? String((n as { id?: unknown }).id) : ''))
    .filter((id) => id.length > 0 && id !== 'undefined')
    .sort()
}

/**
 * Sorted `from->to` endpoint pairs.
 *
 * NOT `e.id`. Wire edges on this path carry no `id` — they are `from`/`to`
 * pairs — so keying on `id` produces `[]` on both sides of every comparison
 * and each one passes while testing nothing. That is the exact vacuity #751's
 * own identity test shipped with in round 1.
 */
export function edgeIdentities(value: unknown): string[] {
  const g = graphOf(value)
  const edges = Array.isArray(g?.edges) ? g!.edges : []
  return edges
    .map((e) => {
      if (typeof e !== 'object' || e === null) return ''
      const o = e as Record<string, unknown>
      const from = o.from ?? o.source
      const to = o.to ?? o.target
      if (typeof from !== 'string' || typeof to !== 'string') return ''
      return `${from}->${to}`
    })
    .filter((k) => k.length > 0)
    .sort()
}

/**
 * Trap-13 control. An agreement assertion that has never seen a presence is
 * vacuous, so every identity comparison must first prove both sides are
 * non-empty. Throws — it is a test-time guard, used in production code paths
 * only via the drift computation below (which tolerates empties).
 */
export function expectComparableGraph(value: unknown, label: string): void {
  const ids = nodeIdentities(value)
  if (ids.length === 0) {
    throw new Error(
      `${label} yielded no nodes — an identity comparison against it would pass by testing nothing`,
    )
  }
}

function computeDrift(preview: unknown, terminal: unknown): IdentityDrift | null {
  const pn = nodeIdentities(preview)
  const tn = nodeIdentities(terminal)
  const pe = edgeIdentities(preview)
  const te = edgeIdentities(terminal)
  const drift: IdentityDrift = {
    nodesOnlyInPreview: pn.filter((id) => !tn.includes(id)),
    nodesOnlyInTerminal: tn.filter((id) => !pn.includes(id)),
    edgesOnlyInPreview: pe.filter((k) => !te.includes(k)),
    edgesOnlyInTerminal: te.filter((k) => !pe.includes(k)),
  }
  const clean =
    drift.nodesOnlyInPreview.length === 0 &&
    drift.nodesOnlyInTerminal.length === 0 &&
    drift.edgesOnlyInPreview.length === 0 &&
    drift.edgesOnlyInTerminal.length === 0
  return clean ? null : drift
}

// ---------------------------------------------------------------------------
// Terminal-payload commit reconciliation (F1 — draft-state truth)
// ---------------------------------------------------------------------------

/**
 * Does this terminal error payload PROVE the draft's graph commit failed?
 *
 * The one wire shape that does is CEE route-v2's `!dg.commitPerformed`
 * envelope — captured at the wire in the fresh-journey P0 diagnosis §1.4:
 * `{error: INTERNAL_ERROR, validator: turn_commit, details: {reason:
 * "draft_graph_commit_failed", retryable: true}}`. For that class the server
 * has said "Nothing was written", so removing the rendered preview states the
 * truth.
 *
 * Everything else — the measured 504 UPSTREAM_TIMEOUT class, proxy timeout
 * bodies, any other ≥400 — leaves the commit UNKNOWABLE from this side of the
 * socket, and measured-COMMON to have succeeded (the commit runs around the
 * GRAPH_READY emission; CEE 2.709's first-write exemption protects it from
 * mid-draft claims). Returning `false` routes the caller to keep-and-mark,
 * which is never a fabrication: it claims only that the structure was rendered
 * and the save is unconfirmed.
 *
 * The read is a narrow duck-walk over the containers CEE errors actually use
 * (top level, `details`, nested `error`), matching `ceeRecovery.ts`'s
 * fail-closed style. Fail-closed here means: an unreadable payload proves
 * nothing, so the preview is KEPT and marked — the direction that cannot
 * destroy a committed model.
 */
export function terminalProvesCommitFailed(payload: unknown): boolean {
  const record = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  const root = record(payload)
  if (!root) return false
  const containers = [root, record(root.details), record(root.error), record(record(root.error)?.details)]
  return containers.some((c) => c !== null && c.reason === 'draft_graph_commit_failed')
}

// ---------------------------------------------------------------------------

export async function consumeStreamedDraftTurn(
  frames: AsyncIterable<StageFrame>,
  handlers: StreamedDraftHandlers,
): Promise<StreamedDraftOutcome> {
  let renderedGraph: StageGraph | null = null
  let renderAttempted = false

  try {
    for await (const frame of frames) {
      switch (frame.stage) {
        case 'DRAFTING':
          handlers.onDrafting?.()
          break

        case 'GRAPH_READY': {
          // Render on arrival. `renderAttempted` — not `renderedGraph` — guards
          // the repeat, so a callback that threw is not retried on a duplicate
          // frame and quietly succeeds the second time.
          if (renderAttempted || !frame.graph) break
          renderAttempted = true
          try {
            handlers.onGraphReady(frame.graph)
            renderedGraph = frame.graph
          } catch {
            // A canvas-side failure must not cost the user the whole turn —
            // the terminal ingest below still runs and applies the full graph.
            renderedGraph = null
          }
          break
        }

        case 'COACHING_READY':
          handlers.onCoachingReady?.(frame.coaching_status)
          break

        case 'COMPLETE': {
          const statusCode = frame.status_code ?? 200
          // See the module header: `salvaged_from_truncation` is NOT a rung
          // here, because #751 established the streamed frames never carry it.
          const terminalError = statusCode >= 400
          const identityDrift =
            renderedGraph && !terminalError
              ? computeDrift(renderedGraph, (frame.payload as { draft_graph?: unknown })?.draft_graph)
              : null
          return {
            kind: 'complete',
            terminalPayload: frame.payload,
            statusCode,
            renderedGraph,
            terminalError,
            identityDrift,
          }
        }

        case 'PROGRESS':
          // Modelled, never observed on the wire (see streamedDraftFrames'
          // header). Intentionally inert: no product behaviour may depend on a
          // frame class nothing feeds.
          break
      }
    }

    return {
      kind: 'abandoned',
      reason: 'no_terminal_frame',
      detail: 'stream ended without a terminal frame',
      renderedGraph,
    }
  } catch (e) {
    if (e instanceof StreamAbandonedError) {
      return { kind: 'abandoned', reason: e.reason, detail: e.message, renderedGraph }
    }
    const err = e as Error
    return {
      kind: 'abandoned',
      reason: err?.name === 'AbortError' ? 'aborted' : 'transport',
      detail: err?.message ?? 'unknown stream failure',
      renderedGraph,
    }
  }
}

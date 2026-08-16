/**
 * Automatic capture immediately before a destructive ingest.
 * British English: visualisation, colour, initialise.
 *
 * WHY THIS EXISTS. `applyDraftResult` replaces the whole graph wholesale. A
 * user who has spent an hour shaping a model and then asks a follow-up question
 * can have that model replaced by a draft. Undo covers one step; a named
 * version they can read and compare is what makes the loss recoverable and
 * VISIBLE.
 *
 * WHERE IT FIRES, AND WHY EXACTLY THERE. `applyDraftResult` runs TWICE for one
 * streamed turn — a GRAPH_READY preview at ~36 s and the terminal payload at
 * ~61 s — and `opts.skipHistory` is `true` on the second. The pre-draft canvas
 * therefore only exists at the FIRST call; by the second, the store already
 * holds the preview graph. So this fires on exactly the same condition as
 * `store.pushHistory()` — capture the user's model, once, while it is still
 * there. Keying off anything else would snapshot the preview and call it the
 * user's work.
 *
 * IT MUST NEVER BREAK THE INGEST. Every failure is swallowed with a warning.
 * A version is a safety net; a safety net that can take down the canvas is
 * worse than no net. This is the one place in the namespace where an exception
 * is deliberately quiet, and the reason is that the user's actual request —
 * "draft me a graph" — must still succeed.
 */

import type { Edge, Node } from '@xyflow/react'
import { captureModelVersion } from './captureModelVersion'
import { appendVersion } from './versionStorage'

/**
 * Capture the current graph as an automatic version, if there is anything
 * worth keeping.
 *
 * No-ops on an empty canvas: replacing nothing is not a loss, and a list
 * cluttered with empty auto-saves would bury the versions the user named.
 */
export function captureBeforeIngest(nodes: readonly Node[], edges: readonly Edge[]): void {
  try {
    if (nodes.length === 0) return

    const createdAt = Date.now()
    const version = captureModelVersion(nodes, edges, {
      id: `ver_auto_${createdAt}_${Math.random().toString(36).slice(2, 11)}`,
      // Names what happened, in the user's terms. No claim about the draft's
      // quality or about what changed — that is the changeset's job.
      name: 'Before Olumi redrafted the model',
      origin: 'pre-ingest',
      createdAt,
    })

    const result = appendVersion(version)
    if (!result.success) {
      console.warn('[versions] Could not capture a version before redraft:', result.error.message)
    }
  } catch (error) {
    console.warn('[versions] Version capture before redraft failed; ingest continues', error)
  }
}

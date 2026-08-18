/**
 * What the product is allowed to SAY when the boot arbiter restores a graph.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE (W-1) ────────────────────────────────────
 * Measured live on the deployed staging build `6524caed`, 2026-08-18, with
 * storage cleared from `/version.json` so no SPA unload write could re-seed it:
 * a guest opened the "Customer Data Platform Selection" saved example and
 * reloaded. The canvas came back announced by
 *
 *     "Recovered unsaved changes from your last session."
 *
 * The graph was Olumi's own bundled demo, drafted on 2026-07-28 and shipped
 * inside the app. Two claims in one sentence, both false: that the model was
 * the visitor's, and that it was unsaved work of theirs.
 *
 * ── WHY A SEPARATE MODULE ────────────────────────────────────────────────────
 * The boot arbiter and the toast that speaks for it live ~200 lines apart in
 * `ReactFlowGraph.tsx`, joined by a `sessionStorage` flag whose only value was
 * `'true'` — a boolean cannot carry WHAT was restored, so the copy had nowhere
 * to come from but a literal at the far end. Both halves live here, so the
 * question "may we call this the user's own work?" is asked and answered in one
 * place, and can be tested without mounting a 3,000-line component.
 *
 * ── HOW THE QUESTION IS ANSWERED ─────────────────────────────────────────────
 * By `resolveStarterId` over the restored nodes — the SAME predicate the canvas
 * disclosure (`StarterProvenanceBanner`) and the run gate
 * (`computeCeeCannotSeeModel`) already use. Not a new "is this a demo" flag: a
 * second answer to one question is how the disclosure and the gate would come
 * to disagree, and the graph's own stamp is the authoritative persisted read
 * (P5) — it is present exactly when the starter graph is.
 *
 * ⚠ This is only sound because `applyStarter` now persists the stamp. Until
 * 2026-08-18 it stamped AFTER `applyDraftResult` had already written the
 * autosave, so the restored graph carried no stamp and this classification
 * would have returned `unsaved_work` for every starter. The two changes are one
 * fix; see `loadStarter.ts`.
 */

import { resolveStarterId } from '../starters/loadStarter'
import { useCanvasStore } from '../store'

/** The cross-effect handoff key. Unchanged — an older build's value still reads. */
export const RECOVERY_NOTICE_KEY = 'olumi-recovered-from-autosave'

/**
 * What was restored — NOT how confident we are, and NOT whether to speak.
 * The kind decides the sentence; the sentences differ in what they CLAIM.
 */
export type RecoveryNoticeKind = 'unsaved_work' | 'saved_example'

export const RECOVERY_NOTICE_COPY: Record<RecoveryNoticeKind, string> = {
  /**
   * Unchanged, deliberately. This is the case the notice was BUILT for — a
   * real user with real unsaved work — and it is still true of that case. The
   * defect was never this sentence; it was this sentence being said about
   * something else.
   */
  unsaved_work: 'Recovered unsaved changes from your last session.',
  /**
   * Says only what holds in every sub-case, including a visitor who edited the
   * example for an hour: the saved example is back on the canvas. It makes no
   * claim about authorship, and none about how much of the session was theirs
   * — "nothing of yours was recovered" would be a fresh false claim the moment
   * they had edited it (one predicate cannot guard both harms).
   *
   * The rest of the truth is carried by `StarterProvenanceBanner`, which
   * renders persistently beside it and names the example and its draft date:
   * "Saved example — Olumi drafted this model on <date>. It wasn't generated
   * just now." That banner is the estate's existing, tested disclosure for
   * exactly this question, and it is back on screen now that the stamp
   * survives the reload.
   */
  saved_example: 'Reopened the saved example.',
}

/** Minimal shape the classification reads — any node-like will do. */
type NodeLike = { data?: Record<string, unknown> | undefined }

/**
 * Which notice a restored graph has earned.
 *
 * Bound by IDENTITY (the starter stamp), never by a value predicate another
 * graph could satisfy — a node count, a title match or a "looks generated"
 * heuristic would all classify a real user's model as a demo sooner or later.
 */
export function classifyRecoveredGraph(nodes: ReadonlyArray<NodeLike>): RecoveryNoticeKind {
  return resolveStarterId(nodes) != null ? 'saved_example' : 'unsaved_work'
}

/**
 * Record, at boot, that a restore happened and what it restored.
 *
 * ⚠ TAKES NO ARGUMENT, DELIBERATELY. The boot arbiter hydrates the store from
 * the chosen source BEFORE it reaches this call, so the canvas already holds
 * exactly the graph the notice is about. Reading it here rather than accepting
 * it removes the one way this can silently go wrong: a call site that passes
 * the wrong array (or an empty one) would classify every restore as
 * `unsaved_work` and re-open W-1 with nothing red anywhere — and a call site
 * buried in a 3,000-line effect is not something a unit test can pin. No
 * argument, no mis-binding. It also makes the classification a statement about
 * what the user is looking at (P2), which is what the sentence claims to be
 * about.
 *
 * Fail-soft: `sessionStorage` throws in some privacy modes, and a missing
 * toast must never be the thing that stops a canvas loading.
 */
export function armRecoveryNotice(): void {
  try {
    sessionStorage.setItem(
      RECOVERY_NOTICE_KEY,
      classifyRecoveredGraph(useCanvasStore.getState().nodes),
    )
  } catch {
    /* sessionStorage unavailable — the graph still restores, silently */
  }
}

/**
 * Take the pending notice, if any, and clear it. Returns the sentence to show,
 * or null when nothing was restored.
 *
 * `'true'` is accepted as `unsaved_work` for one reason only: a tab that armed
 * the flag on the previous build and consumed it after a deploy would otherwise
 * fall silent. It is a read-side alias, never written.
 */
export function consumeRecoveryNotice(): string | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(RECOVERY_NOTICE_KEY)
    if (raw != null) sessionStorage.removeItem(RECOVERY_NOTICE_KEY)
  } catch {
    return null
  }
  if (raw == null) return null
  if (raw === 'saved_example') return RECOVERY_NOTICE_COPY.saved_example
  if (raw === 'unsaved_work' || raw === 'true') return RECOVERY_NOTICE_COPY.unsaved_work
  return null
}

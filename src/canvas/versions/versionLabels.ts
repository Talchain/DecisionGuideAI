/**
 * The words the versions surface uses, in ONE place.
 * British English: visualisation, colour, initialise.
 *
 * ── WHY A LEAF MODULE ────────────────────────────────────────────────────────
 * Two problems this solves, both measured on the 16-Aug build.
 *
 * 1. AUTOMATIC CAPTURES WERE INVISIBLE. `autoCapture.ts` writes a version with
 *    `origin: 'pre-ingest'` immediately before a draft replaces the user's
 *    model. The panel rendered `origin` NOWHERE, so those rows sat in the list
 *    indistinguishable from ones the user had named — a history the user could
 *    not account for. The origin is now rendered, from this one string, in both
 *    the list and the comparison selects; a select cannot host a badge, so the
 *    two would otherwise have been two hand-copied strings (trap 12).
 *
 * 2. "VERSION" AND "ANALYSIS RUN" WERE MIXED. They are different objects:
 *    a VERSION is a snapshot of the model the USER authored (nodes, edges,
 *    values); an ANALYSIS RUN is a computation the ENGINE performed over one.
 *    Saving a version runs nothing; running an analysis saves nothing. Two
 *    surfaces both said "What changed", answering those two different
 *    questions (trap 21 — name the concepts apart rather than letting one
 *    phrase serve both). The panel's vocabulary is pinned here so a future
 *    edit cannot quietly reintroduce the collision in one surface only.
 */

import type { VersionOrigin } from './types'

/**
 * What an automatic capture is, in the user's terms. `autoCapture.ts` fires on
 * exactly one condition — the first `applyDraftResult` of a streamed turn,
 * before the draft replaces the canvas — so "before draft applied" is a
 * statement about when it happened, not a guess.
 */
export const AUTO_CAPTURE_LABEL = 'auto — before draft applied'

/** What a manually saved version is. Rendered only where the two are contrasted. */
export const MANUAL_CAPTURE_LABEL = 'saved by you'

/**
 * The origin marker for a version, or null when there is nothing to say.
 *
 * Manual saves return null on purpose: a marker on every row is noise, and the
 * row the user needs to recognise is the one THEY did not create.
 */
export function versionOriginLabel(origin: VersionOrigin): string | null {
  return origin === 'pre-ingest' ? AUTO_CAPTURE_LABEL : null
}

/**
 * The origin marker as a suffix for a plain-text context (an `<option>`, which
 * cannot host an element). Same source string as the badge — this exists so
 * there is no second copy, not because the two surfaces are different.
 */
export function versionOriginSuffix(origin: VersionOrigin): string {
  const label = versionOriginLabel(origin)
  return label === null ? '' : ` · ${label}`
}

/**
 * THE VOCABULARY DISCLOSURE. Says what a version is AND what it is not, in the
 * panel, once. The negative half is load-bearing: without it a user who has
 * just run an analysis reasonably reads "Save a version" as "save these
 * results", and the product would be inviting a belief it cannot honour —
 * `ModelVersion` carries no results field at all (`types.ts`).
 */
export const VERSION_VS_RUN_DISCLOSURE =
  'A shared version is a durable state of the model your team authored. ' +
  'It is not an analysis run: versions never store results, and saving one does not run an analysis.'

/**
 * THE STORAGE-SCOPE DISCLOSURE (ledger L-33). Stays prominent — it is the one
 * thing about this feature a user cannot discover by using it, and the failure
 * it prevents (assuming a colleague can see your versions) is silent.
 */
export const VERSION_STORAGE_DISCLOSURE =
  'On-this-device checkpoints are stored in this browser only. They are not authoritative shared history, are not visible to collaborators, and are lost if you clear site data.'

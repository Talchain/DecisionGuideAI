/**
 * valueProvenance — ONE classification authority for "who put this number here".
 *
 * ROADMAP 2.638 S2 (P4, human–AI collaboration). Ships the disclosure half of
 * the confirmed-values design: no maths changes, nothing new crosses the wire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS — CONFIRMED AND EDITED ARE DIFFERENT CLAIMS
 * ─────────────────────────────────────────────────────────────────────────────
 * **Edited** = the human supplied a number. **Confirmed** = the human read the
 * number that was already there and said "that one is right". The second is the
 * expensive signal — it is a person putting their name to a machine's estimate
 * — and the estate has been collapsing it into the first (consent witness,
 * ROADMAP 2.663: a confirmed value labelled "User edited").
 *
 * Four live surfaces got it wrong in four different ways, each because the
 * label lived in a hand-maintained map that nobody extended when the
 * `user_confirmed` / `user_override` stamps were introduced (CLAUDE.md trap 12):
 *
 *   · `SourceProvenancePill`  (Model tab)      → **"Not set"**
 *   · `getExtractionLabel`    (3 inspector panels) → **"Estimated by Olumi"**
 *   · `mapSourceToDisplay`    (Model tab, clipboard) → the raw wire literal
 *   · `provenanceToPill`      (node-level `user_set`)  → **null**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE ECHO CANNOT SETTLE THIS — derived at the producer's bytes, 6 Aug 2026
 * ─────────────────────────────────────────────────────────────────────────────
 * The design brief (§4.2) says to drive the confirmation surface from the
 * ECHOED `FactorSensitivityV2.value_source` — "what the engine says it computed
 * with" — rather than from client state. **That premise does not survive
 * measurement, and this module is deliberately client-driven instead.**
 *
 * CEE's `set_factor_value` stamps `observed_state.source = USER_EDIT_SOURCE`,
 * and `USER_EDIT_SOURCE` is the single literal `'user_override'`
 * (`orchestrator/canonicalise-value-ops.ts:280`, applied at
 * `orchestrator-v5/tools/handlers/set-factor-value.ts:421`; read at CEE staging
 * `d5b64246`). It writes that stamp for a typed value AND for a confirm-as-is,
 * which CEE receipts as `noop`. So **the server graph — and therefore every
 * echoed `value_source` — is structurally incapable of distinguishing the two
 * acts.** Two further ways the echo and the client disagree, both real:
 *   · TEMPORAL — the echo describes the graph the LAST ANALYSIS ran on; a
 *     confirmation made after that run has no echo at all.
 *   · COVERAGE — `factor_sensitivity` carries `value_source` only for
 *     PU-listed factors (ground-truth correction 5), so a confirmed valued
 *     factor with no parameter-uncertainty entry has no echo ROW.
 *
 * The client stamp is not a weaker signal here, it is the ONLY one: it is
 * written by `confirmOptimisticFactorEdit` **after CEE's applied `graph_patch`
 * receipt**, and flushed to the autosave at that moment. It is receipt-backed
 * evidence that the client alone holds.
 *
 * ⚠ RESIDUAL, named rather than hidden: if the local autosave is absent (a
 * different browser or device), the boot merge lands CEE's collapsed
 * `user_override` and a confirm-as-is reads as an edit. Closing that needs a
 * distinct server-side stamp for the confirm act — a CEE change, not a UI one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAPE — classification here, COPY at each surface
 * ─────────────────────────────────────────────────────────────────────────────
 * This module owns the *kind*. Each surface keeps its own register (the Model
 * tab is terse, the inspector writes sentences) but must be TOTAL over
 * `ValueProvenanceKind` — a `Record<ValueProvenanceKind, …>` makes a missing
 * kind a type error rather than a silent fallback. That is the derivation trap
 * 12 asks for without forcing one voice on every surface.
 */

/** What act put the number there. */
export type ValueProvenanceKind =
  /** The human read the number that was there and endorsed it. */
  | 'confirmed'
  /** The human supplied the number. */
  | 'edited'
  /** The human recorded it as an explicit assumption. */
  | 'assumption'
  /** A human owns it, but the record does not say which act (wire-level `user_set`). */
  | 'human'
  /** Extracted from the user's own brief by the model. */
  | 'brief'
  /** The model's own estimate. */
  | 'ai'

export interface ValueProvenanceClass {
  kind: ValueProvenanceKind
  /** True when a person, not the model, owns the claim. */
  userOwned: boolean
}

/**
 * Every `observed_state.source` literal any producer in this estate is known to
 * write. Sources, with the byte read that established each:
 *
 *   `user_confirmed`  — client "Confirm as is" (`CalibrateDrillIn.tsx:126`,
 *                       `PreAnalysisPanel.tsx:1154`, `OutputsDock.tsx:1280`)
 *   `user_override`   — client typed value (`CalibrateDrillIn.tsx:125`,
 *                       `PreAnalysisPanel.tsx:1193`, `OutputsDock.tsx:1296`)
 *                       AND **CEE server-side, for BOTH acts** (see above)
 *   `user`            — Model-tab factor-value edits
 *   `user_edited`     — recognised by the OutputsDock transition bridge
 *   `user_calibration`— inspector calibration (`inspectorStrings.ts`)
 *   `user_assumption` — reserved "mark as assumption"; recognised, not yet written
 *   `brief_extraction`/`explicit` — extraction from the user's brief
 *   `cee_inference`/`inferred`/`cee_repair` — the model's own estimate
 */
const SOURCE_CLASSES: Readonly<Record<string, ValueProvenanceKind>> = Object.freeze({
  user_confirmed: 'confirmed',
  user_override: 'edited',
  user: 'edited',
  user_edited: 'edited',
  user_calibration: 'edited',
  user_assumption: 'assumption',
  brief_extraction: 'brief',
  explicit: 'brief',
  cee_inference: 'ai',
  inferred: 'ai',
  cee_repair: 'ai',
})

const USER_OWNED_KINDS: ReadonlySet<ValueProvenanceKind> = new Set<ValueProvenanceKind>([
  'confirmed',
  'edited',
  'assumption',
  'human',
])

/** Every classified literal — the completeness corpus checks against this. */
export const VALUE_PROVENANCE_SOURCES: readonly string[] = Object.freeze(
  Object.keys(SOURCE_CLASSES),
)

/** The literals that mean "the human ratified the number that was there". */
export const CONFIRMED_SOURCES: readonly string[] = Object.freeze(
  VALUE_PROVENANCE_SOURCES.filter((s) => SOURCE_CLASSES[s] === 'confirmed'),
)

/** The literals that mean "the human supplied the number". */
export const EDITED_SOURCES: readonly string[] = Object.freeze(
  VALUE_PROVENANCE_SOURCES.filter((s) => SOURCE_CLASSES[s] === 'edited'),
)

/** True when this kind is a claim a PERSON owns. */
export function isUserOwnedKind(kind: ValueProvenanceKind): boolean {
  return USER_OWNED_KINDS.has(kind)
}

/**
 * Classify an `observed_state.source` literal.
 *
 * Returns `null` — never a guessed class — for an unknown literal. A surface
 * that renders `null` must fall back to its own honest neutral; inventing a
 * class here is how "Estimated by Olumi" ended up on a confirmed value.
 */
export function classifyValueProvenance(
  source: string | null | undefined,
): ValueProvenanceClass | null {
  if (typeof source !== 'string') return null
  const kind = SOURCE_CLASSES[source]
  if (kind === undefined) return null
  return { kind, userOwned: USER_OWNED_KINDS.has(kind) }
}

/**
 * Classify the NODE-LEVEL `data.provenance` value, whose vocabulary is a
 * different, smaller one (`CEEProvenance`).
 *
 * `user_set` maps to `'human'`, not to `'confirmed'`: CEE writes it on every
 * applied `set_factor_value` regardless of act, so it says a person owns the
 * value and nothing more. Rendering it as "confirmed" would be exactly the
 * over-claim this module exists to stop.
 */
export function classifyNodeProvenance(
  provenance: string | null | undefined,
): ValueProvenanceClass | null {
  if (provenance === 'user_set') return { kind: 'human', userOwned: true }
  if (provenance === 'from_brief') return { kind: 'brief', userOwned: false }
  if (provenance === 'ai_inferred') return { kind: 'ai', userOwned: false }
  return null
}

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
  /**
   * A NAMED COLLEAGUE'S panel answer, applied by the owner from a closed
   * elicitation round (schemas 0.40.0 `panel_elicited` + `elicited_from`).
   *
   * ⚠ NOT a member of `USER_OWNED_KINDS`, and that is the whole point of it
   * being its own kind rather than an alias for `'edited'`. "User owned" means
   * THIS user vouched for the number; a panel value is somebody ELSE's stated
   * belief, which the owner chose to adopt. Collapsing the two would put the
   * colleague's estimate behind first-person copy ("Set by you") and reproduce
   * exactly the attribution untruth this kind exists to end — the retype path
   * stamped `user_override` and rendered as "User edited".
   */
  | 'panel'

export interface ValueProvenanceClass {
  kind: ValueProvenanceKind
  /** True when a person, not the model, owns the claim. */
  userOwned: boolean
}

/**
 * ⭐ THE ONE LABEL PER KIND, FOR EVERY SURFACE THAT NAMES AUTHORSHIP.
 *
 * ⚠ WHY IT MOVED HERE. These strings were `SourceProvenancePill`'s private
 * `CONFIG`, which made the Model tab the only surface that could say whose a
 * number is. The Reasoning tab's factor detail needs the same answer in a
 * different shape (a panel-scale line, not an outlined pill), and copying the
 * seven strings across would have been the hand-maintained mirror this estate
 * pays for repeatedly (CLAUDE.md trap 12) — two spellings of one authorship
 * claim, free to drift into disagreeing about the same factor.
 *
 * ⚠ LABELS ONLY, NOT STYLE. Each surface keeps its own border/colour
 * vocabulary: the pill is outlined by semantic token, the panel line is
 * `typography.panelMeta`. Sharing the WORDS is the point; sharing the paint
 * would force one surface into the other's design system.
 *
 * The record is TOTAL over `ValueProvenanceKind`, so a new kind is a type error
 * here rather than a silent fallback at every consumer.
 */
export const VALUE_PROVENANCE_LABEL: Readonly<Record<ValueProvenanceKind, string>> = Object.freeze({
  brief: 'From brief',
  ai: 'AI estimate',
  confirmed: 'Confirmed by you',
  edited: 'User edited',
  assumption: 'Your assumption',
  human: 'Set by you',
  panel: 'From your panel',
})

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
  /**
   * 0.40.0 — server-stamped by CEE, and ONLY after it verified the owner's
   * `applied_from` claim against its own collab store (round on this scenario ·
   * participant on that round · that participant's latest belief for this
   * target · round closed · value equal to the server's record). So a
   * `panel_elicited` literal arriving here is a fact the server established,
   * never one a client asserted.
   */
  panel_elicited: 'panel',
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
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE INTERVENTION VOCABULARY — A DIFFERENT FIELD WEARING THE SAME NAME
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * An option's `interventions[factorId].source` answers **HOW THIS TARGET WAS
 * DETERMINED**. A node's `observed_state.source` answers **WHO PUT THIS VALUE
 * HERE**. Two questions, two closed vocabularies, one field name — and the
 * shared contract says so itself, at `edit-tool-ops.js:229-238` in the vendored
 * 0.48.0 package:
 *
 *   *"`source` IS ONE OF ITS FIELDS (`cee-v3.ts:284` — an enum of
 *   `brief_extraction | cee_hypothesis | user_specified`, meaning HOW THE
 *   INTERVENTION WAS DETERMINED). That is a different field from node
 *   `observed_state.source` wearing the same name, and CEE exempts it for
 *   exactly this reason."*
 *
 * ⚠⚠ THIS IS WHY `cee_hypothesis` IS **NOT** IN `SOURCE_CLASSES`, AND ADDING IT
 * WAS THE FIRST THING THIS LANE TRIED (B1-a, 2026-08-24). It typechecks, it
 * makes the surface render the right words, and `sourceClassesCompleteness`
 * REDs on it — correctly, because the guard's complement assertion exists to
 * catch exactly this: a literal classified here that the contract's
 * `OBSERVED_STATE_SOURCE_LITERALS` does not declare. Merging the two maps would
 * have made `classifyValueProvenance('cee_hypothesis')` answer a question about
 * a factor's observed value that no producer ever asks, and would have made the
 * one guard that can see contract drift permanently unable to.
 *
 * The two vocabularies OVERLAP on `brief_extraction` and are otherwise
 * disjoint, which is what makes the merge look harmless and is why it is not.
 *
 * ⚠ WHAT IS SHARED IS THE **KIND**, DELIBERATELY. Both classifiers return the
 * same `ValueProvenanceKind`, so every surface keeps ONE taxonomy and ONE
 * `Record<ValueProvenanceKind, …>` register. The concepts are named apart at the
 * literal layer and joined at the kind layer — which is the shape CLAUDE.md
 * trap 21 prescribes for two authorities answering different questions.
 *
 * ⚠ THE CONTRACT DOES NOT EXPORT THESE LITERALS. The vendored package "does not
 * carry InterventionV3" (same comment, same file), so unlike `SOURCE_CLASSES`
 * this map has NO canonical list to be checked against and no derivation is
 * available. Stated rather than discovered later: the guard for this map is a
 * HAND-WRITTEN CORPUS pinned to the contract's own quoted enum, which is the
 * other half of trap 12d — where you cannot derive, a corpus is what notices the
 * list is short. If a future schemas minor exports the intervention literals,
 * replace the corpus with a derived guard and delete this paragraph.
 */
const INTERVENTION_SOURCE_CLASSES: Readonly<Record<string, ValueProvenanceKind>> = Object.freeze({
  /** The target is the user's own figure, lifted from their brief. */
  brief_extraction: 'brief',
  /**
   * ⭐ THE MODEL CHOSE THIS NUMBER. Witnessed on the deployed build (UI
   * `88cb7e37` · CEE `d1da670`, fresh guest, 2026-08-24): every
   * `cee_hypothesis` entry on that draw carried `value_confidence: 'low'` and
   * the producer's own reasoning — *"Model-chosen intervention level; this
   * amount is not stated in the brief"* — against `brief_extraction` siblings
   * carrying `value_confidence: 'high'` and a reasoning quoting the user's own
   * sentence verbatim. The class is the one the PRODUCER declares, not one
   * inferred from the symptom (trap 13c).
   */
  cee_hypothesis: 'ai',
  /** The human supplied the target. `'edited'`, and therefore user-owned. */
  user_specified: 'edited',
})

/** Every intervention-source literal this map classifies — the corpus checks it. */
export const INTERVENTION_PROVENANCE_SOURCES: readonly string[] = Object.freeze(
  Object.keys(INTERVENTION_SOURCE_CLASSES),
)

/**
 * Classify an `interventions[factorId].source` literal.
 *
 * Returns `null` — never a guessed class — for an unknown literal, for the same
 * reason `classifyValueProvenance` does: a surface that renders `null` must fall
 * back to its own honest silence. Guessing here would put "AI estimate" over a
 * number the user typed, or the reverse, which is the defect this pair of
 * classifiers exists to end.
 *
 * ⚠ DO NOT ROUTE AN `observed_state.source` THROUGH THIS FUNCTION, or an
 * intervention source through its sibling. They overlap on one literal and
 * would agree on it, which is precisely how a wrong call survives review.
 */
export function classifyInterventionProvenance(
  source: string | null | undefined,
): ValueProvenanceClass | null {
  if (typeof source !== 'string') return null
  const kind = INTERVENTION_SOURCE_CLASSES[source]
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

/**
 * Does this factor's value still need a human to look at it?
 *
 * ⚠ MOVED HERE 18 Aug 2026 — IT WAS THE ESTATE'S OWN DOCUMENTED MIRROR. The
 * predicate existed twice: inline inside `countFactorsToVerify`
 * (`components/model-tab/utils.ts`), and as a deliberate PORT in
 * `model-tab-v2/adapters.ts` whose header said so in as many words and pinned
 * the copy against the live count over a corpus. That pin was honest and it was
 * still a mirror — it could only prove the two AGREED, never that either was
 * right, and it needed a hand-written corpus to do even that (trap 12d).
 *
 * The REHOME → DELETE lane forced the issue: the Model tab's Confirm ✓ must be
 * offered by exactly the predicate that counts the factor as unverified, or the
 * badge and the button disagree about the same row. Three readings of one
 * question was one too many before; four would have been absurd. So it moved to
 * the domain layer both surfaces already depend on, and neither keeps a copy.
 *
 * ⚠ IT READS BOTH SPELLINGS. Canvas stores `observedState`; the CEE/PLoT wire
 * uses `observed_state`, and real graphs carry both. Reading one under-counts.
 *
 * ⚠ ANY SOURCE OTHER THAN ABSENT-OR-`cee_inference` CLEARS IT — including
 * `user_confirmed`, which is what ratifying an estimate now stamps. That is the
 * behaviour the count has always had; it is stated here because the Confirm
 * gesture is the thing that produces the transition, and a reader of the button
 * needs to know the badge will clear with it.
 */
export function factorNeedsVerification(data: unknown): boolean {
  const d = data as Record<string, unknown> | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  return !obs?.source || obs?.source === 'cee_inference'
}

/**
 * Is there a number here that a confirmation could actually ratify?
 *
 * ⚠⚠ THIS IS THE AUTHORITY'S OWN REFUSAL CONDITION, INVERTED — NOT A READING OF
 * IT. `useModelEditAuthority.proposeFactorConfirmation` returns
 * `'not_encodable'` unless `observedState.value` is a FINITE NUMBER, and it
 * stamps nothing when it refuses. Every surface that OFFERS a confirmation must
 * therefore gate on exactly this, or it renders a control the authority will
 * silently decline (preamble P8 — an enabled button that does nothing).
 *
 * The authority imports this rather than keeping its own copy, so the gate and
 * the refusal cannot drift apart. That is the whole point: a surface asking
 * "may I offer Confirm?" and the writer answering "no" must be ONE predicate.
 *
 * ⚠ IT IS `value`, NOT `raw_value`, AND THE DIFFERENCE IS WIRE-REAL. `value` is
 * MODEL scale; `raw_value` is the USER-UNIT magnitude, and it is frequently
 * ABSENT — `conversation/factorValueEdit.ts:145` records the staging-witnessed
 * shape `{value: 0.7}` with no `raw_value` for a capped factor. A gate written
 * against `raw_value` (or against `getPrimaryValue`, which reads only
 * `raw_value`) therefore refuses a whole class of factors the authority would
 * have accepted — an UNDER-count, the exact mirror of the over-count it was
 * written to close. Both directions are pinned in
 * `__tests__/factorConfirmable.spec.ts`.
 *
 * ⚠ BOTH SPELLINGS, for the same reason `factorNeedsVerification` reads both:
 * canvas stores `observedState`, the CEE/PLoT wire uses `observed_state`, and
 * real graphs carry both.
 */
export function factorHasConfirmableValue(data: unknown): boolean {
  const d = data as Record<string, unknown> | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  const value = obs?.value
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * ⭐⭐ THE CANONICAL PREDICATE FOR "N TO VERIFY" — one question, one owner.
 *
 * A factor is CONFIRMABLE when it still needs a human to look at it AND there is
 * a number present that a confirmation can ratify.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT EXISTS: FIVE SURFACES WERE ANSWERING ONE QUESTION FOUR WAYS
 * ─────────────────────────────────────────────────────────────────────────────
 * "N to verify" is rendered by `StatusBar`, `WorkspaceShellTabStrip`,
 * `ModelHealthSection`, `FactorsSection`'s accordion tier label and — new — the
 * v2 attention chip. The Confirm affordance is offered by `FactorCard` (v1) and
 * `ModelRowView` (v2). Before this predicate existed they used FOUR spellings:
 *
 *   · `countFactorsToVerify`        — bare `factorNeedsVerification`
 *   · v2 repair queue              — `… && getPrimaryValue(…) !== null`
 *   · `FactorsSection` Confirm ✓   — `… && (primaryValue ?? normalisedValue)`
 *   · `ModelRowView` Confirm ✓     — `… && row.primaryValue !== null`
 *
 * They agreed on the common shapes and diverged on two REACHABLE classes, in
 * OPPOSITE directions — which is why no single-direction corpus could see both
 * (trap 22b). The bare form over-counts a factor with no value at all; the
 * `raw_value` forms under-count a capped factor carrying only `value`.
 *
 * ⚠ THE RECONCILIATION IS NOT "PICK THE WIDER" OR "PICK THE NARROWER". It is
 * the PRODUCER's condition: the only honest answer to "should this row be
 * counted and offered?" is "will the writer accept it?" (trap 13c — derive the
 * expectation from the producer's declared semantics, never from your own
 * reading of what a field ought to mean). Every one of the sites above now
 * calls this function, and none keeps a copy.
 *
 * ⚠ NOT THE SAME QUESTION AS `no-value` (trap 21). `no-value` asks "is there a
 * number the outline can DISPLAY?", which is `getPrimaryValue` and legitimately
 * a different predicate. Named apart on purpose rather than aligned.
 */
export function factorIsConfirmable(data: unknown): boolean {
  return factorNeedsVerification(data) && factorHasConfirmableValue(data)
}

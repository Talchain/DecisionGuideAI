/**
 * THE ONE AUTHORITY for "analysis is held because Olumi did not draft this
 * model" — one input, one predicate, one sentence, consumed by every surface
 * that needs to say it.
 *
 * ⭐ WHY THIS MODULE EXISTS. The affordance sweep of 18 Aug 2026
 * (`olumi-docs/feedback-2026-08-16/AFFORDANCE-SWEEP-2026-08-18.md`) found that
 * on a bundled starter the canvas model and the server-side model are out of
 * step, and **every surface that needs the server invented its own explanation
 * instead of saying so**. Two of those surfaces were describing THIS state:
 *
 *   - `StarterProvenanceBanner` — "Analysis is held on a saved example —
 *     re-draft it live to run one."  ← already TRUE, already shipped
 *   - the run gate (`canRunAnalysis`) — "Draft or save a model first, then run
 *     analysis."                      ← FALSE in both limbs (see below)
 *
 * The honest copy was therefore already written and already correct; the
 * Analyse control simply did not consume it. That makes this a WIRING problem,
 * not a copywriting one — so this module is the wire, and no surface authors
 * the sentence any more.
 *
 * ⚠ ONE INPUT, DELIBERATELY — AND THE FIRST ATTEMPT AT THIS FIX GOT IT WRONG.
 * That attempt kept the gate's existing boolean (`ceeCannotSeeModel`) and added
 * a SECOND parameter beside it carrying the provenance, both derived from the
 * same `nodes`. Two parameters for one fact is a hand-maintained pairing, and
 * it had already drifted before it was finished: `OutputsDock` passed both,
 * `ConversationPanel` passed only the boolean — so in ONE application state the
 * Analysis panel would have said "a saved example" while the composer's Run
 * tooltip said "a ready-made model". A fix for "two surfaces, two sentences,
 * one state" that creates two surfaces, two sentences, one state.
 * `analysisHeldOn` is therefore the gate's ONLY input for this rung: it answers
 * *whether* analysis is held and *what to call the model* in a single value, so
 * a caller cannot supply one without the other.
 *
 * ⚠ AND IT IS A PREDICATE, NOT A STATIC STRING, DELIBERATELY. The sweep's
 * second finding was that the banner's notice **goes stale**: it kept claiming
 * analysis was held while a toast said "Analysis complete." That happened
 * because the banner mounted on `resolveStarterId(nodes) !== null` while the
 * gate refused on a DIFFERENT condition (which also requires the V5 canonical
 * run path, and also covers template inserts). Banner-mounted did not imply
 * gate-blocked, in either direction, so one could speak while the other
 * disagreed. `analysisHeldOn` is now the single condition both read, so the
 * claim tracks the state it describes.
 *
 * ⚠ WHAT THE GATE'S OLD SENTENCE GOT WRONG (trap 21 — name the question each
 * authority answers). It was `CEE_DRAFT_FIRST_REFUSAL`, justified as "CEE's
 * refusal sentence, verbatim". CEE does emit
 * `'Draft or save a model first, then run analysis.'` — at
 * `analysis-ready-helper.ts::assessCanonicalAnalysisReadiness`, under code
 * `NO_GRAPH`, when `graph === null || graph === undefined`. That answers *"is
 * there a model at all?"*, for which both limbs are true and achievable. This
 * rung answers *"is the model on this canvas one the engine can analyse?"*, and
 * for THAT question both limbs are false:
 *
 *   - "Draft ... a model first" — `canRunAnalysis` returns at `nodeCount === 0`
 *     BEFORE this rung, so a model is always on the canvas when it renders.
 *     Witnessed on deployed `d5aa8453`: 8 nodes, 3 options, 3 risks and 8
 *     estimates on screen, beneath this refusal. The 18 Aug sweep witnessed the
 *     same thing on `1dec0ad6` with the panel's own "4 options · 3 risks ·
 *     8 estimates" four rows above it.
 *   - "... or save a model first" — the predicate reads `node.data` only, and
 *     `applyStarter` stamps `starterId` onto EVERY node. Persistence
 *     round-trips `node.data`, so a saved starter is still refused. The product
 *     was asking for an action it cannot accept (preamble P8) — and
 *     `StarterProvenanceBanner` had ALREADY corrected exactly this promise in
 *     its own copy ("the starter stamp rides a save, so saving does NOT
 *     re-enable analysis. Re-drafting is the one route that does") while the
 *     gate constant beside it kept carrying it. One claim, two copies, one
 *     fixed (trap 12).
 */

import { isV5CanonicalRunPath } from '../../v5/eligibility'
import { isGraphServerAcknowledged } from '../store/importRegistrationMarker'
import { ceeHoldsModel } from '../registration/ceeHeldModel'
import {
  editDeliveryHoldDetail,
  type EditDeliveryState,
} from '../registration/editDeliveryHold'
import type { UnconfirmedDeleteSubject } from '../conversation/unconfirmedStructuralDelete'
import { factorDisplayText } from '../../utils/formatFactorDisplayValue'
import { STRUCTURAL_DELETE_UNCONFIRMED_REMEDY } from '../mutations/structuralDelete'
import { STRUCTURAL_RENAME_UNCONFIRMED_REMEDY } from '../mutations/structuralRename'

/**
 * Which client-side injection put this graph on the canvas.
 *
 * `starterId`  — stamped only by `applyStarter` (pre-drafted starter scenario,
 *                `src/canvas/starters/loadStarter.ts`).
 * `templateId` — stamped only by `insertBlueprint` (PLoT template insert,
 *                `src/canvas/hooks/useBlueprintInsert.ts`).
 *
 * No CEE draft path stamps either one, which is exactly what makes them a sound
 * discriminator. ⚠ There is deliberately NO separate `KEYS` array beside
 * `readInjectionStamp`: the old `CLIENT_INJECTED_PROVENANCE_KEYS` const became a
 * second list of the same two stamps the moment the function needed to tell
 * them APART rather than treat them alike, and two lists of one fact is the
 * mirror this estate keeps paying for (trap 12). The function below is the only
 * place the stamps are named.
 */
export type ClientInjectedProvenance = 'starter' | 'template'

export interface NodeLike {
  /**
   * ⚠ REQUIRED BY THE ACKNOWLEDGEMENT LOOKUP, NOT DECORATION.
   *
   * This interface used to declare `data` alone, because the only question ever
   * asked of a node here was "does it carry a starter stamp?". The hold now
   * also asks whether the SERVER acknowledged this graph, and that identity is
   * derived from the registration projection — which addresses nodes by id.
   * Declaring only `data` while handing these nodes to a projection that reads
   * `id` is the type quietly disagreeing with what the code does, so the shape
   * is widened rather than the call being cast through `any`.
   */
  id?: unknown
  data?: Record<string, unknown> | undefined
}

/**
 * ⭐ THE ONE INPUT — the canvas state, not a pair of derived values.
 *
 * ⚠ THE ARGUMENT WIDENED FROM `nodes` TO THE STATE, AND THAT IS THE WHOLE
 *   POINT. The registration conjunct below needs a fact that is NOT derivable
 *   from the nodes, and the docstring above bans a second parameter beside the
 *   first — correctly, because two arguments a caller assembles by hand are a
 *   pairing that drifts. Taking the state object instead keeps the arity at ONE
 *   and makes a mismatch unconstructible: every call site is
 *   `useCanvasStore((s) => analysisHeldOn(s))`, so the nodes and the
 *   registration posture are read from the same snapshot by construction.
 *
 *   It also keeps the value REACTIVE. Reading the flag from the store INSIDE
 *   this function would have compiled and looked tidier, and a selector bound
 *   to `s.nodes` would then never re-run when the acknowledgement landed — the
 *   graph does not change when CEE acks it. The claim would go stale exactly
 *   as the banner's did before this module existed.
 */
export interface AnalysisHoldState {
  readonly nodes: ReadonlyArray<NodeLike>
  /**
   * ⚠ REQUIRED, NOT OPTIONAL — omission was a live defect, not a nicety.
   *
   * The acknowledgement is keyed on the scenario AND the analytical model,
   * which includes edges. While this was optional, `OutputsDock` and
   * `PreAnalysisPanel` both passed `{ nodes, importPendingServerRegistration }`
   * and nothing complained: their lookup computed an EMPTY-edge key, could not
   * match the graph that was actually acknowledged, and both Run affordances
   * stayed held after a real server receipt for an edge-bearing starter. The
   * full-state selector was correct at the same moment, so the two disagreed.
   * Making it required is what stops a caller reconstructing that state.
   */
  readonly edges: ReadonlyArray<{ source?: unknown; target?: unknown; data?: unknown }>
  /**
   * ⚠ REQUIRED. An acknowledgement is for ONE scenario. Without this, a receipt
   * for scenario A released the same topology armed under scenario B, with no
   * receipt of its own.
   */
  readonly currentScenarioId: string | null
  /**
   * Whether a graph the server has NOT acknowledged holding is on the canvas.
   *
   * Deliberately the store's existing derived field rather than a new boolean:
   * it is armed at every graph-replacement site from a structural, storage-
   * backed marker and released ONLY by `useImportRegistration` on a 200
   * carrying the `scenario_graph_registration.v1` envelope. So every failure
   * mode — 409, 503, transport, unreadable body, no scenario row — leaves it
   * armed, and this predicate keeps holding. Design §2 F6: the affordance is
   * enabled BECAUSE the write reached the server, never optimistically.
   */
  readonly importPendingServerRegistration: boolean
  /**
   * ⭐ REQUIRED — the OW-1 latch (`ceeHeldModel.ts`): the scenarios this page
   * has seen CEE acknowledge holding. Read by identity through `ceeHoldsModel`,
   * never re-derived here. Required for the same reason `edges` is: an optional
   * input lets a caller hand over a partial state that silently keeps the old
   * answer (rule 5(c), programme-docs #63 5795221415).
   */
  readonly ceeHeldScenarioIds: ReadonlySet<string>
}

/**
 * The provenance stamp on the graph, or `null` when Olumi drafted it.
 *
 * Module-private on purpose: it is the RAW graph read, without the run-path
 * conjunct, and a surface that consumed it would be answering "is this a
 * ready-made model?" while believing it had asked "is analysis held?" — the
 * two-questions-one-name defect this module exists to end. `analysisHeldOn` is
 * the only exported way in.
 *
 * Derived from the graph itself, never from a separate "which starter is
 * loaded" store slot: the stamp lives on the nodes, so it disappears exactly
 * when the injected graph does. `starterId` wins when both are present — a
 * starter is the more specific claim and the one with a re-draft affordance.
 */
function readInjectionStamp(
  nodes: ReadonlyArray<NodeLike>,
): ClientInjectedProvenance | null {
  let template: ClientInjectedProvenance | null = null
  for (const node of nodes) {
    if (node.data?.starterId != null) return 'starter'
    if (node.data?.templateId != null) template = 'template'
  }
  return template
}

/**
 * ⭐ THE ONE INPUT. Non-null ⇔ analysis is held because Olumi did not draft the
 * model on this canvas — and the value names WHICH ready-made model it is, so
 * the refusal can describe it without a second parameter to keep in step.
 *
 * Both the run gate and the provenance banner read this, so a surface can no
 * longer claim analysis is held while another disagrees.
 *
 * THREE conjuncts, and all three are load-bearing:
 *  - the graph was injected client-side (`readInjectionStamp`), and
 *  - the run would route through CEE, which analyses its own scenario state,
 *    not the canvas (#343). The V5 turn body carries no graph at all
 *    (`src/v5/buildPayload.ts`; the vendored MessageTurnPayloadSchema is
 *    `.strict()`), so CEE's only route to the nodes is its persisted scenario
 *    row. A V2-direct run DOES send the canvas graph, so the hold does not
 *    apply off the canonical path.
 *  - ⭐ …and CEE HAS NOT ACKNOWLEDGED HOLDING THIS GRAPH.
 *
 * ⚠ THE THIRD CONJUNCT IS WHAT THIS PREDICATE WAS ALWAYS ABOUT, and its
 *   absence was a real defect rather than an omission. The first two conjuncts
 *   are a PROXY for it: "client-injected" implied "the server has not seen it"
 *   only because there was no way to give the server the graph. There is now —
 *   the deterministic `register` seam — so the proxy is wrong in the direction
 *   that matters, and it was wrong PERMANENTLY: `starterId` is stamped on every
 *   node and round-trips persistence by design, so the first two conjuncts stay
 *   true forever and analysis stayed refused on a model CEE demonstrably holds.
 *
 * ⚠ AND THE STAMP IS NOT REMOVED ON REGISTRATION, DELIBERATELY. Stripping it
 *   would have released this predicate with a one-line change and no new
 *   argument — and would have silently deleted the "saved example" disclosure
 *   too, because the banner reads the same stamp. Provenance ("where did this
 *   graph come from?") and analysability ("can the engine analyse it?") are two
 *   questions, and one stamp answering both is precisely the conflation this
 *   estate keeps paying for. The stamp stays; only the hold lifts.
 */
export function analysisHeldOn(
  state: AnalysisHoldState & EditDeliveryState,
): ClientInjectedProvenance | null {
  if (!isV5CanonicalRunPath()) return null
  const stamp = readInjectionStamp(state.nodes)
  if (stamp === null) return null
  // ⭐⭐ RULE 5(c) — CEE HOLDS THIS SCENARIO'S MODEL (the OW-1 latch). The
  //   saved-example hold is over: the engine has the model, whatever the digest
  //   says. The digest can stop matching for good once the latch is set — a
  //   reload whose boot read cannot vouch for every canvas value (Wall 1), or a
  //   rename answered by an untyped 500 and then applied (Wall 2) — and OW-1
  //   rightly never re-registers to earn it back. So only the user's OWN change,
  //   still on its way or still unconfirmed, holds Run here, and `heldReason`
  //   names that change. In flight holds even over an acknowledged digest: fail
  //   closed, CAS at commit (#63 5795221415).
  //
  //   ⚠ NOT DETECTED HERE: a LOCAL-ONLY analytical gesture on a latched model.
  //   Rule 5 (classing every store mutator canonical or local-only, with
  //   "Not saved · Discard") is what produces that signal; until it exists
  //   there is no stored CEE value to compare against, and CEE's own readiness
  //   gate still judges the model it analyses.
  if (ceeHoldsModel(state, state.currentScenarioId)) {
    return editDeliveryHoldDetail(state) === null ? null : stamp
  }
  // ⭐ RELEASE ON POSITIVE ACKNOWLEDGEMENT, NEVER ON THE ABSENCE OF A PENDING
  //   MARKER. Both markers live in localStorage, so both can vanish — but the
  //   two absences mean opposite things. "No pending marker" was being read as
  //   "registered", and on private browsing, disabled storage, a corrupt
  //   record, quota exhaustion or eviction past MAX_IDENTITIES the pending
  //   write is silently dropped, so the hold LIFTED on a graph CEE had never
  //   seen — the pre-mitigation P0, reached through the mitigation.
  //   "No acknowledgement" fails the other way: still held. The cost of a lost
  //   record is a redundant registration, never a false affirmation.
  if (isGraphServerAcknowledged(state.currentScenarioId, state.nodes, state.edges)) return null
  return stamp
}

/**
 * THE sentence for that state — the one already shipped in
 * `StarterProvenanceBanner` and verified true, now owned here so both surfaces
 * say it rather than each writing its own.
 *
 * It names the state and the achievable remedy, and nothing else. The remedy is
 * reachable from where the user is standing: the composer is always on screen,
 * and for a starter the banner's "Re-draft this live" does exactly this in one
 * click (P8 — never ask what you cannot accept).
 *
 * ⚠ TWO ENTRIES, AND NO `unspecified` FALLBACK. The first attempt at this fix
 * carried a third variant ("a ready-made model") for a caller that knew
 * analysis was held but had not been given the provenance. With one input that
 * caller cannot exist — and while it did, it was a sentence the product could
 * emit while describing the model from a guess rather than from the graph. A
 * default that fabricates a description is the defect class, in miniature.
 *
 * The two variants exist only because "saved example" is a false description of
 * a template insert; the CLAIM and the REMEDY are identical in both, and the
 * remedy clause is byte-identical by construction (`HELD_REMEDY`), so neither
 * can drift into offering a different way out.
 *
 * ⚠ STATE-CLASS, stated rather than implied: the `starter` sentence is the
 * shipped, live-witnessed one (18 Aug sweep, `1dec0ad6`). The `template`
 * variant is NOT witnessed — the template-insert state was reachable at the
 * bytes (`insertBlueprint` stamps every node; the `T` panel opens it) but was
 * not driven. Only its noun phrase differs from the witnessed sentence, which
 * is the least invention available: the alternative was to call a template
 * insert "a saved example", which is simply untrue.
 *
 * ⚠ ONE DEVIATION FROM THE SHIPPED STRING, AND WHY. The banner shipped this as
 * "…a saved example — re-draft it live to run one." with an EM DASH. Wiring it
 * into the run gate makes it render in the pre-analysis footer, and that
 * surface's copy is under an enforced rule — `signals/__tests__/registry.spec.ts`
 * asserts "no em dashes anywhere in copy" over every constant it sweeps, and
 * this constant is now swept there (it renders beside `BLOCKED_REASON_COPY`, so
 * it must live under the same rule rather than beside it). The clause boundary
 * became a full stop. No word changed, the claim and the remedy are untouched,
 * and the banner now renders the compliant form too — which is the point of one
 * authority: fixing the copy in one place fixes it everywhere it is said.
 */
const HELD_REMEDY = '. Re-draft it live to run one.'

export const ANALYSIS_HELD_NOTICE: Record<ClientInjectedProvenance, string> = {
  starter: `Analysis is held on a saved example${HELD_REMEDY}`,
  template: `Analysis is held on an inserted template${HELD_REMEDY}`,
} as const

/**
 * ⭐⭐ WHEN THE HOLD IS REALLY THE USER'S OWN UNCONFIRMED EDIT, SAY SO.
 *
 * PROPOSED COPY — for Experience Design sign-off, 23 Sep 2026. Not yet ruled on.
 *
 * WHY (purpose audit, 23 Sep: #1892, #1893, delete-unconfirmed-hold, cross-
 * cutting item 1). Since #1892 an unconfirmed Canvas edit keeps registration —
 * and so the acknowledgement this hold releases on — waiting
 * (`registration/editDeliveryHold.ts`). On a saved example that makes the
 * user's own change the operative cause of the hold far more often than the
 * example is. The only sentence on screen was `ANALYSIS_HELD_NOTICE`: the wrong
 * cause, and a remedy that REPLACES the model the user is trying to settle
 * (ROADMAP 2.1442 measured re-draft destroying user-set estimates).
 *
 * WHAT EACH SENTENCE MAY CLAIM, and why the remedies are the ones offered:
 *  · IN DELIVERY (on the wire, or queued behind another turn) — only that it is
 *    not confirmed yet. No forecast that analysis "will" be available: other
 *    rungs of the gate can still refuse once the hold lifts.
 *  · UNCONFIRMED VALUE (the untyped 500: value kept, register still pending) —
 *    names the factor and the number the USER set, rendered by the card's own
 *    projection. It does NOT name the model's value: nothing on the client
 *    knows what CEE holds, and inventing it is the defect class. The one remedy
 *    offered is the one the hold is known to clear on: setting the value again
 *    (an applied receipt settles the register). ⛔ NOT "reload": #1892's
 *    residual 4 records that after a reload the pending register is gone and it
 *    is UNVERIFIED whether the canvas restores the number from autosave — in
 *    which case a registration could carry it as Olumi's estimate, the very
 *    corruption the hold exists to prevent.
 *  · UNCONFIRMED LINK STRENGTH (#1905 signal 5) — the value remedy, in the
 *    link's own frame: it names "the link from {A} to {B}" and no number, and
 *    its noun is the UI's for a link's magnitude, Strength
 *    (`nodes/shared/metricVocabulary.ts`), never the factor's "value" (Panel
 *    #1917 N1). The link is on the canvas, so setting it again is reachable.
 *  · UNCONFIRMED RENAME — names the label on the canvas. Renaming again (to the
 *    same name or back) is an edit through the protocol; a later committed
 *    rename of the same state, or a different label, releases the hold. The
 *    remedy is `STRUCTURAL_RENAME_UNCONFIRMED_REMEDY`, the one the rename's own
 *    transcript line gives (Panel #1917 N4: one state, one remedy).
 *  · UNCONFIRMED ADD — names the added element. Removing it releases the hold
 *    (its node is no longer on the canvas); adding it again goes through the
 *    protocol with a receipt.
 *  · UNCONFIRMED DELETE (#1905 residual 1: an untyped 500 or transport loss
 *    keeps the deletion on the canvas) — names what was removed, by the name
 *    the delete record kept (the element is no longer on the canvas to read it
 *    from); a link deleted on its own is "the link from {A} to {B}". A delete of
 *    several elements names none of them rather than picking one. A later
 *    proven delete of the same element supersedes the record.
 *    ⭐ ITS ONE EXIT IS THE CHAT (Panel #1917 F1). The element is not on the
 *    canvas, so "remove it again" named nothing to select, and Undo is disabled
 *    on the canvas (`canvasSemanticMutations: 'disabled'`). Asking Olumi goes
 *    through the chat, not the canvas, and a later applied turn releases the hold both
 *    ways — a committed graph without the element proves the delete, one with
 *    it puts the element back (`oneWriterRegistration.spec` §13). The remedy is
 *    `STRUCTURAL_DELETE_UNCONFIRMED_REMEDY`, the one the delete's own transcript
 *    line gives (N4).
 *
 * Question-shaped where the user has a choice; plain statement where they have
 * none. No em dashes (the footer copy sweep in `signals/__tests__/registry.spec`
 * scans these). Straight apostrophes, matching the transcript's own
 * "couldn't confirm" notices (`optimisticFactorEdit.ts`, `structuralRename.ts`),
 * so the chat and the hold use one vocabulary for one state.
 */
export const ANALYSIS_HELD_ON_EDIT_COPY = {
  editInDelivery: 'Your change is still being saved. Analysis waits until Olumi confirms it.',
  unconfirmedValue: (label: string | null, value: string | null): string =>
    `Olumi couldn't confirm ${label === null ? 'your last value change' : `your change to ${label}`}` +
    `${value === null ? '' : ` (${value})`}, so analysis is waiting until it is settled. ` +
    'Would you like to set the value again?',
  unconfirmedLinkStrength: (link: string | null): string =>
    `Olumi couldn't confirm ${link === null ? 'your last link-strength change' : `your change to the strength of ${link}`}, ` +
    'so analysis is waiting until it is settled. Would you like to set the strength again?',
  unconfirmedRename: (label: string | null): string =>
    `Olumi couldn't confirm ${label === null ? 'your rename' : `your rename to ${label}`}, ` +
    `so analysis is waiting until it is settled. ${STRUCTURAL_RENAME_UNCONFIRMED_REMEDY}`,
  unconfirmedAdd: (label: string | null): string =>
    `${label === null ? "Olumi couldn't confirm your addition to the saved model" : `Olumi couldn't confirm that ${label} was added to the saved model`}, ` +
    'so analysis is waiting until it is settled. Would you like to remove it and add it again?',
  unconfirmedDelete: (label: string | null): string =>
    `Olumi couldn't confirm that ${label === null ? 'what you deleted' : label} was removed from the saved model, ` +
    `so analysis is waiting until it is settled. ${STRUCTURAL_DELETE_UNCONFIRMED_REMEDY}`,
} as const

/** What is holding analysis — the ready-made model itself, or the user's own unconfirmed edit. */
export type AnalysisHoldKind =
  | ClientInjectedProvenance
  | 'edit_in_delivery'
  | 'unconfirmed_value'
  | 'unconfirmed_rename'
  | 'unconfirmed_add'
  | 'unconfirmed_delete'

/**
 * The hold AND its sentence, as one value — the analogue of `analysisHeldOn`
 * carrying both "is it held?" and "what do we call it?", for the same reason:
 * a caller cannot supply one without the other.
 */
export interface AnalysisHoldReason {
  readonly kind: AnalysisHoldKind
  readonly sentence: string
}

/**
 * True when the operative cause of the hold is the USER'S OWN edit (in
 * delivery, or unconfirmed), rather than the ready-made model itself. Off
 * `kind` alone, so no surface re-derives it from the sentence.
 *
 * Read by the saved-example banner to withdraw "Re-draft this live" (decision,
 * 23 Sep 2026): a re-draft REPLACES the model, so while an edit is unconfirmed
 * it would discard that change without warning.
 */
export function isUserEditHold(reason: AnalysisHoldReason | null): boolean {
  return reason !== null && reason.kind !== 'starter' && reason.kind !== 'template'
}

/**
 * The hold's input plus the edit registers `editDeliveryHold` reads. Every
 * production reader passes the canvas store's own state (see
 * `hooks/useAnalysisHold.ts`), so the two halves come from one snapshot.
 */
export type AnalysisHoldReasonState = AnalysisHoldState & EditDeliveryState

/**
 * ⚠ INTERNED, SO A STORE SELECTOR MAY RETURN IT. Zustand 5 compares selector
 * results by identity and loops on a fresh object every call; equal content
 * therefore returns the SAME object. Bounded, oldest out — the entry just
 * returned is always the newest, so it is never the one evicted.
 */
const internedReasons = new Map<string, AnalysisHoldReason>()
const MAX_INTERNED_REASONS = 64

function intern(kind: AnalysisHoldKind, sentence: string): AnalysisHoldReason {
  const key = `${kind}\u0000${sentence}`
  const hit = internedReasons.get(key)
  if (hit) return hit
  const reason: AnalysisHoldReason = Object.freeze({ kind, sentence })
  internedReasons.set(key, reason)
  if (internedReasons.size > MAX_INTERNED_REASONS) {
    const oldest = internedReasons.keys().next().value
    if (oldest !== undefined) internedReasons.delete(oldest)
  }
  return reason
}

/**
 * The hold reason for a ready-made model with NO user edit unresolved — the
 * shipped saved-example (or template) sentence. `heldReason` returns exactly
 * this in that state; exported so a caller that already holds a provenance
 * (a gate fixture, say) builds the same interned value rather than a literal.
 */
export function savedExampleHold(provenance: ClientInjectedProvenance): AnalysisHoldReason {
  return intern(provenance, ANALYSIS_HELD_NOTICE[provenance])
}

function nodeDataOf(state: AnalysisHoldReasonState, nodeId: string): Record<string, unknown> | null {
  const node = state.nodes.find((n) => n.id === nodeId)
  const data = node?.data
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

/** The element's name as the canvas shows it, or `null` — never a guessed or an id-shaped stand-in. */
function labelOf(data: Record<string, unknown> | null): string | null {
  const label = data?.label
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : null
}

/**
 * What an unconfirmed delete removed, as the sentence names it, or `null` (the
 * frame's unlabelled form). A node's name is the one the delete record kept. A
 * link's ends are still on the canvas, so their CURRENT names are read there
 * first, then the record's; with either end unnamed, the link is not named.
 */
function removedName(state: AnalysisHoldReasonState, removed: UnconfirmedDeleteSubject): string | null {
  switch (removed.kind) {
    case 'node':
      return removed.label
    case 'link':
      return linkName(
        labelOf(nodeDataOf(state, removed.sourceId)) ?? removed.sourceLabel,
        labelOf(nodeDataOf(state, removed.targetId)) ?? removed.targetLabel,
      )
    case 'several':
      return null
  }
}

/** "the link from {A} to {B}", or `null` when either end has no name. */
function linkName(from: string | null, to: string | null): string | null {
  return from !== null && to !== null ? `the link from ${from} to ${to}` : null
}

/** A link still on the canvas, named by its ends' current labels, or `null`. */
function linkOnCanvasName(state: AnalysisHoldReasonState, edgeId: string): string | null {
  const edges = state.edges as ReadonlyArray<{ id?: unknown; source?: unknown; target?: unknown }>
  const edge = edges.find((e) => e.id === edgeId)
  if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') return null
  return linkName(labelOf(nodeDataOf(state, edge.source)), labelOf(nodeDataOf(state, edge.target)))
}

/**
 * The user's number, rendered by the card's own projection (`factorDisplayText`
 * with the pending value, exactly as `FactorNode` passes it) — never a second
 * formatter. `null` when the projection declines to render it, in which case
 * the sentence simply does not name a value.
 */
function pendingValueText(data: Record<string, unknown> | null, sentValue: number): string | null {
  if (data === null) return null
  const text = factorDisplayText({ ...data, pending_user_value: sentValue })
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null
}

/**
 * ⭐ THE ONE FUNCTION every surface that states the hold reads: the run gate's
 * reason (V3 footer, Model-tab reanalyse bar, composer tooltip, run toasts), the
 * legacy footer, the run chip's caveat and the saved-example banner.
 *
 * Gating is UNCHANGED — non-null exactly when `analysisHeldOn` is. Only the
 * sentence moves: while `editDeliveryHold` reports an unresolved user edit, the
 * edit is the operative cause and is what is named; otherwise the shipped
 * saved-example sentence, byte-identical. An acknowledged model has no hold, so
 * no sentence, whatever is in flight.
 */
export function heldReason(state: AnalysisHoldReasonState): AnalysisHoldReason | null {
  const held = analysisHeldOn(state)
  if (held === null) return null
  const edit = editDeliveryHoldDetail(state)
  if (edit === null) return savedExampleHold(held)
  switch (edit.cause) {
    case 'edit_on_the_wire':
    case 'edit_queued':
    case 'structural_edit_queued':
      return intern('edit_in_delivery', ANALYSIS_HELD_ON_EDIT_COPY.editInDelivery)
    case 'unconfirmed_value_on_canvas': {
      const data = nodeDataOf(state, edit.nodeId)
      return intern(
        'unconfirmed_value',
        ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedValue(labelOf(data), pendingValueText(data, edit.sentValue)),
      )
    }
    case 'unresolved_structural_edit': {
      if (edit.edit === 'delete') {
        return intern('unconfirmed_delete', ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedDelete(removedName(state, edit.removed)))
      }
      const label = labelOf(nodeDataOf(state, edit.nodeId))
      return edit.edit === 'rename'
        ? intern('unconfirmed_rename', ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedRename(label))
        : intern('unconfirmed_add', ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedAdd(label))
    }
    // #1905's signal 5: an unconfirmed link strength. The link's own frame
    // ("strength", never "value": Panel #1917 N1), naming the link; no number
    // (the link has no projection of the user's, and the model's is unknown to
    // the client). The kind stays `unconfirmed_value`: the hold is the same
    // rung, and splitting the kind is a separate question (#1917 N2).
    case 'unconfirmed_edge_on_canvas':
      return intern(
        'unconfirmed_value',
        ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedLinkStrength(linkOnCanvasName(state, edit.edgeId)),
      )
  }
}

/**
 * The notice for the graph on the canvas, or `null` when analysis is not held —
 * so a caller CANNOT render the claim in a state where it is untrue. Returning
 * a string unconditionally is what let the banner go stale.
 *
 * It is `heldReason`'s sentence, so it names an unresolved user edit exactly as
 * the gate does. Components read it through `useAnalysisHeldNotice`, which also
 * re-renders when a module-level delivery register moves.
 */
export function analysisHeldNotice(state: AnalysisHoldReasonState): string | null {
  return heldReason(state)?.sentence ?? null
}

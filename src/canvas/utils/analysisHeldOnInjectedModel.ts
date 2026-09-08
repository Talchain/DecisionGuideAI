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
  state: AnalysisHoldState,
): ClientInjectedProvenance | null {
  if (!isV5CanonicalRunPath()) return null
  const stamp = readInjectionStamp(state.nodes)
  if (stamp === null) return null
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
 * The notice for the graph on the canvas, or `null` when analysis is not held —
 * so a caller CANNOT render the claim in a state where it is untrue. Returning
 * a string unconditionally is what let the banner go stale.
 */
export function analysisHeldNotice(state: AnalysisHoldState): string | null {
  const held = analysisHeldOn(state)
  return held === null ? null : ANALYSIS_HELD_NOTICE[held]
}

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
  data?: Record<string, unknown> | undefined
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
 * Two conjuncts, and both are load-bearing:
 *  - the graph was injected client-side (`readInjectionStamp`), and
 *  - the run would route through CEE, which analyses its own scenario state,
 *    not the canvas (#343). The V5 turn body carries no graph at all
 *    (`src/v5/buildPayload.ts`; the vendored MessageTurnPayloadSchema is
 *    `.strict()`), so CEE's only route to the nodes is its persisted scenario
 *    row. A V2-direct run DOES send the canvas graph, so the hold does not
 *    apply off the canonical path.
 */
export function analysisHeldOn(
  nodes: ReadonlyArray<NodeLike>,
): ClientInjectedProvenance | null {
  return isV5CanonicalRunPath() ? readInjectionStamp(nodes) : null
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
export function analysisHeldNotice(nodes: ReadonlyArray<NodeLike>): string | null {
  const held = analysisHeldOn(nodes)
  return held === null ? null : ANALYSIS_HELD_NOTICE[held]
}

/**
 * THE ONE AUTHORITY for "analysis is held because Olumi did not draft this
 * model" — the predicate AND the sentence, in one place, consumed by every
 * surface that needs to say it.
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
 * not a copywriting one — so this module is the wire, and neither surface
 * authors the sentence any more.
 *
 * ⚠ AND IT IS A PREDICATE, NOT A STATIC STRING, DELIBERATELY. The sweep's
 * second finding was that the banner's notice **goes stale**: it kept claiming
 * analysis was held while a toast said "Analysis complete." That happened
 * because the banner mounted on `resolveStarterId(nodes) !== null` while the
 * gate refused on `computeCeeCannotSeeModel(nodes)` — two DIFFERENT conditions
 * (the gate also requires the V5 canonical run path, and also covers template
 * inserts). Banner-mounted did not imply gate-blocked, in either direction, so
 * one could speak while the other disagreed. `analysisHeldOnInjectedModel` is
 * now the single condition both read, so the claim tracks the state it
 * describes.
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
 *     estimates on screen, beneath this refusal.
 *   - "... or save a model first" — the predicate reads `node.data` only, and
 *     `applyStarter` stamps `starterId` onto EVERY node. Persistence
 *     round-trips `node.data`, so a saved starter is still refused. The product
 *     was asking for an action it cannot accept (preamble P8) — and
 *     `StarterProvenanceBanner` had ALREADY corrected exactly this promise in
 *     its own copy ("the starter stamp rides a save, so saving does NOT
 *     re-enable analysis. Re-drafting is the one route that does") while the
 *     gate constant beside it kept carrying it. One claim, two copies, one
 *     fixed (trap 12).
 *
 * ⭐ REUSABLE BY THE SWEEP'S OTHER SURFACES, BY CONSTRUCTION. The sweep found
 * ZERO honest refusals across 17 primary affordances. The shape that fixes this
 * one — a named STATE, one predicate over the live graph, one sentence that
 * names the achievable remedy, both consumed rather than re-authored — is what
 * the other instances need too. They are dispatched separately and this lane
 * does not touch them; the point is only that nothing here blocks them from
 * importing it.
 */

import { isV5CanonicalRunPath } from '../../v5/eligibility'

/**
 * Which client-side injection put this graph on the canvas, if any.
 *
 * `templateId` — stamped only by insertBlueprint (PLoT template insert).
 * `starterId`  — stamped only by applyStarter (pre-drafted starter scenario,
 *                src/canvas/starters/loadStarter.ts).
 *
 * No CEE draft path stamps either one, which is exactly what makes them a sound
 * discriminator. ⚠ There is deliberately NO separate `KEYS` array beside
 * `clientInjectedProvenance` any more: the old `CLIENT_INJECTED_PROVENANCE_KEYS`
 * const became a second list of the same two stamps the moment the function
 * needed to tell them APART rather than treat them alike, and two lists of one
 * fact is the mirror this estate keeps paying for (trap 12). The function below
 * is the only place the stamps are named.
 */
export type ClientInjectedProvenance = 'starter' | 'template'

export interface NodeLike {
  data?: Record<string, unknown> | undefined
}

/**
 * The provenance of a client-injected graph, or `null` when Olumi drafted it.
 *
 * Derived from the graph itself, never from a separate "which starter is
 * loaded" store slot: the stamp lives on the nodes, so it disappears exactly
 * when the injected graph does. `starterId` wins when both are present — a
 * starter is the more specific claim and the one with a re-draft affordance.
 */
export function clientInjectedProvenance(
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
 * Is analysis HELD because Olumi did not draft the model on this canvas?
 *
 * THE single condition. Both the run gate and the provenance banner read it, so
 * a surface can no longer claim analysis is held while another disagrees.
 *
 * Two conjuncts, and both are load-bearing:
 *  - the graph was injected client-side (`clientInjectedProvenance`), and
 *  - the run would route through CEE, which analyses its own scenario state,
 *    not the canvas (#343). The V5 turn body carries no graph at all
 *    (`src/v5/buildPayload.ts`; the vendored MessageTurnPayloadSchema is
 *    `.strict()`), so CEE's only route to the nodes is its persisted scenario
 *    row. A V2-direct run DOES send the canvas graph, so the hold does not
 *    apply off the canonical path.
 */
export function analysisHeldOnInjectedModel(nodes: ReadonlyArray<NodeLike>): boolean {
  return isV5CanonicalRunPath() && clientInjectedProvenance(nodes) !== null
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
 * The variants exist only because "saved example" is a false description of a
 * template insert; the CLAIM and the REMEDY are identical in all three, and the
 * remedy clause is byte-identical by construction (`HELD_REMEDY`), so no variant
 * can drift into offering a different way out.
 *
 * `unspecified` is for a caller that knows analysis is held but was not given
 * the provenance — it states the claim without guessing which kind of ready-made
 * model it is. It is NOT a default that fabricates: it describes exactly the
 * caller's knowledge.
 */
const HELD_REMEDY = ' — re-draft it live to run one.'

export const ANALYSIS_HELD_NOTICE: Record<ClientInjectedProvenance | 'unspecified', string> = {
  starter: `Analysis is held on a saved example${HELD_REMEDY}`,
  template: `Analysis is held on an inserted template${HELD_REMEDY}`,
  unspecified: `Analysis is held on a ready-made model${HELD_REMEDY}`,
} as const

/** The notice for a known-or-unknown provenance, when analysis IS held. */
export function noticeForProvenance(
  provenance: ClientInjectedProvenance | null | undefined,
): string {
  return ANALYSIS_HELD_NOTICE[provenance ?? 'unspecified']
}

/**
 * The notice for the graph on the canvas, or `null` when analysis is not held —
 * so a caller CANNOT render the claim in a state where it is untrue. Returning
 * a string unconditionally is what let the banner go stale.
 */
export function analysisHeldNotice(nodes: ReadonlyArray<NodeLike>): string | null {
  if (!analysisHeldOnInjectedModel(nodes)) return null
  const provenance = clientInjectedProvenance(nodes)
  return provenance === null ? null : ANALYSIS_HELD_NOTICE[provenance]
}

/**
 * Analysis (New) — which science-grounded METHOD a finding warrants, if any.
 *
 * ⭐⭐ WHY THIS EXISTS, AND WHY IT IS THE POINT OF THE SURFACE.
 *
 * The seven techniques in `METHOD_CATALOGUE` are the product's differentiator —
 * Olumi recommends *techniques*, not answers — and they ship buried in a
 * dropdown, disconnected from the findings that should trigger them. The card
 * that says "a 13% chance the result flips" names no technique at all, while
 * "Consider the opposite" sits two clicks away in a menu with no idea that
 * finding exists. Attaching the method to its trigger is the wiring that makes
 * the claim legible, and it is wiring: both halves already ship.
 *
 * ⚠⚠ THE MAP IS DELIBERATELY SHORT, AND THE GAPS ARE THE FEATURE. A method is
 * attached ONLY where the recommendation and the technique are the SAME MOVE,
 * judged against the catalogue's own `description`. Three of the eight
 * recommendation builders qualify. Every other finding renders NO method chip.
 *
 * That restraint is not caution for its own sake. A method chip is a claim that
 * decision science prescribes this move here; attaching one by rough
 * resemblance would put a fabricated scientific label on screen, which is
 * precisely the defect class `StrengthenTheReasoning` was built to avoid
 * ("NOTHING HERE IS AUTHORED"). Absence is not zero — a finding with no
 * matching technique says nothing rather than guessing.
 *
 * ⚠ KEYED ON THE RECOMMENDATION ID, NOT ON `helpType`. Two reasons, and the
 * second is the load-bearing one:
 *
 *   1. Four of the eight builders mint per-target ids
 *      (`strengthen:flip:${edgeId}`, `strengthen:lehi:${factorId}`), so the
 *      match is on a PREFIX and the id remains the stable identity.
 *   2. `helpType` is a five-value enum — `clarify | broaden | challenge |
 *      evaluate | commit` — and three separate builders emit `clarify` for
 *      three unrelated moves (define a success measure, give a factor a range,
 *      relay verbatim producer copy). Selecting a named technique off an enum
 *      that coarse would attach the same method to findings that have nothing
 *      in common. The id distinguishes them; the enum cannot.
 */

import { METHOD_CATALOGUE, type MethodEntry } from '../decision-overview/actionsCatalogue'

/**
 * Recommendation-id prefix → method id, with the justification for each.
 *
 * ⚠ ADDING A ROW IS A PRODUCT CLAIM, NOT A CONVENIENCE. Before adding one, read
 * the catalogue entry's `description` and satisfy yourself the finding IS that
 * technique rather than merely adjacent to it. If it takes a paragraph to argue,
 * the answer is no.
 */
const METHOD_BY_RECOMMENDATION_PREFIX: ReadonlyArray<readonly [string, string]> = [
  // "Pressure-test the leading option" IS a pre-mortem: the catalogue's own
  // description is "imagine failure and capture plausible causes", which is
  // what pressure-testing a leader means.
  ['strengthen:robustness', 'pre_mortem'],

  // "Find a route that works differently" and "generate an option that works
  // through a materially different mechanism" are the same instruction; the
  // catalogue's wording is very nearly the recommendation's own.
  ['strengthen:broaden', 'different_option'],

  // "Test the assumption most likely to change the leader" against "build the
  // strongest honest case AGAINST the currently leading option — what evidence
  // or reasoning would change my mind?". Both ask what would overturn the
  // current answer; the finding names the specific assumption to start from.
  ['strengthen:flip', 'consider_opposite'],
]

/**
 * The method this finding warrants, or `null` when none genuinely does.
 *
 * `null` is the common case by design — see the header. Callers must render
 * nothing at all for it, never a placeholder or a default technique.
 */
export function methodForRecommendation(recommendationId: string): MethodEntry | null {
  if (!recommendationId) return null
  const hit = METHOD_BY_RECOMMENDATION_PREFIX.find(([prefix]) =>
    recommendationId === prefix || recommendationId.startsWith(`${prefix}:`),
  )
  if (!hit) return null
  return METHOD_CATALOGUE.find((m) => m.id === hit[1]) ?? null
}

/**
 * Exposed for the drift guard: every method id above must exist in the
 * catalogue. A rename in `actionsCatalogue.ts` would otherwise silently reduce
 * this module to returning `null` for everything — the failure would be a
 * feature quietly disappearing, with no test to catch it (CLAUDE.md trap 12).
 */
export const MAPPED_METHOD_IDS: readonly string[] = METHOD_BY_RECOMMENDATION_PREFIX.map(
  ([, methodId]) => methodId,
)

/** Exposed for the same guard, so a prefix typo is visible to a test. */
export const MAPPED_RECOMMENDATION_PREFIXES: readonly string[] =
  METHOD_BY_RECOMMENDATION_PREFIX.map(([prefix]) => prefix)

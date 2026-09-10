/**
 * User-facing vocabulary for node kinds — ONE spelling, so a product rename is
 * one edit rather than nine.
 *
 * ⭐⭐ WHY THIS FILE EXISTS (Paul, 31 Aug 2026). The decision node's user-facing
 * word was re-typed as a bare `'Decision'` literal in NINE places: the node
 * registry, the plot toolbar, the model-tab row presentation, the inspector
 * strings, the graph vocabulary legend, the legacy node inspector, the context
 * menu, the pre-analysis health readout and the canvas legend popover. Renaming
 * it meant finding all nine and hoping none was missed — the hand-maintained
 * mirror this estate keeps paying for (CLAUDE.md trap 12), in a product noun.
 *
 * ⚠ THIS IS THE DISPLAY WORD ONLY. The node KIND is still `'decision'` and must
 * stay that way: it is a wire value on the CEE/schemas contract, a key in
 * `NODE_REGISTRY`, `TIER_BY_KIND` and every adapter's type union. Renaming the
 * identifier would be a contract change wearing a copy change's clothes.
 */

/**
 * The decision node, as a user reads it.
 *
 * ⭐ "Decision" was retired 31 Aug 2026. Paul: *"we agreed [it] should not be
 * called Decision anymore, as we're not solely focusing on decisions"*.
 *
 * WHY "Question" AND NOT THE ALTERNATIVES, since the next person will ask:
 *
 *   • The product is the strategic reasoning layer — teams "frame problems,
 *     strategise, ideate, challenge and debate". Not every model ends in a
 *     decision, and the anchor node should not assert that it does.
 *   • This node's children are OPTIONS, so it is the thing options are answers
 *     to. That is a question.
 *   • ⚠ "Challenge" was the closest rival and is REJECTED on collision: the
 *     product already uses "challenge" as a verb for contesting an estimate
 *     ("Challenge this result"). One word, two concepts, is trap 21 — and
 *     minting it deliberately would be worse than inheriting it.
 *   • "Choice" carries the same decide-only narrowing as "Decision".
 *
 * It also reads honestly when empty: a node labelled "Question" invites the
 * user to write theirs, which is the state a fresh model is actually in.
 */
export const DECISION_NODE_LABEL = 'Question'

/** One-line gloss, for legends and vocabulary surfaces. */
export const DECISION_NODE_DEFINITION =
  'What you are working out — the options below are the answers you are weighing.'

/**
 * The state a factor is in when it carries a number and nobody has confirmed it
 * — `factorIsConfirmable` in `./valueProvenance`, the write authority's own
 * condition and the predicate behind every live "N to verify" surface.
 *
 * ⭐ WHY IT MOVED HERE (1 Sep 2026). It was authored inside
 * `model-tab-v2/rowPresentation.ts` as one row of `ATTENTION_LABEL`, which was
 * fine while the Model tab was its only reader. The Analysis (New) model strip
 * now names the same state on the same predicate, and `model-tab-v2/` is a
 * SEALED namespace: its boundary guard permits exactly one outside reference —
 * its named mount host — because a second reference is a second mount path.
 * So the choice was to reach through a sealed door, or to keep a second copy of
 * a user-facing string on another surface. Both are wrong, and this file exists
 * for exactly the second one: a product word re-typed per surface is the mirror
 * this estate keeps paying for (see the header).
 *
 * ⚠ IT IS NOT A PROVENANCE CLAIM. "Nobody has confirmed it" is a weaker and
 * different statement from "Olumi wrote it" — the predicate joins a value the
 * producer invented with a value that arrived carrying no source at all, and
 * separates neither by author. Any surface tempted to render this as a
 * whose-value-is-this badge is reading it wrong.
 */
export const UNCONFIRMED_ESTIMATE_LABEL = 'Estimate not yet confirmed'

/**
 * The goal node, as a user reads it.
 *
 * ⚠ WHY THIS EXISTS NOW. `ghostTiers` needs to name the KIND of node a model's
 * subject came from, because the frontier's prompt used to call every subject a
 * "decision" — including a subject read off a GOAL node, in a sentence that
 * lands in the user's own transcript under the user's own name. Naming the kind
 * means spelling its word, and this file is where a product word is spelled.
 *
 * ⚠ IT IS NOT YET THE ONLY SPELLING, and saying so is the point. Three surfaces
 * still carry a bare `'Goal'` literal — `NODE_REGISTRY` (`domain/nodes.ts`),
 * `getTypeLabel` (`inspector-v2/inspectorStrings.ts`) and `KIND_LABEL`
 * (`model-tab-v2/rowPresentation.ts`) — exactly as nine surfaces carried
 * `'Decision'` before the header above was written. Rewiring them is a separate
 * change with its own review; what this constant buys today is that the fourth
 * reader does not add a fourth loose literal.
 */
export const GOAL_NODE_LABEL = 'Goal'

/**
 * ⭐⭐ HOW A FACTOR'S CATEGORY READS — the ONE spelling, for the same reason
 * this file exists.
 *
 * CEE stamps each factor `controllable` | `observable` | `external`. It is the
 * distinction between *what this team can act on* and *what it must plan
 * around*, which is the pivot from analysing a model to doing something about
 * it — and it is one of the few producer facts that is genuinely about the
 * THINKING rather than about the numbers.
 *
 * ⚠ IT WAS ALREADY SPELLED TWICE. `CATEGORY_OPTIONS` in
 * `inspector-v2/editors/FactorControllableEditor.tsx` carried these three
 * words, and `CATEGORY_STYLES` in `components/model-tab/FactorsSection.tsx`
 * carries them a second time (`:44-48`, paired with border classes). Adding a
 * THIRD copy for the Model tab is precisely the hand-maintained mirror this
 * module was created to abolish — in a product noun, again — so the editor now
 * derives its options from here.
 *
 * ⚠ `CATEGORY_STYLES` IS NOT CONVERTED HERE, and this note exists so the count
 * is not inherited wrong: it sits behind a mounted-false legacy block, so there
 * is no user impact, but it is a live copy and converting it is a separate
 * change with its own review.
 *
 * ⚠ THE WIRE VALUES ARE UNCHANGED and must stay so: `category` is a CEE field
 * and a key in the inspector's mutation union. This is the DISPLAY word only.
 */
export const FACTOR_CATEGORY_LABEL = {
  controllable: 'Controllable',
  observable: 'Observable',
  external: 'External',
} as const

export type FactorCategoryValue = keyof typeof FACTOR_CATEGORY_LABEL

/**
 * The display word for a stamp, or `null` for anything this vocabulary does not
 * recognise — INCLUDING absence.
 *
 * ⚠⚠ `null`, NEVER A DEFAULT, AND THIS IS THE WHOLE POINT. The inspector editor
 * renders `(data?.category as string) ?? 'controllable'`, so a factor CEE never
 * classified is shown to the user as *Controllable* — a classification nobody
 * made, on the surface that then offers to "change" it. That is an invented
 * fact wearing an editor's clothes, and it is exactly the defect class this
 * estate keeps paying for.
 *
 * A reader of the Model tab must be able to tell "this model says external"
 * from "nothing here says", so an unstamped factor gets NO line rather than a
 * guessed one. (The editor's default is a separate, pre-existing question about
 * a different surface; it is reported, not silently changed here.)
 *
 * ⚠ THIS FUNCTION ALONE DOES NOT DELIVER THAT DISTINCTION, and a reading
 * surface must not call it directly. Absence is not the only unstated case —
 * the CEE ingestion adapter fills an omitted `category` with its own edge-shape
 * guess, so the field is populated for factors nobody classified.
 * `statedFactorCategoryLabel` below is the reader that closes that door.
 */
export function factorCategoryLabel(category: unknown): string | null {
  if (typeof category !== 'string') return null
  /* ⚠ NORMALISED, BECAUSE THE ESTATE ALREADY PAID TO LEARN THIS INPUT DOMAIN.
     `graphDisplayCalculations.ts` carries a shipped P1 hotfix whose comment
     names the real arrivals: `"External"`, `"external "`, `"CONTROLLABLE"`.
     That is recorded producer behaviour, not a hypothetical. A reader stricter
     than its writers turns a stated stamp into `null`, and `null` here MEANS
     the producer said nothing, so the strictness would invert the one
     distinction this vocabulary exists to protect. */
  const normalised = category.trim().toLowerCase()
  /* ⚠ AN OWN-KEY CHECK, NOT `?? null`. An unguarded index reaches the prototype
     chain, and `??` falls back on null/undefined only, so `"toString"` returned
     a FUNCTION and the surface rendered its native-code source text. The
     signature promises `null` for anything unrecognised; this is what delivers
     it over the whole `unknown` domain.

     ⚠ `hasOwnProperty.call`, NOT `Object.hasOwn` — that is ES2022 and
     `tsconfig.app.json` stops at `lib: ["ES2020", …]`. The identical pair of
     notes sits on `plainStatus` in
     `components/results/analysisNew/buildAnalysisNewViewModel.ts`, where the
     same defect and the same lib gap were met before; raising `lib` is a
     repo-wide config change and stays rowed rather than taken here. */
  return Object.prototype.hasOwnProperty.call(FACTOR_CATEGORY_LABEL, normalised)
    ? (FACTOR_CATEGORY_LABEL as Record<string, string>)[normalised]
    : null
}

/**
 * ⭐⭐⭐ WHAT A READING SURFACE MAY STATE AS THE MODEL'S OWN CLASSIFICATION —
 * `null` whenever this UI is the only thing that said it.
 *
 * ⚠⚠ NAMED APART FROM `factorCategoryLabel` ON PURPOSE. They answer DIFFERENT
 * QUESTIONS and collapsing them is the estate's trap 21. `factorCategoryLabel`
 * answers *how does this value read?* — a pure word lookup, correct for an
 * editor that is about to offer a change. This one answers *may a surface
 * present this as the model's classification?*, which is a question about
 * PROVENANCE, and only a surface built for READING needs to ask it.
 *
 * ⚠⚠ WHY IT EXISTS. `adapters/cee/client.ts` runs `inferMissingCategories` on
 * every draft/graph ingestion path: when CEE omits `category`, the UI writes
 * `controllable` or `observable` from edge shape, into the SAME field, with no
 * hedge. By the time the store sees it the field is not absent, so a reader
 * checking only for absence cannot tell the guess from the stamp, and prints
 * one as the other. That inference marks itself with `categoryInferredByUi`;
 * this function is the consumer of that marker.
 *
 * ⚠ THE SILENCE IS THE POINT, and it is the same rule as the fail-closed
 * `null` above. A visible, honest nothing beats a confident guess: the human
 * is the author here, and a classification presented as the model's when
 * nobody made it is exactly the confident wrongness this surface must not
 * produce. The unstated case still renders the kind line, so the absence is
 * of the qualifier only.
 *
 * ⚠ THE ABSENCE OF THE MARKER IS A NARROW CLAIM — *the ingestion inference did
 * not write this value* — and NOT a positive attestation that CEE stamped it.
 * A value a human set through the inspector is legitimately shown; a value
 * arriving by some path that neither stamps nor marks would also be shown,
 * which is the pre-existing behaviour rather than a new one. Say what is
 * measured, not what would be convenient.
 */
export function statedFactorCategoryLabel(category: unknown, inferredByUi: unknown): string | null {
  if (inferredByUi === true) return null
  return factorCategoryLabel(category)
}

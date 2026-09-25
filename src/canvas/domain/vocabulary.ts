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

/**
 * Is a decision node still carrying the TYPE'S DEFAULT NAME rather than one a
 * person wrote?
 *
 * ⭐ THIS LIVES HERE, BESIDE THE CONSTANT IT COMPARES AGAINST, FOR THE REASON
 * `factorIsConfirmable` DOES (1 Sep 2026, documented below): two surfaces need
 * the same product-word judgement, and `model-tab-v2/` is a SEALED namespace
 * whose boundary guard permits exactly one outside reference. Reaching through
 * that door, or keeping a second copy of the comparison on the canvas, are both
 * wrong; this file exists for precisely that case.
 *
 * ⚠ COMPARED BY VALUE AGAINST THE CONSTANT, NEVER BY KIND. Treating every
 * decision node as unwritten would erase every question a user HAS written —
 * a failure mode worse than the defect. The estate's precedent is
 * `utils/ghostTiers.ts`, which refuses a label equal to the unnamed fallback
 * for the same reason: a producer default is not a name a user typed.
 *
 * ⚠ AND IT IS NOT THE SAME QUESTION AS "IS THE LABEL EMPTY". An empty label and
 * the word "Question" are both *unwritten*, but only one of them has zero
 * length — which is how the canvas card and the Model tab came to disagree
 * about the same node: the card asked `label.length === 0` and the Model tab
 * asked this. Two internally-consistent authorities, one fact (trap 21).
 */
export function decisionLabelIsUnwritten(label: string): boolean {
  return label.trim() === DECISION_NODE_LABEL
}

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
 * The four characters the board actually prints for the label above.
 *
 * ⭐ IT IS HERE BECAUSE THERE ARE NOW THREE SURFACES SAYING IT, NOT ONE.
 * `EstimateMarker` renders it on a factor card at rest; the reduced line
 * renders it when the card is too small to carry a body; and
 * `CanvasLegendPopover` keys its glossary row on the same four characters. A
 * product word re-typed per surface is the mirror this file exists to abolish
 * (see the header) — and the reduced line is the surface that PROVED it, by
 * printing the number with the marker silently dropped.
 *
 * ⚠ IT IS THE TOKEN, NOT THE MEANING. `UNCONFIRMED_ESTIMATE_LABEL` above is
 * what it MEANS and is what hover text is built from. This is only what the
 * ink says, and it is short because the caption column on a 230px card is
 * content-sized: a longer word costs the bar beside it.
 */
export const UNCONFIRMED_ESTIMATE_TOKEN = 'est.'

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
 * ⭐⭐ THE PRODUCT'S NAMES FOR THE GROUPS A MODEL IS MADE OF — ONE SOURCE, NOW
 * THAT TWO SURFACES DRAW THEM.
 *
 * The Model outline has named these groups since design §4.1. The canvas places
 * every node into exactly the same groups — `TIER_BY_KIND` is what decides a
 * node's row — and drew them with **no names at all**, so the structure was
 * asserted by the geometry and invisible to the reader.
 *
 * ⚠ THESE STRINGS MOVED HERE RATHER THAN BEING COPIED. `model-tab-v2` is a
 * sealed namespace, so the canvas cannot import its `GROUP_TITLE`; the available
 * alternatives were a second hand-kept copy of four words — this estate's
 * dominant defect — or one source with two readers. `rowPresentation.GROUP_TITLE`
 * now composes from these, which is the precedent set by
 * {@link decisionLabelIsUnwritten}.
 *
 * ⚠ AND THE OUTLINE'S OWN DOC ALREADY ASKED FOR THIS: *"the outline and the
 * canvas name the same kinds the same way"*. It was true of the glyphs and not
 * of the groups.
 */
export const MODEL_GROUP_TITLE = {
  goal: GOAL_NODE_LABEL,
  options: 'Options',
  factors: 'Factors',
  outcomesRisks: 'Outcomes & risks',
  relationships: 'Relationships',
} as const

/**
 * ⭐ A21 AUDIT — THE MODEL TAB'S 'goal' GROUP HOLDS TWO KINDS, NOT ONE.
 *
 * `model-tab-v2/adapters.ts`'s `KIND_GROUP` files BOTH `decision` (the
 * Question) and `goal` under the same `'goal'` group id, so the outline's
 * heading read `MODEL_GROUP_TITLE.goal` ("Goal") beside a row count that
 * included the Question — "Goal 2" for one goal and one question.
 *
 * ⛔ NOT A REASSIGNMENT OF `MODEL_GROUP_TITLE.goal` ITSELF. That constant has
 * a second reader, `utils/tierLanes.ts`, which labels the CANVAS's goal tier
 * lane — a different surface where the decision already has its own tier and
 * "Question & goal" would be wrong. This is a dedicated second constant for
 * the Model tab's own combined heading, not a retitling of the shared one.
 */
export const MODEL_TAB_GOAL_GROUP_TITLE = 'Question & goal'


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

/**
 * ⭐⭐ HOW STRONG AN EFFECT READS — the ONE band vocabulary, for the same reason
 * this file exists.
 *
 * ⚠ IT MOVED HERE FROM `ui/inspector-v2/inspectorStrings.ts` (unchanged —
 * same four words, same four thresholds, same contract reference). It did NOT
 * move because the inspector was the wrong place to read it; it moved because
 * the CANVAS needs the same answer, `domain/` imports from `ui/` **nowhere in
 * this repo** (measured: 0 occurrences, against 68 the other way), and the
 * alternative was a second hand-kept copy of four adjectives — the mirror this
 * module was created to abolish. `inspectorStrings.ts` re-exports it, so every
 * existing importer is untouched.
 *
 * ⚠⚠ WHAT THE MOVE FIXED, and it is the reason the move happened at all.
 * `domain/edgeLabels.ts`'s `describeEdge` — the canvas edge chip — carried its
 * own restatement, `absWeight >= 0.7 ? 'Strong' : absWeight >= 0.3 ?
 * 'Moderate' : 'Weak'`. The two tables agree on exactly ONE band,
 * |w| ∈ [0.30, 0.40) — 10% of the [0, 1] range — so the canvas said
 * **"Moderate boost"** about an edge the inspector panel beside it called
 * **"Strong"**, and **"Strong boost"** about one the inspector called **"Very
 * strong"**. One number, two authorities, both internally consistent: trap 21,
 * and trap 12 underneath it.
 *
 * ⚠ IT IS A MAGNITUDE-ONLY NAMER AND MUST STAY ONE. Pass `Math.abs(...)`, or a
 * value already known non-negative. It takes no direction argument and returns
 * no direction word, deliberately — reading a sign as a scientific claim is the
 * ROADMAP 2.263 defect class. `getDirectionalStrengthLabel`
 * (`components/model-tab/strengthBands.ts`) is the DIFFERENT function that
 * answers the directional question, on its own DIFFERENT band cuts, and the
 * two are named apart on purpose. Do not collapse them.
 *
 * ⚠ THE THRESHOLDS ARE THE CONTRACT'S, NOT THIS FILE'S. They come from
 * `validation_ui_data_contract_v1.1` and are aligned with the DS v4 reference
 * artefact; `StrengthBandButtons.tsx` writes the midpoint of each band back
 * into the model, so a cut moved here silently re-labels a value a user chose.
 * Change them in the contract first.
 */
/**
 * ⭐⭐⭐ THE CANONICAL BAND TABLE — cuts, words and midpoints in ONE object, so
 * every canvas surface that speaks about a connector's strength derives from
 * it instead of restating it (18 Sep 2026).
 *
 * WHAT THIS REPLACED, AND THE QUESTION EACH OF THE FOUR TABLES ANSWERED. Trap
 * 21 says to write the questions down BEFORE reconciling, because two
 * authorities answering DIFFERENT questions must be named apart rather than
 * aligned. Four were live over `|mean|` — three of them RENDERED and the fourth
 * computed-and-discarded, a distinction the next block draws because an earlier
 * draft of this one collapsed it:
 *
 *   1. `getStrengthLabel` (here)            "what ADJECTIVE is this magnitude
 *                                            entitled to?"   4 words, cuts
 *                                            0.70 / 0.40 / 0.20.
 *   2. `weightMagnitudeToStrokeWidth`       "how THICK is this line?"
 *      (`utils/graphDisplayCalculations`)    3 rungs, cuts 0.70 / 0.40.
 *   3. `THICKNESS_ROWS`                     "what does a thickness MEAN?"
 *      (`components/CanvasLegendPopover`)    3 rows: Weak / Moderate / Strong.
 *   4. `getEffectSizeCoaching`              "what word describes the value you
 *      (`ui/inspector/coachingText`)         are SETTING?" 5 words, cuts
 *                                            0.9 / 0.7 / 0.4 / 0.1.
 *
 * (1) and (4) ask the SAME question of the SAME number and answered it
 * differently, so they are reconciled. (2) asks a genuinely different question
 * — and (3) is the JOIN: a legend exists precisely to assert "this thickness
 * means this word". A join is only well-formed when both sides have the same
 * rungs, so (2) gained a fourth rung rather than (3) being taught to hedge.
 * See `graphDisplayCalculations.ts` for that decision in full.
 *
 * ⚠⚠ WHICH OF THE FOUR A USER COULD ACTUALLY SEE — CORRECTED 18 Sep 2026, AND
 * THE CORRECTION IS THE POINT. An earlier draft of this block opened *"WHAT A
 * USER SAW BEFORE"* and described the band pills and the coaching sentence
 * disagreeing side by side in `EdgePanel`. **That was a claim about the
 * deployed product derived by reading the tree, and it is false.** (4)'s
 * sentence is DARK: `getEffectSizeCoaching` has exactly one non-test call site,
 * `SignedStrengthSlider.tsx:84`, and that component discards the result — its
 * JSX ends on *"Value display and coaching nudge removed"*, and the repo's own
 * `scripts/ci/typecheck-baseline-identities.txt` carries the dead local as
 * `TS6133 'effectCoaching' is declared but its value is never read`. Contrast
 * control on the same sweep: the sibling `getConfidenceCoaching` IS rendered
 * (`EdgeInspector.tsx:447`), so the zero is the code's and not the probe's.
 * CLAUDE.md chronic failure 1 and trap 20 in one sentence — the over-read
 * happened in the act of RECORDING, in the file every later lane inherits.
 *
 * ── RENDERED, so these were user-visible ───────────────────────────────────
 *   · (3) the legend taught **"Weak effect"** — a word the CANVAS prints
 *     nowhere else (⚠ the Model tab DOES print it, on different cuts — see
 *     `graphDisplayCalculations.ts`; the original "nowhere in the product"
 *     claim is withdrawn) — for a thickness the canvas drew for every `|mean| < 0.40`,
 *     i.e. for BOTH *Slight* and *Moderate* edges at once. Two different
 *     findings, pixel-identical on the channel that key teaches as strength.
 *   · (1)'s words reach the board and the panel: the edge chip
 *     (`edgeLabels.describeEdge`), `ConnectionRow` and
 *     the band pills (`StrengthBandButtons`, which also WRITE the midpoint).
 *   · (2) is the picture itself.
 *
 * ── DARK, so this half is a code defect and not yet a user defect ──────────
 *   · (4) the coaching sentence. The divergence was real between the
 *     FUNCTIONS — at `|0.15|` the pills' table said *Slight* where it said
 *     *"Moderate effect."*, and the two INVERTED at their shared boundaries
 *     because (4)'s cuts were inclusive upwards (`0.40` → "Moderate effect."
 *     against a *Strong* pill; `0.70` → "Strong effect." against *Very
 *     strong*). Nobody was shown it. Reconciling a dark vocabulary is still
 *     right — it cannot re-open when it is lit — but it is CODE EXISTS +
 *     TESTED on the status ladder, never "what a user saw".
 *
 * ⚠ THE THRESHOLDS ARE THE CONTRACT'S, NOT THIS FILE'S — unchanged by the
 * consolidation. They come from `validation_ui_data_contract_v1.1` and are
 * aligned with the DS v4 reference artefact. `midpoint` is what a "pick this
 * band" gesture WRITES INTO THE MODEL (`StrengthBandButtons.tsx`), so a cut
 * moved here silently re-labels a value a user chose. Change the contract
 * first.
 *
 * ⚠ THE TOP BAND HAS NO UPPER BOUND ON PURPOSE. `weight` is clamped to [0, 2]
 * (UI-SEM-023), not to [0, 1], so a `max` of 1.00 would leave `|mean| = 1.5`
 * in no band at all. `Infinity` keeps the table total over its input domain.
 *
 * ⚠⚠ EVERY NAME BELOW CARRIES A `Canvas`/`CANVAS_` PREFIX, AND THE PREFIX IS
 * LOAD-BEARING RATHER THAN DECORATIVE. Three of the four names this block
 * wanted are ALREADY EXPORTED ELSEWHERE IN THIS REPO, by modules that answer
 * different questions on different cuts — measured 18 Sep 2026:
 *
 *   · `STRENGTH_BANDS`  — `components/shared/ScientificEditor.tsx:21`, an
 *     EXPORTED array of `{ label, min, max }`. **Structurally compatible with
 *     this table**: `band.label`, `band.min` and `band.max` all typecheck
 *     against either, so a wrong auto-import COMPILES CLEAN and silently
 *     substitutes 0.10–0.25 / 0.30–0.50 / 0.60–0.85 for 0.20 / 0.40 / 0.70.
 *   · `StrengthBand`    — `components/model-tab/strengthBands.ts:13`, a string
 *     union `'strong' | 'moderate' | 'weak' | 'negligible'`.
 *   · `getStrengthBand` — `components/model-tab/strengthBands.ts:19`, the same
 *     `(number) => StrengthBand` SHAPE as this one. Because each module owns
 *     its own `StrengthBand`, a consistently-wrong import pair
 *     (`ContestedEdgeCard.tsx:136` is exactly this shape —
 *     `useRef<StrengthBand>(getStrengthBand(...))`) also compiles clean, on
 *     cuts of 0.6 / 0.25 / 0.05.
 *
 * ⛔ SO THE COLLISION WAS NOT A TIDINESS QUESTION. The typechecker is the only
 * thing standing between a mis-import and a silently re-banded number, and on
 * all three names it does not object. Prefixing is what makes the wrong import
 * impossible to write by accident.
 *
 * `getStrengthLabel` is deliberately NOT prefixed: it has no collision in this
 * repo, and `inspector-v2/inspectorStrings.ts` re-exports it as the address
 * every existing importer already knows.
 */
export type CanvasStrengthBandId = 'slight' | 'moderate' | 'strong' | 'veryStrong'

export interface CanvasStrengthBand {
  /** Stable key. Consumers index their own per-band values by this, never by label. */
  readonly id: CanvasStrengthBandId
  /** The ONE user-facing word for this band. */
  readonly label: string
  /** Inclusive lower bound on |mean|. */
  readonly min: number
  /** Exclusive upper bound on |mean|; `Infinity` on the top band. */
  readonly max: number
  /** The exact value a "set it to this band" gesture writes. */
  readonly midpoint: number
}

/**
 * Ascending, and the order the band pills render in.
 *
 * ⛔⛔ THIS FILE MUST CONTAIN EXACTLY ONE BAND TABLE, AND THAT IS ASSERTED
 * RATHER THAN REQUESTED. `canvas/__tests__/oneStrengthVocabulary.spec.ts`
 * walks this MODULE'S OWN EXPORTS at runtime and REDs if a second array of
 * `{ label, min, … }` appears here under any name. A file holding two canonical
 * tables is the exact defect this consolidation exists to remove, re-created
 * one merge later — and it is a live hazard now, not a hypothetical: the open
 * branch `canvas/how-much-is-still-open` adds `STRENGTH_BAND_LADDER` to this
 * same file, and `git merge-tree` already reports the conflict. Resolving that
 * conflict by KEEPING BOTH is the wrong answer, and the guard is what makes
 * that answer fail loudly instead of merging quietly.
 */
export const CANVAS_STRENGTH_BANDS: readonly CanvasStrengthBand[] = [
  { id: 'slight',     label: 'Slight',      min: 0.00, max: 0.20,     midpoint: 0.10 },
  { id: 'moderate',   label: 'Moderate',    min: 0.20, max: 0.40,     midpoint: 0.30 },
  { id: 'strong',     label: 'Strong',      min: 0.40, max: 0.70,     midpoint: 0.55 },
  { id: 'veryStrong', label: 'Very strong', min: 0.70, max: Infinity, midpoint: 0.85 },
]

/**
 * The band a magnitude falls in. Scans DOWNWARD and falls through to the lowest
 * band, so the behaviour is byte-identical to the if-chain this replaced for
 * every input INCLUDING the ones no caller should pass: a negative, or `NaN`,
 * lands in the lowest band exactly as it did before, rather than becoming
 * `undefined` and crashing a caller that never handled one.
 */
export function getCanvasStrengthBand(absValue: number): CanvasStrengthBand {
  for (let i = CANVAS_STRENGTH_BANDS.length - 1; i > 0; i--) {
    if (absValue >= CANVAS_STRENGTH_BANDS[i].min) return CANVAS_STRENGTH_BANDS[i]
  }
  return CANVAS_STRENGTH_BANDS[0]
}

/**
 * The ONE word for a magnitude. A thin read over `CANVAS_STRENGTH_BANDS` — the
 * threshold list that used to sit on this line is gone, because a comment
 * restating the table immediately above it is the mirror this file exists to
 * abolish, and it would be the first thing to go stale.
 */
export function getStrengthLabel(absValue: number): string {
  return getCanvasStrengthBand(absValue).label
}

/**
 * ⛔⛔ THE STRENGTH TABLES THIS CONSOLIDATION DID **NOT** RECONCILE — a DATED
 * MEASUREMENT, recorded here so the next lane inherits the scope rather than a
 * count (18 Sep 2026).
 *
 * ⚠⚠ THE PREVIOUS COUNT WAS WRONG AND IS WITHDRAWN. The note on
 * `pre-analysis/KeyRelationships.tsx` called itself "A FIFTH" strength
 * vocabulary, which asserts that it was the only one left over. It was one of
 * THREE. A count minted from a partial sweep is this estate's characteristic
 * defect (CLAUDE.md trap 20: the over-read happens in the act of RECORDING),
 * so what is written down below is the probe, its date and its exclusions —
 * not a number to be trusted.
 *
 * THE PROBE, and it is NOT blind — it carries a contrast control (`TriageCard`,
 * expected present, returned 90 references) exactly because a sweep that can
 * see nothing returns the same clean output as a sweep that looked (trap 13e).
 * Drop the backslashes before the slashes; they are here only so the glob's
 * `**` + `/` does not close this block comment:
 *
 *   rg -a -n "0\.[0-9]" src/ -g '!**\/__tests__\/**' -g '!*.spec.*' \
 *     | rg -a -i "'(Very strong|Strongly|Moderately|Weakly|Weak|Moderate|Strong|Slight)'"
 *
 * ── STILL DIVERGENT, ALL THREE MEASURED **DARK** ───────────────────────────
 *
 *   1. `canvas/components/pre-analysis/KeyRelationships.tsx:75` — 3 bands,
 *      "Weakly / Moderately / Strongly", cuts 0.25 / 0.60, writing
 *      0.15 / 0.40 / 0.70. DARK: zero product call sites — the only `import`
 *      and every `<KeyRelationships` usage in `src/` and `e2e/` is its own spec.
 *
 *   2. `components/shared/TriageCard.tsx:195` — 3 bands, "Weak / Moderate /
 *      Strong", writing **0.3 / 0.7 / 1.2**. DARK on BOTH of its hosts, and the
 *      two reasons differ: `PreAnalysisPanel.tsx:1316` passes
 *      `onUpdateEdgeStrength` only when `CANONICAL_EDIT_AUTHORITY
 *      .preAnalysisEdgeStrength` has server-graph authority, and it is
 *      `'disabled'` (`mutations/mutationAuthority.ts:126`); the other host,
 *      `results/TriageActionCardsBody.tsx`, never passes the prop at all. Both
 *      render sites are `onUpdateEdgeStrength &&`-gated, so the pills mount on
 *      neither.
 *      ⚠ WERE THAT GATE FLIPPED, clicking **"Moderate"** would write **0.7** —
 *      which the table above calls **"Very strong"** — and "Strong" would write
 *      1.2, also "Very strong", so two of the three pills would be
 *      indistinguishable in the model AND both mislabelled. This is the one
 *      kind of surface that cannot be allowed a private vocabulary: a divergent
 *      cut on a WRITING control does not merely mislabel, it attributes a
 *      fabricated number to the user.
 *
 *   3. `components/shared/ScientificEditor.tsx:21` — 3 bands, "Weakly /
 *      Moderately / Strongly", `0.10–0.25 / 0.30–0.50 / 0.60–0.85`, **with gaps
 *      that no value can be labelled from** (0.25–0.30, 0.50–0.60, and either
 *      end). DARK, and more completely than the band row alone: `<ScientificEditor`
 *      has **zero render sites in `src/` and `e2e/`** — its only references
 *      anywhere are `import type { ScientificEditorProps }`, a props SHAPE that
 *      `TriageCard` renders with its own controls. Contrast control on the same
 *      probe: `TriageCard`, 90 references. Its midpoints would read
 *      Slight / Strong / Very strong against the table above — all three wrong.
 *
 * ── LIVE, AND NAMED APART ON PURPOSE (NOT a defect; do not "reconcile") ─────
 *
 *   `components/model-tab/strengthBands.ts` — `getStrengthBand` +
 *   `getDirectionalStrengthLabel`, cuts 0.6 / 0.25 / 0.05, consumed by
 *   `ContestedEdgeCard.tsx` and `ModelRowView.tsx`. It answers the DIRECTIONAL
 *   question. Trap 21: two authorities answering different questions are named
 *   apart, never aligned.
 *
 *   ⚠ ONE LATENT SEAM BETWEEN IT AND THIS TABLE, RECORDED SO IT IS NOT
 *   REDISCOVERED AS A SURPRISE. `ContestedEdgeCard` renders the SHARED
 *   `ui/inspector/SignedStrengthSlider` (`:396`) seeded from
 *   `validation.pass1.strength_mean` — the number the card itself labels on the
 *   directional cuts. The slider asks `getEffectSizeCoaching`, which now speaks
 *   THIS table. The sentence is dark, so nothing renders twice today; light it
 *   and that card shows one number under two strength words (`|0.5|` →
 *   *"Moderate positive effect"* beside *"Strong effect."*). The disagreement
 *   pre-dates this consolidation — the old ladder said *"Strong effect."* at
 *   the same value — so it is inherited, not minted here. Full note and the
 *   two ways out: `ui/inspector/coachingText.ts`.
 *
 * ── EXCLUDED, WITH THE REASON, so the next sweep does not re-adjudicate ─────
 *
 *   · `results/DriversSection.tsx:226` `CONTESTED_PRESETS` — the same three
 *     adverbs, but over a driver's CONFIDENCE, and its own comments record that
 *     it does not propagate to the edge store.
 *   · `ui/inspector-v2/panels/FactorExternalPanel.tsx:47` `QUICK_SET` — Low /
 *     Moderate / High over a factor's expected LEVEL range, not a connector's
 *     strength.
 *   · `utils/labelUtils.ts:266` `evidenceTierLabel` — Strong / Fair / Weak over
 *     an EVIDENCE score.
 *
 * ⚠ THIS IS A MEASUREMENT, NOT A GUARD. Unlike the one-table assertion above,
 * nothing REDs when it goes stale — it is a hand-maintained mirror by
 * construction, which is why it carries its probe and its date. Re-run the
 * probe; do not inherit the list, including this sentence.
 */


/**
 * influenceScaleCopy — the ONE home for influence-scale disclosure wording
 * (lane C4), shared by every surface that renders the display model's
 * influence number: the results Drivers panel (DriversSection header tooltip,
 * ranking explainer, visible caption) and the canvas surfaces (MetricPills
 * "I: NN%" pill, FactorNode detailed-view Influence row). Centralised so the
 * surfaces cannot drift ("keep in step" comments are not a mechanism) and so
 * the copy-hygiene spec has one import to police.
 *
 * Basis semantics (driverDisplayModel). ⚠⚠ CORRECTED 5 Sep 2026 — this
 * paragraph said 'influence_score' was "the producer's ABSOLUTE causal
 * influence score", and that sentence is where the false wording downstream
 * came from.
 *
 * BOTH stamped provenances are SET-RELATIVE. They are two different
 * NORMALISATIONS: 'normalised_elasticity' is this app's own, and
 * 'influence_score' is the producer's, against `max|influence|` — so its top
 * row is 1.0 by construction exactly as the other's is. Verified from this
 * side rather than taken on trust — and narrowed 6 Sep 2026 to what is measured
 * (the previous sentence claimed EVERY capture maxes at 1.0; a reviewer refuted
 * it): of the 21 JSON files under `src/` carrying `influence_score`, every one
 * whose maximum is non-zero maxes at exactly 1.0 (live staging responses among
 * them), none exceeds 1.0, and one real degenerate turn is uniformly 0. The
 * sweep is derived in `influenceIsNeverCalledAbsolute.spec.ts`.
 *
 * So BOTH must be disclosed, in the same words. No provenance (legacy fixtures
 * / cached payloads) still fails closed to the generic wording, never claiming
 * a basis the pipeline did not stamp.
 *
 * ⚠ The distinction between the two normalisations is real and is still carried
 * in `provenance`. It is not a difference a reader can act on, which is why it
 * no longer buys a separate — and false — vocabulary.
 *
 * Copy hygiene (influenceScaleCopy.copyHygiene.spec.ts): sentence case,
 * en-GB, no internal analytical vocabulary, and NO em dashes (DS ban) in any
 * user-facing string exported here.
 */
import type {
  DriverDisplayProvenance,
  ResolvedAnalysisMetric,
} from './driverDisplayModel'
import type { ZeroReasonCode } from './types'

/** Header tooltip / pill title — no basis stamped (fail-closed). */
export const INFLUENCE_EXPLANATION_GENERIC =
  'Influence: how much this factor affects the outcome'

/** Header tooltip / pill title — set-relative fallback basis. */
export const INFLUENCE_EXPLANATION_RELATIVE =
  'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'

/**
 * Header tooltip / pill title.
 *
 * ⚠⚠ TWO LANES FOUND TWO DIFFERENT FALSEHOODS IN ONE CLAUSE. BOTH FIXES STAND.
 *
 * ── #1221 (canvas lane, merged 5 Sep): "from the analysis" is FALSE ────────
 * DO NOT RESTORE IT. `influence_score` is `normalised_influence`, a normalised
 * product of authored edge `strength.mean` along the paths to the goal, with
 * option and decision nodes filtered OUT, computed BEFORE the ISL result
 * exists. Witnessed: a founder added a fourth option and flipped the leader
 * outright, and all five canvas influence numbers were byte-identical across
 * both runs. They could not have moved; the tooltip attributed them to the run.
 *
 * That lane deliberately did NOT replace it with an invariance claim, because
 * invariance is true on the graph path and unbounded from this repo. Correct,
 * and untouched.
 *
 * ── #1228 (this lane, 6 Sep): "an absolute causal influence score" is ALSO
 *    FALSE, and the same lane kept it in good faith ────────────────────────
 * It kept the scale clause on the explicit grounds that it is "the producer's
 * own declared semantics (`driverDisplayModel.ts`, 'an absolute producer scale,
 * not a share')". **That premise was wrong, and it was wrong in our own type
 * file** — which is why a careful lane relied on it.
 *
 * `influence_score` is normalised against `max|influence|`, so the top row is
 * 1.0 BY CONSTRUCTION. Measured on data rather than argued from code, and
 * stated as measured (see the module header for the 6 Sep narrowing): of the 21
 * JSON files under `src/` carrying the field, every one whose maximum is
 * non-zero maxes at EXACTLY 1.0 (live staging responses among them), none
 * exceeds 1.0, and one is uniformly 0. A quantity that is either exactly 1 at
 * its top or uniformly zero is a ratio to its own maximum.
 *
 * So the clause was false twice over, for two unrelated reasons, and neither
 * lane could see the other's. It is now the relative wording — which was true
 * of both bases the whole time.
 *
 * Kept as an ALIAS rather than deleted: canvas surfaces reach this copy through
 * `influenceExplanation()` below (`canvas/nodes/FactorNode.tsx`,
 * `canvas/nodes/shared/MetricPills.tsx`), so changing what it SAYS fixes every
 * consumer at once.
 *
 * ⚠ 7 Sep 2026 — THIS PARAGRAPH USED TO SAY "canvas surfaces outside this lane
 * import the symbol … deleting it would force an unrelated lane to take a
 * breaking change on my schedule", and the docblock below reused that premise to
 * justify keeping the name. MEASURED AT THIS HEAD AND FALSE.
 * `INFLUENCE_EXPLANATION_ABSOLUTE` is referenced in 5 files, ALL of them under
 * `src/components/results/`: this module, `DriversSection.tsx`, and three specs.
 * `src/canvas/` references it ZERO times, and there is no barrel or re-export
 * (`src/components/results/index.ts` does not exist). Contrast control in the
 * same sweep, so the zero is an absence rather than a blind probe:
 * `INFLUENCE_EXPLANATION_GENERIC` IS imported by name in two canvas files, and
 * eight canvas files import from this module. So renaming this symbol is a LOCAL
 * change, not a coordinated cross-lane one. What survives of the original
 * sentence is its true half: rewriting the STRING fixes every surface at once,
 * because canvas goes through the accessor rather than the constant.
 */
export const INFLUENCE_EXPLANATION_ABSOLUTE =
  "Influence: Olumi's structural influence score, relative to the strongest factor in this run. The top driver always shows 100%."

/**
 * ⚠⚠ THE TWO ARMS STAY DISTINCT, AND THAT IS #1221'S GUARD DOING ITS JOB.
 *
 * My first cut aliased this constant to the relative one, on the reasoning that
 * both bases are set-relative so the sentence is the same. `influenceScaleCopy.
 * noRunProvenance.spec.ts` REDded — a positive control written by the canvas
 * lane asserting "the two arms still make their OWN distinct claims, so a later
 * change that collapsed them into one bland string would be visible here."
 *
 * It was right and I was wrong. The SCALE is shared; the QUANTITY is not.
 * `influence_score` is the producer's structural score and
 * `normalised_elasticity` is this app's own normalisation of a raw elasticity —
 * which is exactly why only the first licenses a figure. A reader hovering the
 * pill needs to know which one they are looking at, and an alias would have
 * taken that away to fix something else.
 *
 * So both arms name their own quantity and NEITHER claims an absolute scale.
 * The name is kept on judgement, not on coupling: per the measurement in the
 * docblock above, renaming `INFLUENCE_EXPLANATION_ABSOLUTE` is a local change
 * inside `src/components/results/`. It is a tidy-up this lane declined so the
 * diff stays about the copy, not one it was barred from making.
 */

/**
 * Drivers panel ranking explainer — the FAIL-CLOSED arm, taken exactly when
 * `DriversSection` resolves `influenceBasis === 'unknown'`: no provenance stamp,
 * OR no visible driver rows, OR the fallback basis below its magnitude floor.
 *
 * ⚠ 7 Sep 2026 — THIS SAID "generic (absolute or unstamped basis)", AND THIS PR
 * FALSIFIED IT. It was true at `11b995d9`, where `DriversSection` gated the
 * explainer on `influenceBasis === 'relative'`, so the producer basis fell
 * through to this string. The Q2 widening routes BOTH stamped bases to the
 * relative explainer (`DriversSection.tsx`, `influenceScaleIsSetRelative`), so
 * this arm no longer serves the producer basis — and "absolute" is the scale
 * word this PR retires. Sole consumer: `DriversSection.tsx`.
 */
export const INFLUENCE_RANKING_EXPLAINER_GENERIC =
  'Ranked by how much each factor affects the outcome'

/**
 * Drivers panel ranking explainer — EITHER stamped basis.
 *
 * ⚠ 7 Sep 2026 — THIS SAID "set-relative fallback basis", naming one basis when
 * this PR widened it to two. Both stamped provenances are set-relative
 * normalisations, so both take this string; only the unstamped and degenerate
 * states fall through to the generic one above.
 */
export const INFLUENCE_RANKING_EXPLAINER_RELATIVE =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'

/**
 * Drivers panel always-visible caption — EITHER stamped basis.
 *
 * ⚠⚠ 7 Sep 2026 — THIS SAID "set-relative fallback basis ONLY", AND THAT WORD IS
 * THE DEFECT THIS PR EXISTS TO REMOVE. Withholding this caption on the producer
 * basis is what let a figure that is 100% BY CONSTRUCTION read as a causal
 * share, on the ordinary run. `DriversSection.tsx` now renders it whenever
 * `influenceScaleIsSetRelative` (i.e. any stamped basis with visible rows);
 * `DriversSection.influenceScaleDisclosure.spec.tsx` pins that by test id on
 * both bases and pins its ABSENCE in both degenerate states.
 */
export const INFLUENCE_SCALE_CAPTION =
  'Influence is relative to the strongest factor. The top driver always shows 100%.'

/**
 * Basis-aware explanation for tooltips / native titles. Fail-closed: an
 * absent provenance yields the generic wording.
 */
export function influenceExplanation(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'normalised_elasticity'
    ? INFLUENCE_EXPLANATION_RELATIVE
    : provenance === 'influence_score'
      ? INFLUENCE_EXPLANATION_ABSOLUTE
      : INFLUENCE_EXPLANATION_GENERIC
}

/**
 * Accessible name for the "I: NN%" pill. The pill's visible text is cryptic,
 * so the name carries both the number and the basis.
 */
export function influencePillAriaLabel(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  // ⚠ THE NAME LEADS WITH THE SAME NOUN THE PILL NOW SHOWS. When the visible
  // string gained its basis, this label still opened with the bare noun — one
  // quantity under two names, which is the exact shape the visible change was
  // made to close. The explanatory clause stays: it says what the noun means.
  /**
   * ⚠⚠ THE `influence_score` ARM SAID "an absolute causal influence score from
   * the analysis". IT IS NOT ABSOLUTE, AND THE ARM BESIDE IT ALREADY SAID SO.
   *
   * Both provenances are set-relative — they are two different NORMALISATIONS,
   * not absolute-vs-relative. `influence_score` is the producer's, against
   * `max|influence|`, so the top row is 1.0 by construction.
   *
   * ⚠ 6 Sep 2026 — THE SENTENCE THAT STOOD HERE WAS THE REFUTED UNIVERSAL,
   * "every capture in this repo carrying the field maxes at exactly 1.0", and
   * THIS PR ADDED IT — in the module it designates as the single source of
   * truth, while narrowing the same claim correctly everywhere else in this
   * file. What is measured, swept over `src/` at `aa504187`: 21 JSON files
   * carry `influence_score`; 20 of them max at exactly 1.0; the twenty-first,
   * `seeded-2026-08-17-w2d-analysis-turn.json`, is uniformly 0 (one factor
   * stamped `input_quality: "degenerate_fallback"`). None exceeds 1.0, and
   * none maxes strictly between 0 and 1. That sweep is DERIVED, with the
   * all-zero file pinned by name as an exact set, in
   * `influenceIsNeverCalledAbsolute.spec.ts` — which is the guard. This
   * comment is not, which is exactly how the universal survived here.
   *
   * The `normalised_elasticity` arm has disclosed "The top driver always shows
   * 100%" the whole time, which is equally true of this one.
   *
   * The two arms therefore say the same thing to a reader. The distinction is
   * still real and is still carried — in `provenance`, where it belongs — but
   * it is not a difference a user can act on, and spending a false word on it
   * was the cost.
   */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? `Relative influence ${pct}%, scaled against the strongest factor. The top driver always shows 100%`
    : 'Influence basis unavailable'
}

/**
 * The VISIBLE noun for an influence figure, basis-aware.
 *
 * ⭐ WHY THE BASIS MOVED INTO THE VISIBLE STRING. On the set-relative basis the
 * value is scaled against the strongest factor in the run, so the leader reads
 * 100% by construction and three near-equal factors read 91% each. A bare
 * percentage there is taken for an absolute share of the outcome — a deployed
 * graph showed exactly that. The basis was disclosed only through `title` and
 * `aria-label`: a pointer user never opens the first and a sighted user never
 * hears the second.
 *
 * Fail-closed to the plain noun when nothing is stamped. Both canvas call sites
 * already withhold the figure entirely in that state, so this arm asserts
 * nothing about a basis it does not know.
 */
export function influenceBasisNoun(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  /* ⚠ Same ruling as `influencePillAriaLabel`: both provenances are
     set-relative, so both take the relative noun. "Influence score" as a bare
     noun invited exactly the absolute reading this function's own docblock
     describes a deployed graph producing. */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? 'Relative influence'
    : 'Influence'
}

/**
 * Accessible name for the detailed-view Influence DataBar. The value is
 * announced separately via aria-valuenow, so the name carries the basis only.
 */
export function influenceBarAriaLabel(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  /* Same ruling as the pill: both provenances are set-relative normalisations,
     so both get the disclosure that the top driver always shows 100% — which
     was previously given to only one of the two it is true of. */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? 'Influence, relative to the strongest factor. The top driver always shows 100%'
    : 'Influence'
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE QUANTITY VOCABULARY — a SECOND question, named apart from the scale.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Everything above this line answers "WHAT SCALE IS THIS NUMBER ON?", and it
 * answers it correctly: both stamped bases are set-relative, so both take the
 * same scale wording. Nothing above answers "WHICH QUANTITY IS THIS?", and the
 * two bases genuinely differ there. `influenceBasisNoun` returns the SAME
 * visible noun for both; `influencePillAriaLabel` and `influenceBarAriaLabel`
 * make the same collapse. That collapse is CORRECT about scale and SILENT
 * about quantity, and this block exists to say the silent half out loud.
 *
 * This is CLAUDE.md trap 21 inside one module: two authorities answering
 * different questions look like an inconsistency to reconcile, and aligning
 * them is the wrong fix. `influenceBasisNoun`'s own docblock already records
 * the ruling that produced it — "The SCALE is shared; the QUANTITY is not" —
 * and then the code beside it spends one noun on both. So the fix is not to
 * change that function. It is to give the second question its own vocabulary,
 * with its own name, exported from the same module so there is still ONE home
 * for influence copy and one import for the hygiene spec to police.
 *
 * ── WHY THE TWO QUANTITIES ARE DIFFERENT, MEASURED RATHER THAN ARGUED ──────
 *
 * Swept over every JSON under `src/` at `80bacf36` (the sweep is derived in
 * `influenceQuantityVocabulary.spec.ts`, so it REDs if the corpus moves):
 *
 *   · 123 factor rows across 21 files carry `influence_score`.
 *   · `influence_score` EQUALS the magnitude chain's `elasticity` on 57 rows
 *     and DIVERGES on 41. (25 rows carry no `elasticity` at all.)
 *   · The divergences are the trust cases, not rounding. In
 *     `live-influence-score-one-2026-08-23.json`, a real staging response,
 *     "Monthly Payroll Burn" carries `influence_score: 1` with `elasticity: 0`
 *     — the producer's demoted lever, which is top-ranked on one quantity and
 *     bottom-ranked on the other.
 *   · The producer ships BOTH ORDERINGS and they disagree: of the 95 rows
 *     carrying `importance_rank` and `influence_rank`, the two ranks differ on
 *     55. A user reading "the top driver" is reading whichever ordering the
 *     display basis happened to pick.
 *
 * So a reader who is not told which quantity they are looking at cannot tell a
 * factor that is strongly wired to the goal from one that moves the outcome,
 * and on 41 of 123 measured rows those are different factors.
 *
 * ── AND WHY THE ANSWER IS PER-RUN, WHICH IS THE HALF THAT BITES ────────────
 *
 * `selectDriverDisplayModel` (`driverDisplayModel.ts`) decides the basis ONCE
 * FOR THE WHOLE SET: `factors.every((f) => typeof f.influenceScore === 'number'
 * && Number.isFinite(f.influenceScore))`. It is all-or-nothing. One factor
 * missing a finite producer score drops EVERY factor in the run onto the
 * fallback basis.
 *
 * ⚠⚠ THE CONSEQUENCE IS THE WHOLE REASON THIS BLOCK EXISTS, AND IT MUST NOT BE
 * COMPRESSED INTO "the basis varies". The number 100% is printed by the top row
 * on BOTH bases, by construction, on every run. So the same "100%" beside the
 * same factor name means "most strongly wired to the goal in this model" on one
 * run and "moves the outcome most" on the next, with the switch invisible and
 * nothing on screen distinguishing them. The figure is not comparable across
 * two runs unless both landed on the same basis, and no surface has ever said
 * which basis a run landed on.
 *
 * ⚠ NOTHING HERE MAY IMPLY THE FIGURE MEANS THE SAME THING FROM ONE RUN TO THE
 * NEXT. Every string below is scoped to the figures currently on screen.
 *
 * ── THE PRODUCER'S OWN STAMP, WHICH IS WHERE "STRUCTURAL" COMES FROM ───────
 *
 * The noun is not this lane's reading of what the field ought to mean. The
 * producer stamps the row: `importance_basis` reads `"graph_structural"` on
 * 67 of 67 rows carrying it, across 12 files, with NO other value anywhere in
 * the corpus. It is currently read by ZERO lines of code under `src/` — a
 * declared semantics the UI has never consulted. That stamp, plus
 * `types.ts`'s own "structural causal influence", plus PR #1221's witness that
 * five canvas influence numbers were byte-identical across two runs with
 * different option sets, is the evidence for the word "structural".
 *
 * ⚠ SCOPE, NARROWLY (trap 20). This block does not make `importance_basis` a
 * read path. It cites it as evidence for a noun. Consuming the stamp — and
 * failing closed when a future run stamps something other than
 * `graph_structural` — is a separate change with its own review.
 */

/** The two questions a driver figure raises, kept apart. This is the second. */
export interface InfluenceQuantity {
  /** The quantity's own name. Distinct per basis, by construction. */
  readonly noun: string
  /** One line saying what this quantity measures, for a reader who asks. */
  readonly gloss: string
  /**
   * The per-run disclosure, for rendering beside the figures themselves.
   *
   * Scoped to "these figures" deliberately: the basis is decided per run, so a
   * sentence in the present tense about what is on screen is the only true
   * form. A sentence about what "influence" means would be false the next run.
   */
  readonly runDisclosure: string
}

/**
 * ⭐ TOTAL OVER `DriverDisplayProvenance`, DELIBERATELY, AND THAT IS THE GUARD.
 *
 * Typed as a `Record` over the union rather than `Record<string, ...>`, so a
 * third basis added to `DriverDisplayProvenance` fails the BUILD here instead
 * of silently rendering the fail-closed wording for a quantity that has a name.
 * Same mechanism as `ZERO_REASON_BADGE_LABELS` below, for the same reason.
 *
 * ⚠ THE TWO ENTRIES MUST NEVER BE ALIASED TO EACH OTHER. That is the entire
 * point of the block, and `influenceQuantityVocabulary.spec.ts` asserts the
 * nouns are distinct — the same positive-control shape #1221 used on
 * `INFLUENCE_EXPLANATION_*`, which caught exactly that over-reach once already.
 */
export const INFLUENCE_QUANTITY_BY_BASIS: Record<DriverDisplayProvenance, InfluenceQuantity> = {
  /**
   * The producer's structural score. See the sweep above for why the word is
   * "structural" and not this lane's opinion.
   *
   * ⚠ THE GLOSS DOES NOT SAY "in this analysis" OR ANY VARIANT.
   * `influenceScaleCopy.noRunProvenance.spec.ts` establishes that this figure
   * is NOT computed from the run: it is a normalised product of authored
   * strengths along the paths to the goal, computed before the result exists.
   * Attributing it to the run is the exact falsehood that suite exists to stop.
   */
  influence_score: {
    noun: 'Structural influence',
    gloss: 'How strongly this factor connects to the goal in your model.',
    runDisclosure:
      'These show structural influence: how strongly each factor connects to the goal in your model.',
  },
  /**
   * This app's own normalisation of the producer's magnitude chain
   * (`elasticity`, then `sensitivity_score`, `sensitivity`, `importance_score`
   * — `driverDisplayModel.ts`'s `MAGNITUDE_FIELDS`).
   *
   * ⚠ THE GLOSS IS DERIVED FROM COPY THIS PRODUCT ALREADY SHIPS, not from this
   * lane's reading of the field name. `elasticityShiftCopy` in
   * `DriversSection.tsx` renders "Higher values tend to shift outcome by N%"
   * off the same quantity, so "how much the outcome shifts" is the semantics
   * already on screen rather than a new claim about the producer.
   *
   * ⚠ THE SECOND SENTENCE OF `runDisclosure` STATES THE ACTUAL PRODUCER
   * CONDITION, and it is the per-run half. The fallback is taken when NOT every
   * factor carried a finite `influence_score` — not because sensitivity was
   * preferred, and not because of anything about the factors on screen. Saying
   * "for every factor shown" would be FALSE: the coverage verdict is computed
   * over the whole feed, and the factor that failed it may be one the >= 0.01
   * visibility filter removed from the list the reader is looking at.
   */
  normalised_elasticity: {
    noun: 'Outcome sensitivity',
    gloss: 'How much the outcome shifts when this factor changes.',
    runDisclosure:
      'Olumi did not have a structural influence figure for every factor, so these show outcome sensitivity: how much the outcome shifts when each factor changes.',
  },
}

/**
 * The quantity a figure on THIS basis represents, or null when nothing is
 * stamped.
 *
 * Fail-closed on purpose, and null rather than a generic quantity: there is no
 * honest third noun. An unstamped payload is one whose quantity we do not know,
 * and naming it anyway is the fabrication this module keeps being corrected for.
 * Callers render the existing basis-free wording in that state.
 */
export function influenceQuantity(
  provenance: DriverDisplayProvenance | null | undefined,
): InfluenceQuantity | null {
  return provenance === 'influence_score' || provenance === 'normalised_elasticity'
    ? INFLUENCE_QUANTITY_BY_BASIS[provenance]
    : null
}

/**
 * The per-run basis disclosure for a set of figures, or null when unstamped.
 *
 * ⚠ THE ARGUMENT IS THE BASIS THE SURFACE RESOLVED, NEVER A PER-TAB CONSTANT.
 * A surface that hardcodes which quantity it shows is asserting a per-run fact
 * from a compile-time one, and the basis moves per run.
 */
export function influenceQuantityRunDisclosure(
  provenance: DriverDisplayProvenance | null | undefined,
): string | null {
  return influenceQuantity(provenance)?.runDisclosure ?? null
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE PRODUCER'S STAMP, NOW ACTUALLY READ — AND THE FAIL-CLOSED RULE OVER IT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The block above cites `importance_basis: "graph_structural"` as the EVIDENCE
 * for the word "structural", and says in as many words that it does not make
 * the stamp a read path: "Consuming the stamp — and failing closed when a
 * future run stamps something other than `graph_structural` — is a separate
 * change with its own review." This is that change.
 *
 * ── WHAT WAS WRONG WITH CITING IT AND NOT READING IT ──────────────────────
 *
 * A noun justified by a producer declaration that nothing checks is a noun
 * justified by a SNAPSHOT. The evidence was true when it was written and the
 * code had no way to notice it stopping being true. The moment a run stamps a
 * different basis, the screen keeps saying "structural influence" with the
 * justification silently withdrawn — and nothing REDs, because no test and no
 * branch ever looked at the field. That is this estate's hand-maintained mirror
 * (CLAUDE.md trap 12) wearing an unusual disguise: the mirror is not a list in
 * the code, it is a sentence in a docblock asserting a fact about the wire.
 *
 * ── THE RULE, AND WHY ABSENT ≠ UNRECOGNISED ───────────────────────────────
 *
 * Three states, not two, and collapsing them is the available mistake:
 *
 *   · CONFIRMED    — at least one row stamps a basis this code handles, and no
 *                    row stamps one it does not. The producer agrees with our
 *                    noun. Name the quantity.
 *   · UNSTAMPED    — no row carries a stamp at all. We learn NOTHING. The
 *                    pre-existing wording stands, exactly as it did before this
 *                    change; withholding here would be a regression against
 *                    legacy payloads, not caution. Measured at this head: 67 of
 *                    the 123 factor rows in the corpus carry a stamp, so 56 do
 *                    not — treating absent as unrecognised would blank the
 *                    disclosure on every one of those.
 *   · UNRECOGNISED — some row stamps a value this code does not handle. Our
 *                    noun is FALSIFIED, not merely unsupported. Withhold it.
 *
 * ⚠ THE UNRECOGNISED VERDICT IS EAGER AND SET-WIDE, ON PURPOSE. One unhandled
 * stamp anywhere in the feed poisons the run, mirroring
 * `selectDriverDisplayModel`'s own all-or-nothing coverage rule. A disclosure
 * is one sentence about the whole column; if any row in that column is on a
 * basis we cannot name, the sentence cannot be made true by majority.
 *
 * ── THE SCOPE OF THE WITHHOLDING, STATED NARROWLY (trap 20) ───────────────
 *
 * ONLY the `influence_score` arm is gated. That arm's noun is "Structural
 * influence" and the stamp is its evidence, so an unrecognised stamp falsifies
 * it. The `normalised_elasticity` arm is NOT gated: its noun is this app's own
 * normalisation of the magnitude chain, its gloss is derived from
 * `elasticityShiftCopy` that this product already ships, and `importance_basis`
 * is not evidence for it either way. Withholding it too would suppress a
 * sentence whose support is untouched, on the run that is already the degraded
 * one. Fail-closed means "do not assert what you cannot support" — not "assert
 * nothing whenever anything is uncertain".
 *
 * ⚠⚠ AND THE THING THIS CODE DOES *NOT* KNOW, SAID OUT LOUD. Measured over the
 * 67 stamped rows: `importance_basis` co-occurs with `importance_rank` (67/67)
 * AND with `influence_score` (67/67), and the producer's `importance_rank` and
 * `influence_rank` DISAGREE on 55 of 95 rows. So whether the stamp governs
 * `influence_score` specifically, or the `importance_*` ordering beside it, is
 * a PRODUCER-SIDE question this corpus cannot settle, and nothing here claims
 * to have settled it. The fail-closed direction is correct under either
 * reading, which is precisely why the rule is written as withholding rather
 * than as a re-interpretation: withholding needs only that the stamp is
 * evidence for the noun, never that it governs one exact field.
 */

/** The one basis value this code knows how to name. */
export const IMPORTANCE_BASIS_GRAPH_STRUCTURAL = 'graph_structural'

/**
 * Every `importance_basis` value this code handles.
 *
 * ⚠ THIS IS A HAND-WRITTEN LIST AND IT IS SUPPOSED TO BE. It cannot be derived
 * — the producer's value space lives in another service — so the completeness
 * check lives OUTSIDE it: `influenceQuantityVocabulary.spec.ts` sweeps every
 * JSON under `src/` and asserts the observed stamp set equals this list
 * EXACTLY. Growing or shrinking either side REDs. That is CLAUDE.md 12d's
 * ruling in practice: a derived guard proves agreement and can never prove
 * completeness, so the list gets a corpus check rather than a second mirror.
 */
export const HANDLED_IMPORTANCE_BASES: readonly string[] = [IMPORTANCE_BASIS_GRAPH_STRUCTURAL]

/** What the run's stamps let us say about the producer's declared basis. */
export type ImportanceBasisTrust = 'confirmed' | 'unstamped' | 'unrecognised'

/**
 * Fold a run's per-row stamps into one verdict. See the three states above.
 *
 * Blank strings count as absent, not as unrecognised: an empty stamp is a
 * producer emitting nothing, and treating it as a hostile value would blank the
 * disclosure on a whitespace bug rather than on a semantic change.
 */
export function importanceBasisTrust(
  stamps: ReadonlyArray<string | null | undefined>,
): ImportanceBasisTrust {
  let sawHandled = false
  for (const stamp of stamps) {
    if (typeof stamp !== 'string' || stamp.trim().length === 0) continue
    if (!HANDLED_IMPORTANCE_BASES.includes(stamp)) return 'unrecognised'
    sawHandled = true
  }
  return sawHandled ? 'confirmed' : 'unstamped'
}

/**
 * The quantity a run's figures represent, gated on the producer's own stamp.
 *
 * ⚠ STRICTLY A NARROWING OF `influenceQuantity`. This function can only ever
 * return what that one returns, or null — it never names a quantity the
 * ungated path would not have named. So the worst case of a bug here is a
 * disclosure that goes missing, never a new claim appearing.
 */
export function influenceQuantityForRun(
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasisStamps: ReadonlyArray<string | null | undefined>,
): InfluenceQuantity | null {
  if (
    provenance === 'influence_score'
    && importanceBasisTrust(importanceBasisStamps) === 'unrecognised'
  ) {
    return null
  }
  return influenceQuantity(provenance)
}

/** The per-run disclosure, gated on the producer's stamp. Null withholds it. */
export function influenceQuantityRunDisclosureForRun(
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasisStamps: ReadonlyArray<string | null | undefined>,
): string | null {
  return influenceQuantityForRun(provenance, importanceBasisStamps)?.runDisclosure ?? null
}

/** Convert a resolved metric to display percent without rescaling its value. */
export function analysisMetricPercent(metric: ResolvedAnalysisMetric): number {
  return Math.round(metric.value * 100)
}

/** Compact visible label. Every number names its licensed metric. */
export function analysisMetricVisibleLabel(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `Relative influence ${pct}%`
    case 'pre_analysis_influence_score':
      return `Pre-analysis influence score ${pct}%`
    case 'value_of_information':
      return `Value of information ${pct}%`
  }
}

/** Standalone title and accessible description for a resolved metric. */
export function analysisMetricTitle(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `Influence ${pct}%, relative to the strongest factor in this analysis`
    case 'pre_analysis_influence_score':
      return `Pre-analysis influence score ${pct}%`
    case 'value_of_information':
      return `Value of information ${pct}%`
  }
}

/** Predicate slot for generated prose after a factor name. */
export function analysisMetricPredicate(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `has relative influence of ${pct}% within this analysis`
    case 'pre_analysis_influence_score':
      return `has a pre-analysis influence score of ${pct}%`
    case 'value_of_information':
      return `has a value of information score of ${pct}%`
  }
}

/** Complete context sentence used by compact coaching surfaces. */
export function analysisMetricContextSentence(metric: ResolvedAnalysisMetric): string {
  return `${analysisMetricTitle(metric)}.`
}

/**
 * ⭐⭐ WHY A FACTOR THE PRODUCER RETURNED CARRIES NO SENSITIVITY — the
 * producer's own stamp, in one spelling.
 *
 * `ZeroReasonCode` (`results/types.ts`) is the producer's explanation for a
 * suppressed sensitivity, and the three codes differ in a way no summary
 * survives. `analysisNewCopy.ts` states the rule for its own empty state:
 * "three reasons cannot share one summary without one of them being described
 * wrongly". So every surface that discloses a suppression names the CODE.
 *
 * ⚠ MOVED HERE FROM `DriversSection.tsx`, WHERE IT WAS A FILE-LOCAL CONST, so
 * that the Reasoning tab's exclusion notice and the Drivers panel's row badge
 * cannot drift into two spellings of one producer stamp (CLAUDE.md trap 12).
 * `DriversSection` imports it rather than declaring it; nothing else changed
 * there.
 *
 * ⚠ TOTAL OVER THE CODE UNION, DELIBERATELY. Typed as a `Record` over
 * `NonNullable<ZeroReasonCode>` rather than `Record<string, string>`, so a
 * fourth code added to the union fails the BUILD instead of rendering a blank
 * reason. That is the derived half of the guard; the copy-hygiene cases above
 * are the corpus half.
 *
 * Display/label only — it reflects the producer's stamp and never fabricates
 * or recomputes a value.
 */
export const ZERO_REASON_BADGE_LABELS: Record<NonNullable<ZeroReasonCode>, string> = {
  intervention_override: 'Controlled by your options',
  disconnected: 'No path to the goal',
  zero_outcome_diff: "Doesn't change the outcome",
}

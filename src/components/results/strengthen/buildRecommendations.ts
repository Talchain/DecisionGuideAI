/**
 * buildRecommendations — Wave 3a trigger engine (brief §8.6: every
 * recommendation has a named deterministic or producer-backed trigger; the
 * UI adapts presentation, never invents semantic truth).
 *
 * Pure and fixture-testable. Trigger honesty rules:
 * - success-measure is the one DETERMINISTIC trigger (null goal threshold).
 * - flip / robustness / commit / phase-3 read producer fields only.
 * - low-evidence-high-influence is PATH-CONDITIONAL: it fires only when the
 *   producer sent per-factor confidence (newer wires) — never from the
 *   beliefExists fallback (plan §2).
 * - VOI cites the producer worth_investigating flag when present; otherwise
 *   the evpi>0.05pp UI threshold fallback is HONESTLY labelled (the
 *   UI-SEM-014 class) — the source line never claims producer provenance.
 * - broaden fires ONLY from a producer bias finding (§19: never local
 *   option counting) — no live emission until CEE ships the signal.
 *
 * Priority is deterministic (ascending): the framing foundation first, then
 * the producer's own Phase-3 ranking (ascending `priority_rank`, verbatim),
 * then evidence work, then challenge, then commit — and last, the UI-SEM-085
 * unranked phase-3 band (guidance blocks CEE sent with no `priority_rank` —
 * by contract, exercise and pre-0.19.0 blocks — whose order is arrival order
 * and is labelled as such). Reprioritisation reorders; the lifecycle store owns
 * status and never resets it. When the producer supplies an adaptive
 * priority (inputs.adaptivePriority), matching-helpType recs float above
 * the rest while preserving relative order within each group.
 */
import { guidanceCategoryRank, type GuidanceItem } from '../../../canvas/stores/guidanceStore'
import type { HelpType, Recommendation, StrengthenInputs, StrengthenPhase3Item } from './strengthenTypes'
import { attestsNoFactorFlip } from '../utils/fragileEdgeCopy'
import { biasCodeFromPhase3Item } from './biasTypesFromGuidance'
import { SUCCESS_TARGET_PROMPT } from './successTargetPrompt'
import { strongerOptionInWeakRuns } from '../strengthElicitation/assumedStrengthCopy'
import { selectNextInputToSet } from './nextInputToSet'
import { influenceRankReadout } from '../influenceScaleCopy'

/**
 * The deterministic "define a success measure" recommendation's id.
 *
 * ⭐ EXPORTED BECAUSE A SECOND SURFACE SUPPRESSES IT BY ID. The model strip
 * renders its own "Target · None set · Set a target" line, so the glance must
 * not ALSO promote this recommendation as the one thing to do — the panel said
 * one fact three times. A string literal in the suppressing file would be a
 * hand-maintained mirror: renaming the id here would silently restore the
 * duplication with nothing red (CLAUDE.md trap 12).
 */
export const SUCCESS_MEASURE_RECOMMENDATION_ID = 'strengthen:success-measure'

/**
 * GuidanceItem → StrengthenPhase3Item, the ONE store→engine mapping
 * (UI-SEM-085 narrowed; Stage 2). `priorityRank` rides through VERBATIM —
 * ascending, lower = first, unbounded, presence = producer-ranked. Nothing is
 * inverted and nothing is defaulted here: the historic `100 - priority`
 * re-inversion at this seam is what collapsed the coaching band (every rank
 * >= 100 had already clamped to priority 0 upstream, so 101 and 201 became one
 * tie broken by wire array order).
 *
 * Stage 2: `category`, `actionLabel` and `signal` now ride through VERBATIM
 * too. Stage 1 hardcoded `actionLabel: undefined` here, silently dropping the
 * producer's CTA label for every phase-3 row; `category` and `signal` were
 * never carried. Exported so specs can pin the live seam instead of
 * re-implementing it.
 */
export function toStrengthenPhase3Item(item: GuidanceItem): StrengthenPhase3Item {
  return {
    id: item.item_id,
    title: item.title,
    body: item.detail,
    actionIntent: item.primary_action.type === 'discuss' ? 'discuss' : item.primary_action.type,
    actionLabel: item.actionLabel,
    ...(item.category ? { category: item.category } : {}),
    ...(item.signal ? { signal: item.signal } : {}),
    // Stage 3: `signal_code` rides through VERBATIM. It survived
    // `deriveGuidance` onto `GuidanceItem` and then died HERE, unmapped — so
    // the engine had no way to tell a producer pre-mortem from a producer
    // assumption check and minted `clarify` for both.
    ...(item.signal_code ? { signalCode: item.signal_code } : {}),
    // ⭐ AND `dsk_claim_id` DIED HERE TOO, for the same reason and with the same
    // consequence one layer on. `signal_code` is `CALIBRATION_PROMPT` for both a
    // pre-mortem and an outside-view prompt; the claim id is `DSK-T-001` and
    // `DSK-T-002`. Dropping it left the methods shelf unable to tell the reader
    // that this run raised a pre-mortem — on the withheld run, where these
    // producer blocks are the only coaching the panel has.
    ...(item.dsk_claim_id ? { dskClaimId: item.dsk_claim_id } : {}),
    ...(item.coaching_kind ? { coachingKind: item.coaching_kind } : {}),
    /**
     * ⭐⭐ `target_object` FIRST, THEN `related_elements` — AND THE SECOND HALF
     * WAS SIMPLY NOT READ, WHICH LEFT A DEAD AFFORDANCE ON THIS PANEL.
     *
     * `GuidanceItem.related_elements` is the producer's own list of the other
     * elements a finding is about — its declared job, in the field's own words,
     * is that *"Inspectors match `id` against the currently selected element in
     * addition to `target_object.id`"*, and `InspectorCoaching.tsx:58-66` does
     * exactly that, with `target_object` taking precedence.
     *
     * This mapper read only `target_object`. So a finding the producer named
     * ONLY through `related_elements` — a WEAKLY_CONNECTED_NODE signal about a
     * node and its isolated neighbours is the documented example — arrived here
     * with `targetIds: []`, became `targetId: null` at `:397`, and
     * `StrengthenPanel.tsx:239` gates "Show me on the canvas" on exactly that.
     * **The Inspector could take you to the element and this panel could not**,
     * on the same producer fact. Two surfaces, one payload, different answers —
     * and the panel's silence looked like the producer had said nothing.
     *
     * ⚠ PRECEDENCE IS COPIED FROM THE INSPECTOR, NOT INVENTED. `target_object`
     * stays first, so `targetIds[0]` is UNCHANGED for every item that has one:
     * this can only add a route where there was none. A second ordering rule
     * for one producer field is how two readers of one fact drift apart.
     *
     * ⚠ AND NOTHING IS FILTERED BY `type` OR CHECKED AGAINST THE CANVAS HERE.
     * This mapper is pure and has no store; `focusModelTarget` is fail-CLOSED
     * and already resolves nodes AND edges, and its callers degrade with
     * `STRENGTHEN_COPY.focusFailedNotice` when an id names nothing — the same
     * contract `target_object.id` has always had. Adding a resolution test here
     * would put a second, store-bound answer beside the one that exists.
     */
    targetIds: [
      ...(item.target_object?.id ? [item.target_object.id] : []),
      ...(item.related_elements ?? [])
        .map((r) => r.id)
        .filter((id): id is string => typeof id === 'string' && id !== ''),
    ].filter((id, i, all) => all.indexOf(id) === i),
    ...(typeof item.priorityRank === 'number' ? { priorityRank: item.priorityRank } : {}),
  }
}

// ⛔ `VOI_EVPI_FLOOR_PP = 5` REMOVED. It was a UI-invented threshold on
// `evpi_percentage_points`, used to admit factors the PRODUCER had not flagged.
// The quantity is refuted — replayed live 2026-07-25, PLoT published 12.3 /
// 10.2 / 6.6 pp for three factors ISL measured at 0.0 pp in the SAME response,
// via a formula that multiplies BY the top-two win-probability gap and so
// inverts decision theory. A UI threshold on a refuted number selected factors
// on evidence our own compute layer contradicts.
/** Producer influence above this + confidence below the low bar = LEHI. */
const LEHI_INFLUENCE_FLOOR = 0.5
const LEHI_CONFIDENCE_CEILING = 0.4

// UI-SEM-075: Strengthen list flood control — display gating only, never a
// semantic judgement. (a) Phase-3 promotion is capped at the producer's own
// top-N ranking (MAX_PHASE3_PROMOTED) so a verbose guidance payload cannot
// flood the panel with a dozen rows; the un-promoted items still render in
// their own guidance surfaces. (b) Recommendations are deduplicated by
// normalised title + body (keep the highest-priority instance) so the panel
// never shows two rows with an identical visible identity. Title ALONE is
// not a duplicate: the producer emits distinct findings under one generic
// headline (four "A load-bearing assumption" review cards with different
// bodies) and title-only dedupe silently dropped real findings. Remove when
// CEE ships a canonical per-surface promotion budget / deduplicated
// strengthen feed.
const MAX_PHASE3_PROMOTED = 4

/**
 * ⛔⛔ PRODUCER REVIEW CARDS WHOSE KIND IS A CLAIM, AND THE LICENCE EACH NEEDS.
 *
 * Witnessed on the served build (23 Sep 2026, saved example "Customer Data
 * Platform Selection", guest): the turn's admission was `quantified_provisional`
 * — no option may be called the leader, no result stable or robust — and the
 * glance obeyed it. `decision_review_enricher` still sent three review cards,
 * and this promotion put them into "Strengthen the reasoning" VERBATIM, under
 * "Source: Olumi model review.":
 *
 *   ANALYSIS_NARRATIVE — "Adopt RudderStack produced the best outcome in 55% of
 *                         runs…": names and ranks a leader.
 *   PRE_MORTEM         — "the migration to Adopt RudderStack has overrun…":
 *                         presupposes the leader.
 *   FRAGILE_RESULT     — "How robust is this? … rated low on how often the
 *                         ordering holds": a robustness rating.
 *
 * #1881 gated the panel's OWN leader and strength words through
 * `hasLeadingOption` and `stabilityLicensed` (#1206). Both inputs were already
 * threaded by both callers; this promotion simply never consulted them, so the
 * producer's cards made the claims the panel's own copy is forbidden to make,
 * one row below it.
 *
 * RULED on olumi-programme-docs#63 (Release Control, comment 5787083967):
 * SUPPRESSION ONLY — a review-card kind that asserts a leader or a result
 * strength obeys the run's claim licence. So:
 *
 * - ⚠ KEYED ON THE PRODUCER'S `signal_code`, NEVER ON TEXT. The code is the
 *   producer's own name for the card's kind; the body is prose this estate
 *   forbids parsing. An item with no code is not identifiable as a claim card
 *   and is kept.
 * - ⚠ NOTHING IS REWORDED. A card is shown verbatim or not at all.
 * - ⚠ `ASSUMPTION_CHECK` IS ABSENT ON PURPOSE. It asserts neither a leader nor a
 *   strength, and the ruling names it as the card to leave alone. Every other
 *   code is untouched too: adding one here is a new claim about what a producer
 *   kind asserts, and needs its own evidence.
 * - ⚠ EXACT MATCH, like `HELP_TYPE_BY_SIGNAL_CODE`: the vocabulary is the
 *   producer's SCREAMING_SNAKE, verbatim.
 *
 * Not exported. The spec writes the codes out longhand, so a rename here goes
 * RED there instead of agreeing with itself.
 */
const LEADER_CLAIM_SIGNAL_CODES: ReadonlySet<string> = new Set([
  'ANALYSIS_NARRATIVE',
  'PRE_MORTEM',
])
const STABILITY_CLAIM_SIGNAL_CODES: ReadonlySet<string> = new Set(['FRAGILE_RESULT'])

/** Adaptive-priority boost: large enough that a matching rec always outranks
 * every non-matching band while in-band relative order is preserved. */
const ADAPTIVE_MATCH_BOOST = 10_000

/**
 * Producer `signal_code` → help type, for phase-3 guidance rows.
 *
 * ⭐⭐ WHY THIS EXISTS. Every phase-3 row was minted `clarify`, unconditionally.
 * So the producer's OWN challenge cards — a pre-mortem, a cognitive-bias
 * signal, a fragile result — arrived at the panel classified as "complete the
 * model". Two consequences, and the second is the expensive one:
 *   1. The row is mislabelled.
 *   2. `composePreview` picks the last preview slot by looking for a finding of
 *      a DIFFERENT kind, so that the default three rows are not all one kind of
 *      thinking. Fed a monoculture of `clarify` it has nothing to choose
 *      between — and since the producer band occupies ranks 10-13, above every
 *      deterministic trigger, the one critical move in the product sat below
 *      the fold on exactly the runs that warranted it.
 *
 * ⚠⚠ DELIBERATELY SHORT, AND THE GAPS ARE THE POINT — the same restraint rule
 * as `recommendationMethod.ts`. A row is reclassified ONLY where the producer's
 * code names the move AND we can point at an existing, independent
 * classification of that same move:
 *
 *   PRE_MORTEM, FRAGILE_RESULT → 'challenge'. The engine's own
 *     `strengthen:robustness` trigger — "Pressure-test the leading option", the
 *     move for a lead that does not survive stress-testing — is `challenge`.
 *     Same move, same kind; this is the engine agreeing with itself.
 *   LOW_OPTION_COUNT → 'broaden'. The engine's own `strengthen:broaden` —
 *     "Find a route that works differently" — is `broaden`, and a low option
 *     count is what that recommendation is about.
 *   COGNITIVE_BIAS → 'challenge'. The one row NOT grounded in an existing
 *     trigger, and it is called out rather than hidden: it is grounded in the
 *     catalogue instead. `review_bias` is a technique whose whole content is
 *     critique of the reasoning so far. (Narrow-framing bias is separate and
 *     already drives `strengthen:broaden` through its own producer gate.)
 *
 * ASSUMPTION_CHECK, EVIDENCE_GAP, CALIBRATION_PROMPT, STRENGTHEN_ITEM,
 * ANALYSIS_NARRATIVE, DEFAULT_NODE_CONFIDENCE and FLIP_THRESHOLD are
 * deliberately ABSENT. Nothing here classifies them, so a kind for them would
 * be the UI's opinion wearing the producer's clothes. They keep `clarify`,
 * which is what they get today — this change can only move a row OFF the
 * default, never onto it.
 *
 * `signal_code` is an OPEN producer vocabulary, so an unrecognised code falls
 * through to `clarify`. That is the honest default, not a gap to close later:
 * a code we have never seen is a move we cannot classify.
 */
const HELP_TYPE_BY_SIGNAL_CODE: Readonly<Record<string, HelpType>> = {
  PRE_MORTEM: 'challenge',
  FRAGILE_RESULT: 'challenge',
  COGNITIVE_BIAS: 'challenge',
  LOW_OPTION_COUNT: 'broaden',
}

/** Exported so a spec can pin the map without re-implementing it. */
export function helpTypeForPhase3Item(item: StrengthenPhase3Item): HelpType {
  if (!item.signalCode) return 'clarify'
  return HELP_TYPE_BY_SIGNAL_CODE[item.signalCode] ?? 'clarify'
}

// UI-SEM-085 (narrowed, 0.19.0): two phase-3 bands, not one. A guidance
// block the producer ranked (it carries `priority_rank` — ascending, lower =
// first, UNBOUNDED) keeps its place near the top of the ladder (phase3Base).
// A block the producer did NOT rank (pre-0.19.0 blocks, exercise blocks —
// the contract gives them no rank) has no producer ORDER — those rows drop
// to phase3Unranked, BELOW every producer-backed trigger, and each says so
// in its source line. Demotion + disclosure ONLY: no replacement order is
// derived from `category`/`priority` (urgency is not an order), and the
// order WITHIN the unranked band remains the arrival order — labelled as
// such instead of presented as a ranking.
//
// Band offsets are DENSE indices into the promoted list (0..3 under
// MAX_PHASE3_PROMOTED), NOT the raw rank: ranks are unbounded, so adding
// them (the historic `phase3Base + rank`) let a coaching-band rank (>= 100)
// spill past the flip trigger and even past the unranked band. An ordinal
// carries only ORDER — the dense index preserves it exactly.
const PRIORITY = {
  successMeasure: 0,
  nextInput: 5,
  phase3Base: 10, // + dense promoted-list index (producer-ranked only)
  flip: 100,
  lehi: 110,
  voi: 120,
  robustness: 130,
  broaden: 140,
  commit: 200,
  phase3Unranked: 210, // + dense index; below the whole producer-backed ladder
} as const

/** UI-SEM-085 source lines. Producer-ranked rows keep the original line; a
 * defaulted row must not imply an ordering the producer never sent. */
const PHASE3_SOURCE_RANKED = 'Source: Olumi model review.'
const PHASE3_SOURCE_UNRANKED =
  'Source: Olumi model review (not ranked, shown in the order received).'

/** Text normalisation for the UI-SEM-075 dedupe keys (case/whitespace only). */
function normaliseText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** UI-SEM-075(b) dedupe key: normalised title + body. Two entries are true
 * duplicates only when BOTH match — a shared generic headline over distinct
 * bodies is distinct findings, never a duplicate. */
function dedupeKey(title: string, body: string | undefined): string {
  return `${normaliseText(title)}\u0000${normaliseText(body ?? '')}`
}

/**
 * ⭐⭐ ONE FINDING THAT ARRIVED ON TWO CHANNELS IS ONE FINDING.
 *
 * ## Measured on a real run (bundle `d9c4066c`, 19 Sep 2026)
 *
 * The producer emits each load-bearing assumption TWICE, from the same handler
 * in the same millisecond, with **byte-identical bodies**:
 *
 * ```
 *   signal_id "review:assumption:1:8ac55f86e2c168ef"  priority_rank  71
 *     type review_card · title "A load-bearing assumption"
 *     NO action, NO target_refs                      ← the explanation
 *
 *   signal_id "coach:assumption:1:8ac55f86e2c168ef"   priority_rank 101
 *     type coaching · title "An assumption to check"
 *     action_intent confirm_factor · target_refs [Product Quality]
 *                                                    ← the route
 * ```
 *
 * Three assumptions, so **six rows on screen** — each sentence read twice, and
 * only the second copy of each could be acted on.
 *
 * ## ⚠ WHY THE EXISTING DEDUPE CANNOT SEE IT — it misses by exactly one field
 *
 * `dedupeKey` is `title + body`, and these twins have **different titles**. That
 * conjunction is right for the case it was written for (the comment above it
 * records it: one generic headline over distinct bodies is distinct findings)
 * and blind to the mirror case — one body under two headlines.
 *
 * ## The key is the PRODUCER'S OWN, not a content sniff
 *
 * `signal_code` is `ASSUMPTION_CHECK` on both halves, and the rank bands are
 * documented on `StrengthenPhase3Item.priorityRank`: **10-99 review cards,
 * 100-199 coaching**. So `signal_code` + body is a channel-independent identity
 * the producer already mints; body equality alone would be a sniff, and
 * `signal_code` alone would collapse genuinely distinct findings of one kind.
 *
 * ## ⛔ IT MERGES, IT DOES NOT DROP — and that distinction is the whole fix
 *
 * A plain dedupe would keep the FIRST twin after sorting, which is the review
 * card (rank 71) — **and silently delete the action and the target**, leaving
 * an explanation the user cannot act on. That is the defect RC4 named, arrived
 * at from the opposite direction. So the surviving row keeps its own copy and
 * ADOPTS the action, the coaching kind and the targets from its twin.
 *
 * Consequences, each deliberate:
 * - **the explanation survives verbatim** — the kept body is never rewritten;
 * - **display order is unchanged** — the kept row is the one that already sorted
 *   first, so nothing moves;
 * - **the disagreement controls keep working**, because they hang off the row's
 *   target and action, which are now present rather than on a second row;
 * - **the single-finding case is untouched** — a finding with no twin folds to
 *   itself and is returned unchanged;
 * - **different bodies are never merged**, so a real pair of findings that share
 *   a `signal_code` both render.
 */
function channelTwinKey(item: StrengthenPhase3Item): string | null {
  const code = normaliseText(item.signalCode ?? '')
  const body = normaliseText(item.body ?? '')
  // Both halves required. A code with no body cannot be shown to be the same
  // finding, and a body with no code is the content sniff this avoids.
  return code !== '' && body !== '' ? `${code}\u0000${body}` : null
}

/**
 * ⛔⛔ THE CHANNEL DISCRIMINATOR — AND ITS ABSENCE WAS A REAL DEFECT THE
 * EXISTING SUITE CAUGHT.
 *
 * The first version keyed on `signal_code` + body alone. That is too loose:
 * `biasMethodReachesTheProducersBias` mounts **six named bias cards that share
 * one generic body** (`COGNITIVE_BIAS` / "Producer evidence quoting the brief.")
 * and differ only by title. The loose key folded all six into one and spent the
 * display budget on a row the producer never sent.
 *
 * ⭐ "One finding on two channels" means literally that, so the rule must test
 * the CHANNEL. A `review_card` carries no `coaching_kind`; a `coaching` block
 * always does. So a twin pair is one of each — and six coaching cards can never
 * pair with one another however much text they share.
 *
 * ⚠ Derived from the capture, not assumed: `review:assumption:1:…` has no
 * `coaching_kind`, `coach:assumption:1:…` has `assumption_check`, and all six
 * bias cards carry `bias_signal`. The discriminator separates the real pair and
 * refuses the false one on the same evidence.
 */
function isCrossChannelPair(a: StrengthenPhase3Item, b: StrengthenPhase3Item): boolean {
  return (a.coachingKind == null) !== (b.coachingKind == null)
}

function mergeChannelTwins(items: StrengthenPhase3Item[]): StrengthenPhase3Item[] {
  const out: StrengthenPhase3Item[] = []
  const firstAt = new Map<string, number>()
  for (const item of items) {
    const key = channelTwinKey(item)
    if (key === null) {
      out.push(item)
      continue
    }
    const at = firstAt.get(key)
    if (at === undefined) {
      firstAt.set(key, out.length)
      out.push(item)
      continue
    }
    const kept = out[at]
    // ⛔ Same code and same body is NOT enough. Without the channel test, six
    // bias cards sharing one generic body collapse into one row.
    if (!isCrossChannelPair(kept, item)) {
      out.push(item)
      continue
    }
    // ⚠ `??` and a length check, never a spread of the twin: the kept row's own
    // producer copy must win every field it already has. Adopting is for what
    // it LACKS — which on the measured run is exactly the action and the target.
    out[at] = {
      ...kept,
      actionIntent: kept.actionIntent ?? item.actionIntent,
      actionLabel: kept.actionLabel ?? item.actionLabel,
      coachingKind: kept.coachingKind ?? item.coachingKind,
      targetIds: kept.targetIds.length > 0 ? kept.targetIds : item.targetIds,
    }
  }
  return out
}

/*
 * ⚠ `pct()` LIVED HERE AND IS GONE WITH ITS ONLY CALLER. The flip signal was
 * the single use of it; the sentence that replaces that signal formats its own
 * percentage inside `strongerOptionInWeakRuns`, beside the condition it belongs
 * to, so a second formatter in this file would be a percentage waiting to
 * disagree with the one the reader sees. Removed rather than left unused,
 * because the required check's FIRST step is lint and an unused local fails it
 * before a single test runs.
 */

export function buildRecommendations(inputs: StrengthenInputs): Recommendation[] {
  const recs: Recommendation[] = []

  // ── ROADMAP 1.243: the leader ENTITLEMENT ────────────────────────────────
  // `analysisComplete` answers "did a run finish?". It does NOT answer "may we
  // name a leader?" — and every trigger below used it as though it did. On a
  // withheld run (CEE declines to put an option forward; `deriveDecisionVerdict`
  // returns hasLeadingOption false) the challenge trigger still emitted
  // "Challenge the leader" with the prompt "Build the strongest case against
  // the current leading option." — the assistant asked to argue against a
  // leader the producer had explicitly refused to name.
  //
  // Strict `=== false`: only an explicit withheld verdict suppresses; an absent
  // one is a legacy/fixture caller and keeps the previous behaviour. Read ONCE,
  // here, so a trigger added later cannot quietly reintroduce the conflation by
  // reaching for `analysisComplete` again.
  //
  // ⚠ SAME NAME AS THE EXPORT IN `analysisClaimPolicy.ts`, AND — SINCE #1190 —
  // THE SAME ANSWER. This local is NOT a second question. Both production
  // callers thread the COMPOSED answer into `inputs.hasLeadingOption`:
  //
  //   `strengthen/StrengthenContainer.tsx`                  → leaderDesignationPermitted(data.recommendation)
  //   `analysisNew/buildStrengthenInputsForAnalysisNew.ts`  → leaderDesignationPermitted(data.recommendation)
  //
  // so on every live path `inputs.hasLeadingOption` already carries the CEE
  // lattice AND this result's separation, and this local means exactly what
  // the export means. Importing the export here would change no trigger.
  //
  // ⚠⚠ AN EARLIER VERSION OF THIS COMMENT SAID THE OPPOSITE — that the local
  // "answers Q2 ALONE, because `inputs` carries no admission and this module
  // is not on that seam", and that importing the export "would silently change
  // which triggers fire". Both sentences were false at the tip that shipped
  // them: `StrengthenContainer` already threaded the composed answer, so the
  // divergence was never local-vs-export but CALLER-vs-CALLER, and #1190 then
  // closed the one caller that did read Q2 alone. A false comment describing
  // successor work is worse than no comment — it tells the next reader the
  // question is settled in the wrong direction — which is why the correction
  // is recorded here rather than the old text simply being deleted.
  //
  // THE REAL, REMAINING HAZARD IS THE INTERFACE, NOT THE NAME. This module
  // DERIVES nothing: it reads whatever its caller threaded. A third caller
  // that threads `verdict.hasLeadingOption` instead would silently re-open the
  // divergence on `quantified_provisional`, here, with no red. That is pinned
  // by `__tests__/strengthenInputsCallersThreadComposed.spec.ts`, which
  // enumerates the production call sites rather than trusting this paragraph —
  // a comment is a hand-maintained mirror, and this one has already drifted
  // once (CLAUDE.md trap 12).
  const leaderClaimWithheld = inputs.hasLeadingOption === false

  // ── THE SUBJECT OF A PERMITTED CLAIM: A NAME, NOT A RANK POSITION ─────────
  //
  // ⭐⭐ PERMISSION AND IDENTITY ARE TWO QUESTIONS AND THIS ENGINE ONLY HELD ONE
  // OF THEM (CLAUDE.md trap 21). `leaderClaimWithheld` above answers *may this
  // panel designate a leader?* — it is entitlement, and it says nothing about
  // what the option is CALLED. So the two triggers it permits wrote their
  // subject as the only referent they had: "the option that scored highest",
  // which is TRUE of rank 0, FALSE of every other option, and NAMES NONE. The
  // reader is handed a placing and left to resolve it, on a claim the system
  // chose and the user never asked for.
  //
  // ⚠ AND NO VOCABULARY GUARD CAN SEE IT — the sentence contains no banned
  // word. `ownedLeaderClaim.strengthen.spec.tsx`'s designating-form net catches
  // leader NOUNS ("the leader", "the leading option") and was green throughout.
  // The race frame lives in the REFERENT, so the repair is a referent change:
  // where the gate already permits naming an option, SAY THE NAME. That is also
  // the weaker claim of the two, because it drops the ranking assertion instead
  // of restating it.
  //
  // ⚠ TRIMMED, AND EMPTY IS ABSENT. A producer label of `''` or `'   '` would
  // otherwise render "Pressure-test " with nothing after it.
  const permittedLeadingOptionName =
    !leaderClaimWithheld && typeof inputs.leadingOptionLabel === 'string'
      ? inputs.leadingOptionLabel.trim() || null
      : null

  /**
   * ── Clarify: define a measurable success (deterministic) ──────────────────
   *
   * ⚠⚠ GATED ON EXISTENCE, NOT ON A NUMBER, AND THE DIFFERENCE IS THE WHOLE
   * DEFECT. This read `inputs.goalThreshold == null` — a numeric test standing
   * in for "has anyone set a target?". It is not the same question. A goal
   * stating `200k`, `£11M`, `11%` or `≥ £1,000` HAS a target that no
   * `number | null` can hold, so the card denied one while the model strip
   * displayed it, in the same panel, with the words "your goal has no success
   * threshold (checked directly)".
   *
   * Five rounds of tightening and widening a single coercion each moved that
   * harm rather than closing it, because the two harms are opposite: too
   * permissive silences true coaching, too strict re-opens the contradiction.
   * `hasStatedGoalTarget` is the existence answer, `goalThreshold` stays the
   * number, and neither is asked to be the other.
   *
   * The `=== undefined` fallback keeps every legacy and fixture caller on
   * exactly its previous behaviour.
   *
   * ⚠ IT IS `=== undefined`, NOT `??`, AND AN EARLIER VERSION OF THIS COMMENT
   * SAID `??`. They differ on an explicit `null`: `??` would treat one as
   * absent and fall back to the numeric test, while `=== undefined` treats it
   * as a present answer of "no target stated". The type is `boolean | undefined`
   * so `null` is not admitted, which is why the code is right — but a comment
   * naming a mechanism the code beside it does not use is the defect this whole
   * change is about, and it does not get an exemption for being small.
   */
  const noStatedTarget = inputs.hasStatedGoalTarget === undefined
    ? inputs.goalThreshold == null
    : !inputs.hasStatedGoalTarget
  if (noStatedTarget) {
    recs.push({
      id: SUCCESS_MEASURE_RECOMMENDATION_ID,
      helpType: 'clarify',
      title: 'Define what success looks like',
      signal: 'No measurable success target is set.',
      // 1.243 RELABEL, unconditional. `whyNow` is not display copy alone: the
      // container passes it as the Ask-Olumi drawer CONTEXT, so "only which is
      // ahead" reached the assistant as a statement that the analysis HAD
      // ranked the options — false on any withheld run, and this rec is not
      // even analysis-gated, so it also said it before any run existed. The
      // contrast that motivates the rec is kept; only the ranking claim goes.
      whyNow: 'Without a target the analysis cannot say how likely each option is to succeed, only how they compare with one another.',
      tryThis: 'Pick the number that would make this decision a win, and the date it matters by.',
      sourceLine: 'Source: your goal has no success threshold (checked directly).',
      action: {
        // Round-2 wiring: the primary DOES the thing — the structured
        // Define-success modal (threshold commits through the canonical
        // rerun path). The Olumi route stays available on the ✦ affordance.
        kind: 'open-modal',
        modal: 'define-success',
        label: 'Define success',
        /**
         * ⭐⭐ THE PROMPT IS THE HAND-OFF, AND ON THE LIVE POSTURE IT IS THE ONLY
         * ROUTE THIS CARD HAS. `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is
         * `'disabled'` in a `const satisfies` object, so `hasServerGraphAuthority`
         * is a compile-time `false` and BOTH Strengthen surfaces fall through to
         * the Ask-Olumi drawer rather than the modal. Whatever this string says
         * is what the user sends — so it is shared with the canvas coaching
         * panel's own Define-success row rather than spelled twice. See
         * `successTargetPrompt.ts` for the staging witness it replaces and why
         * each of its clauses exists.
         */
        prompt: SUCCESS_TARGET_PROMPT,
      },
      targetId: null,
      priority: PRIORITY.successMeasure,
    })
  }

  // ── Phase-3 promotion (producer-owned coaching blocks, verbatim) ──────────
  // UI-SEM-075(a): promote only the producer's own top-N ranking, first
  // occurrence per title+body — display gating so the panel never floods
  // with a dozen near-identical guidance rows (the rest stay on their own
  // surfaces). Keying on title ALONE dropped distinct findings: the producer
  // emits several review cards under one generic headline with different
  // bodies (fixture cee-response-b82c89dd-trimmed). The cap is a display
  // budget and still applies AFTER true-duplicate removal.
  // UI-SEM-085 (narrowed): producer-ranked items sort ahead of unranked ones
  // BEFORE the MAX_PHASE3_PROMOTED budget is applied. Without this the cap
  // could be spent on unranked rows (which are then demoted to the bottom
  // anyway) while a genuinely producer-ranked block is dropped entirely.
  // Ranked-ness IS rank presence (0.19.0: `priority_rank` is the producer's
  // ordering; exercise blocks and pre-0.19.0 blocks legitimately lack it).
  const isProducerRanked = (i: StrengthenInputs['phase3Items'][number]): boolean =>
    typeof i.priorityRank === 'number'
  // ⛔ THE RUN'S CLAIM LICENCE, applied to the producer's review cards (see
  // LEADER_CLAIM_SIGNAL_CODES; #1206, #1881, ruling olumi-programme-docs#63).
  // Strict `=== false` on both, for the reason `leaderClaimWithheld` above gives:
  // an absent value is a legacy/fixture caller and keeps every card, matching
  // the absence arm both inputs document in `strengthenTypes.ts`. The leader arm
  // REUSES `leaderClaimWithheld` rather than re-reading the input, so it cannot
  // drift from the other triggers it gates.
  //
  // ⚠ FILTERED FIRST — BEFORE the sort, the dedupe, the channel-twin fold and
  // the MAX_PHASE3_PROMOTED budget. On the captured runs the three claim cards
  // sort ahead of every assumption card (should_fix before could_fix; rank 10
  // before 60+) and so hold three of the four slots; dropping them after the
  // cap would spend those slots on rows nobody sees and push real findings off
  // the list — the harm the UI-SEM-085 ordering fix prevents one level up. And
  // before the title+body dedupe, so a suppressed card can never be the "first
  // occurrence" that silently removes a licensed one.
  const stabilityClaimWithheld = inputs.stabilityLicensed === false
  const obeysClaimLicence = (i: StrengthenInputs['phase3Items'][number]): boolean => {
    if (i.signalCode === undefined) return true
    if (leaderClaimWithheld && LEADER_CLAIM_SIGNAL_CODES.has(i.signalCode)) return false
    if (stabilityClaimWithheld && STABILITY_CLAIM_SIGNAL_CODES.has(i.signalCode)) return false
    return true
  }
  const seenPhase3Keys = new Set<string>()
  const dedupedPhase3 = inputs.phase3Items
    .filter(obeysClaimLicence)
    .sort((a, b) => {
      // Stage 2 — SEVERITY-major: the producer's `category` is the primary
      // display order (must_fix → should_fix → could_fix → technique). It is
      // the user-facing hierarchy, so a must_fix finding outranks a should_fix
      // one whatever their ranks. Items the producer did NOT categorise fall
      // into one trailing bucket (honest absence — never a synthesised
      // severity), preserving their existing ranked/arrival order among
      // themselves (guidanceRankHonesty pins that category-less rows are never
      // silently reordered).
      const catDelta = guidanceCategoryRank(a.category) - guidanceCategoryRank(b.category)
      if (catDelta !== 0) return catDelta
      // Within a category: producer-ranked before unranked (UI-SEM-085 — rank
      // PRESENCE is the "producer ordered this" fact; the ranked/unranked band
      // split below then keeps unranked rows demoted + disclosed).
      const rankedDelta = Number(isProducerRanked(b)) - Number(isProducerRanked(a))
      if (rankedDelta !== 0) return rankedDelta
      // Then ascending producer rank — lower = first, verbatim wire semantics
      // (unbounded; the bands are disjoint numeric ranges, so plain numeric
      // order respects them — no cross-band re-ranking). Equal ranks are
      // producer-order ties: sort() is stable, arrival order holds, which is
      // what the contract prescribes. Unranked pairs both hit the sentinel →
      // stable → arrival order, labelled as such below.
      return (
        (a.priorityRank ?? Number.MAX_SAFE_INTEGER) -
        (b.priorityRank ?? Number.MAX_SAFE_INTEGER)
      )
    })
    .filter((item) => {
      const key = dedupeKey(item.title, item.body)
      if (seenPhase3Keys.has(key)) return false
      seenPhase3Keys.add(key)
      return true
    })
  // ⭐ ONE FINDING ON TWO CHANNELS, folded before the display budget is spent.
  // Order matters: folding AFTER the cap would let a twin pair consume two of
  // the budget's slots and push a distinct finding off the list entirely, which
  // is the same harm the UI-SEM-085 ordering fix exists to prevent one level up.
  const promotedPhase3 = mergeChannelTwins(dedupedPhase3).slice(0, MAX_PHASE3_PROMOTED)
  let promotedIndex = 0
  for (const item of promotedPhase3) {
    const biasCode = biasCodeFromPhase3Item(item)
    recs.push({
      id: `strengthen:phase3:${item.id}`,
      // Producer-owned passthrough, exactly as `signalCode` and `biasCode` are:
      // `methodForRecommendation` needs an IDENTITY to resolve a technique, and
      // this is the only one a coaching block carries.
      ...(item.dskClaimId ? { dskClaimId: item.dskClaimId } : {}),
      // Stage 3: the producer's own `signal_code`, where it names a move we can
      // independently classify. Falls through to 'clarify' — today's
      // unconditional value — for every code we cannot. See
      // HELP_TYPE_BY_SIGNAL_CODE.
      helpType: helpTypeForPhase3Item(item),
      title: item.title, // verbatim wire copy — never UI-authored
      // The producer's factor-naming body rides BOTH display fields VERBATIM
      // (trigger honesty holds — wire copy, never UI-authored):
      // - signal: the collapsed-row subtitle (information scent, clamped by
      //   the panel);
      // - whyNow: the expanded-row prose AND the Ask-Olumi drawer context
      //   (StrengthenContainer passes rec.whyNow) — a generic line here
      //   degraded every phase-3 drawer ask to boilerplate (round 2).
      // Boilerplate is the no-body fallback only. The PANEL dedupes display:
      // an open row renders the body once, in full, never clamp + full copy.
      // Stage 2: a producer `signal` display line (carried today only on the
      // deterministic stale-rerun nudge) is preferred VERBATIM over the body —
      // it is the producer's own subtitle. Body is the fallback; boilerplate
      // the no-copy floor.
      signal: item.signal ?? item.body ?? 'Olumi flagged this while reviewing your model.',
      whyNow: item.body ?? 'Resolving it improves what the analysis can tell you.',
      /**
       * ⭐⭐ NO INSTRUCTION IS NAMED HERE, AND THAT IS THE FIX RATHER THAN A GAP.
       *
       * This read `item.actionLabel ?? 'Work through it with Olumi.'`, and it
       * was a restatement of the button in BOTH branches — not only in the
       * fallback. When the producer supplies `actionLabel` it becomes
       * `action.label` four lines below, so the card rendered the identical
       * string twice; when it does not, both fell to the same boilerplate.
       * Either way "Try this" carried nothing the reader could not already see.
       *
       * The producer's own instruction, when it has one, rides `action.label`
       * on the button — where it is pressable. The catalogue paths in this file
       * keep their hand-authored `tryThis` because those ARE instructions
       * ("Build the strongest case AGAINST the current leader and see if it
       * survives"), and they are what "Try this" should mean.
       */
      tryThis: null,
      // UI-SEM-085: the label IS the band marker — an unranked row states that
      // its position is arrival order, not merit.
      sourceLine: isProducerRanked(item) ? PHASE3_SOURCE_RANKED : PHASE3_SOURCE_UNRANKED,
      action: {
        kind: 'ai-dialogue',
        label: item.actionLabel ?? 'Work through with Olumi',
        actionType: item.actionIntent ?? 'discuss',
        parameters: { block_id: item.id },
        prompt: item.title,
      },
      targetId: item.targetIds[0] ?? null,
      // UI-SEM-085 (narrowed): producer-ranked keeps the top band, unranked
      // drops below the entire producer-backed ladder. The offset is the
      // DENSE position in the promoted list (never the raw rank — unbounded
      // ranks spill across bands; an ordinal carries only order, and the
      // dense index preserves it exactly). Ranked rows precede unranked rows
      // in promotedPhase3, so one running index keeps both bands in
      // producer/arrival order without ever colliding with the flip trigger.
      priority:
        (isProducerRanked(item) ? PRIORITY.phase3Base : PRIORITY.phase3Unranked) +
        promotedIndex++,
      // Stage 2: the producer's severity, VERBATIM — drives the row badge.
      // Only phase-3 recs carry it (the UI's own triggers are uncategorised,
      // so they show no badge — honest absence).
      ...(item.category ? { category: item.category } : {}),
      // Stage 3: carried so the surface can attach a named technique to a
      // PRODUCER finding, not only to the UI's own triggers.
      ...(item.signalCode ? { signalCode: item.signalCode } : {}),
      /**
       * ⭐⭐ WHICH bias, not merely THAT a bias was found — the fact that
       * decides whether the card can offer the corrective for the bias in hand
       * or only the generic "review a possible bias".
       *
       * `signalCode` above is `COGNITIVE_BIAS` for every one of them, so the
       * identity was arriving and dying here: the producer names the bias in the
       * card's TITLE, the registry is the estate's one authority on what those
       * titles mean, and nothing was reading the two together on a per-card
       * basis. `biasCodeFromPhase3Item` requires BOTH producer facts
       * (`coaching_kind === 'bias_signal'` AND a registry-recognised title) and
       * returns `null` otherwise — so this is absent on every non-bias card and
       * on any bias this estate has no code for. Nothing is inferred from the
       * model or the brief.
       */
      ...(biasCode ? { biasCode } : {}),
    })
  }

  // ── Evaluate: the single top flip risk (producer fragile_edges) ──────────
  // 1.243 GATE. A "flip" is a change in the ORDERING, so this rec is
  // comparative in all three of its parts: the SELECTION (argmax over the
  // MEASURED `switch_probability` — StrengthenContainer's presence branch
  // admits no other quantity; `marginal_switch_probability` is a different
  // Monte Carlo and never substitutes), the
  // TITLE, and the SIGNAL, which names `alternative_winner_label` and so
  // designates by elimination (the #494 residual-1 argument: naming what the
  // result would flip TO asserts that something else is currently ahead).
  // Gated rather than relabelled because there is no leader-free reading of
  // the quantity itself — unlike win probability, which #494 could relabel
  // because "this option wins in N% of runs" survives without a ranking.
  // The DATA is not lost: `challengeFragileEdges` also feeds V7SignalRow's
  // flip-risk chip, buildV7Lenses' flipRisks and V7TopMatter.
  //
  // ⚠⚠ SECOND GATE, AND IT IS A DIFFERENT QUESTION (the anti-correlated half).
  // `leaderClaimWithheld` is Q1, PERMISSION. It is FALSE on exactly the runs
  // where Q2 bites, because a run whose factors cannot flip the leader is a run
  // whose leader IS confidently designated — so Q1 alone left this rec asserting
  // "55% chance the result flips to {alt}" directly beside the footer's "none of
  // the factors we could test changed which option leads on its own". Witnessed
  // on `live-analysis-turn-walkA-2026-08-04.json`, same panel, same run, same
  // named alternative. Q2 is the producer's own flip evidence, read through the
  // existing `classifyFlipEvidence` authority — no new derivation.
  //
  // GATED, not relabelled, for the reason the Q1 comment above already gives:
  // there is no leader-free reading of "chance the result flips", and the title
  // ("most likely to change the leader") carries the same claim. The DATA is not
  // lost — the same `challengeFragileEdges` feed the fragile card, V7SignalRow's
  // chip, `buildV7Lenses` flipRisks and V7TopMatter.
  const flipEvidenceAttestsNoFlip = attestsNoFactorFlip(inputs.flipThresholds)
  if (
    !leaderClaimWithheld &&
    !flipEvidenceAttestsNoFlip &&
    inputs.analysisComplete &&
    inputs.fragileEdges.length > 0
  ) {
    const top = [...inputs.fragileEdges].sort(
      (a, b) => b.switchProbability - a.switchProbability,
    )[0]
    const alt = top.alternativeWinnerLabel
    recs.push({
      id: `strengthen:flip:${top.edgeId}`,
      helpType: 'evaluate',
      // ⭐ THE SAME REFERENT REPAIR, ON THE OTHER PERMITTED TRIGGER. This read
      // "Test the assumption most likely to change which option scores
      // highest" — an argmax description of the ASSUMPTION wrapped around a
      // ranking assertion about the OPTIONS, naming neither. The assumption has
      // a name and the engine is already holding it, so the title says it.
      //
      // ⚠ NOTHING IS LOST. The reason this assumption rather than another is
      // the `signal` directly beneath ("NN% chance the result flips to {alt} if
      // {factor} shifts"), and `whyNow` carries the urgency. The title was
      // restating the selection rule; now it states the subject.
      title: `Test the assumption about ${top.factorLabel}`,
      /**
       * ⛔⛔ THIS SAID THE WRONG QUANTITY, AND IT SAID IT AS A FORECAST.
       *
       * As shipped: *"NN% chance {alt} scores highest instead if {factor}
       * shifts."* Two faults in one sentence, and the second is the one no
       * guard could see:
       *
       *  1 · CONDITION DROPPED. ISL declares the field (`staging`,
       *      `src/models/response_v2.py:569-575`): *"Proportion of MC samples
       *      where alternative wins WHEN EDGE IS WEAK."* It is conditional on
       *      the link being in its bottom quartile — not on the factor
       *      "shifting", which is any movement in either direction.
       *  2 · TENSE. "chance … if … shifts" is a forecast about something that
       *      might happen. The number counts runs that ALREADY happened.
       *
       * ⛔ AND THE SENTENCE WAS AN ACCURATE DESCRIPTION OF THE ADJACENT FIELD.
       * `response_v2.py:576-580` declares `marginal_switch_probability` —
       * *"Probability of decision flip when ONLY this edge varies"* — which is
       * precisely "how much this one assumption moved the answer". The UI reads
       * it nowhere. Two neighbouring producer fields, and this card had them
       * swapped. #1798 found the identical swap in the uncertainty column's
       * caption; this is the same defect on the card the panel leads with.
       *
       * ⚠ THE REPLACEMENT IS IMPORTED, NOT WRITTEN. `strongerOptionInWeakRuns`
       * is the elicitation card's own sentence, which has carried the condition
       * correctly since it was written. A second spelling here is how one
       * measurement acquires two readings, which is the defect being closed.
       */
      signal: strongerOptionInWeakRuns(top.switchProbability, alt ?? null, 'that assumption'),
      whyNow: 'This single relationship carries the most decision risk right now.',
      tryThis: 'Plan one check that would confirm or correct this assumption before you rely on the ranking.',
      sourceLine: 'Source: robustness analysis (fragile relationships).',
      action: {
        kind: 'ai-dialogue',
        label: 'Plan an evidence check',
        actionType: 'discuss',
        parameters: { edge_id: top.edgeId, switch_probability: top.switchProbability },
        prompt: `Help me plan an evidence check for the relationship involving ${top.factorLabel}.`,
      },
      targetId: top.edgeId,
      priority: PRIORITY.flip,
    })
  }

  // ── Clarify: the next input this run turns on ────────────────────────────
  //
  // ⭐⭐ THE PRODUCT ALREADY COMPUTES THIS AND NEVER SAYS IT. On a
  // `quantified_provisional` run CEE publishes the exact set of parameters the
  // comparison is waiting on, and the surface already publishes an ordinal over
  // the factors. Joining them names ONE next input instead of rendering the set
  // as an untruncatable roll-call. Both post-result captures on served
  // `fd992149` are in exactly this state.
  //
  // ⛔ IT PROMISES NOTHING ABOUT THE NEXT RUN, AND A CAPTURE IS WHY. `52383f4b`
  // carries `confidence_parameters_user_stated: 1` — the user had already set
  // Monthly Churn Rate — and the refusal persisted on
  // `USER_STATED_PARAMETERS_NOT_MATERIAL`. Three further gates sit behind this
  // one. So every sentence below states what IS true now; none says "and then I
  // will name the leader".
  //
  // ⚠ NO GATE ON `leaderClaimPermitted`. This row exists precisely BECAUSE the
  // claim is withheld, and it designates no option — the subject is an input of
  // the reader's own model, not a comparative standing.
  if (inputs.analysisComplete) {
    const next = selectNextInputToSet(
      inputs.factors,
      inputs.materialParametersAwaitingUserIds,
      inputs.analysisIdentityIsCurrent === true,
      inputs.driverLeader,
    )
    // The ordinal's words are the copy owner's, never re-spelled here; it
    // refuses any rank it cannot publish, so a null readout is a null row.
    const readout = next ? influenceRankReadout(1, next.setSize) : null
    /**
     * ⛔⛔ CAN A RANGE BE SET FOR THIS FACTOR AT ALL — a DIFFERENT QUESTION from
     * `next.declaresNoRange`, which asks only whether it records one today.
     *
     * The branch below used to turn on `declaresNoRange` alone and told the
     * reader to settle a range. `factorRangeCapability.ts` exists because that
     * act is available for roughly ONE FACTOR IN SEVEN: a range editor lives on
     * exactly one surface, the canvas inspector's `FactorExternalPanel`, and
     * only for `category === 'external'`. So on the other six this card named an
     * act that does not exist on any surface — the defect
     * `noScaleRemedyIsTheUnitPath` ruled on ("the remedy this panel names must
     * be one the assistant can actually perform") and the one the LEHI card
     * below was already fixed for.
     *
     * ⚠ IT WENT ELEVEN DAYS BECAUSE THE GUARD WAS HAND-SCOPED.
     * `theRangeActExistsOrIsNotNamed.spec.ts` selects its card with
     * `id.startsWith('strengthen:lehi:')`, so the ruling was enforced exactly
     * where a guard could observe it and nowhere else — the shape this file's
     * own em-dash docblock records, forty lines down.
     *
     * ⛔ FAIL-CLOSED, per `StrengthenFactor.rangeIsSettable`'s own rule: absent
     * means UNKNOWN and is read as NO. A wrongly-named act spends the trust the
     * finding just earned; an unnamed one costs only wording.
     */
    const nextRangeIsSettable =
      next !== null &&
      inputs.factors.find((f) => f.factorId === next.factorId)?.rangeIsSettable === true
    if (next && readout) {
      recs.push({
        id: `strengthen:next-input:${next.factorId}`,
        helpType: 'clarify',
        title: `Give ${next.label} a value of your own`,
        signal: `${readout.phrase}, and the estimate behind it is Olumi's.`,
        whyNow:
          /**
           * ⛔⛔ THIS NO LONGER RESTATES THE REFUSAL, AND A LIVE CAPTURE IS WHY.
           *
           * It previously read *"Until at least one of the values this
           * comparison turns on is yours, no option can be put forward."*
           * Measured on the deployed build (manual test 21 Sep, bundle
           * `olumi-debug-95b92672`): `AtAGlance` renders CEE's admission
           * VERBATIM on the same tab, a few centimetres above this card —
           * *"Every estimate this comparison rests on is Olumi's, not yours
           * … no option can be called the leader … until you have set at least
           * one of them."* Both sections are rendered by
           * `AnalysisNewTabBody`, and `strengthenWhyLine` concatenates
           * `signal` + `whyNow` into the card BODY, so this was on screen even
           * with the row collapsed. The panel was answering, in its own voice,
           * a question the producer had just answered directly above it.
           *
           * ⭐ WHAT REPLACES IT IS THE ONE FACT NOTHING ELSE ON THE SCREEN
           * CARRIES, and it is the fact that stops this card becoming a false
           * promise. Capture `52383f4b` has
           * `confidence_parameters_user_stated: 1` — the user HAD set a value —
           * and the refusal persisted on `USER_STATED_PARAMETERS_NOT_MATERIAL`.
           * Necessary, not proven sufficient. Saying so is not a hedge; it is
           * the difference between this row and an instruction that fails.
           *
           * ⚠ "as the leader" CAME OUT — `noWinnerVocabulary.spec.ts` REDDED IT
           * and was right. The 8 Sep no-contest ruling retires placings from
           * UI-AUTHORED copy, and "the leader" is one.
           *
           * ⭐ CEE's own admission message says "no option can be called the
           * leader" and is NOT caught, because producer prose renders verbatim
           * and is exempt by design. That asymmetry is correct and is exactly
           * why the guard sweeps this file: a sentence this surface AUTHORS is
           * held to the ruling even where the producer's neighbouring sentence
           * is not.
           *
           * "put one forward" is the phrasing the estate already permits —
           * `checks.leader_not_assessed.orderingCaveat`'s sibling uses it and
           * passes the same sweep — so this states the same fact in the
           * vocabulary that survived the ruling.
           */
          'Setting it is necessary for a comparison you own, and may not be all this run needs.',
        /**
         * ⚠ NO EM DASH, AND THE GUARD CANNOT SEE THIS FILE. The ruling is
         * "no em dashes in product content"; `noEmDashesInRenderedCopy.spec.ts`
         * enforces it over a HAND-LIST of four files
         * (`analysisNewCopy`, `buildAnalysisNewViewModel`, `humaniseCritique`,
         * `goalAnchorCopy`) and `strengthen/buildRecommendations.ts` is not one
         * of them, although it renders straight onto the same tab. An em dash
         * here would have shipped unseen. Honouring a ruling only where a guard
         * can observe it is how the ruling stops meaning anything — the same
         * hand-list shape `noWinnerVocabulary.spec.ts` records about itself.
         *
         * ⚠ THE ROUTE MUTATES NOTHING, AND THAT IS WHY THIS ROW IS SAFE TO SHOW.
         * `canvas-focus` takes the reader to the factor; it types no number and
         * writes nothing. The one genuinely dangerous act — committing a bare
         * amount on a factor that records no prior range, which leaves the model
         * unanalysable with no route back (`ModelRowView.tsx`, 10 Sep witness) —
         * is owned and stated by the Model tab at the point of commit. This row
         * must not reproduce that judgement; it only carries the fact forward
         * when it has one, so the reader is not surprised by it later.
         */
        /**
         * ⭐ THE FINDING SURVIVES EVERY BRANCH; ONLY THE ACT MOVES. Dropping the
         * card, or dropping the fact, would hide something true — this is still
         * the input the run turns on most and the estimate behind it is still
         * Olumi's. The third arm therefore keeps the reason a lone figure is
         * weak here and names only the act the reader can actually perform.
         *
         * ⚠ IT DOES NOT EXPLAIN THE LIMITATION. "Olumi cannot record a range for
         * this kind of factor" is product internals; the ruling asks for a
         * remedy that works, not a confession about one that does not.
         */
        tryThis: !next.declaresNoRange
          ? 'Use the figure you would defend in the room, not a cautious one.'
          : nextRangeIsSettable
            ? 'This one records no range yet, so a single figure has nothing to be measured against. Worth settling the range at the same time.'
            : 'A single figure here has nothing to be measured against, so use the one you would defend in the room, not a cautious one.',
        sourceLine:
          "Source: the inputs Olumi reports this comparison is waiting on, in this run's own influence order.",
        action: { kind: 'canvas-focus', label: 'Show me this factor' },
        targetId: next.factorId,
        priority: PRIORITY.nextInput,
      })
    }
  }

  // ── Clarify: low-evidence, high-influence factor (path-conditional) ──────
  if (inputs.analysisComplete) {
    const lehi = inputs.factors
      .filter(
        (f) =>
          // ⛔ Display-policy gate (driverConfidenceDisplayPolicy.ts). "High
          // influence, low evidence." is a confidence-DERIVED assertion, and
          // the ruled policy is that factor confidence has no display-safe
          // source today — "no raw %, no bar, no dash, no confidence-derived
          // prose". This recommendation was the prose. `show: false` carries
          // no value to compare, so the ceiling below can only be reached by a
          // number the policy has cleared.
          f.confidenceDisplay.show &&
          f.confidenceDisplay.value < LEHI_CONFIDENCE_CEILING &&
          (f.influence ?? 0) > LEHI_INFLUENCE_FLOOR,
      )
      .sort((a, b) => (b.influence ?? 0) - (a.influence ?? 0))[0]
    if (lehi) {
      /**
       * ⛔⛔ THIS CARD TOLD ROUGHLY SIX FACTORS IN SEVEN TO DO SOMETHING THE
       * PRODUCT CANNOT DO.
       *
       * As shipped: titled *"Give {factor} a realistic range"*, button **"Set a
       * range"**, action `canvas-focus`. That route resolves to `focusNodeById`
       * — it selects the node, dims its neighbours and moves the camera. It
       * opens no editor and switches no tab.
       *
       * A range editor exists on exactly ONE surface, the canvas inspector's
       * `FactorExternalPanel`, and only for a factor whose category is
       * `'external'`. Measured across two real captures: **1 of 7** categorised
       * factors. For the rest the button led to a node where the act does not
       * exist anywhere.
       *
       * ⭐ THE RULING THIS APPLIES ALREADY EXISTED, on the surface where it was
       * discovered and nowhere else — `noScaleRemedyIsTheUnitPath`: *"The
       * remedy this panel names must be one the assistant can actually
       * perform."* It was written after a journey witness asked Olumi, in
       * natural language, twice, to do what a disclosure told them to do, and
       * was declined both times.
       *
       * ── WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT ──────────────────────
       * The FINDING is kept on both branches. "High influence, low evidence" is
       * worth telling someone whatever they can do about it, and dropping the
       * card would hide something true. Only the ACT moves.
       *
       *  · settable → the range coaching stands, and the button now says what
       *    pressing it DOES. The control is on the node's own panel, one step
       *    beyond the camera, so "Set a range" was over-promising even here.
       *  · not settable → no range is named at all. The act becomes one the
       *    assistant genuinely performs: saying what evidence would move the
       *    figure. `ai-dialogue` is the route that can carry any act.
       *
       * ⚠ IT DOES NOT EXPLAIN THE LIMITATION. "Olumi cannot record a range for
       * this kind of factor" is product internals, and the ruling asks for a
       * remedy that works, not a confession about one that does not.
       */
      const rangeSettable = lehi.rangeIsSettable === true
      recs.push({
        id: `strengthen:lehi:${lehi.factorId}`,
        helpType: 'clarify',
        title: rangeSettable
          ? `Give ${lehi.label} a realistic range`
          : `Weigh the evidence behind ${lehi.label}`,
        signal: 'High influence, low evidence.',
        whyNow: 'A single figure hides uncertainty in an important input.',
        tryThis: rangeSettable
          ? 'Use a plausible low and high based on what you have seen before.'
          : 'Say what would move this figure, and by how much.',
        sourceLine: 'Source: sensitivity and evidence-quality signals.',
        action: rangeSettable
          ? { kind: 'canvas-focus', label: 'Show me this factor' }
          : {
              kind: 'ai-dialogue',
              label: 'Weigh this estimate',
              prompt: `What evidence would move the estimate for ${lehi.label}, and by how much?`,
            },
        targetId: lehi.factorId,
        priority: PRIORITY.lehi,
      })
    }
  }

  // ── Evaluate: highest value of information ────────────────────────────────
  if (inputs.analysisComplete) {
    // Selection is the PRODUCER's explicit flag and nothing else. That flag is
    // a strict read of wire `worth_investigating === true` (see
    // useResultsSectionData's factor extractor, which deliberately refuses the
    // canvas adapter's `?? evpi > 0.05` default). No UI numeric gate, and no
    // re-rank: the producer's own order stands.
    const top = inputs.factors.filter((f) => f.worthInvestigating === true)[0]
    if (top) {
      recs.push({
        id: `strengthen:voi:${top.factorId}`,
        helpType: 'evaluate',
        // 1.243 RELABEL, not gate, and UNCONDITIONAL. The trigger is the
        // producer's own per-factor `worth_investigating` flag — leader-
        // independent, so gating would delete a real producer finding to
        // remove a two-word phrase. Only "the ranking" presupposed a
        // comparative standing the producer may have withheld; "this
        // analysis" is true on every run. Relabelled on BOTH runs rather than
        // forked per verdict, following #494's "Leads NN%" precedent: a
        // carve-out list of "leader words that are fine here" is the
        // hand-maintained mirror trap 12 warns about.
        title: `Investigate ${top.label} before relying on this analysis`,
        // ⛔ The percentage-point variant of this sentence is REMOVED:
        // "Knowing this better could shift the result by about {N} percentage
        // points." It is the same claim as the factor chip and the confidence
        // line, in the Strengthen panel, from the same refuted field.
        signal: 'The engine flagged this as worth investigating before you rely on this analysis.',
        whyNow: 'Of everything uncertain, this is the most valuable thing to learn next.',
        tryThis: 'Spend a short, time-boxed effort narrowing this down before deciding.',
        sourceLine: 'Source: value of information analysis (flagged by the engine).',
        action: {
          kind: 'ai-dialogue',
          label: 'Plan the investigation',
          actionType: 'discuss',
          parameters: { factor_id: top.factorId },
          prompt: `Help me plan a quick investigation into ${top.label}.`,
        },
        targetId: top.canFocus ? top.factorId : null,
        priority: PRIORITY.voi,
      })
    }
  }

  // ── Challenge: pressure-test a fragile-looking leader ─────────────────────
  // 1.243 GATE — the row this change exists for. Every one of its six
  // user- or assistant-facing fields designates a leader (title, signal,
  // whyNow, tryThis, action.label, action.prompt) and its `parameters` carry
  // `topic: 'challenge_leader'` onto the wire. There is nothing left to show
  // once the claim is withheld, so the whole rec is gated: the chip does not
  // render and the prompt is never CONSTRUCTED. The robustness grade itself
  // is not suppressed — it is a run-level grade, and the confidence surfaces
  // own it (#494 kept "Analysis complete (robust)" for the same reason).
  const level = inputs.robustness.level?.toLowerCase() ?? null
  if (!leaderClaimWithheld && inputs.analysisComplete && (level === 'low' || level === 'very_low')) {
    // ⭐ THE SUBJECT IS THE NAMED OPTION WHENEVER ONE RESOLVES. See
    // `permittedLeadingOptionName` above for why a rank description is not an
    // acceptable subject even on a run entitled to designate.
    //
    // ⚠ AND THE UNNAMED ARM ADDRESSES THE RESULT, NEVER THE RANKING. Permission
    // without an identity is a degenerate path (production resolves a label
    // wherever it resolves a leader), and the two truthful answers there are
    // "say nothing" or "talk about the run". Silence would delete a real
    // producer finding — the run's own robustness grade — to remove a claim the
    // sentence need never have made, so the copy drops to the RUN, which is
    // what `signal`, `whyNow` and the button already talk about. What it must
    // NOT do is fall back to "the option that scored highest": that is the
    // defect, not the fallback.
    const subject = permittedLeadingOptionName ?? 'this result'
    recs.push({
      id: 'strengthen:robustness',
      helpType: 'challenge',
      title: `Pressure-test ${subject}`,
      signal: 'This result does not hold up strongly under stress-testing.',
      whyNow: 'A fragile result can shift with small changes, so it deserves a challenge before you act on it.',
      tryThis: `Build the strongest case against ${subject} and see what survives.`,
      sourceLine: 'Source: robustness analysis.',
      action: {
        kind: 'ai-dialogue',
        label: 'Challenge this result',
        actionType: 'challenge_assumption',
        parameters: { topic: 'challenge_leader' },
        prompt: `Build the strongest case against ${subject}.`,
      },
      targetId: null,
      priority: PRIORITY.robustness,
    })
  }

  // ── Broaden (producer-gated: §19 — never local option counting) ──────────
  const NARROW_TYPES = ['narrow_framing', 'framing', 'framing_bias']
  if (inputs.biasFindingTypes.some((t) => NARROW_TYPES.includes(t))) {
    recs.push({
      id: 'strengthen:broaden',
      helpType: 'broaden',
      title: 'Find a route that works differently',
      signal: 'Your options look structurally similar.',
      whyNow: 'Comparing near-identical routes can settle on one without testing the real alternatives.',
      tryThis: 'Generate one materially different option before relying on this comparison.',
      sourceLine: 'Source: framing review.',
      action: {
        kind: 'ai-dialogue',
        label: 'Generate a different option',
        actionType: 'add_option',
        parameters: { reason: 'narrow_framing' },
        prompt: 'Suggest one materially different option that works through a different mechanism.',
      },
      targetId: null,
      priority: PRIORITY.broaden,
    })
  }

  // ── Commit: readiness supports a provisional decision ────────────────────
  if (
    inputs.analysisComplete &&
    inputs.robustness.status === 'computed' &&
    level === 'high' &&
    // ⛔ "held up under stress-testing … result stable" is a strength claim;
    // not stated where the admission licenses none (#1206).
    inputs.stabilityLicensed !== false
  ) {
    recs.push({
      id: 'strengthen:commit',
      helpType: 'commit',
      title: 'Record the decision and what would trigger a rethink',
      signal: 'On the data so far, these numbers held up under stress-testing.',
      whyNow: 'Capturing the decision and its revisit triggers now preserves the reasoning while it is fresh.',
      tryThis: 'Note the chosen option, the key assumptions, and the one change that would reopen this.',
      sourceLine: 'Source: robustness analysis (result stable).',
      action: {
        // Round-2 wiring: opens the Record-the-decision modal (honest
        // local-only capture) instead of the prototype's generic-dialogue
        // wiring bug. Olumi route stays on the ✦ affordance.
        kind: 'open-modal',
        modal: 'decision-record',
        label: 'Create a decision record',
        prompt: 'Help me record this decision, its key assumptions, and what would trigger a rethink.',
      },
      targetId: null,
      priority: PRIORITY.commit,
    })
  }

  // ── Adaptive priority (producer signal only — see StrengthenInputs) ──────
  // Matching-helpType recs float above every other band; relative order
  // within the matching group is preserved. Fail-closed: null/absent leaves
  // the deterministic ladder untouched.
  const boosted = inputs.adaptivePriority
    ? recs.map((rec) =>
        rec.helpType === inputs.adaptivePriority
          ? { ...rec, priority: rec.priority - ADAPTIVE_MATCH_BOOST }
          : rec,
      )
    : recs

  // ── UI-SEM-075(b): never two rows with an identical visible identity ─────
  // Keyed on title + signal — exactly what the collapsed two-line row shows.
  // Keep the highest-priority (lowest number) instance of each. (Phase-3
  // signals carry the producer body, so distinct findings under one generic
  // headline survive; true duplicates still collapse.)
  const byIdentity = new Map<string, Recommendation>()
  for (const rec of boosted) {
    const key = dedupeKey(rec.title, rec.signal)
    const existing = byIdentity.get(key)
    if (!existing || rec.priority < existing.priority) byIdentity.set(key, rec)
  }
  /**
   * ⭐⭐ ORDERED BY THE FIELD THIS FUNCTION SPENDS ITS WHOLE LENGTH COMPUTING.
   *
   * ⛔ WITHOUT THIS THE ADAPTIVE BOOST WAS INERT, AND MEASURED SO:
   *
   *     adaptivePriority: 'evaluate'
   *     RETURNED ["strengthen:success-measure@0", "strengthen:flip:e1@-9900"]
   *
   * `ADAPTIVE_MATCH_BOOST` had subtracted 10,000 from the matching rec —
   * overwhelmingly the highest priority in the set — and it still came back at
   * index 1. `priority` was consumed ONLY by the dedupe above (keep the lowest
   * number of a duplicate identity); the array itself came back in builder push
   * order. The comment on the boost says matching recs "float above every other
   * band". They floated nowhere.
   *
   * ⚠ IT WORKED ON ONE SURFACE AND NOT THE OTHER, WHICH IS WHY NOBODY SAW IT.
   * The Analysis tab reads through `strengthenStore`, which sorts on the way in
   * (`strengthenStore.ts:397`). The Reasoning tab renders the return value
   * directly — `useAnalysisNewViewModel.ts:134`, `buildRecommendations(inputs)
   * .filter(...)`, no sort — and `AnalysisNewTabBody`'s `glancePrimary` takes
   * `interventions[0]` as THE ONE ACT the panel promotes. So the producer's
   * stage signal steered the tab Paul's scope ruling excludes, and was inert on
   * the tab he uses.
   *
   * ⚠⚠ AND THE GUARD COULD NOT SEE IT. `buildRecommendations.spec.ts:459`
   * asserts the boost by calling `.sort((a, b) => a.priority - b.priority)` ON
   * THE RESULT first. That proves the NUMBER changed and is structurally blind
   * to whether the ORDER did — the test supplied the very step the consumer was
   * missing. Same shape as the drivers caveat fixed earlier today: the guard
   * anchored on the quantity that moves, not the one the user sees
   * (CLAUDE.md trap 13d).
   *
   * ⚠ STABLE, AND THAT IS LOAD-BEARING. `Array.prototype.sort` is stable, so
   * equal priorities keep builder order — which is what `adaptive priority
   * preserves relative order WITHIN the matching group` asserts, and what the
   * producer-ranked phase-3 band (sorted into `priority` at :417) depends on.
   */
  return boosted
    .filter((rec) => byIdentity.get(dedupeKey(rec.title, rec.signal)) === rec)
    .sort((a, b) => a.priority - b.priority)
}

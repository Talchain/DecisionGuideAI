/**
 * ⭐ ONE FACTOR'S RANKS, FROM THE SHARED DRIVER FEED — extracted VERBATIM from
 * `useNodeDisplayMetadata` (23 Sep 2026) so the card's own metadata AND the
 * board-wide "Worth reviewing" plan (`nodeAttention.ts`) read ONE rank rule.
 * A second copy of this arithmetic is how the marker and the card would come to
 * disagree about which factor is Driver 1 (CLAUDE.md trap 12). The rationale
 * that travelled with the code is kept below, unedited, beside the lines it
 * explains.
 */
import {
  compareByDisplayModel,
  determinedRankDepth,
  MAX_BADGED_RANK,
} from '../../../components/results/driverDisplayModel'
import type { selectDriverPolicyFeed } from '../../../components/results/useResultsSectionData'

type DriverFeed = ReturnType<typeof selectDriverPolicyFeed>

export interface FactorRanks {
  /**
   * Distinct factors in the run's driver feed — the ELIGIBLE ANALYSED factors.
   * Both the LICENCE set `influenceRankReadout` checks (a rank inside a
   * comparison of at least two) AND, again since ED #63 5806207128, the printed
   * `M` of "Driver N of M analysed" ("Denominator = eligible analysed factors,
   * not 'number of ranks we happen to render'").
   */
  influenceSetSize: number
  /**
   * The number of factors this rule gives a rank (inside `determinedDepth`).
   * Set-level, the same for every factor in the feed. Since ED 5806207128 it
   * is NOT printed: it is the fail-closed PUBLICATION guard `driverRankFor` and
   * the attention plan read (a rank beyond it states nothing). Contract v3.1
   * pt 5 had made it the printed `M`; that reading is retired.
   */
  rankedSetSize: number
  /** 1..MAX_BADGED_RANK where the ordering is determined; otherwise null. */
  sensitivityRank: number | null
  /** 1..3 by value of information; otherwise null. */
  voiRank: number | null
}

/**
 * The card's ORDER — moved verbatim out of `rankFactor` (26 Sep 2026) so the
 * Analysis hero's "Main driver" can read the SAME ordered list rather than a
 * second one. See the rationale block inside `rankFactor` for why the key is
 * |elasticity| and not `influence_score`.
 */
function orderBySensitivity(rows: DriverFeed['policyRows']) {
  return rows
    .map((r) => ({
      key: r.key,
      elasticity: r.rawElasticity,
      // The badge asks "what is the result most sensitive to". Elasticity is
      // that question's answer; `displayModel.value` answers "how big is this
      // factor structurally", which is why it used to disagree with the words.
      value: Number.isFinite(r.rawElasticity) ? Math.abs(r.rawElasticity) : 0,
    }))
    .sort(compareByDisplayModel)
}

export function rankFactor(
  rows: DriverFeed['policyRows'],
  displayModel: DriverFeed['displayModel'],
  nodeId: string,
): FactorRanks {
  let influenceSetSize: number
  let sensitivityRank: number | null = null
  let voiRank: number | null = null
  /**
   * ⛔⛔ THE BADGE RANKED BY THE WRONG QUANTITY, AND IT SAID SO ON SCREEN.
   *
   * This sorted on `displayModel.value`, which under complete producer
   * coverage IS `influence_score` — PLoT's STRUCTURAL weight, computed from
   * authored edge strengths BEFORE the simulation. The badge's own
   * accessible name is `sensitivityRankBadgeAccessibleName`:
   * *"Key driver #N: one of the factors the result is most sensitive to"*.
   * Structural weight is not sensitivity, and on a real board they diverge.
   *
   * ── MEASURED ON PAUL'S OWN RUN, not inferred ─────────────────────────
   * `olumi-debug-1dd2133d-20260916.json`, staging `6497a251`. PLoT sent BOTH
   * ranks in `factor_sensitivity`, and they disagree:
   *
   *   factor                       importance_rank  influence_rank  elasticity
   *   Team Leadership Coverage            1               2            0.8
   *   Delivery Capacity                   2               4            0.4
   *   Hiring Speed in Current Market      3               5            0.4
   *   Tech Lead Presence                  4               1            0
   *   Hiring and Onboarding Cost          5               3            0
   *   Additional Developer Headcount      6               6            0
   *
   * The board badged #1/#2/#3 as Tech Lead Presence / Team Leadership
   * Coverage / Hiring and Onboarding Cost — EXACTLY `influence_rank` order.
   * **So the product badged "the result is most sensitive to this" onto a
   * factor whose own `elasticity` and `sensitivity_score` are both 0.**
   * `importance_rank`'s top three ARE the elasticity ordering, so the
   * badge's WORDS were right all along and the FIELD was wrong.
   *
   * ── WHY ELASTICITY AND NOT `importance_rank` ─────────────────────────
   * `importance_rank` is the producer's own answer and would be the ideal
   * key — `adapters/plot/v2/responseMapper.ts:1040` already says *"Sort by
   * importance_rank if available"* — but it is DROPPED before the shared
   * policy feed, which carries `key` and `rawElasticity` only. Threading a
   * new field through that feed is a larger change than this defect
   * warrants, and it is not needed: on this payload elasticity reproduces
   * `importance_rank`'s ordering exactly. Rowed rather than smuggled in.
   *
   * ⚠ THE TIE GATE IS UNCHANGED AND DOES REAL WORK HERE. Ranking by
   * elasticity leaves Delivery Capacity and Hiring Speed tied at 0.4, so
   * `determinedRankDepth` cuts the badged depth to 1 and Paul's board shows
   * ONE badge — on the factor the result is genuinely sensitive to —
   * instead of three led by a factor that moves nothing. Fewer badges is
   * the correct outcome, not a regression.
   *
   * ⛔ SCOPE: this changes the BADGE's ordering only. `displayModel.value`
   * still feeds the influence NUMBER, which is a different question and
   * correctly a different answer. A card may now show the highest influence
   * and carry no badge; that is the two metrics being honestly distinct
   * rather than one silently standing in for the other.
   */
  const ranked = orderBySensitivity(rows)

  // The denominator for the ranked caption, taken off THIS array so it can
  // never be derived from a different set than the rank beside it. Distinct
  // keys, mirroring the duplicate-id collapse `determinedRankDepth` applies
  // — one factor, one position, one unit of the total.
  //
  // ⭐⭐ UNCONDITIONAL INSIDE THIS BRANCH, AND THAT IS A CONTRACT, NOT A
  // CONVENIENCE. It is what makes `sensitivityRank != null` imply
  // `influenceSetSize != null`, which is the whole argument for leaving the
  // field optional on `NodeDisplayMetadata` — see its docblock. A staleness
  // gate sat here for one commit and broke that implication silently: the
  // docblock claimed the state was unreachable while the spec four tests
  // later produced it. The licence to PUBLISH the denominator is a different
  // question with a different producer and it is asked at the render site
  // (`FactorNode.tsx`, `useAnalysisResultsAreCurrent`). Two questions, two
  // places, neither answering for the other (CLAUDE.md trap 21).
  influenceSetSize = new Set(ranked.map((f) => f.key)).size

  // Find this node's rank (1-indexed).
  //
  // ⚠⚠ A RANK IS A COMPARATIVE CLAIM AND A TIE CANNOT SUPPORT ONE
  // (2026-08-30). `compareByDisplayModel` falls through value → elasticity
  // → `key.localeCompare`, so on a degenerate draft this RESOLVED the tie
  // instead of reporting it: five byte-identical factors fed in shuffled
  // order came back `#1 fac_a … #5 fac_e` — ALPHABETICAL — with one
  // distinct value and one distinct elasticity between them (measured in
  // this tree; a spread-value contrast control in the same run came back in
  // value order, so the probe was discriminating). The rank then renders as
  // `#N` at `NodeInspector.tsx`, as a "Key driver #N" canvas badge at
  // `BaseNode.tsx`, and as "Connects factor ranked #N in influence" at
  // `EdgeInspector.tsx`, so the leader node could honestly say "tied" while
  // the inspector beside it crowned one of the tied factors "#1".
  //
  // The gate ASKS THE EXISTING OWNER — `hasClearInfluenceLeader`, the same
  // function the Drivers panel's badge and the leader node's "#1 driver"
  // claim consume — rather than minting a rival tie notion here. One
  // question, one function.
  //
  // ⚠ IT IS SET-LEVEL, DELIBERATELY. Withholding only the tied factors'
  // ranks would print a "#3" with no "#1" or "#2" beside it, which is a
  // second kind of nonsense; when the top is undetermined the ordinal
  // reading of the whole set is what fails. Under the NO-HIDING ruling this
  // withholds a claim the data cannot support rather than hiding a finding.
  //
  // ⚠⚠ ON THE ORDINARY SET THE READER KEEPS THE NUMBER; ON THE
  // MAGNITUDE-LESS SET THEY KEEP NOTHING (2026-09-04, review round 2). This
  // comment used to end "the reader keeps the number and loses only the
  // false ordering", and the manufactured-zero fix a few lines below
  // falsifies it: when no factor in the set carries a real magnitude, the
  // all-zero sentinel makes `determinedRankDepth` return 0 AND the
  // influence figure is withheld as unmeasured. Measured and pinned in
  // `useNodeDisplayMetadata.rankGateBreadth.spec.ts` ("THE DEFECT
  // (set-level)"): rank, value and provenance are ALL null while
  // `inSensitivityAnalysis` is true — no rank, no number, no explanation.
  // The silence is still the honest answer (every figure available there is
  // invented), but it is a real cost to the reader and the deferred copy
  // (CANVAS-BACKLOG S47) is what owes them the reason.
  //
  // ⚠⚠ THE GATE ASKED A NARROWER QUESTION THAN THE BADGE PROMISED, AND THE
  // GAP SHIPPED (2026-09-03). This read `hasClearInfluenceLeader(...) &&
  // rank <= 3` — a gate about RANK 1 licensing THREE ordinals. On a real
  // user's model (`{1.00, 0.67 x6, 0.00}`, six factors tied) the leader
  // gate passes, so `#2` and `#3` went to two of the six tied factors,
  // chosen by `compareByDisplayModel`'s fall-through to `key.localeCompare`
  // — ALPHABETICAL NODE ID — under a tooltip that reads "ranked by
  // influence on the outcome". The numeral is not the defect and is not
  // removed: it is correct and valuable wherever the ordering is genuinely
  // determined. Claiming it where it is not, and attributing it to a
  // measurement, is. `determinedRankDepth` asks the badge's OWN question
  // ("are ranks 1..3 each clear?") at the same owner, so on that set only
  // `#1` is badged and every `#N` the canvas prints is true.
  const rank = ranked.findIndex(f => f.key === nodeId) + 1
  // MAX_BADGED_RANK is the badge's promise, so it is what the gate is
  // measured against — the depth and the cap can no longer drift apart.
  /**
   * ⛔⛔ THE TIE GATE MUST ASK ABOUT THE NUMBER THE READER SEES, NOT ONLY THE
   * ONE THE ORDER IS KEYED ON — and this PR broke that before fixing it.
   *
   * Re-keying `ranked.value` from the displayed influence onto `|elasticity|`
   * (correct for the ORDER — the badge says "most sensitive to") silently moved
   * the TIE TEST onto elasticity too, because `determinedRankDepth` reads
   * `value`. `driverPolicyFeed.parity.spec.tsx` caught it on a fixture with
   * IDENTICAL `influence_score: 0.5` and elasticities `0.3` / `-0.9`: not tied
   * on the sort key, so the canvas badged `#1` and `#2` beside two visible
   * `0.5`s. That is exactly the defect #964 exists to remove, reintroduced —
   * and that spec states the principle: "an ordinal is a COMPARATIVE claim and
   * a tie cannot support one."
   *
   * ⚠ ORDERING AND BADGING ARE DIFFERENT QUESTIONS (CLAUDE.md trap 21), so
   * they get different inputs. An ordinal needs BOTH to discriminate: the basis
   * it claims (elasticity) AND the figure printed beside it (the displayed
   * influence). Tied on either, and the reader cannot check the claim — so the
   * depth is the MINIMUM of the two, never the sort key's alone.
   *
   * ⭐ It still ASKS THE EXISTING OWNER twice rather than minting a rival tie
   * notion, which is the rule the paragraph above already set.
   */
  const depthByBasis = determinedRankDepth(
    ranked.map((f) => ({ id: f.key, value: f.value })),
    MAX_BADGED_RANK,
  )
  const depthByDisplayed = determinedRankDepth(
    ranked.map((f) => ({ id: f.key, value: displayModel.get(f.key)?.value ?? 0 })),
    MAX_BADGED_RANK,
  )
  const determinedDepth = Math.min(depthByBasis, depthByDisplayed)
  sensitivityRank = rank > 0 && rank <= determinedDepth ? rank : null
  // The ranked count — the distinct keys whose position is inside the SAME
  // depth that licenses each one (a duplicate row is one factor, as in
  // `influenceSetSize`). A publication guard, not the printed M (ED 5806207128).
  const rankedSetSize = new Set(ranked.slice(0, determinedDepth).map((f) => f.key)).size

  // VoI rank: top-3 factors by value_of_information. Keyed off the shared
  // feed's canonical key (node_id → factor_id → id → label), so a row
  // carrying several differing id fields can no longer rank under one id
  // here and another in the panel.
  const rankedByVoi = rows
    .map((r) => ({ id: r.key, voi: r.valueOfInformation ?? 0 }))
    .filter(f => typeof f.voi === 'number' && f.voi > 0)
    .sort((a, b) => b.voi - a.voi)
  const voiPos = rankedByVoi.findIndex(f => f.id === nodeId) + 1
  if (voiPos > 0 && voiPos <= 3) voiRank = voiPos
  return { influenceSetSize, rankedSetSize, sensitivityRank, voiRank }
}

/**
 * ⭐⭐ THE RUN'S MAIN DRIVER, FROM THE CARD'S OWN RANKED LIST.
 *
 * ⛔ WITNESSED ON SERVED 853feeb7 (design audit §2 #7, pricing starter, one
 * Run): the card on Top Account Revenue Concentration read "Driver 1 of 5
 * analysed" while the Analysis hero read "Main driver: Enterprise Revenue
 * Cannibalization Risk" — a factor whose own card read "Not ranked in this
 * run". The hero took `drivers.topDrivers[0]`, which the Drivers panel orders
 * by the displayed `influence_score` (PLoT's STRUCTURAL weight). On that
 * payload the crowned factor is an option-set lever with `elasticity: 0` and
 * `sensitivity_score: 0`, while PLoT's own `importance_rank`,
 * `decision_brief.top_drivers[0]` and DOMINANT_FACTOR warning all name Top
 * Account Revenue Concentration — the card's #1.
 *
 * So the hero asks THIS module, over the same feed rows, the same order and
 * the same rank-1 gate as the card and the leader node (`DecisionNode`).
 *
 *   · `leadIsClear: true`  — the card prints "Driver 1 of M" on `key`.
 *   · `leadIsClear: false` — the top of the card's order is not separable, so
 *     the card prints no rank; the hero hedges ("Tied for main driver").
 *   · `null` — no row carries a magnitude on the card's basis, so the card
 *     ranks nothing and there is no main driver to name.
 */
export interface SensitivityLeader {
  key: string
  leadIsClear: boolean
}

export function sensitivityLeader(
  rows: DriverFeed['policyRows'],
  displayModel: DriverFeed['displayModel'],
): SensitivityLeader | null {
  const first = orderBySensitivity(rows)[0]
  if (!first || first.value === 0) return null
  return {
    key: first.key,
    leadIsClear: rankFactor(rows, displayModel, first.key).sensitivityRank === 1,
  }
}

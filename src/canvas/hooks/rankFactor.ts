import {
  compareByDisplayModel,
  determinedRankDepth,
  MAX_BADGED_RANK,
} from '../../components/results/driverDisplayModel'
import type { selectDriverPolicyFeed } from '../../components/results/useResultsSectionData'

/**
 * One factor's published rank, VoI rank and the ranked set's size, from the
 * SAME driver policy feed the panel uses. Extracted verbatim (with its
 * rationale) from `useNodeDisplayMetadata` so the canvas attention plan reads
 * the identical ranks the cards show — one derivation, never a mirror.
 */
export function rankFactor(
  rows: ReturnType<typeof selectDriverPolicyFeed>['policyRows'],
  displayModel: ReturnType<typeof selectDriverPolicyFeed>['displayModel'],
  nodeId: string,
): { influenceSetSize: number; sensitivityRank: number | null; voiRank: number | null } {
  const ranked = rows
    .map((r) => ({
      key: r.key,
      elasticity: r.rawElasticity,
      // The badge asks "what is the result most sensitive to". Elasticity is
      // that question's answer; `displayModel.value` answers "how big is this
      // factor structurally", which is why it used to disagree with the words.
      value: Number.isFinite(r.rawElasticity) ? Math.abs(r.rawElasticity) : 0,
    }))
    .sort(compareByDisplayModel)

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
  const influenceSetSize = new Set(ranked.map((f) => f.key)).size

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
  const sensitivityRank = rank > 0 && rank <= determinedDepth ? rank : null

  // VoI rank: top-3 factors by value_of_information. Keyed off the shared
  // feed's canonical key (node_id → factor_id → id → label), so a row
  // carrying several differing id fields can no longer rank under one id
  // here and another in the panel.
  const rankedByVoi = rows
    .map((r) => ({ id: r.key, voi: r.valueOfInformation ?? 0 }))
    .filter(f => typeof f.voi === 'number' && f.voi > 0)
    .sort((a, b) => b.voi - a.voi)
  const voiPos = rankedByVoi.findIndex(f => f.id === nodeId) + 1
  const voiRank = voiPos > 0 && voiPos <= 3 ? voiPos : null
  return { influenceSetSize, sensitivityRank, voiRank }
}

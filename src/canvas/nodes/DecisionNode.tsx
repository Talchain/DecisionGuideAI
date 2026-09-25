/**
 * Decision ("Question") node component.
 *
 * ⭐ PROTOTYPE ROW (Paul, 25 Sep 2026 — the canvas matches the prototype):
 *   Title (the question, the data label verbatim) → ONE line:
 *   "N alternatives", then " · Evidence priority: <factor>" ONLY when the
 *   current run ranks a canvas factor first (unnamed / no options: the resting
 *   line and its one CTA). The reasoning sentences (top gap, withheld-leader
 *   disclosure, run-wide share absence) are OFF the row, whole, in the popover
 *   or the Detailed body — see `focusDetail`.
 *
 * ⭐ LOCKED CANVAS DESIGN (23 Sep 2026; ED 11:52Z point 1): WIDE AND SHALLOW.
 *   Title (the question) → ONE line: the option count and at most ONE
 *   reasoning-focus signal (superseded 25 Sep: the signal was a clamped
 *   sentence and was served cut mid-sentence) → the rail (the ONE coaching icon — "Explore more options"
 *   before a run, the typed "Challenge this result" after it — and the run
 *   action).
 * Detailed: adds the robustness line and the chip rows, same width.
 * Popovers: unchanged (readiness breakdown before a run, robustness after).
 *
 * History (superseded, kept for the record of why each line existed): the
 * face used to carry the triage line, two coaching chips, the readiness
 * summary and a "Run analysis" chip as separate rows; `bodyHasContent` chose a
 * resting fallback when none rendered. See `DECISION_RESTING_COPY` and
 * `composeReadinessSummary`, which remain the owners of those strings.
 */
import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { useModelReadiness } from '../hooks/useModelReadiness'
import type { ModelReadiness } from '../hooks/useModelReadiness'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useSupportShareRunWideAbsent } from '../hooks/useSupportShareRunWideAbsent'
import { selectWithheldLeaderDisclosure } from './withheldLeaderDisclosure'
import { STRUCTURAL_UNSET } from './shared/metricVocabulary'
import { typography } from '../../styles/typography'
import { NodePopover } from './shared'
import type { ResolvedCoaching } from './coaching/resolveNodeCoaching'
import { CoachingChipRow } from './coaching/CoachingChipRow'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { isGoalDefined } from '../../utils/isGoalDefined'
import { cleanFactorLabel } from '../utils/labelUtils'
import { aggregateEdgeSignedStrength, compareEdgeValueAggregates } from '../domain/edgeValueProvenance'
import { requestAsk, canReceiveAsk } from '../ui/inspector-v2/askSemantic'
import { decisionLabelIsUnwritten } from '../domain/vocabulary'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { driverRankFor, useInfluenceRank } from '../hooks/useInfluenceRank'
import { rankFactor } from './shared/rankFactor'
import { selectDriverPolicyFeed } from '../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../components/results/types'

/**
 * EVERY static string the resting state can render or send.
 *
 * ⭐ THIS RECORD IS WHY THE HONESTY GUARD IS COMPLETE. The first cut of this
 * feature spelled its copy inline and pinned it against ONE rendered fixture,
 * so the guard bit on exactly one of three lines: an independent review
 * mutated the other two into `'This decision is not named yet'`,
 * `'…for this question'`, `'…the options are too close to call'` and
 * `'…so no option is leading'` — a fabricated analysis verdict and two stale
 * node-type words — and the suite stayed 8/8 GREEN on all four.
 *
 * Copy that never leaves this record can be enumerated, so the guard runs over
 * the WHOLE set instead of whatever one fixture happens to mount. The rendered
 * corpus in the spec is kept ALONGSIDE it, not instead of it: enumeration
 * proves every declared string is honest, and only a rendered corpus notices a
 * string that never got declared (CLAUDE.md trap 12d — ship both).
 */
export const DECISION_RESTING_COPY = {
  unnamedLine: 'Not named yet',
  unnamedCta: 'Name it',
  unnamedAsk: 'Suggest a clear name for this part of the model',
  unnamedAskLabel: 'Name this',
  /**
   * ⚠ A REFERENCE, NOT A COPY, AND THAT IS LOAD-BEARING — the same rule this
   * record's own header states. `STRUCTURAL_UNSET.noOptions` is the canvas's
   * one word for "not modelled", and the `StatusPill` in this card's corner
   * reads the SAME constant (`BaseNode.tsx`). Re-typing the literal here would
   * let the corner and the body drift back into disagreeing about one fact.
   * The VALUE is unchanged, so every rendered assertion on this line still
   * matches byte for byte.
   */
  noOptionsLine: STRUCTURAL_UNSET.noOptions,
  noOptionsCta: 'Add options',
  noOptionsAsk: 'Suggest options to compare here',
  noOptionsAskLabel: 'Add options',
  completedRunLine: "Hover for this node's detail",
  emptyLine: 'Nothing to show on this node',
} as const

/**
 * ⛔ THE BRIEF ECHO IS GONE, AND WHAT REPLACES IT IS DERIVED (Paul, 7 Sep
 * 2026): *"The current question node lacks value. There's not enough
 * information or functionality within it. It also doesn't need to say what you
 * gave me. The user should be able to see that."*
 *
 * The echo was added on 5 Sep because he reported his brief was not surfaced,
 * and it answered the letter of that report — a "What you gave me" heading over
 * his own words truncated at 160 characters. Echoing the input back is the
 * least valuable form of surfacing it, and the results panel's
 * `WhatIWasGivenSection` still holds it: `contextIntegrityStore` keeps a live
 * product consumer after this removal, so the draft-turn write it depends on is
 * not orphaned. That was checked, not assumed.
 *
 * ⭐ WHAT GOES IN ITS PLACE IS ALREADY COMPUTED AND WAS ONLY EVER REACHABLE
 * BEHIND A PRE-ANALYSIS HOVER. `useModelReadiness` runs unconditionally on every
 * render of this node, and its four counts render in exactly one place: a
 * popover gated `!isPostAnalysis && optionCount > 0`. So after a run the node
 * held the whole readiness breakdown and showed none of it — the estate's
 * build-more-than-we-plug-in defect at the size of one line. The answer here is
 * WIRING, not writing: no new derivation, no new number.
 */

/**
 * The readiness words, spelled ONCE.
 *
 * ⚠ THE CARD LINE AND THE POPOVER READ THE SAME RECORD, and that is the point.
 * The popover spelled `Estimated:` / `Missing:` / `External:` as inline
 * literals; a card line with its own copies would be two names for one thing in
 * one component — the hand-maintained mirror this estate keeps paying for
 * (CLAUDE.md trap 12), and precisely the hazard the copy block this replaces
 * flagged about its own heading. `popoverLabel` derives the popover's
 * capitalised form so the rendered bytes are unchanged; the spec pins those
 * exact strings, so "unchanged" is measured rather than asserted.
 */
export const DECISION_READINESS_COPY = {
  factorSingular: 'factor',
  factorPlural: 'factors',
  explicit: 'explicit',
  inferred: 'estimated',
  missing: 'missing',
  external: 'external',
} as const

/**
 * \u2b50\u2b50 HOW MANY ALTERNATIVES ARE IN PLAY \u2014 SPELLED ONCE, FOR BOTH SURFACES.
 *
 * ## The defect this closes
 *
 * `optionCount` is derived correctly (de-duplicated by target, see its `useMemo`
 * below) and reached exactly one piece of RENDERED TEXT: `lodMetric`, the single
 * reduced line a card shows BELOW the legibility floor. So the anchor card of
 * every model stated its option count only when zoomed out \u2014 the moment the
 * reader can read least \u2014 and said nothing about it at normal reading zoom,
 * where the whole point of the card is to frame the comparison. Its only other
 * uses are a chip MESSAGE (never rendered) and a popover gated
 * `!isPostAnalysis && optionCount > 0` (behind a hover, pre-analysis only).
 *
 * ## Why one function rather than two strings
 *
 * The card face and the reduced line state THE SAME FACT. Two spellings of one
 * fact inside one component is the hand-maintained mirror this file argues
 * against three times already (CLAUDE.md trap 12) \u2014 they would agree on the day
 * they were written and nothing would go red when they stopped. The singular
 * rule and the zero rule therefore live here, once, and both surfaces consume
 * this.
 *
 * \u2b50 AND IDENTICAL IS THE RIGHT BEHAVIOUR, NOT A COMPROMISE. `zoomLegibility`'s
 * own ruling is that zooming out must not make a card anonymous \u2014 "small text
 * you can squint at is strictly better than a box that says nothing". A count
 * that survives the zoom ladder VERBATIM is that promise kept: the card loses
 * everything else and keeps the one fact, rather than changing its mind about
 * how to say it.
 *
 * ## \u26d4 "OPTIONS", NOT "COMPARABLE" \u2014 and this is a deliberate refusal
 *
 * An option that EXISTS is not an option the run can COMPARE. CEE stamps
 * `waived_by_exclusion` per option and this repo reads it through
 * `selectOptionExclusionMessage` (`stores/readinessStore.ts:1398`), whose own
 * header rules that *"'Not connected', 'no values set' and 'excluded from this
 * calculation' are THREE different facts"* and that deriving admission on the
 * canvas would put a second authority on screen disagreeing with CEE (trap 21).
 * That verdict also lives in a DIFFERENT store, is per-option, and is withheld
 * while `stale`.
 *
 * `optionCount` cannot see any of it. It counts distinct option nodes this
 * decision has an outgoing edge to \u2014 a STRUCTURAL fact the canvas owns and can
 * defend. Upgrading a count into a claim about comparability that the data does
 * not carry is exactly the fabrication this card's tombstones record removing
 * twice already.
 *
 * ## "ALTERNATIVES" IS THE PROTOTYPE'S NOUN FOR THE SAME COUNT (Paul, 25 Sep 2026)
 *
 * The word was "options" until Paul ruled, from live screenshots, that the
 * canvas matches the PROTOTYPE: `olumi-canvas-visual-contract.html:192` reads
 * "3 alternatives \u00b7 Evidence priority: conversion", and its layer label is
 * ALTERNATIVES. The noun changes; the claim does not \u2014 still a count of linked
 * option nodes, still not "comparable". `OPTION_BASELINE_REFERENCE` in
 * `metricVocabulary` already says "the other alternatives". No ED ruling in
 * DESIGN-AUTHORITY.md fixes "options" (5809278282 leaves the Question card
 * unchanged). The coaching MESSAGES ("My model has N options so far") are sent
 * text, not card copy, and keep their wording.
 *
 * ## Zero is not `0 alternatives`
 *
 * Returns `null` at zero, so every caller falls through to
 * `DECISION_RESTING_COPY.noOptionsLine` \u2014 "No options linked yet", which carries
 * a working CTA. A decision with no options is a STRUCTURAL absence with an
 * authoring act behind it, not a metric reading zero; stating "0 alternatives" would
 * delete that affordance and present an absence as a finding. This keeps the two
 * apart rather than re-merging them.
 */
export function composeOptionCountLine(optionCount: number): string | null {
  if (!Number.isFinite(optionCount) || optionCount <= 0) return null
  return `${optionCount} alternative${optionCount === 1 ? '' : 's'}`
}

/**
 * The prototype's label for the second segment of the Question row
 * (`olumi-canvas-visual-contract.html:192`: "3 alternatives · Evidence
 * priority: conversion"). What follows the colon is ALWAYS a factor label the
 * canvas carries — see `selectEvidencePriorityFactorId`.
 */
export const EVIDENCE_PRIORITY_LABEL = 'Evidence priority'

/**
 * The id of the factor ON THIS CANVAS that the run ranks first by sensitivity,
 * or `null`.
 *
 * It ranks with `rankFactor` over `selectDriverPolicyFeed` — the exact reader
 * behind the factor card's "Driver 1 of N" — so a tie at the top, or a leader
 * the canvas does not hold, yields `null` rather than a guess. This only FINDS
 * the candidate; the card still licenses it through the factor card's own
 * currency and measured-influence gates before naming it.
 */
export function selectEvidencePriorityFactorId(
  report: unknown,
  nodes: ReadonlyArray<{ id: string; type?: string; data?: { type?: unknown } | null }>,
): string | null {
  if (!report || typeof report !== 'object') return null
  const feed = selectDriverPolicyFeed(report as ResultsReport)
  if (feed.policyRows.length === 0) return null
  for (const node of nodes) {
    if (node.type !== 'factor' && node.data?.type !== 'factor') continue
    if (rankFactor(feed.policyRows, feed.displayModel, node.id).sensitivityRank === 1) return node.id
  }
  return null
}

/** Same separator the inspector's guidance line already renders. */
export const READINESS_SEPARATOR = ' \u00b7 '

/** The popover's capitalised form, derived from the one record above. */
export function popoverLabel(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/*
 * ⛔ `truncateAtWord` IS GONE, BECAUSE NOTHING ON THIS CARD IS CUT ANY MORE
 * (Paul, 25 Sep 2026: the live Question card read "3 options · A success
 * target on your model can't be…" — truncated mid-sentence). Its only callers
 * were the two triage lines' 40-character SHORT forms, painted in the one-line
 * clamp on the card face. The prototype's row carries no such sentence, so the
 * sentences moved OFF the resting card, whole, into the popover (Standard) or
 * the Detailed body; with no clamp there is no short form to compute. The
 * record of the rule it carried, and of its twins (`OptionNode.tsx`,
 * `labelUtils.ts truncateLabelAtWord`, `analysisNew/nameOrClaim.ts`), is in
 * this file's history and in `__tests__/DecisionNode.triageTruncation.spec.tsx`,
 * which still pins the `labelUtils` twin.
 */

// ---- Model readiness helpers ----

// ⭐ `ModelReadiness` and `useModelReadiness` MOVED to
// `../hooks/useModelReadiness`, and re-exported here because this file is their
// historic home and other modules import the type from it. The move is not a
// tidy-up: the GOAL card offers the same "Run analysis" action on a DIFFERENT
// predicate, so the two cards disagreed about whether the model was ready. One
// authority, two consumers — see the hook's own header for the measurement.
export type { ModelReadiness } from '../hooks/useModelReadiness'

/**
 * ⭐ THE READINESS FACTS AS ONE CARD LINE — "4 factors \u00b7 2 estimated \u00b7 1 missing".
 *
 * ⛔ IT IS A STRUCTURAL COUNT AND CARRIES NO ANALYSIS PERMISSION. Every input is
 * a property of the GRAPH — how many factors exist and how each one's value got
 * there — so nothing here is derived from `report`, from `headline`, or from
 * `deriveDecisionVerdict`. It says nothing about which option leads and it must
 * never be changed into something that can: the leader-claim seam is where this
 * product has shipped a withheld verdict and a named leader two pixels apart
 * before (CLAUDE.md trap 21). That is also why it needs no gate on
 * `licensesComparativeLeaderClaim` — a fact that makes no comparative claim
 * needs no licence to make one.
 *
 * ⚠ THE TOTAL IS THE SUM OF THE PARTS, NEVER `factorNodes.length`. Those two
 * numbers differ: `useModelReadiness` skips a factor with no `data` at all, so a
 * total taken from the node list could exceed its own breakdown and the line
 * would fail to add up in front of the user. Summing the four buckets makes that
 * impossible by construction rather than by care.
 *
 * ⚠ `explicit` IS DELIBERATELY NOT SPELLED. It is the remainder — total minus
 * the three qualifiers — so printing it makes the line longer and says nothing
 * the reader could not subtract. What earns space is what is NOT nailed down.
 * The word stays in the record because the popover still renders it.
 *
 * Returns `null` when the model has no factors at all: a card with nothing to
 * count keeps its wayfinding line rather than being handed "0 factors", which
 * is furniture with a number in it.
 */
export function composeReadinessSummary(readiness: ModelReadiness): string | null {
  const total =
    readiness.explicitCount + readiness.inferredCount + readiness.missingCount + readiness.externalCount
  if (total === 0) return null

  const parts = [
    `${total} ${total === 1 ? DECISION_READINESS_COPY.factorSingular : DECISION_READINESS_COPY.factorPlural}`,
  ]
  if (readiness.inferredCount > 0) parts.push(`${readiness.inferredCount} ${DECISION_READINESS_COPY.inferred}`)
  if (readiness.missingCount > 0) parts.push(`${readiness.missingCount} ${DECISION_READINESS_COPY.missing}`)
  if (readiness.externalCount > 0) parts.push(`${readiness.externalCount} ${DECISION_READINESS_COPY.external}`)
  return parts.join(READINESS_SEPARATOR)
}


export const DecisionNode = memo(({ id, data, selected }: NodeProps<DecisionNodeData>) => {
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)
  const viewMode = useCanvasStore(state => state.viewMode)
  const goalThreshold = useCanvasStore(state => state.goalThreshold)
  const goalConstraints = useCanvasStore(state => state.goalConstraints)

  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'
  const supportShareRunWideAbsent = useSupportShareRunWideAbsent()

  /**
   * ⭐ WHY NO OPTION WAS PUT FORWARD — the producer's own reason, on the canvas.
   *
   * Measured on founder export `44e349fa`: the run computed 0.72 / 0.16 / 0.09 /
   * 0.02 over four options and named no leader, because
   * `CONSTRAINT_TARGET_UNRELIABLE` withheld goal-fit. The reason, and the fix,
   * were already humanised and already in `report.inference_warnings` — and
   * reached only the Analysis tab, which the founder's scope ruling says to
   * ignore. This is the existing sentence reaching the surface he uses.
   *
   * ⚠ NODE LABELS ARE NOT PASSED. `CONSTRAINT_TARGET_UNRELIABLE` arrives with
   * no `field` and no `affected_nodes` (measured), so a label map would change
   * nothing today, and building one per node render to achieve nothing is cost
   * with no claim behind it. When the producer starts carrying the identity,
   * pass `nodeLabels` here — the selector already takes it.
   */
  const withheldLeader = useMemo(
    () => (isPostAnalysis ? selectWithheldLeaderDisclosure(report as never) : null),
    [isPostAnalysis, report],
  )

  const readiness = useModelReadiness()
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()
  // Audit §8 P1: result-derived decorations mirror the panels' freshness
  // verdict (opacity + title only — no layout shift, chips stay interactive).

  /**
   * ⭐ DISTINCT OPTIONS, NOT OUTGOING EDGES — and this PR is what makes the
   * difference observable.
   *
   * This counted EDGES whose target is an option, so a decision with one option
   * linked TWICE counted two. That was harmless for as long as nothing read the
   * magnitude: the three other readers are `> 0` (:397, :711) and `=== 0`
   * (:543), and the distinct set is empty exactly when the filtered edge list
   * is, so de-duplicating cannot change any of their verdicts. The new
   * "My model has N options so far" message at :345 is the FIRST reader of the
   * number itself — the PR that stops the copy being generic is the PR that
   * makes this reachable, so it belongs here rather than in a follow-up.
   *
   * ⚠ AND IT IS REACHABLE, not theoretical. `store.addEdge` refuses duplicates
   * (`store.ts:2739`, via `isDuplicateEdge`) — but the CEE patch path does not
   * go through it: `applyPatch.ts:350` appends supplied edges wholesale with no
   * duplicate check, and its `_rewireTarget` handling can point two surviving
   * edges at one option without appending anything at all. The product already
   * knows this happens: `useModelHealth.ts:180` ships a "Duplicate edge" warning
   * for exactly this state.
   *
   * So the honest count is of the options themselves. A duplicate edge is a
   * modelling defect the health check reports; it is not a second option, and
   * the user should not be told it is one in their own words.
   */
  const optionCount = useMemo(() => {
    const optionTargets = edges
      .filter(e => e.source === id)
      .filter(e => {
        const targetNode = nodes.find(n => n.id === e.target)
        return targetNode?.type === 'option' || targetNode?.data?.type === 'option'
      })
      .map(e => e.target)
    return new Set(optionTargets).size
  }, [edges, nodes, id])

  // All factor values present?
  const allFactorsPresent = readiness.missingCount === 0
  const goalDefined = isGoalDefined(goalThreshold, goalConstraints)
  const showRunAnalysis = allFactorsPresent && goalDefined

  // ---- Triage line: single most important next action (pre-analysis only) ----
  const triage = useMemo<{ full: string } | null>(() => {
    if (isPostAnalysis) return null

    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')

    // 1. Missing values — find first missing factor
    for (const node of factorNodes) {
      const d = node.data as Record<string, unknown> | undefined
      if (!d) continue
      if (d.category === 'external') continue
      const os = d.observedState as Record<string, unknown> | undefined
      const prior = d.prior as { range_min?: number; range_max?: number } | undefined
      const value = os?.value as number | undefined
      if (value == null && !(prior?.range_min != null && prior?.range_max != null)) {
        const rawLabel = (d.label as string | undefined) ?? ''
        const cleaned = cleanFactorLabel(rawLabel) || rawLabel
        return { full: `Top gap: estimate ${cleaned}` }
      }
    }

    // 2. Inferred factors with high leverage — top 2 by edge weight sum across all factors
    //
    // ⛔ Provenance gate — THE HIGHEST-CONSEQUENCE ONE IN THIS FAMILY. The line
    // this produces ("Top gap: validate X") is the product TELLING THE USER
    // WHICH FACTOR TO GO AND FIX. Every contribution to the ranking sum used to
    // be `w ?? 0.5`, and `USER_EDGE_DEFAULTS`/`DEFAULT_EDGE_DATA` always define
    // `weight`, so on a graph where nobody had set a single strength every
    // factor scored `0.5 × (its out-degree)` — i.e. the recommendation was
    // decided by out-degree and node iteration order, and presented as
    // leverage. `aggregateEdgeSignedStrength` counts ONLY sourced strengths, so
    // a factor with no evidence of leverage yields `show: false` and is left
    // out of the ranking rather than handed a fabricated score; if NO factor
    // has any sourced strength the whole step has nothing to rank on and falls
    // through to the next triage rule instead of inventing a winner.
    const scoredFactors = factorNodes
      .filter(n => (n.data as Record<string, unknown> | undefined)?.category !== 'external')
      .map(n => ({
        node: n,
        leverage: aggregateEdgeSignedStrength(
          edges.filter(e => e.source === n.id).map(e => e.data as Record<string, unknown> | undefined),
          { magnitude: true },
        ),
      }))
      .sort((a, b) => compareEdgeValueAggregates(a.leverage, b.leverage))
    const topTwoIds = new Set(
      scoredFactors.filter(s => s.leverage.show).slice(0, 2).map(s => s.node.id),
    )
    const topInferred = scoredFactors.find(s => {
      if (!topTwoIds.has(s.node.id)) return false
      const os = (s.node.data as Record<string, unknown> | undefined)?.observedState as Record<string, unknown> | undefined
      return os?.extractionType === 'inferred'
    })
    if (topInferred) {
      const rawLabel = (topInferred.node.data?.label as string | undefined) ?? ''
      const cleaned = cleanFactorLabel(rawLabel) || rawLabel
      return { full: `Top gap: validate ${cleaned}` }
    }

    // 3. Goal has no threshold
    if (!goalDefined) return { full: 'Top gap: set a success target' }

    // 4. Fewer than 3 options
    if (optionNodes.length < 3) return { full: 'Top gap: explore more options' }

    // 5. Model is reasonably complete — no triage line
    return null
  }, [isPostAnalysis, nodes, edges, goalDefined])

  /**
   * ⛔ `biggestRisk` LIVED HERE. DELETED, NOT REPAIRED.
   *
   * It chose the risk with the greatest raw `edge.data.weight` on a risk → goal
   * edge and the headline rendered it as ", but sensitive to X". Neither half was
   * sourced: no sensitivity feed covers risks (`report.factor_sensitivity` is
   * factors-only — three shipped fixtures, zero risk rows), and the selector
   * bypassed the provenance gate this file already applies eighty lines above,
   * so an unstated default weight could win it. With every risk edge on a
   * default they are equal, so the comparison never fired after the first
   * iteration and THE FIRST RISK IN NODE ORDER was named.
   *
   * ⚠ MY FIRST ATTEMPT REBUILT IT — provenance-gated, tie-failing, honestly
   * worded. Review refused that and was right: the clause hung off a verdict
   * that is itself a duplicate, and a more accurate version of a sentence that
   * should not be there is not progress.
   */

  // Coaching chip clusters — live in popovers (Standard) or inline in
  // Detailed view. The body never renders coaching chips. Exception:
  // pre-analysis body still shows the "Run analysis" CTA when the model is
  // ready, because that's a primary action button rather than coaching.
  /**
   * ⭐ "A THIRD OPTION" WAS HARDCODED, AND THIS PR IS WHAT MAKES IT REACHABLE.
   *
   * The sent message read "Suggest a third option I haven't considered for this
   * decision" on every model. With one option it asked for a third that would
   * be the second; with seven it asked for a third that already existed five
   * times over. The string asserts the model holds exactly two options — and it
   * is sent as the USER'S OWN message, so the user is made to state a false
   * fact about their own board.
   *
   * The defect predates this PR. Promoting it does not: it lived behind a hover
   * in a non-default view, and this change puts it on the anchor node of every
   * Standard-view model. That is the question a PR opening a dark surface has
   * to answer — now that people can reach it, is what they reach true?
   *
   * ⚠ AND THE SUITE COULD NOT SEE IT. `DecisionNode.invitations.spec.tsx`
   * asserts the chips "assert nothing about the model" by scanning RENDERED
   * LABEL TEXT. The falsehood is in `message`, which never renders. The guard
   * and the defect were on different strings — so the assertion below is on
   * `message` specifically.
   *
   * Counting only, never assessing: how many options exist is observable.
   * "Your options are too similar" would be a claim about the user's reasoning
   * and belongs to the producer.
   */
  // ⚠ The sentence itself now lives in the resolver, which composes it from
  // `optionCount`. Counting only, never assessing — the pluralisation and the
  // wording are unchanged.
  const preAnalysisCoachingChips = useMemo(() => (
    <CoachingChipRow
      className="flex items-center gap-1 flex-wrap mt-1.5"
      chips={resolveNodeCoaching({
        kind: 'decision',
        surface: 'preAnalysis',
        state: { showRunAnalysis },
        context: { optionCount },
      })}
    />
  ), [showRunAnalysis, optionCount])

  const postAnalysisCoachingChips = useMemo(() => (
    <>
      {/* ⭐⭐ THE QUESTION IS COMPARATIVE, BECAUSE THE ACTION IS.
      `what_would_flip` asks what would change the ORDER of the options. The
      sentence it sent asked what would make a different option "most likely
      to hit my goal" — which fuses a comparative ranking with target
      attainment, and those are two different questions with two different
      answers. A model can rank first and still be unlikely to reach the
      goal; the goal probability can move without any option changing place.

      ⚠ THIS IS THE CONFLATION PAUL HAS RULED ON REPEATEDLY, arriving through
      a chat message rather than a badge — which is why repairing the visible
      bar did not reach it. The typed route is unchanged and was never wrong;
      only the natural-language question was, and it is the half that reaches
      the model and comes back as an answer to a question nobody asked.

      ⚠ NO GOAL PREMISE AT ALL, deliberately. Asking "which assumptions could
      change the comparison" needs no goal probability to be meaningful, so it
      cannot smuggle the attainment claim back in through its own framing. */}
      <CoachingChipRow
        className="flex gap-1 flex-wrap mt-1.5"
        chips={resolveNodeCoaching({
          kind: 'decision',
          surface: 'postAnalysis',
          state: { showRunAnalysis },
          context: { optionCount },
        })}
      />
    </>
  ), [showRunAnalysis, optionCount])

  // Stability for post-analysis Detailed body and Standard popover.
  // Returns the underlying fraction (0-1) so the popover progress bar can use
  // it directly without re-parsing the formatted string.
  /**
   * ⛔⛔ THIS CARD USED TO DRAW THE LEADING OPTION'S WIN PROBABILITY AND CALL IT
   * ROBUSTNESS. It read `robustness.recommendation_stability`, rendered it as
   * `Stability: 62% (moderate)` and drew a progress bar at that width.
   *
   * `recommendation_stability` is not a robustness measurement. PLoT WITHHOLDS
   * it deliberately, and `compare-tab/TrajectorySection.tsx:28-45` states why
   * at the bytes: *"ISL derives it as `option_wins[winner] / n_samples` — the
   * leading option's `win_probability` relabelled, carrying zero independent
   * information."* That tab DELETED its `Stability %` column for this reason.
   * This card kept it, one screen away, with an authored four-tier scale
   * (0.85/0.70/0.40) that exists nowhere in the producer.
   *
   * So the card asserted a second, independent-looking confirmation of exactly
   * the claim the option cards already make — the reader saw two numbers and
   * had no way to know they were one number twice.
   *
   * ⭐ `display_verdict` is the ONLY field licensed to make a robustness claim
   * on screen (`hooks/useAnalysisMetadata.ts:14-22`, the single-source rule).
   * This is the same repair `useAnalysisMetadata` already made for the TopBar
   * chip, which had consumed the raw `is_robust` and produced *"one screen
   * state carried a green `Stable` chip above an analysis panel saying
   * 'fragile' four times"*. Same defect class, one card later.
   *
   * FAIL-CLOSED, exactly as every other consumer does it: only the four
   * display-safe tokens count, and `not_assessed` / absent / unrecognised
   * yields null — which renders NOTHING. Silence, never a cheerful default.
   *
   * ⚠ AND NO PERCENTAGE. There is no licensed robustness percentage, so none
   * is shown; inventing one is what got us here. The producer's own
   * `display_verdict_reason` is rendered VERBATIM where present, the same way
   * `components/utils/postAnalysisFooter.ts:86` already treats it.
   */
  const robustnessVerdict = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    const raw = robustness?.display_verdict
    const verdict = raw === 'robust' || raw === 'moderate' || raw === 'fragile' ? raw : null
    if (!verdict) return null
    const rawReason = robustness?.display_verdict_reason
    const reason = typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim() : null
    return { verdict, reason }
  }, [isPostAnalysis, report])


  // ---- What the two body branches will actually put on screen ----
  //
  // ⭐ NAMED ONCE AND USED TWICE — by the JSX below AND by `bodyHasContent`.
  // The resting state has to fire EXACTLY when nothing else renders, and a
  // second copy of these conditions written out beside the first is the
  // hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12):
  // it would read green while drifting, and the drift's symptom — a resting
  // state on top of real content, or no resting state on an empty node — is
  // invisible to any test that does not happen to mount that exact cell.
  const isPostAnalysisBranch = isPostAnalysis && Boolean(report)
  const isPreAnalysisBranch = !isPostAnalysisBranch && optionCount > 0
  // Named here and consumed BOTH by the popover's own render condition below
  // AND by the resting copy, which points at that popover — a second copy of
  // this expression is how the copy would start pointing at a panel that is
  // not there.
  const hasPostAnalysisPopover = isPostAnalysis && !isDetailed
  const showStabilityLine = isDetailed && Boolean(robustnessVerdict)
  /**
   * ⭐⭐ PAUL'S RULING, 9 Sep 2026: "Do the DecisionNode chips, keep the resting
   * state copy too." BOTH, on one surface. What stood here recorded the
   * deadlock and parked it:
   *
   *   "POST-ANALYSIS CHIPS STAY DETAILED-ONLY… the post-analysis Standard body
   *    is the exact surface another lane's HONEST RESTING STATE occupies… four
   *    of their tests go red. Left alone pending a decision that covers both."
   *
   * ⭐ THE DEADLOCK WAS ONE PREDICATE DOING TWO JOBS — trap 21, and naming the
   * two questions apart dissolves it rather than picking a winner:
   *
   *   · the CHIPS are INVITATIONS — "you may challenge this"
   *   · the RESTING COPY reports the ABSENCE OF A FINDING — "this node holds
   *     no verdict of its own"
   *
   * Both were routed through `bodyHasContent`, so an invitation counted as a
   * finding and suppressed a statement about what the node does not hold. They
   * are not alternatives and never were. `bodyHasContent`'s post arm is now
   * `showStabilityLine` — the presence of an actual FINDING — so the chips can
   * render without silencing the copy.
   *
   * The other lane's contract survives intact, which is the test:
   *   · Standard completed run → resting copy renders (their `:508` arm, whose
   *     whole point is that a verdict no longer holds it shut)
   *   · Detailed WITH stability → resting copy stays shut (their `:555` TWIN,
   *     which exists to stop "renders on a completed run" degrading into
   *     "always renders"). `showStabilityLine` is `isDetailed && stability`, so
   *     that arm is unmoved.
   *
   * MEASURED, which is why this was worth Paul's ruling: on deployed
   * `9748b336`, Standard, post-analysis, resting state, `Challenge this result`
   * and `Compare options` both read **0** — they were in a hover popover, and
   * `NodePopover.tsx:129` is `if (!visible) return null`. Contrast controls in
   * the same probe: 71 `react-flow__node`, 26 `Influence`.
   */
  // ⚠ THE BODY AND THE POPOVER MUST BE MUTUALLY EXCLUSIVE, and my first cut was
  // not: with `true` here, a run with no stability rendered the chips in BOTH —
  // the popover carries them as its no-stability fallback (see the popover
  // below for why removing them outright makes `completedRunLine` or
  // `emptyLine` false). My own coexistence test caught it with "Found multiple
  // elements with the text: Challenge this result", which is the test doing its
  // job on the author.
  //
  // So: the body shows the chips whenever the popover is NOT carrying them —
  // i.e. in Detailed (no popover at all), and in Standard whenever stability
  // gives the popover its own content. The two predicates are complements of
  // one expression, so they cannot drift into overlapping or into a gap.

  /**
   * ⭐ THE INVITATIONS BELONG ON THE CARD, NOT BEHIND A HOVER.
   *
   * "Explore more options" and "What could go wrong?" are the canvas's two most
   * reasoning-shaped affordances on its most important node, and until this
   * they rendered in exactly two places: the Detailed (expert) view, and a
   * HOVER POPOVER. Measured on the deployed build — `viewMode: 'standard'`, and
   * none of the four coaching chips anywhere on screen, with a contrast control
   * proving the probe could read the page.
   *
   * So for an ordinary user on the default view they did not exist, and on a
   * touch device they could not exist: `hover` is not an input that device has.
   *
   * ⚠ THIS DOES CHANGE A STATED RULE. The comment on the body chip below reads
   * "Coaching chips live in the popover" — a deliberate anti-clutter decision,
   * and a reasonable one when it was made. It is worth revisiting only because
   * of WHERE these sit: this is ONE node, the anchor of the whole model, not a
   * treatment applied to every card. Two chips on the single node the user is
   * being asked to think hardest about is not furniture; the same two chips on
   * thirteen cards would be.
   *
   * ⚠ MOVED OUT OF THE POPOVER, NOT DUPLICATED INTO THE BODY — and this
   * paragraph said the opposite until a review caught it.
   *
   * I first wrote duplication, citing the R5 ruling's permission ("full
   * functionality ... may be DUPLICATED there") on the grounds that a pointer
   * user who hovers should not find less than they had. Rendering both put the
   * SAME chip on one node twice, which `render-matrix.spec.tsx` caught as
   * "found multiple elements". So the code moves them, the popover sixty lines
   * below says "⛔ THE CHIPS ARE NOT HERE ANY MORE", and this comment went on
   * describing the rejected alternative as shipped fact — with a ruling cited
   * as authority for it. A false label is a first-class defect here (trap 14);
   * the next reader would have believed the paragraph over the code.
   */
  // ⚠ NO `optionCount > 0` CONJUNCT, and that is measured rather than assumed.
  // I wrote one, and a mutant proved it a NO-OP: deleting it left the suite
  // fully green, because `isPreAnalysisBranch` already requires linked options.
  // A guard that cannot fail is not defence in depth, it is a second answer to
  // a question already answered — and the next reader would have had to work
  // out which one was load-bearing.

  // ⭐ POST ARM IS THE PRESENCE OF A FINDING, NOT OF ANY CHILD. See
  // `showPostAnalysisChips` above: chips are invitations and must not be
  // counted as content that silences the resting copy.
  /**
   * ⭐ ONE FACT ABOUT THE RUN, STATED ONCE, ON THE NODE THAT FRAMES THE
   * COMPARISON. When NO option resolved a support percentage, the option cards
   * yield that position (`OptionNode`, `supportShareRunWideAbsent`) instead of
   * repeating one absence per card. Something has to say it, or the cards'
   * silence reads as a rendering gap — the argument the `n_valid === 0` block
   * in `OptionNode` already makes for its own copy.
   *
   * ⚠ THIS IS A READINESS-CLASS FACT ABOUT THE RUN, NOT A COMPARATIVE CLAIM,
   * and that is why it may sit here at all. The tombstones above record that
   * the leader sentence, its bar and its caveat were all removed from this node
   * because it was answering the question it exists to ask, in the option
   * cards' own words. This states what the run PRODUCED. It names no option,
   * ranks nothing, and cannot become a designation: it renders only when there
   * is no share anywhere to designate from.
   *
   * Standard AND Detailed, unlike `showStabilityLine`. A reader who cannot see
   * why the comparison is missing is not helped by the explanation being
   * expert-only.
   */
  const showSupportShareAbsent = isPostAnalysisBranch && supportShareRunWideAbsent

  /**
   * ⭐ "Evidence priority: <factor>" — the prototype's second segment, read
   * from the RUN, never composed by the canvas. It names the factor the current
   * run ranks FIRST by sensitivity: the same rank, from the same reader and the
   * same licence, that the factor card states as "Driver 1 of N"
   * (`useNodeDisplayMetadata` → `useInfluenceRank` → `driverRankFor`, plus the
   * card's own measured-influence condition). So the two cards cannot disagree
   * about which factor leads.
   *
   * Omitted — never substituted — when: there is no completed run; the run is
   * not current; the top is a tie; the ranked factor is not on this canvas (the
   * report's own label is not used); or the factor has no label.
   */
  const evidencePriorityFactorId = useMemo(
    () => (isPostAnalysisBranch ? selectEvidencePriorityFactorId(report, nodes) : null),
    [isPostAnalysisBranch, report, nodes],
  )
  const evidencePriorityMeta = useNodeDisplayMetadata(evidencePriorityFactorId ?? '', 'factor')
  const evidencePriorityReadout = useInfluenceRank(
    evidencePriorityMeta.sensitivityRank,
    evidencePriorityMeta.influenceSetSize,
  )
  const evidencePriority = useMemo<{ factorId: string; label: string } | null>(() => {
    if (evidencePriorityFactorId === null) return null
    const rank = driverRankFor(
      evidencePriorityReadout,
      evidencePriorityMeta.sensitivityRank,
      evidencePriorityMeta.influenceSetSize,
      false,
      evidencePriorityMeta.influenceRankedCount,
    )
    if (rank?.rank !== 1) return null
    if (evidencePriorityMeta.influence == null || evidencePriorityMeta.influenceProvenance == null) return null
    const rawLabel = nodes.find(n => n.id === evidencePriorityFactorId)?.data?.label
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
    return label.length > 0 ? { factorId: evidencePriorityFactorId, label } : null
  }, [evidencePriorityFactorId, evidencePriorityReadout, evidencePriorityMeta, nodes])

  // ⛔ `showSupportShareAbsent` IS DELIBERATELY NOT A CONJUNCT HERE, AND IT WAS
  // ONCE. `bodyHasContent` gates `{!bodyHasContent && bodyFallback}` and
  // `bodyFallback` IS the resting state, so adding it displaced that block in
  // Standard post-analysis — in exactly the case the sentence exists to
  // improve, and the tombstone above warns about this mechanism already. The
  // sentence and the resting block are SIBLING JSX nodes, each independently
  // conditional, so the sentence never needed the rider to render: it was not a
  // trade-off between them. Pinned both ways in
  // `DecisionNode.restingState.spec.tsx`.
  // ---- The honest resting state ----
  //
  // Measured on deployed `2db13473`: the anchor node of a real model rendered
  // as an EMPTY BOX carrying nothing but its title, because both branches put
  // zero children on screen and `BaseNode`'s children wrapper is gated on
  // `children` being truthy. Two reachable ways in — a decision with no option
  // linked (`optionCount === 0` fell through both arms to a literal `null`),
  // and a completed run in Standard view where the producer made no owned
  // leader claim (the `mt-1` div rendered with no children, since the
  // stability line and the post chips are Detailed-only).
  //
  // ⛔ THE ONE THING THIS COPY MAY NOT DO IS EXPLAIN THE ANALYSIS. The second
  // case is reached BECAUSE a leader claim was withheld, which makes "no
  // leading option" / "too close to call" the obvious sentence to write here —
  // and it would be this node inventing a verdict it does not hold. `headline`
  // is also null when the claimed option is simply not on the canvas any more
  // (`deriveDecisionVerdict`'s identity gate, and the winner-label lookup
  // below it), so a sentence about the analysis would be false on a reachable
  // path, not merely unearned. It states what is ABSENT FROM THIS NODE, never
  // a finding, and never a reassuring positive.
  //
  // ⛔ AND IT NAMES NO NODE TYPE. The user-facing word for this type is moving
  // ("Decision" → "Question") behind `DECISION_NODE_LABEL` in
  // `canvas/domain/vocabulary.ts`, owned by another lane. Copy that does not
  // need the word cannot ship the stale one.
  //
  // ⭐⭐ AND THE CTA GOES TO THE CONVERSATION, NOT TO THE INSPECTOR. The first
  // cut called `requestNodeRename` + `openNodeInspector`, on the strength of
  // #1020/#1024 — but **#1025 REVERTED #1024**, because a node-label edit has
  // no wire carrier and a server rehydrate silently discarded the user's
  // rename. Re-derived on `origin/staging` at this tip: `onLabelChange` has
  // ZERO product callers (spec files only), `InspectorShell:136` forwards it
  // into `EditableLabel`'s `onSave`, and `EditableLabel:91` reads
  // `if (!autoEdit || wasArmed || !onSave) return` — so the auto-edit effect
  // returns immediately and the title renders as static text. Contrast control
  // for that sweep: the sibling `onSave` DOES have live product call sites
  // (`FactorObservablePanel:239`, `RiskPanel:130`), so the zero is real
  // absence and not a blind probe.
  //
  // A CTA pointing there would open a panel that says changes cannot be saved.
  // `requestAsk` is the seam that works — three live product call sites, and
  // it NEVER auto-sends: it prefills an editable draft in the composer, or the
  // Ask-Olumi drawer when no composer is registered, and the user presses
  // Send. Renaming does land conversationally. The button is gated on
  // `canReceiveAsk` for the reason that module's own header gives: with no
  // surface at all the affordance must not render rather than pretend.
  //
  // ⚠ The narrowing shapes are not decoration. Under `tsconfig.tooling.json`
  // this component's `data` resolves to `{}` and `id` to `unknown` (the same
  // widening that already baselines a TS2345 on `useModelReadiness(id)`
  // above), so a bare `data?.label` / `openNodeInspector(id)` compiles under
  // one project and REDs the gate under the other.
  const restingLabelValue = (data as { label?: unknown } | undefined)?.label
  const restingLabel = typeof restingLabelValue === 'string' ? restingLabelValue.trim() : ''
  /**
   * ⭐⭐ "UNWRITTEN" IS TWO STATES, AND THIS READ ONLY ONE OF THEM.
   *
   * An empty label is unwritten. So is the type's own default name — a node
   * still reading `Question` (`DECISION_NODE_LABEL`, whose own doc argues it
   * "invites the user to write theirs"). Only the first has zero length, so
   * `restingLabel.length === 0` saw the empty case and missed the default.
   *
   * ⛔ THE CONSEQUENCE IS TWO AUTHORITIES DISAGREEING ABOUT ONE NODE, and it
   * was witnessed on the deployed build `079d080b`: a fresh draft from a typed
   * brief put a Question card on the canvas reading the word **"Question"**,
   * with no unwritten line and no CTA — while the Model tab, reading the SAME
   * node through `projectModelQuestion` → `labelIsTypeDefault`, correctly
   * reported the question as `unwritten`. Each surface was internally
   * consistent; nothing could tell the reader which to believe (trap 21).
   *
   * ⭐ SO THE FIX IS THE SHARED PREDICATE, NOT A SECOND COMPARISON HERE.
   * `decisionLabelIsUnwritten` lives beside the constant in
   * `domain/vocabulary.ts` and the Model tab's `labelIsTypeDefault` now
   * delegates to it — one definition, two consumers. Re-typing
   * `=== 'Question'` on this card is exactly the mirror that file exists to
   * abolish, and the product word has already moved once (Paul retired
   * "Decision" on 31 Aug).
   *
   * ⭐ AND THE ARM IT UNLOCKS IS A REAL MOVE, WHICH IS WHY THIS IS SAFE TO
   * WIDEN. `unnamedAsk` goes through `requestAsk` — three live product call
   * sites, gated on `canAsk`, and it never auto-sends: it prefills an editable
   * draft the user presses Send on. Marking a state the reader cannot act on
   * would be the defect one level along; here the affordance already works and
   * simply was not being reached.
   */
  const isUnnamed = restingLabel.length === 0 || decisionLabelIsUnwritten(restingLabel)
  const restingNodeId = id as string

  // ⚠ ORDER MATTERS, AND THE SECOND ARM IS A CORRECTION. This previously read
  // "Nothing on this node yet" on a COMPLETED run — while the SAME node's
  // popover carried "62%", "sensitive", "Challenge this result" and "Compare
  // options". "yet" says nothing has happened; a run had. And "Rename it"
  // prescribed an act unrelated to why the body was empty. The corpus could
  // not see it because the withheld-report fixture omitted
  // `recommendation_stability` — i.e. it EXCLUDED the class where the
  // contradiction is visible (CLAUDE.md trap 13d: check what a corpus leaves
  // out, not what it covers).
  //
  // Where a popover exists the body now points AT it — a statement about this
  // surface, still not about the analysis — and offers no CTA, because the
  // absence there is not something the user authors away.
  const resting = isUnnamed
    ? {
        line: DECISION_RESTING_COPY.unnamedLine,
        cta: DECISION_RESTING_COPY.unnamedCta,
        ask: DECISION_RESTING_COPY.unnamedAsk,
        askLabel: DECISION_RESTING_COPY.unnamedAskLabel,
      }
    : hasPostAnalysisPopover
      ? { line: DECISION_RESTING_COPY.completedRunLine, cta: null, ask: null, askLabel: null }
      : optionCount === 0
        ? {
            line: DECISION_RESTING_COPY.noOptionsLine,
            cta: DECISION_RESTING_COPY.noOptionsCta,
            ask: DECISION_RESTING_COPY.noOptionsAsk,
            askLabel: DECISION_RESTING_COPY.noOptionsAskLabel,
          }
        : { line: DECISION_RESTING_COPY.emptyLine, cta: null, ask: null, askLabel: null }

  const restingAsk = resting.ask
  const restingAskLabel = resting.askLabel
  const canAsk = useGuidanceStore(canReceiveAsk)

  const handleRestingAsk = useCallback(() => {
    if (!restingAsk || !restingAskLabel) return
    // No `parameters`: this is a plain ask, so it prefills the composer where
    // one is registered and falls back to the Ask-Olumi drawer otherwise.
    // Either way the user sees the draft and presses Send — it is never sent
    // for them.
    requestAsk({
      text: restingAsk,
      label: restingAskLabel,
      targetId: restingNodeId,
      source: 'decision-node-resting',
    })
  }, [restingAsk, restingAskLabel, restingNodeId])

  /**
   * How many alternatives are in play — the card-face line and the reduced line
   * are ONE string, resolved here.
   *
   * ⚠ THE `isUnnamed` GATE BELONGS TO THE REDUCED LINE ONLY, AND THAT IS WHY
   * THIS IS COMPOSED IN TWO STEPS RATHER THAN ONE. Below the legibility floor a
   * card gets ONE line, so an unnamed question must spend it on the authoring
   * prompt — the count is worth less than knowing what the node is. At reading
   * zoom nothing is being traded: the title, the prompt and the count all fit,
   * and withholding the count from an unnamed question would hide a fact for no
   * reason. `optionCountLineText` is the fact; `lodMetric` is the fact AFTER the
   * one-line budget has been applied to it.
   */
  const optionCountLineText = useMemo(
    () => composeOptionCountLine(optionCount),
    [optionCount],
  )

  // Keep the Question node structural at every zoom. A completed analysis
  // must not replace this count with the option verdict removed from its body.
  // Unnamed and empty nodes retain their existing authoring/wayfinding copy.
  const lodMetric = useMemo<string | null>(() => {
    if (!isUnnamed && optionCountLineText !== null) return optionCountLineText
    return resting.line
  }, [isUnnamed, resting.line, optionCountLineText])


  // ⭐ The readiness summary and the content-free "Hover for this node's detail"
  // line are OFF the shallow face (ED 11:52Z point 1: option count + at most ONE
  // reasoning-focus signal). The readiness counts stay in the pre-analysis
  // popover; `composeReadinessSummary` is still exported for its callers.

  // ---- Render ----

  /**
   * Contract v3.1 `.node .row-meta` (T04 / ANC-03): the row under the question
   * is ONE muted run joined by " · " ("3 alternatives · Evidence priority:
   * conversion"), not three type styles side by side separated by whitespace.
   * The glyph is the file's own `READINESS_SEPARATOR`, so the card and the
   * inspector's guidance line spell it once. Decorative: screen readers get the
   * items, which are already separate elements.
   */
  const rowMetaSeparator = (
    <span
      aria-hidden="true"
      data-testid="decision-row-meta-separator"
      className={`${typography.edgeLabel} shrink-0 text-text-light`}
    >
      {READINESS_SEPARATOR.trim()}
    </span>
  )

  /**
   * ⭐⭐ THE REASONING SENTENCE IS OFF THE RESTING CARD, AND WHOLE WHERE IT WENT
   * (Paul, 25 Sep 2026, from live screenshots: the card must match the
   * PROTOTYPE, whose row is "3 alternatives · Evidence priority: conversion" —
   * one clean line). Served, the row's second segment was a SENTENCE clamped to
   * one line: "3 options · A success target on your model can't be…".
   * A word-boundary clamp still cut the sentence; no clamp can fit a sentence
   * of unbounded length into a fixed row.
   *
   * So the three sentences that used to be the row's "focus signal" — the
   * pre-run top gap, the withheld-leader disclosure, the run-wide absence of
   * per-option shares — keep their selection logic and test ids unchanged and
   * render WHOLE, with no clamp and no ellipsis:
   *   · Standard: in the node popover, which already carries this card's
   *     detail before and after a run;
   *   · Detailed after a run: in the body (there is no post-run popover there);
   *   · and a `.sr-only` copy stays on the card whenever the visible copy is in
   *     the popover, so a screen reader reaches it without a hover (ED 02:31Z's
   *     full-text-recovery rule, kept).
   * Unnamed and no-option cards keep their resting line and CTA on the row.
   */
  const focusDetail: { testId: string; text: string; extra?: Record<string, string> } | null =
    isUnnamed || (!isPostAnalysisBranch && !isPreAnalysisBranch)
      ? null
      : isPostAnalysisBranch
        ? withheldLeader
          ? {
              testId: 'decision-leader-withheld',
              text: withheldLeader.suggestion.length > 0 ? `${withheldLeader.title} ${withheldLeader.suggestion}` : withheldLeader.title,
              extra: { 'data-withheld-code': withheldLeader.code },
            }
          : showSupportShareAbsent
            ? {
                testId: 'decision-support-share-absent',
                text: 'On the data so far, this run gave no share of runs for the options. Compare them on what each one changes.',
              }
            : null
        : triage
          ? { testId: 'decision-node-top-gap', text: triage.full }
          : null
  const focusDetailInBody = isDetailed && isPostAnalysisBranch
  const focusDetailLine = focusDetail !== null ? (
    <div
      data-testid={focusDetail.testId}
      {...focusDetail.extra}
      className={`${typography.edgeLabel} break-words text-text-light`}
    >
      {focusDetail.text}
    </div>
  ) : null

  const restingCta = resting.cta && canAsk ? (
    <button
      type="button"
      data-testid="decision-node-resting-cta"
      /* Contract v3.1 ANC-12: the same link treatment as the goal's target
         route (from-font, offset 2px, clear of descenders at 11px x scale) and
         5px of hit slop, so the ~15px line box (15.1 + 10 = 25px at 1x) clears
         the 24px target floor; the only thing under the left slop is the
         aria-hidden separator glyph, which has no handler. The
         resting underline STAYS: info and text-light differ by ~1.1:1, so
         colour alone would not mark it as a link (WCAG 1.4.1). */
      className={`${typography.edgeLabel} relative text-info underline decoration-from-font underline-offset-2 cursor-pointer nodrag nopan rounded before:absolute before:-inset-[5px] before:content-[''] hover:text-info-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
      onClick={handleRestingAsk}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {resting.cta}
    </button>
  ) : null

  const focusSignal = isUnnamed || (!isPostAnalysisBranch && !isPreAnalysisBranch) ? (
    <>
      <span className={`${typography.edgeLabel} text-text-light`}>{resting.line}</span>
      {restingCta !== null && rowMetaSeparator}
      {restingCta}
    </>
  ) : evidencePriority !== null ? (
    <span
      data-testid="decision-evidence-priority"
      data-factor-id={evidencePriority.factorId}
      className={`${typography.edgeLabel} min-w-0 break-words text-text-light`}
    >
      {`${EVIDENCE_PRIORITY_LABEL}: ${evidencePriority.label}`}
    </span>
  ) : null

  // The card's ONE coaching question (rail): before a run, "Explore more
  // options"; after it, "Challenge this result" — TYPED `what_would_flip`,
  // dispatched typed by `NodeCoachingIcon`, never demoted (ED 02:31Z).
  //
  // ⚠ ONLY WHERE THE CHIPS IT REPLACES RENDERED: after a run, or before one
  // with options linked (`isPreAnalysisBranch`). With NO options the card's
  // one act is the resting CTA ("Add options"); "Explore more options — My
  // model has 0 options so far" beside it would be the same invitation twice,
  // one of them counting a zero (review of this PR, DecisionNode.invitations).
  const decisionCoaching: ResolvedCoaching = useMemo(
    () =>
      isPostAnalysisBranch || isPreAnalysisBranch
        ? resolveNodeCoaching({
            kind: 'decision',
            surface: isPostAnalysisBranch ? 'postAnalysis' : 'preAnalysis',
            state: { showRunAnalysis },
            context: { optionCount },
          })
        : null,
    [isPostAnalysisBranch, isPreAnalysisBranch, showRunAnalysis, optionCount],
  )
  const postRunPopoverChips = useMemo(() => {
    const rest = isPostAnalysisBranch ? (decisionCoaching ?? []).slice(1) : []
    return rest.length > 0 ? (
      <CoachingChipRow className="flex gap-1 flex-wrap mt-1.5" testId="decision-popover-post-run" chips={rest} />
    ) : null
  }, [decisionCoaching, isPostAnalysisBranch])
  // The Standard popover's invitations: every pre-analysis chip EXCEPT the one
  // the rail icon asks (the first), so hover never repeats the icon's question.
  const popoverInvitations = useMemo(() => {
    const rest = (decisionCoaching ?? []).slice(1)
    return !isPostAnalysisBranch && rest.length > 0 ? (
      <CoachingChipRow className="flex items-center gap-1 flex-wrap mt-1.5" testId="decision-popover-invitations" chips={rest} />
    ) : null
  }, [decisionCoaching, isPostAnalysisBranch])

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
    >
      <BaseNode
        nodeType="decision"
        lodMetric={lodMetric}
        icon={Crosshair}
        id={id}
        data={data}
        selected={selected}
        coaching={decisionCoaching}
        /* ⛔⛔ NO `railIcons` HERE ANY MORE — DESIGN-GAP-AUDIT row 5(b), 24 Sep
           2026. The rail used to carry a Play action (`decision-run-analysis-
           <id>`, label "Run the analysis now" or the held notice), gated on
           `!isPostAnalysisBranch && showRunAnalysis && optionCount > 0`. That
           consolidated the goal card's duplicate "Run analysis" chip onto this
           one surface (23 Sep 2026, `runAnalysisOneAuthority.spec.tsx`'s
           "locked design"). This is a FURTHER move, not a reversion to the
           duplicate: running lives in the panel's Analyse button, so NEITHER
           card offers a run affordance now — see that spec file's updated
           header for the record of the ruling this supersedes. `showRunAnalysis`
           itself stays: `resolveNodeCoaching` still reads it to keep the rail's
           ONE coaching icon from offering "What could go wrong?" at the same
           moment the analysis is ready to run — a coupling that predates the
           Play icon and is unrelated to it. */
      >
        {/* ⭐⭐ THE QUESTION CARD IS WIDE AND SHALLOW (ED 11:52Z point 1: "target:
            wide + shallow, meaningful canonical question/framing label, option
            count + at most one reasoning-focus signal, coaching behind the one
            icon. Do not echo the whole brief").

            ONE line under the title (prototype, Paul 25 Sep 2026): how many
            alternatives are in play, and — after a CURRENT run only — the
            factor it ranks first, "Evidence priority: <label>";
              · unnamed / no options: the resting line and its one CTA.
            The reasoning sentences that used to be the second segment are off
            the row, whole (`focusDetail`).
            The coaching chips ("Explore more options", "Challenge this result")
            are the rail's ONE coaching icon — typed `what_would_flip` kept typed.
            Detailed adds the robustness line and the chip rows, as before. */}
        {/* Contract v3.1 (FRAME-10, T04, ANC-03, ANC-13): the row is
            `.node .row-meta` — 11px, muted, one run joined by " · ".
            · The count is META, not a second title: it was the 14px value
              token in body ink, so the card read "Question / 3 options" as
              two headings. The value-token guard no longer lists this site
              (tests/ci-guards/the-recorded-value-carries-its-weight.spec.ts).
            · title → row is 7px, the wide card's gap (`.node.wide{gap:7px}`):
              the header's 4px plus 3px here (was 4 + 4), so the card shrinks.
            · the gap counter-scales like the text (4px at every zoom on
              screen), and 4px x the bound scale 2 is the 8px it replaces, so
              the row is never wider at the height the layout reserves. */}
        <div
          className="mt-[3px] flex min-w-0 flex-wrap items-baseline gap-x-[calc(4px*var(--canvas-label-scale,1))] gap-y-0.5"
          data-testid="decision-node-resting-state"
        >
          {optionCountLineText !== null && (
            <span data-testid="decision-node-option-count" className={`${typography.edgeLabel} shrink-0 text-text-light`}>
              {optionCountLineText}
            </span>
          )}
          {optionCountLineText !== null && focusSignal !== null && rowMetaSeparator}
          {focusSignal}
        </div>
        {/* The row's reasoning sentence, off the row (see `focusDetail`): a whole
            line in the Detailed body after a run, where no popover mounts;
            otherwise the popover carries it and AT gets this card-side copy. */}
        {focusDetailInBody && focusDetailLine !== null && <div className="mt-1">{focusDetailLine}</div>}
        {!focusDetailInBody && focusDetail !== null && (
          <span data-testid="decision-focus-signal-sr" className={typography.screenReaderOnly}>
            {focusDetail.text}
          </span>
        )}
        {isDetailed && showStabilityLine && robustnessVerdict && (
          <div
            className={`${typography.edgeLabel} text-text-light mt-1`}
            data-testid="decision-robustness-verdict"
          >
            Robustness: {robustnessVerdict.verdict}
          </div>
        )}
        {isDetailed && (isPostAnalysisBranch ? postAnalysisCoachingChips : isPreAnalysisBranch ? preAnalysisCoachingChips : null)}
      </BaseNode>

      {/* Pre-analysis popover — model readiness breakdown + coaching chips */}
      {!isPostAnalysis && optionCount > 0 && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {focusDetailLine !== null && <div className="mb-1.5">{focusDetailLine}</div>}
          <div className={`${typography.edgeLabel} text-text-body space-y-1`}>
            <div className="font-medium text-text-header">Model readiness</div>
            {readiness.explicitCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.explicit)}: {readiness.explicitCount}</div>
            )}
            {readiness.inferredCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.inferred)}: {readiness.inferredCount}</div>
            )}
            {readiness.missingCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.missing)}: {readiness.missingCount}</div>
            )}
            {readiness.externalCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.external)}: {readiness.externalCount}</div>
            )}
            {readiness.biasTriggers.length > 0 && (
              <>
                <div className="font-medium text-text-header mt-1">Bias triggers</div>
                {readiness.biasTriggers.map(trigger => (
                  <div key={trigger}>{trigger}</div>
                ))}
              </>
            )}
          </div>
          {/* ⭐ LOCKED DESIGN (23 Sep 2026): the card face now carries ONE coaching
              icon (the first invitation), so the remaining invitations — "What
              could go wrong?" — would otherwise be Detailed-only in Standard.
              They come back HERE, the Standard hover/tap surface, minus the
              one the icon already asks, so no question appears twice on one
              surface. (History: they were moved OUT of this popover when the
              face carried them all as chips; that premise is gone.) */}
          {!isDetailed && popoverInvitations}
        </NodePopover>
      )}

      {/* Post-analysis Standard popover — stability detail + coaching chips.
          Detailed view shows stability + chips inline in the body, so the
          popover only renders in Standard. */}
      {hasPostAnalysisPopover && (
        <NodePopover
          visible={showPopover}
          width={220}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {/* ⛔ THE BAR IS GONE, AND ITS ABSENCE IS THE POINT. Its width was
              `recommendation_stability` — the leading option's win probability
              — drawn in a robustness panel, so the reader compared a bar
              against the option cards' support bar without being told they
              were the same number. There is no licensed robustness
              percentage, so there is no bar and no figure. */}
          {focusDetailLine !== null && <div className="mb-1.5">{focusDetailLine}</div>}
          {robustnessVerdict && (
            <div className={`${typography.edgeLabel} text-text-body space-y-1.5`}>
              <div className="font-medium text-text-header">Robustness</div>
              <div className="text-text-light" data-testid="decision-robustness-popover-verdict">
                {robustnessVerdict.verdict}
              </div>
              {robustnessVerdict.reason && (
                <div className="text-text-light">{robustnessVerdict.reason}</div>
              )}
            </div>
          )}
          {/* ⭐ CHIPS ARE THE POPOVER'S FALLBACK ONLY, now that the body shows
              them. Rendering them in both places put the same two invitations
              on screen twice on hover.

              ⛔ AND THIS MAY NOT BECOME AN UNCONDITIONAL REMOVAL. The popover's
              existence is what makes `completedRunLine` ("Hover for this node's
              detail") true — `resting` selects that line on `hasPostAnalysisPopover`.
              Drop the chips outright and a run with no stability leaves an EMPTY
              popover under a line promising detail; gate the popover on stability
              instead and the same run falls through to `emptyLine` ("Nothing to
              show on this node") while the chips are plainly showing — false on a
              reachable path either way. Keeping them as the no-stability fallback
              is what holds both statements honest. */}
          {/* Locked design (23 Sep 2026): the rail icon already asks the FIRST
              post-run question ("Challenge this result", typed), so the popover
              offers the rest — the same no-repeat rule as the pre-run popover. */}
          {postRunPopoverChips}
        </NodePopover>
      )}
    </div>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode

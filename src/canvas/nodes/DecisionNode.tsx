/**
 * Decision node component — Graph v2 simplification.
 *
 * Pre-analysis Standard: triage line, 2 coaching chips, popover with model
 *   readiness breakdown.
 * Pre-analysis Detailed: same as Standard (chip rules are view-agnostic).
 * Post-analysis Standard: model-readiness summary, with stability and coaching
 *   in the popover. Option comparisons remain on option cards.
 * Post-analysis Detailed: stability and coaching inline in the body.
 *
 * Resting state: when NEITHER branch would put a child on screen, the body
 *   states what is absent from this node and — where an authoring act would
 *   answer that absence — offers to ask Olumi for it. Never a sentence about
 *   the analysis. See `bodyHasContent` and `DECISION_RESTING_COPY`.
 *   On `completedRunLine` it leads with the model-readiness summary
 *   ("4 factors · 2 estimated · 1 missing"), which is the same structural count
 *   the pre-analysis popover shows and is the only thing on this card that
 *   survives a completed run. See `composeReadinessSummary`.
 */
import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useSupportShareRunWideAbsent } from '../hooks/useSupportShareRunWideAbsent'
import { METRIC_NOUN } from './shared/metricVocabulary'
import { typography } from '../../styles/typography'
import { NodeChip, NodePopover } from './shared'
import { isGoalDefined } from '../../utils/isGoalDefined'
import { cleanFactorLabel } from '../utils/labelUtils'
import { biasSignal } from '../shared/biasSignalTitles'
import { aggregateEdgeSignedStrength, compareEdgeValueAggregates } from '../domain/edgeValueProvenance'
import { requestAsk, canReceiveAsk } from '../ui/inspector-v2/askSemantic'

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
  noOptionsLine: 'No options linked yet',
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

/** Same separator the inspector's guidance line already renders. */
export const READINESS_SEPARATOR = ' \u00b7 '

/** The popover's capitalised form, derived from the one record above. */
export function popoverLabel(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Truncate text at word boundary. */
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '\u2026'
}

// ---- Model readiness helpers ----

export interface ModelReadiness {
  // breakdown consumed by the pre-analysis popover, the triage line and the
  // card's own readiness summary
  explicitCount: number
  inferredCount: number
  missingCount: number
  externalCount: number
  biasTriggers: string[]
}

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

function useModelReadiness(decisionId: string): ModelReadiness {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  return useMemo(() => {
    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    const riskNodes = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk')

    let explicitCount = 0
    let inferredCount = 0
    let missingCount = 0
    let externalCount = 0

    for (const node of factorNodes) {
      const data = node.data as Record<string, unknown> | undefined
      if (!data) continue
      const category = data.category as string | undefined
      const observedState = data.observedState as Record<string, unknown> | undefined
      const prior = data.prior as { range_min?: number; range_max?: number } | undefined
      const value = observedState?.value as number | undefined
      const extractionType = observedState?.extractionType as string | undefined

      if (category === 'external') {
        externalCount++
        continue
      }

      if (value == null && !(prior?.range_min != null && prior?.range_max != null)) {
        missingCount++
      } else if (extractionType === 'inferred') {
        inferredCount++
      } else {
        explicitCount++
      }
    }

    // Bias triggers - bias NAMES composed from the one registry
    // (review-folds C15; rendered output byte-identical to the old
    // literals). 'Missing risks' is a graph-signal label, not a registry
    // bias code, so it stays local.
    const biasTriggers: string[] = []
    if (optionNodes.length < 3) biasTriggers.push(`${biasSignal('narrow_framing').title}: < 3 options`)
    if (riskNodes.length <= 1) biasTriggers.push('Missing risks: \u2264 1 risk identified')
    const hasBaseline = optionNodes.some(n => (n.data as Record<string, unknown> | undefined)?.is_baseline === true)
    if (hasBaseline) biasTriggers.push(`${biasSignal('status_quo_bias').title}: baseline present`)
    // Overconfidence: any factor is inferred (unvalidated estimate)
    const hasInferredFactor = factorNodes.some(n => {
      const os = (n.data as Record<string, unknown> | undefined)?.observedState as Record<string, unknown> | undefined
      return os?.extractionType === 'inferred'
    })
    if (hasInferredFactor) biasTriggers.push(`${biasSignal('overconfidence').title}: top factor unvalidated`)

    return {
      explicitCount,
      inferredCount,
      missingCount,
      externalCount,
      biasTriggers,
    }
  }, [nodes, edges, decisionId])
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

  const readiness = useModelReadiness(id)
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
  const triageLine = useMemo(() => {
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
        return `Top gap: estimate ${truncateAtWord(cleaned, 40)}`
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
      return `Top gap: validate ${truncateAtWord(cleaned, 40)}`
    }

    // 3. Goal has no threshold
    if (!goalDefined) return 'Top gap: set a success target'

    // 4. Fewer than 3 options
    if (optionNodes.length < 3) return 'Top gap: explore more options'

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
  const exploreOptionsMessage =
    `My model has ${optionCount} option${optionCount === 1 ? '' : 's'} so far.` +
    ' What other options could answer this decision that I have not put on the board?'

  const preAnalysisCoachingChips = useMemo(() => (
    <div className="flex items-center gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="decision_explore_more_options" actionType={null} label="Explore more options" message={exploreOptionsMessage} />
      {!showRunAnalysis && (
        <NodeChip chipId="decision_what_could_go_wrong" actionType={null} label="What could go wrong?" message="What could go wrong with this decision?" />
      )}
    </div>
  ), [showRunAnalysis, exploreOptionsMessage])

  const postAnalysisCoachingChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
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
      <NodeChip chipId="decision_challenge_result" actionType="what_would_flip" label="Challenge this result" message="Which assumptions could change the comparison between these options?" />
      <NodeChip chipId="decision_compare_options" actionType="compare_options" label="Compare options" message="Compare the options side by side" />
    </div>
  ), [])

  // Stability for post-analysis Detailed body and Standard popover.
  // Returns the underlying fraction (0-1) so the popover progress bar can use
  // it directly without re-parsing the formatted string.
  const stabilityDisplay = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    const stability = robustness?.recommendation_stability as number | undefined
    if (stability == null) return null
    const fraction = Math.max(0, Math.min(1, stability))
    const pct = Math.round(fraction * 100)
    const tier = fraction >= 0.85 ? 'robust'
      : fraction >= 0.70 ? 'moderate'
      : fraction >= 0.40 ? 'sensitive'
      : 'highly sensitive'
    return { pct, tier, fraction }
  }, [isPostAnalysis, report])

  // Chip actions via _sendMessage
  const handleChip = useCallback((message: string) => {
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(message)
  }, [])

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
  const showStabilityLine = isDetailed && Boolean(stabilityDisplay)
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
  const showPostAnalysisChips = isDetailed || Boolean(stabilityDisplay)
  const showTriageLine = Boolean(triageLine)

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
  const showPreAnalysisInvitations = isPreAnalysisBranch

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

  const bodyHasContent = isPostAnalysisBranch
    ? (showStabilityLine || showSupportShareAbsent)
    : isPreAnalysisBranch
      ? (showTriageLine || showRunAnalysis || showPreAnalysisInvitations)
      : false

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
  const isUnnamed = restingLabel.length === 0
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

  // Keep the Question node structural at every zoom. A completed analysis
  // must not replace this count with the option verdict removed from its body.
  // Unnamed and empty nodes retain their existing authoring/wayfinding copy.
  const lodMetric = useMemo<string | null>(() => {
    if (!isUnnamed && optionCount > 0) {
      return `${optionCount} option${optionCount === 1 ? '' : 's'}`
    }
    return resting.line
  }, [isUnnamed, resting.line, optionCount])

  /**
   * ⚠⚠ ONE ARM, BECAUSE THE OTHER IS UNREACHABLE HERE — AND I WROTE TWO FIRST.
   *
   * The block this replaces substituted on `completedRunLine || emptyLine`, so
   * my first cut inherited both and added a second mechanism to suppress
   * `emptyLine` ("Nothing to show on this node") wherever the summary rendered,
   * on the grounds that a count of the model directly above that sentence is
   * the product contradicting itself.
   *
   * ⛔ THE SUPPRESSION COULD NEVER FIRE. Derived at this file's own branch
   * conditions rather than assumed, and pinned by the two tests named below:
   *
   *   • The PRE-ANALYSIS branch cannot reach the fallback at all —
   *     `showPreAnalysisInvitations` IS `isPreAnalysisBranch`, so
   *     `bodyHasContent` is unconditionally true whenever options are linked.
   *   • The THIRD arm requires `optionCount === 0`, which the arms above route
   *     to `noOptionsLine`/`unnamedLine`, never to `emptyLine`.
   *   • The POST-ANALYSIS branch reaches the fallback only in Standard view
   *     (Detailed always renders chips), and Standard means
   *     `hasPostAnalysisPopover`, which is `completedRunLine`.
   *
   * So `emptyLine` reaches only `lodMetric`, which is a different surface with
   * its own `optionCount` arm. A guard that cannot fail is not defence in
   * depth, it is a second answer to a question already answered — this file
   * makes exactly that argument sixty lines up about an `optionCount > 0`
   * conjunct a mutant proved to be a no-op. Narrowed to what is reachable and
   * testable, and the reachability itself is asserted rather than recorded in
   * a comment nobody re-derives.
   *
   * ⚠ THE TWO CTA ARMS ARE STILL LEFT ALONE, which is the removed block's rule
   * kept deliberately rather than by inertia: `unnamedLine` and `noOptionsLine`
   * prompt an authoring act the user can perform, and a count above them
   * dilutes the prompt and buys nothing.
   */
  const restingLineIsContentFree = resting.line === DECISION_RESTING_COPY.completedRunLine

  /**
   * ⭐⭐ INSIDE `decision-node-resting-state`, AND THAT IS THE ARGUMENT FOR THIS
   * LINE RATHER THAN A CAVEAT ABOUT IT.
   *
   * The brief block this replaces sat OUTSIDE the subtree for a sound reason:
   * it rendered the USER'S OWN prose, which may legitimately contain every word
   * the honesty guard forbids, so hosting it inside would have forced the guard
   * to be weakened. The same is true of the `triageLine` alternative I tried
   * first and discarded — it carries a factor LABEL, and "Supplier lead time"
   * alone REDs the guard.
   *
   * This line carries no user text at all: four integers and four owned words.
   * So it belongs INSIDE the guarded subtree, where `DecisionNode.restingState`
   * now enumerates `DECISION_READINESS_COPY` and runs a factor-bearing fixture
   * through the same rendered corpus. The guard is EXTENDED to cover new copy,
   * never relaxed to admit it.
   *
   * ⚠ `triageLine` WAS THE OBVIOUS CANDIDATE AND CANNOT WORK HERE — measured,
   * not assumed. It opens `if (isPostAnalysis) return null`, so it is null in
   * exactly the state this fallback exists to fill. Wiring it in would have
   * produced a block that is always absent where it is needed, under a green
   * suite built from pre-analysis fixtures.
   */
  const readinessSummary = useMemo(() => composeReadinessSummary(readiness), [readiness])
  const showReadinessSummary = Boolean(readinessSummary) && restingLineIsContentFree

  const restingState = (
    <div className="mt-1" data-testid="decision-node-resting-state">
      {showReadinessSummary && (
        <div
          data-testid="decision-node-readiness-summary"
          className={`${typography.edgeLabel} text-text-body`}
        >
          {readinessSummary}
        </div>
      )}
      <div className={`${typography.edgeLabel} text-text-light`}>{resting.line}</div>
      {resting.cta && canAsk && (
        <button
          type="button"
          data-testid="decision-node-resting-cta"
          className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan mt-0.5`}
          onClick={handleRestingAsk}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {resting.cta}
        </button>
      )}
    </div>
  )

  /**
   * What the body falls back to when neither branch put a child on screen.
   *
   * ⚠ IT IS NOW A PLAIN ALIAS, AND IT STAYS NAMED. The brief block used to
   * substitute for the resting state here, so this expression chose between two
   * blocks; the readiness summary is a LINE INSIDE the resting state instead, so
   * there is nothing left to choose. The name is kept because this file renders
   * the fallback at THREE sites — collapsing it to a bare `restingState` at each
   * one is how the three start to diverge, which is the defect the original
   * comment was written about.
   */
  const bodyFallback = restingState

  // ---- Render ----

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      <BaseNode
        nodeType="decision"
        lodMetric={lodMetric}
        icon={Crosshair}
        id={id}
        data={data}
        selected={selected}
      >
        {/* ===== POST-ANALYSIS =====
            Branches on the ANALYSIS LIFECYCLE, not on the leader claim.
            It used to branch on `headline`, which coupled three unrelated
            things to one gate: withholding the leader sentence also withheld
            the stability line and the post-analysis chips — and then fell
            through to the PRE-analysis branch, so a completed run rendered
            "Run analysis" again. Harmless while `headline` was null only in
            degenerate cases; a live regression the moment a withheld verdict
            made it null on a real completed run (ROADMAP 1.223).

            Stability is the axis `decisionVerdict` insists is disclosed
            SEPARATELY from separation, so suppressing it alongside the leader
            claim would be the over-suppression half of this same defect. */}
        {isPostAnalysisBranch ? (
          <div className="mt-1">
            {/* ⛔ THE LEADER SENTENCE IS GONE FROM THE QUESTION NODE.

                It read "{X} supported in N% of simulated scenarios" — the
                option cards' own verdict, restated under a heading that asks a
                question. The node that FRAMES the decision was answering it,
                in the words of the cards beside it, and a reader got the same
                claim twice with no second source behind the repetition.

                ⚠ THE PERMISSION SEMANTICS ARE UNCHANGED AND STILL LIVE. This
                does not relax the option cards' admission, refusal,
                non-vacuity or identity controls. This Question node no longer
                derives a comparative headline, including at reduced zoom.

                Its risk clause went with it (see the selector's tombstone
                above). What this node keeps is the authored question,
                readiness facts, independent stability and the routes out. */}
            {/* ⛔ AND THE RUN CAVEAT WENT WITH THE CLAIM IT QUALIFIED.

                It read "{grade}: small changes could flip which option the data
                supports" and was gated on the producer's claim — a caveat
                ABOUT the verdict sentence, existing because that sentence was
                always-on while its qualifier was Detailed-only.

                ⚠ Removing a claim does not require retaining its attached
                caveat. With no comparative sentence on this card there is
                nothing here for it to qualify, and a fragility notice floating
                above a question would be a claim of its own.

                ⭐ THE GENUINE INDEPENDENT STABILITY INFORMATION IS UNTOUCHED and
                is a different quantity: `stabilityDisplay` still renders inline
                in Detailed (`showStabilityLine`, below) and in the Standard
                popover (bottom of this file). That is the axis `decisionVerdict`
                insists is disclosed separately, and it survives on both
                surfaces. */}
            {/* ⛔ AND ITS BAR WENT WITH IT — `decision-leader-metric-row`.

                The bar was added because this figure was the least visually
                encoded on the canvas. True, and it is the OPTION card's job:
                the row rendered `option_probabilities[leader]` under
                `METRIC_NOUN.support` — the same field, same caption and same
                scale the most-supported OptionNode already draws. A second
                copy here is the duplication one layer below the sentence.

                ⚠ The old comment's warning still stands where the bar still
                lives: never gate it on the NUMBER rather than the CLAIM,
                because `option_probabilities[leader].win_probability` is
                present on withheld runs too. That argument was always an
                argument for the option card's bar. It is untouched. */}
            {/* ⛔ NO READINESS BLOCK HERE — AND I BUILT ONE TWICE BEFORE
                ARRIVING AT THAT.

                With the verdict, its bar and its caveat all gone, a completed
                run in STANDARD puts nothing in this branch (stability and chips
                are Detailed-only), so `bodyHasContent` is false and the
                RESTING/completed-run state renders — which already carries the
                readiness breakdown, inside the guarded subtree, with its
                wayfinding line. Nothing needed lifting.

                My first attempt rendered readiness here ungated, which made
                `bodyHasContent` true on every completed run and SUPPRESSED that
                resting state; my second gated it on `bodyHasContent`, which was
                coherent but pointless once the caveat also went. The simplest
                shape is the ruled one: remove the duplicate, let the existing
                state supply the content, and move no copy out from under the
                honesty corpus. */}
            {/* Post-analysis Detailed only: stability + chips inline in body
                (Detailed has no popover). Standard surfaces both via the
                popover below. */}
            {showSupportShareAbsent && (
              <div
                className={`${typography.edgeLabel} text-text-body mt-1`}
                data-testid="decision-support-share-absent"
              >
                On the data so far, this run produced no {METRIC_NOUN.support.toLowerCase()} percentages
                for the options. Compare them on what each one changes.
              </div>
            )}
            {showStabilityLine && stabilityDisplay && (
              <div
                className={`${typography.edgeLabel} text-text-light mt-1`}
              >
                Stability: {stabilityDisplay.pct}% ({stabilityDisplay.tier})
              </div>
            )}
            {showPostAnalysisChips && postAnalysisCoachingChips}
            {/* Nothing above rendered — say what is absent rather than
                presenting an empty box. */}
            {!bodyHasContent && bodyFallback}
          </div>
        ) : isPreAnalysisBranch ? (
          <>
            {/* ===== PRE-ANALYSIS ===== */}

            {/* Triage line — single most important next action.
                ⚠ IT MUST WRAP, NOT TRUNCATE, and that is not a style preference.
                This carried `truncate` (`white-space: nowrap` + ellipsis) and
                shipped 37-41% cut on every starter measured — deployed staging
                `384a2b4f`, 29 Aug 2026:

                  "Top gap: validate Platform Engineer Headco…"   38% hidden
                  "Top gap: validate Vendor Solution Adoption"    38% hidden
                  "Top gap: validate Snowflake-Native Build …"    41% hidden

                The full string occurred EXACTLY ONCE in the DOM with no
                unclipped instance anywhere — no `title`, no `aria-label`
                carrying it, and opening the node's details did not restate it.
                So the product's single most action-guiding sentence was cut
                before it named the thing to go and fix, with nowhere to recover
                it. An ellipsis with somewhere to go is a caveat; an ellipsis
                with nowhere to go is hiding.

                Wrapping is bounded, so this cannot grow without limit: the
                label is already shortened to 40 chars by `truncateAtWord`
                above, capping the line near 59 characters — two lines at this
                measure. `e2e/visual/nodeTextClipping.visual.spec.ts` REDs if any
                node text starts overflowing its box again. */}
            {showTriageLine && (
              <div className={`${typography.edgeLabel} text-text-body mt-1`}>
                {triageLine}
              </div>
            )}

            {/* The "Run analysis" CTA when the model is ready — a primary
                action, not coaching. */}
            {showRunAnalysis && (
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                <NodeChip chipId="decision_run_analysis" actionType="run_analysis" label="Run analysis" message="Run the analysis now" />
              </div>
            )}
            {/* The invitations — see `showPreAnalysisInvitations` for why these
                moved out from behind the hover. `preAnalysisCoachingChips`
                already drops "What could go wrong?" while the Run CTA is up, so
                the card never carries three chips at once. */}
            {showPreAnalysisInvitations && preAnalysisCoachingChips}
            {!bodyHasContent && bodyFallback}
          </>
        ) : (
          /* Neither branch applies — most often a decision with no option
             linked, which is the shape measured on `2db13473`. This arm used
             to be a literal `null`, i.e. the empty box itself. */
          bodyFallback
        )}
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
          <div className={`${typography.edgeLabel} text-text-body space-y-1`}>
            <div className="font-medium text-text-heading">Model readiness</div>
            {readiness.explicitCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.explicit)}: {readiness.explicitCount}</div>
            )}
            {readiness.inferredCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.inferred)}: {readiness.inferredCount}</div>
            )}
            {readiness.missingCount > 0 && (
              <div className="text-danger">{popoverLabel(DECISION_READINESS_COPY.missing)}: {readiness.missingCount}</div>
            )}
            {readiness.externalCount > 0 && (
              <div>{popoverLabel(DECISION_READINESS_COPY.external)}: {readiness.externalCount}</div>
            )}
            {readiness.biasTriggers.length > 0 && (
              <>
                <div className="font-medium text-text-heading mt-1">Bias triggers</div>
                {readiness.biasTriggers.map(trigger => (
                  <div key={trigger} className="text-warning">{trigger}</div>
                ))}
              </>
            )}
          </div>
          {/* ⛔ THE CHIPS ARE NOT HERE ANY MORE — they are on the card.
              Rendering them in both put the SAME chip on one node twice for a
              pointer user, which is worse than either placement alone, and it
              broke `render-matrix`'s own `getByText` audit. The popover keeps
              what it is uniquely good at: the readiness breakdown, which is
              detail on demand rather than an invitation. */}
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
          {stabilityDisplay && (
            <div className={`${typography.edgeLabel} text-text-body space-y-1.5`}>
              <div className="font-medium text-text-heading">Stability</div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-info"
                    style={{ width: `${Math.max(4, stabilityDisplay.pct)}%` }}
                  />
                </div>
                <span className="w-7 text-right shrink-0 text-text-light">{stabilityDisplay.pct}%</span>
              </div>
              <div className="text-text-light">{stabilityDisplay.tier}</div>
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
          {!stabilityDisplay && postAnalysisCoachingChips}
        </NodePopover>
      )}
    </div>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode

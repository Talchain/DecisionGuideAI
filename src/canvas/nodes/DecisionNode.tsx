/**
 * Decision node component — Graph v2 simplification.
 *
 * Pre-analysis Standard: triage line, 2 coaching chips, popover with model
 *   readiness breakdown.
 * Pre-analysis Detailed: same as Standard (chip rules are view-agnostic).
 * Post-analysis Standard: compound winner + risk sentence, 2 coaching chips,
 *   popover with stability % + tier + progress bar.
 * Post-analysis Detailed: same as Standard PLUS stability line in body.
 *
 * Resting state: when NEITHER branch would put a child on screen, the body
 *   states what is absent from this node and — where an authoring act would
 *   answer that absence — offers to ask Olumi for it. Never a sentence about
 *   the analysis. See `bodyHasContent` and `DECISION_RESTING_COPY`.
 */
import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { typography } from '../../styles/typography'
import { METRIC_NOUN } from './shared/metricVocabulary'
import { NodeChip, NodeMetricRow, NodePopover } from './shared'
import { isGoalDefined } from '../../utils/isGoalDefined'
import { cleanFactorLabel } from '../utils/labelUtils'
import { biasSignal } from '../shared/biasSignalTitles'
import { aggregateEdgeSignedStrength, compareEdgeValueAggregates } from '../domain/edgeValueProvenance'
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../../lib/decisionVerdict'
import { licensesComparativeLeaderClaim, useAnalysisAdmission } from '../hooks/useAnalysisReady'
import { openNodeInspector } from './shared/openNodeInspector'
import { leaderRobustnessGrade } from './shared/leaderRobustnessGrade'
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

/** Truncate text at word boundary. */
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '\u2026'
}

// ---- Model readiness helpers ----

interface ModelReadiness {
  // breakdown consumed by the pre-analysis popover and triage line
  explicitCount: number
  inferredCount: number
  missingCount: number
  externalCount: number
  biasTriggers: string[]
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

  // ---- Post-analysis: winner headline ----
  //
  // ROADMAP 1.223: "{X} leads in N% of scenarios" is a comparative leader
  // claim, so it quotes `deriveDecisionVerdict` — the one module entitled to
  // say a leading option exists — exactly as the sibling `OptionNode` badge
  // already does. It previously read `robustness.recommended_option_id`
  // directly, which answers only "WHO leads?" and never "is there a leader at
  // all", so on a withheld turn the canvas printed this sentence four inches
  // from CEE's own "no option can be put forward yet", and directly above an
  // `OptionNode` that had correctly withheld its "Leading option" badge.
  // Q1 OF TWO — THE MODEL'S LICENCE (`permitted_analysis_mode`). "{X} leads in
  // N% of scenarios" is the most explicit comparative-leader claim on the
  // canvas, and until now it asked only Q2. The results panel has composed both
  // since ROADMAP 1.267; this node asked half the question, so a model CEE
  // admitted at `exploratory` printed the sentence beside a panel withholding
  // every designation for the same run. Imported from the one reader of Q1,
  // never re-spelled locally.
  const modelLicensesComparativeClaim = licensesComparativeLeaderClaim(useAnalysisAdmission())

  const headline = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    // Absence of the admission means an older producer and is `true`, so this
    // is exactly today's behaviour until CEE speaks. The opposite arm from Q2
    // below, deliberately: never fold either into the other's default.
    if (!modelLicensesComparativeClaim) return null
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    const verdict = deriveDecisionVerdict(report as DecisionVerdictReportLike | null, {
      visibleOptionIds: new Set(optionNodes.map(n => n.id)),
    })
    // No owned leader claim ⇒ no sentence. Silence, not a substitute claim:
    // the node's stability line and triage chips keep their own voices, and
    // the win probabilities remain readable on the option nodes themselves.
    if (!verdict.hasLeadingOption) return null
    const recommendedId = verdict.leaderId
    if (!recommendedId) return null

    const winnerNode = nodes.find(n => n.id === recommendedId)
    const winnerLabel = (winnerNode?.data?.label as string | undefined) ?? null
    if (!winnerLabel) return null

    const optionProbs = (report as any)?.option_probabilities ?? {}
    const winProb = optionProbs[recommendedId]?.win_probability as number | undefined

    return { winnerLabel, winProb }
  }, [isPostAnalysis, modelLicensesComparativeClaim, report, nodes])

  // Biggest risk: risk node with highest bridge edge weight to goal
  const biggestRisk = useMemo(() => {
    if (!isPostAnalysis) return null
    const goalNode = nodes.find(n => n.type === 'goal' || n.data?.type === 'goal')
    if (!goalNode) return null

    const riskNodes = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk')
    let best: { nodeId: string; label: string; weight: number } | null = null

    for (const risk of riskNodes) {
      const edge = edges.find(e => e.source === risk.id && e.target === goalNode.id)
      if (!edge) continue
      const weight = (edge.data as any)?.weight as number | undefined
      if (weight != null && (best === null || weight > best.weight)) {
        best = {
          nodeId: risk.id,
          label: (risk.data?.label as string) ?? '',
          weight,
        }
      }
    }
    return best
  }, [isPostAnalysis, nodes, edges])

  const handleRiskClick = useCallback(() => {
    if (!biggestRisk) return
    const store = useCanvasStore.getState()
    store.setHighlightedNodes([biggestRisk.nodeId])
    openNodeInspector(biggestRisk.nodeId)
    setTimeout(() => store.setHighlightedNodes([]), 3000)
  }, [biggestRisk])

  const truncatedRiskLabel = biggestRisk
    ? (biggestRisk.label.length > 22 ? `${biggestRisk.label.slice(0, 22)}...` : biggestRisk.label)
    : null

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
      <NodeChip chipId="decision_challenge_result" actionType="what_would_flip" label="Challenge this result" message="What assumptions would need to change for a different option to be most likely to hit my goal?" />
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
  const showHeadline = Boolean(headline)
  /**
   * AXIS 2 for the leader sentence. Same shared owner the option card reads —
   * never re-spelled here, because two local expressions of one question is
   * exactly how the canvas ended up with three robustness vocabularies already
   * (this node's own `stabilityDisplay` thresholds, GoalNode's inline read, and
   * the shared classifier). A DISCLOSURE only: `headline` above is untouched.
   */
  const robustnessGrade = useMemo(
    () => (isPostAnalysis ? leaderRobustnessGrade(report) : null),
    [isPostAnalysis, report],
  )
  const showStabilityLine = isDetailed && Boolean(stabilityDisplay)
  // ⚠ POST-ANALYSIS CHIPS STAY DETAILED-ONLY, and that is a boundary, not an
  // oversight. "Challenge this result" deserves the same treatment as the
  // pre-analysis pair below and I tried it — but the post-analysis Standard
  // body is the exact surface another lane's HONEST RESTING STATE occupies
  // (`DecisionNode.restingState.spec.tsx`), and filling it with chips suppresses
  // that copy: four of their tests go red. Two lanes, one surface, and their
  // design has a measured defect behind it. Left alone pending a decision that
  // covers both.
  const showPostAnalysisChips = isDetailed
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

  const bodyHasContent = isPostAnalysisBranch
    ? (showHeadline || showStabilityLine || showPostAnalysisChips)
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

  /**
   * ⭐ WHAT THE ANCHOR OF THE MODEL SAYS WHEN IT IS TOO SMALL TO SAY ANYTHING
   * ELSE — and it had NOTHING, which is the defect Paul reported twice.
   *
   * `shared/lodMetricLine.ts` deliberately scoped `decision` out: it has no
   * single headline QUANTITY, so a central resolver reading `data` could not
   * find one. That reasoning was correct and the conclusion was wrong, because
   * it left THE MOST IMPORTANT CARD ON THE CANVAS as an empty box below the
   * legibility floor — measured on deployed `7d717c13`, where this node's body
   * holds a perfectly good sentence ("Segment leads in 48% of scenarios…")
   * rendered `visibility: hidden` with nothing put back in its place. Every
   * other type got a line and the anchor got none.
   *
   * ⛔ IT NAMES A LEADER ONLY WHERE THE CARD IS ALREADY ENTITLED TO. This reads
   * `headline`, which is the SAME permission the full-zoom body consumes — so
   * a run whose verdict withholds a leader has `headline === null` here and
   * this says nothing about the analysis at all. It does not re-derive the
   * permission, and it must never be changed into something that does: the
   * leader-claim seam is exactly where this product has shipped a withheld
   * verdict and a named leader two pixels apart before (trap 21).
   *
   * Where no leader may be named it falls back to the RESTING line — a
   * statement about what is absent from this node, never about the analysis.
   *
   * ⭐⭐ AND ONE OF THOSE RESTING LINES WAS THE SAME SENTENCE ON EVERY MODEL —
   * measured in a real browser, all five committed starter drafts, both
   * 1280x800 and 1440x900 (`e2e/geometry/zoomLadder.measure.ts`, 1 Sep 2026).
   * At the zoom "Show whole model" parks at, the anchor card's one line read
   * `Nothing to show on this node` — 10 of 10 readings, identical.
   *
   * That is Paul's canvas-density ruling (31 Aug) failing in its purest form:
   * *copy identical on every card is furniture, not information*. Here it is
   * worse than furniture. A blank card is at least ambiguous; a sentence saying
   * the anchor of the model has nothing on it is the product volunteering that
   * its most important card is empty — while that same card is wired to three
   * or four options and knows it.
   *
   * ⛔ THE REPLACEMENT IS A COUNT THE CARD ALREADY HOLDS, NOT A NEW NUMBER.
   * `optionCount` is the SAME memo the `noOptionsLine` arm above branches on
   * and the same one the pre-analysis ask sentence spells at line 373 — one
   * authority, deduped by node id, and explicitly NOT a count of edges (see its
   * own header: two edges to one option are a modelling defect the health check
   * reports, not two options). So this cannot state a different number from the
   * card two pixels away, which is exactly the trap `shared/lodMetricLine.ts`
   * refused a central `decision` arm to avoid.
   *
   * ⚠ IT VARIES, WHICH IS THE WHOLE POINT: 4 on `build-vs-buy`, 3 on
   * `market-entry`. And it is reachable only where `optionCount > 0`, because
   * `optionCount === 0` is caught by the `noOptionsLine` arm above and keeps
   * its CTA — the count is asserted here rather than assumed, so a future
   * reordering of those arms cannot silently produce `0 options` on a card
   * whose job is to say "Add options".
   */
  const lodMetric = useMemo<string | null>(() => {
    if (headline?.winnerLabel) {
      const pct = headline.winProb != null ? ` ${Math.round(headline.winProb * 100)}%` : ''
      return `${headline.winnerLabel}${pct}`
    }
    if (resting.line === DECISION_RESTING_COPY.emptyLine && optionCount > 0) {
      return `${optionCount} option${optionCount === 1 ? '' : 's'}`
    }
    return resting.line
  }, [headline, resting, optionCount])

  const restingState = (
    <div className="mt-1" data-testid="decision-node-resting-state">
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
            {/* The leader sentence — and ONLY this — is gated on the producer's
                owned claim. */}
            {showHeadline && headline && (
              <div
                className={`${typography.nodeLabel} text-text-body`}
              >
                {headline.winnerLabel} leads in {headline.winProb != null ? `${Math.round(headline.winProb * 100)}%` : ''} of scenarios{biggestRisk && biggestRisk.label ? (
                  <>
                    , but sensitive to{' '}
                    <button
                      type="button"
                      className={`${typography.nodeLabel} text-info underline cursor-pointer nodrag nopan`}
                      onClick={handleRiskClick}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {truncatedRiskLabel}
                    </button>
                  </>
                ) : null}
              </div>
            )}
            {/* AXIS 2, ON THE STRONGEST SENTENCE THE CANVAS SPEAKS.
                "{X} leads in N% of scenarios" renders in Standard AND Detailed,
                while this node's existing stability line is `isDetailed`-gated
                (see `showStabilityLine`) — i.e. behind a hover popover in the
                Standard view the founder was in. So the claim was always-on and
                its caveat was not. Gated on `showHeadline && headline` so the
                disclosure cannot appear without the sentence it qualifies. */}
            {showHeadline && headline && robustnessGrade && (
              <div
                className={`${typography.edgeLabel} text-text-light mt-0.5`}
                data-testid="decision-leader-robustness"
                title={robustnessGrade.title}
              >
                {robustnessGrade.label}: small changes could flip which option leads.
              </div>
            )}

            {/* ⭐ THE SAME BAR EVERY OTHER CARD ALREADY HAS, ON THE NUMBER THAT
                MATTERS MOST. Measured on deployed staging `d4ff3683`: factor,
                risk, outcome and option cards all render `noun ▬▬▬ NN%`, and
                this one — the anchor of the model — rendered its percentage as
                bare prose. The most consequential figure on the canvas was the
                least visually encoded one.

                ⛔ IT READS `headline`, THE SAME PERMISSION THE SENTENCE ABOVE
                CONSUMES, AND IT MUST NEVER BE CHANGED INTO SOMETHING THAT
                RE-DERIVES IT. `option_probabilities[leader].win_probability` is
                present on withheld runs too — the fixture pair proves it — so a
                bar gated on the NUMBER rather than on the CLAIM would state a
                leader the producer refused to designate, in a channel nobody
                was watching. That is trap 21's seam exactly: this product has
                shipped a withheld verdict and a named leader two pixels apart
                before.

                ⚠ `bg-option` DELIBERATELY, not a decision hue. This is the same
                field, for the same option, that the winning OptionNode renders
                as `Ahead 47%` — so the two bars are the same quantity on the
                same scale and a reader is entitled to compare them by eye. A
                different fill would imply a different measure.

                ⚠ NO `phrase`. Every span in the row is `aria-hidden`, and that
                is correct here: the sentence directly above already states
                "{X} leads in N% of scenarios" to assistive tech. A phrase would
                make a screen reader say the same claim twice. The row is a
                VISUAL encoding of a sentence that stays where it was — nothing
                moved out of visible text, so the eight-surface leader-claim
                corpus keeps biting on the copy it was written against. */}
            {showHeadline && headline && headline.winProb != null && (
              <NodeMetricRow
                label={METRIC_NOUN.ahead}
                value={headline.winProb}
                formatted={`${Math.round(headline.winProb * 100)}%`}
                fillClass="bg-option"
                testId="decision-leader-metric-row"
              />
            )}

            {/* Post-analysis Detailed only: stability + chips inline in body
                (Detailed has no popover). Standard surfaces both via the
                popover below. */}
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
            {!bodyHasContent && restingState}
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
            {!bodyHasContent && restingState}
          </>
        ) : (
          /* Neither branch applies — most often a decision with no option
             linked, which is the shape measured on `2db13473`. This arm used
             to be a literal `null`, i.e. the empty box itself. */
          restingState
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
            {readiness.explicitCount > 0 && <div>Explicit: {readiness.explicitCount}</div>}
            {readiness.inferredCount > 0 && <div>Estimated: {readiness.inferredCount}</div>}
            {readiness.missingCount > 0 && <div className="text-danger">Missing: {readiness.missingCount}</div>}
            {readiness.externalCount > 0 && <div>External: {readiness.externalCount}</div>}
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
          {postAnalysisCoachingChips}
        </NodePopover>
      )}
    </div>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode

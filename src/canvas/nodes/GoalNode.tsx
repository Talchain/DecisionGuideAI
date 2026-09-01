/**
 * Goal node component — v3 wireframe
 *
 * Layer 1 (always visible):
 *  - No threshold (either phase): one compact "No target set" status chip that
 *    opens this node's inspector. R5/L-47: no instructional prose, no full
 *    buttons on the node.
 *  - With threshold: `GOAL_TARGET_PREFIX` + value ("Target: 15%") + provenance
 *    icon. The SAME string is this card's reduced line below the legibility
 *    floor — see `targetLine`, which is the only place it is built.
 *  - Post-analysis with threshold: achievement probability (danger if <10%), actionable guidance
 *  - No risks chip (always)
 *
 * Layer 2 (popover in Standard / inline in Detailed):
 *  - Stability bar + percentage
 *  - Constraint badges (if any)
 *  - Chips: "Why is this so low?", "Is my target realistic?"
 *
 * No ExpertOverlay. No MetricPills.
 */
import { memo, useMemo } from 'react'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
  goalLabelIsUnconfirmedBriefExtract,
} from '../domain/goalLabelProvenance'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { formatGoalTarget } from '../../components/results/utils/formatGoalTarget'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { GOAL_ANCHOR_COPY } from '../../components/results/utils/goalAnchorCopy'
import { basisWithholdsPossessive } from '../../components/results/utils/selectGoalProbability'
import { readInferenceWarnings } from '../../components/results/utils/readInferenceWarnings'
import { DataBar, type DataBarColour } from '../ui/shared/DataBar'
import { getStabilityClassification } from '../../lib/stability'
import { NodeChip, NodeMetricRow, NodePopover, ScienceIcon } from './shared'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { openNodeInspector } from './shared/openNodeInspector'
import { useHasAnyRealProbability } from '../ui/inspector-v2/useAnalysisResults'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { formatGoalProbability } from '../../components/results/utils/displayFloors'

/**
 * ⭐ THE TWO STRINGS THIS CARD USES TO STATE ITS TARGET, DECLARED ONCE.
 *
 * Both are rendered at FULL ZOOM (the body line and the no-target chip) and
 * both are re-used verbatim as the card's reduced line below the legibility
 * floor. They are module constants rather than inline literals for one reason:
 * a low-zoom line that is a second hand-written copy of a full-zoom string will
 * drift, and it already did — the colon was dropped in the copy, so one goal
 * read `Target: 15%` and `Target 15%` one zoom step apart, with the
 * contradicting body hidden.
 */
const GOAL_TARGET_PREFIX = 'Target:'
const GOAL_NO_TARGET_LINE = 'No target set'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  const report = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  // C-1: restored — this is what tells a finished-but-empty run apart from a
  // run that simply has no target yet.
  const hasAnyProbability = useHasAnyRealProbability()
  const isDetailed = viewMode === 'expert'
  // Phase 2.3 — null-probability guard. Post-analysis without any finite
  // per-option win_probability means the engine finished but produced no
  // probability. We must not render "Analysis complete" copy in that case.
  // F5a (Codex review): the rerun prompt must be driven by the ACTUAL freshness
  // state — the same composed trust surface AnalysisFreshnessNotice reads — never
  // by value absence. A completed CURRENT run can legitimately carry no goal
  // probability (producer returned none), and demanding a rerun then contradicts
  // the panel's "Analysis reflects the current model". Only a genuinely
  // changed/stale model ('changed' semantic) warrants "Rerun the analysis".
  const analysisChanged = useAnalysisTrust().semantic === 'changed'
  // Audit §8 P1: canvas result decorations mirror the panels' freshness
  // verdict (opacity + title only — no layout shift).

  const robustnessData = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    if (!robustness) return null
    const stability: number | null = typeof (robustness.recommendation_stability ?? robustness.recommendationStability) === 'number'
      ? (robustness.recommendation_stability ?? robustness.recommendationStability) : null
    const level: string | null = robustness.level ?? robustness.robustness_level ?? null
    return { stability, level }
  }, [report, isPostAnalysis])

  // ROADMAP 1.1 fix (6b-goal-capture evidence, finding b): the pre-analysis-v3
  // Hero's Success-target field commits via setGoalThresholdAndUpdateNode,
  // which writes `success_threshold` + `threshold_source: 'user'` onto the
  // goal node's data (see computeSuccessState.ts, the Hero's own selector,
  // which already treats this as the highest-priority "is set" signal). This
  // node's badge previously checked `goal_threshold_raw` ONLY — a CEE-backfilled
  // field (applyDraftResult.ts) that a Hero-only commit never populates — so
  // the canvas badge kept reading "no target" even after the Hero (or a
  // reconciled CEE round-trip) set one. Mirror computeSuccessState's priority:
  // a user-set success_threshold counts as "set" first; fall back to the
  // CEE-derived goal_threshold_raw.
  const userThreshold = props.data?.threshold_source === 'user'
    ? (props.data?.success_threshold as number | null | undefined)
    : undefined
  const ceeThresholdRaw = props.data?.goal_threshold_raw as string | number | null | undefined
  const thresholdRaw = userThreshold != null ? userThreshold : ceeThresholdRaw
  const thresholdUnit = props.data?.goal_threshold_unit as string | undefined
  const hasThreshold = thresholdRaw != null && String(thresholdRaw).trim() !== ''

  const stabilityClassification = useMemo(() =>
    getStabilityClassification(robustnessData?.stability),
    [robustnessData?.stability]
  )
  const stabilityBarColour = useMemo((): DataBarColour => {
    const level = robustnessData?.level ?? stabilityClassification?.level
    switch (level) {
      case 'high': return 'success'
      case 'moderate': return 'goal'
      case 'low': case 'very_low': return 'warning'
      default: return 'goal'
    }
  }, [robustnessData, stabilityClassification])

  const stabilityValue = robustnessData?.stability ?? displayMetadata.stabilityPercentage

  const preAnalysisConstraints = useCanvasStore(state => state.goalConstraints)
  const postAnalysisConstraints = useCanvasStore(state =>
    (state.results?.report as any)?.goal_constraints as Array<CEEGoalConstraint & { probability?: number }> | null | undefined
  )
  const activeConstraints: Array<CEEGoalConstraint & { probability?: number }> | null =
    isPostAnalysis ? (postAnalysisConstraints ?? preAnalysisConstraints) : preAnalysisConstraints

  const hasConstraintDefaultWarning = useMemo(() => {
    if (!isPostAnalysis || !report) return false
    // R-6: the ONE dual-slot reader (root first, then the legacy `robustness`
    // nesting). This was a fourth private copy of that fallback, in its own cast
    // style; the shared reader carries the 773-fact measurement showing the
    // legacy slot is 0/773, which is why reading only one slot renders
    // permanently empty with nothing red.
    const warnings = readInferenceWarnings(report as never)
    if (!Array.isArray(warnings)) return false
    return warnings.some((w: any) => w.code === 'CONSTRAINT_NODE_DEFAULT_BASE')
  }, [report, isPostAnalysis])

  // THE POSSESSIVE GATE (ROADMAP 2.283) — the last live un-gated possessive
  // surface in the estate.
  //
  // `basis === 'joint_goal_substituted'` means this number is P(all
  // constraints jointly satisfied) STANDING IN for an absent
  // `probability_of_goal`. "chance of reaching target" then names a question
  // the number does not answer — witnessed on staging as a ~100x
  // understatement rendered in the possessive voice (#556). Six sibling
  // surfaces already withhold the possessive in this state; this node could
  // not, because `useNodeDisplayMetadata` read the basis and discarded it.
  // 2.283 forwards it; this is the consumer.
  //
  // ⚠ SCOPED TO `joint_goal_substituted`, NEVER to "the figure is joint".
  // `joint_goal_constrained` is the user's own goal AND their own limits —
  // the possessive is EARNED there and is untouched (the ROADMAP 1.49 case).
  // The expression is byte-identical to `OptionNode`'s, deliberately.
  // ⭐ L62 (2026-08-04) — THIS IS NOW ALWAYS FALSE, AND THAT IS THE POINT.
  // `selectGoalProbability` no longer substitutes the joint figure into the
  // goal-fit slot at all: on that basis (`'joint_goal_withheld'`) it returns NO
  // number, so this surface renders nothing to re-voice. The bases that still
  // carry a number — `'goal_probability'` and `'joint_goal_constrained'` —
  // both EARN the possessive. The narrowing goes through the owner's exported
  // `basisWithholdsPossessive` so the four canvas/summary surfaces share ONE
  // rule instead of four copies of a literal.
  const goalFitSubstituted =
    displayMetadata.achievementProbability !== null &&
    basisWithholdsPossessive(displayMetadata.achievementProbabilityBasis)
  // The readout, built ONCE above both arms so the withheld and permitted
  // wordings can never show different numbers for the same run.
  //
  // ⭐ ROADMAP 2.333 — THE EXACT-ZERO DIVERGENCE, CLOSED.
  // This was the node's own literal, and its sub-1% predicate carried a
  // `> 0 &&` carve-out the dock surfaces do not have. The consequence was
  // narrow and live: for an EXACT zero the carve-out fell through to
  // `Math.round(0 * 100)`, so the canvas node said "0% chance of reaching
  // target" while the option card beside it said "< 1%" about the same
  // number. `displayFloors.ts` carried a standing correction recording this
  // as the open, opposite convention.
  //
  // It now calls the goal register's shared formatter, so the canvas and the
  // dock state one thing. Non-zero sub-1% values are unaffected — they read
  // "< 1%" here exactly as they always did.
  //
  // No sample count is passed: `useNodeDisplayMetadata` carries the
  // probability and its basis, not `n_valid_samples`, so this surface takes
  // the floored fallback arm. That is the honest option — threading a count
  // this hook does not hold would mean inventing one.
  const achievementReadout =
    displayMetadata.achievementProbability === null
      ? null
      : formatGoalProbability(displayMetadata.achievementProbability)

  /**
   * ⭐ ONE GATE FOR THE ACHIEVEMENT FIGURE, NAMED ONCE.
   *
   * The same three-term expression was written out THREE times below — once
   * for the readout, once for the modelled-basis caveat, once for the
   * low-probability guidance — and the metric row would have made it four.
   * Four hand-kept copies of the permission that decides whether this card
   * states a probability at all is precisely the mirror this estate keeps
   * paying for (CLAUDE.md trap 12), and the drift it produces is the worst
   * kind available here: a number rendered by one copy while the disclosure
   * that makes it honest is withheld by another.
   *
   * ⚠ UI-SEM-082 IS THE REASON FOR `hasThreshold`, and it is not incidental.
   * The producer synthesises an auto goal threshold and returns a probability
   * even when the USER set no target, so gating on value presence alone would
   * crown a target nobody chose.
   */
  const showAchievementReadout =
    hasThreshold &&
    displayMetadata.isResultsMode &&
    displayMetadata.achievementProbability !== null

  /**
   * The critical-probability predicate, also named once. It was written out
   * three times — the danger colour, the coaching chip's gate, and the
   * "Target may be ambitious" guidance — each carrying its own null check. The
   * `< 0.10` threshold is the card's own editorial line and there is no reason
   * for three copies of it to be able to disagree about where it sits.
   */
  const achievementIsCritical =
    displayMetadata.achievementProbability !== null &&
    displayMetadata.achievementProbability < 0.10

  /**
   * Border: DASHED for "not finished yet", COLOUR for "something is wrong".
   *
   * ⭐ NO TARGET IS NOT AN ALARM (31 Aug 2026). This returned
   * `border-warning border-dashed`, so a goal with no success target rendered
   * in the product's warning colour -- on the most important node on the
   * canvas, in the state EVERY model is in before the user sets one.
   *
   * That contradicts the ruling this state already has, written into
   * `results/utils/goalAnchorCopy.ts` beside the `noTarget` copy: *"it NEVER
   * blocks. This is an invitation with a route, not a wall."* The sentence
   * obeyed it; the border did not, and the border is what a user reads first.
   *
   * The dash stays -- it is the shared idiom on this node for "incomplete or
   * provisional", and it is what distinguishes an unset target from a set one.
   * Only the alarm colour goes. The two genuinely diagnostic states below keep
   * their colours, because those ARE claims about the analysis: `moderate` and
   * `low` robustness are the producer's own verdicts, not a gap in the user's
   * input.
   */
  const goalBorderOverride = useMemo(() => {
    if (!hasThreshold) return 'border-panel-border border-dashed'
    if (!robustnessData) return undefined
    switch (robustnessData.level) {
      case 'moderate': return 'border-info border-dashed'
      case 'low': return 'border-danger border-dashed'
      default: return undefined
    }
  }, [hasThreshold, robustnessData])

  // Format threshold display.
  //
  // ROADMAP 2.315(c): the unit-string → unit-kind mapping that used to live
  // inline here now lives in `formatGoalTarget`, unchanged in behaviour. It was
  // moved because Inspector v2's GoalPanel needed the SAME mapping and had none
  // (it interpolated the number bare with the unit as a suffix — "800000 £"),
  // and the staging walk saw the two surfaces print different strings for one
  // goal. Sharing the mapping makes agreement structural rather than a
  // convention someone has to remember (CLAUDE.md #12). Percent rounding,
  // 'count' suppression and currency prefixing are all as they were; the only
  // behavioural difference is that a unit is now TRIMMED before classification,
  // the same direction the U2 fix took when it retired this site's local
  // `'%' | 'percent' | 'percentage'` copy.
  const thresholdDisplay = useMemo(() => {
    if (!hasThreshold) return null
    const raw = typeof thresholdRaw === 'number' ? thresholdRaw : Number(thresholdRaw)
    if (Number.isNaN(raw)) return String(thresholdRaw)
    return formatGoalTarget(raw, thresholdUnit) ?? String(thresholdRaw)
  }, [hasThreshold, thresholdRaw, thresholdUnit])

  /**
   * ⭐⭐ ONE OWNER FOR WHAT THIS CARD SAYS ABOUT ITS TARGET — AT EVERY ZOOM.
   *
   * ⚠ THIS EXISTS BECAUSE THE TWO SITES HAD ALREADY DIVERGED, BY ONE CHARACTER.
   * The full-zoom body rendered `Target: 15%` and the reduced line, added
   * beside it a day later, rendered `Target 15%`. Same card, same datum, one
   * zoom step apart — and the file's own docblock documented the colon form, so
   * all three disagreed. Nothing could catch it, because the low-zoom line was
   * a SECOND HAND-WRITTEN COPY of the first: the strings were only ever equal
   * by someone remembering to keep them equal (CLAUDE.md trap 12).
   *
   * ⛔ SO THE RULE IS MADE STRUCTURAL RATHER THAN RESTATED: the reduced line is
   * DERIVED FROM WHAT THIS CARD RENDERS AT FULL ZOOM, never hand-copied beside
   * it. `targetLine` below is the ONLY place the phrase is built; the full-zoom
   * body renders it and `lodMetric` passes it down. A future edit to the
   * wording changes both or neither, and `GoalNode.lodTargetLine.spec.tsx`
   * pins the low-zoom line AGAINST THE FULL-ZOOM RENDER rather than against a
   * literal, so a re-divergence cannot pass by editing one string.
   *
   * ⚠ THE TARGET, NOT AN ACHIEVEMENT PROBABILITY. A goal's probability figures
   * carry mandatory adjacent disclosures (`GOAL_FIT_BASIS_CAVEAT_COPY`,
   * possessive withholding) that cannot ride one line, and a number stripped of
   * the caveat that makes it honest is not made safe by shrinking the type —
   * the same rule `shared/lodMetricLine.ts` applies to an outcome. The
   * THRESHOLD is the user's own stated target: it needs no caveat, because it
   * is not a claim about the world, and it is the thing a reader most wants
   * from this card at a glance.
   */
  const targetLine = thresholdDisplay != null ? `${GOAL_TARGET_PREFIX} ${thresholdDisplay}` : null

  /**
   * ⭐ AND THE NO-TARGET CASE IS THE POINT, NOT AN AFTERTHOUGHT. A goal with no
   * target is the state EVERY model is in before somebody sets one — the single
   * most common goal card there is, and below the floor it was an EMPTY BOX,
   * which is indistinguishable from a broken render. It now says the card's own
   * words: `GOAL_NO_TARGET_LINE` is the same constant the full-zoom chip
   * renders, so this states an ABSENCE and can never be mistaken for a value.
   */
  const lodMetric = targetLine ?? GOAL_NO_TARGET_LINE


  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'goal')

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Whether to show Layer 2 inline (Detailed view)
  const showLayer2Inline = isDetailed

  // Layer 2 content exists when there's anything to show (stability,
  // constraints, warning) OR when post-analysis chips need a home (every
  // post-analysis goal with a threshold gets at least the "Is my target
  // realistic?" coaching chip).
  const hasLayer2 = (
    stabilityValue !== null ||
    (activeConstraints && activeConstraints.length > 0) ||
    hasConstraintDefaultWarning ||
    (hasThreshold && isPostAnalysis)
  )

  // Popover trigger: only for goals with threshold, post-analysis
  const showPopoverTrigger = hasThreshold && isPostAnalysis && hasLayer2

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = hasLayer2 ? (
    <>
      {/* Stability bar — stale-dimmed when the model changed since the run */}
      {stabilityValue !== null && (
        <div
          className={`mb-1`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`${typography.edgeLabel} text-text-light`}>Decision stability</span>
            <span className={`${typography.edgeLabel} text-text-body`}>{Math.round(stabilityValue * 100)}%</span>
            {(stabilityClassification?.level === 'low' || stabilityClassification?.level === 'very_low') && (
              <span className={`${typography.edgeLabel} bg-panel border border-warning/30 text-text-body rounded-full px-1 py-0`}>
                Marginal
              </span>
            )}
          </div>
          <DataBar value={stabilityValue} label="Stability" colour={stabilityBarColour} size="standard" />
        </div>
      )}

      {/* Constraint badges */}
      {activeConstraints && activeConstraints.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {activeConstraints.map((c, i) => {
            const prob = typeof c.probability === 'number' ? c.probability : null
            const colourClass = prob === null ? 'border-info/30 text-text-body'
              : prob >= 0.7 ? 'border-success/40 text-success'
              : prob >= 0.4 ? 'border-warning/40 text-warning'
              : 'border-danger/40 text-danger'
            const badgeAriaLabel = `Constraint: ${c.operator} ${c.label}${prob !== null ? `, ${Math.round(prob * 100)}% probability` : ''}`
            return (
              <div key={c.id ?? i} className={`flex items-center justify-between gap-1 px-1.5 py-0.5 bg-panel border rounded-full ${colourClass}`} aria-label={badgeAriaLabel}>
                <span className={`${typography.edgeLabel} truncate`}>{c.operator} {c.label}</span>
                {prob !== null && <span className={`${typography.edgeLabel} font-mono shrink-0`}>{Math.round(prob * 100)}%</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Constraint default warning */}
      {hasConstraintDefaultWarning && (
        <p className={`${typography.edgeLabel} text-warning m-0 mt-0.5`}>
          Some model inputs missing. Goal probability may be less reliable.
        </p>
      )}

      {/* Coaching chips — moved out of body. "Why is this so low?" only
          fires when the achievement probability is critically low; "Is my
          target realistic?" applies to every post-analysis goal with a
          threshold. */}
      {hasThreshold && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {achievementIsCritical && (
            <NodeChip chipId="goal_why_so_low" actionType="explain_results" label="Why is this so low?" message="Why is the probability of reaching my goal target so low? What are the main drivers?" />
          )}
          <NodeChip chipId="goal_target_realistic" actionType={null} label="Is my target realistic?" message="Is my current goal target realistic given the factors in my model? What would be a more achievable target?" />
        </div>
      )}
    </>
  ) : null

  // R5 + L-47 (Paul, 16 Aug 2026): "Full buttons/instructional text on nodes:
  // no." The goal node used to carry a two-sentence instruction plus a
  // "Help me set a target" chip — a billboard on the canvas. Both no-target
  // branches now render one compact status chip that OPENS THIS NODE'S
  // INSPECTOR, where setting a target actually happens. The explanation moves
  // to the chip's tooltip and to the inspector; the canvas keeps the signal.
  //
  // A <button>, not a chip-shaped div: click, tap, Tab and Enter/Space all
  // work with no key handling of our own (hover/click/keyboard parity, ruled).
  // C-1: the chip has to carry TWO distinguishable states, because the copy it
  // replaced did. The old post-analysis branch had a second sentence for the
  // null-probability case ("Analysis finished. Set a target and check the graph
  // for incomplete inputs") — a real diagnostic, and it lost its home when the
  // prose came out. A missing target before a run and a run that finished
  // WITHOUT producing any probability are different situations with different
  // next actions, so they get different tooltips and different accessible
  // names. The visible chip text stays one short phrase either way: the point
  // of R5 is that the node signals, and the detail lives one hover away.
  const noTargetDiagnostic = isPostAnalysis && !hasAnyProbability
  const noTargetStatusChip = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openNodeInspector(props.id) }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`nodrag mt-1 inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 ${typography.edgeLabel} text-text-body hover:bg-warning/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      aria-label={
        noTargetDiagnostic
          ? "No target set, and this run produced no probability — open this goal's details"
          : "No target set — open this goal's details to set one"
      }
      title={
        noTargetDiagnostic
          ? 'The analysis finished without producing a probability. Set a measurable target, and check the model for inputs that are still incomplete.'
          : 'Add a measurable success target, e.g. metric, threshold or deadline'
      }
      data-testid="goal-node-no-target-chip"
      data-diagnostic={noTargetDiagnostic ? 'no-probability' : undefined}
    >
      {GOAL_NO_TARGET_LINE}
    </button>
  )

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      <BaseNode
        {...props}
        nodeType="goal"
        lodMetric={lodMetric}
        icon={metadata.icon}
        borderClassOverride={goalBorderOverride ?? undefined}
        headerSlot={scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* ⭐ The label is the user's own sentence, lifted from the brief —
            CEE's objective derivation refused, so the canvas is showing a
            stated FACT where a goal belongs. A MARKER, not a second
            affordance: per L-47 the canvas signals and the detail lives one
            hover away, and the single place to act is the Analysis tab's Goal
            field. Editing there stamps `user_set` and this disappears. */}
        {goalLabelIsUnconfirmedBriefExtract(
          props.data as { provenance?: unknown } | undefined,
        ) && (
          <span
            data-testid={GOAL_LABEL_FROM_BRIEF_TESTID}
            title={GOAL_LABEL_FROM_BRIEF_COPY.notice}
            className={`mt-1 inline-flex items-center rounded-full border border-info/40 bg-info/10 px-1.5 py-0.5 ${typography.edgeLabel} text-text-light`}
          >
            {GOAL_LABEL_FROM_BRIEF_COPY.pill}
          </span>
        )}

        {/* No target, post-analysis: analysis done but no threshold to evaluate.
            Null-probability guard swaps the copy when the run produced no
            finite win_probability (BoundaryError / null probs / stale state). */}
        {!hasThreshold && isPostAnalysis && noTargetStatusChip}

        {/* No target, pre-analysis: the "goal gap". Surface the missing target
            clearly (Paul-authored copy — brief primary + A1 secondary), then keep
            the existing coaching chip. */}
        {!hasThreshold && !isPostAnalysis && noTargetStatusChip}

        {/* With target: display it */}
        {targetLine !== null && (
          <div className={`${typography.nodeLabel} text-text-light mt-1`}>
            {targetLine}
          </div>
        )}

        {/* Audit §8 P1 goal-state matrix: target SET + analysis ran + no
            probability for it (target set after the run, or the run produced
            none). The old branches ignored this quadrant, leaving a card
            that showed a target with no path to a probability. No new CTA —
            the edit affordance and Run flows already exist elsewhere.
            F5a (Codex review): the copy is driven by the freshness/dirty state,
            not by value absence — a CURRENT run that simply produced no goal
            probability shows the honest absent-state copy (never a rerun demand
            that would contradict the panel's "reflects the current model"); only
            a genuinely changed model prompts a rerun. */}
        {/* ROADMAP 2.275: the third arm. Witnessed on staging `a27cadf7`
            (witness-2267 §6b/§11a) — this node asserted "This run did not
            produce a goal probability" while the Analysis→Goal-fit sub-tab
            rendered "< 1%" for all four options from the same report, both
            simultaneously visible at 1280×800.

            Both statements were individually defensible: no goal probability
            is attributable to the NODE (the run designates no leading option),
            yet per-option goal-fit figures genuinely exist. The defect was
            that the node spoke as though "goal probability" were one thing and
            flatly denied it. It now acknowledges the figures it can see and
            says where to read them — no number is invented here, and no option
            is designated. */}
        {hasThreshold && isPostAnalysis && displayMetadata.achievementProbability === null && (
          <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>
            {analysisChanged
              ? 'Target set. Rerun the analysis to update your results.'
              : displayMetadata.goalFitAvailable
                ? 'Target set. No overall goal probability for this run — see Goal fit for each option’s chance.'
                : 'Target set. This run did not produce a goal probability.'}
          </p>
        )}

        {/* Post-analysis: achievement probability.
            UI-SEM-082 (Lane 4, Paul ruled; extends UI-SEM-071 doctrine): gate on
            the target being SET (hasThreshold) — never on producer value presence
            alone. The producer synthesises an auto_goal_threshold and returns a
            goal_probability even when the USER set no target (UI-SEM-071 class),
            so without this gate the "N% chance of reaching target" line would
            crown a target the user never set AND co-render with the "Set a target
            to see how likely you are to reach it" invitation above. hasThreshold makes the two
            mutually exclusive by construction. */}
        {showAchievementReadout && (
          <div className={`${typography.nodeLabel} mt-1 ${
            achievementIsCritical ? 'text-danger' : 'text-text-body'
          }`}>
            {/* ROADMAP 2.283: the withheld arm is the shared register's PHRASE
                form verbatim — the same wording the results panel, the hero,
                the V7 goal lens and OptionNode render for this basis. The
                permitted arm is byte-identical to the string it replaced;
                migrating the healthy path off "reaching target" is a separate
                copy decision and is NOT smuggled in here. */}
            {goalFitSubstituted
              ? GOAL_ANCHOR_COPY.phrase(achievementReadout ?? '', goalFitSubstituted)
              : `${achievementReadout} chance of reaching target`}
            {hasConstraintDefaultWarning && (
              <span
                className={`${typography.edgeLabel} ml-1 bg-panel border border-factor/30 text-text-body rounded-full w-4 h-4 inline-flex items-center justify-center`}
                title="Some model inputs are missing. Goal probability may be less reliable."
              >
                ?
              </span>
            )}
          </div>
        )}

        {/* ⭐ THE SHARED METRIC ROW — the same `noun ▬▬▬ NN%` the factor, risk,
            outcome and option cards already render (measured on deployed
            staging `d4ff3683`: 12 of 14 cards had it, the goal and the decision
            did not). It carries NO new datum: `achievementProbability` is the
            producer figure the sentence directly above already states in words,
            through the one chooser entitled to pick it
            (`selectGoalProbability`). Nothing is computed here.

            ⛔ IT SITS INSIDE THE FIGURE BLOCK, ABOVE THE CAVEAT, ON PURPOSE.
            On a modelled basis this number may not be shown BARE, and the
            disclosure below is what makes it honest — which is exactly why the
            low-zoom line withholds the figure rather than shrinking it. Putting
            the bar between the sentence and its caveat keeps the disclosure
            adjacent to every rendering of the number, not just the prose one.
            A row placed after the caveat would leave a bar with nothing
            qualifying it.

            ⚠ THE NOUN IS NOT DECORATION (UI-SEM-089): an unlabelled percentage
            beside a goal reads as a computed CONTRIBUTION. `Chance` keeps the
            quantity named on the row itself.

            ⚠ NO `phrase`, and every span in the row is `aria-hidden` — correct,
            because the sentence above already says "N% chance of reaching
            target" to assistive tech. A phrase here would make a screen reader
            state the same figure twice. The row is a VISUAL encoding of copy
            that has not moved, so `GoalNode.possessiveGate`, the zero-floor
            specs and the parity suite all keep biting on the text they were
            written against.

            ⚠ AND THE POSSESSIVE GATE IS INHERITED, NOT RE-DERIVED. Where
            `selectGoalProbability` withholds (`joint_goal_withheld`) it returns
            no number at all, so `showAchievementReadout` is false and this row
            does not exist. It must never grow its own basis check. */}
        {showAchievementReadout && (
          <NodeMetricRow
            label="Chance"
            value={displayMetadata.achievementProbability}
            formatted={achievementReadout ?? ''}
            fillClass="bg-goal"
            testId="goal-achievement-metric-row"
          />
        )}

        {/* Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): the
            achievement-probability number above is scored from a MODELLED
            forward-propagated outcome distribution, not a directly-elicited
            base — same gate + shared wording as OptionCards' caveat
            (GOAL_FIT_BASIS_CAVEAT_COPY), rendered adjacent to the number it
            qualifies, never separately, never invented. */}
        {showAchievementReadout &&
          displayMetadata.achievementProbabilityIsModelledBasis === true && (
            <p
              className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}
              data-testid="goal-fit-basis-caveat-node"
            >
              {GOAL_FIT_BASIS_CAVEAT_COPY}
            </p>
          )}

        {/* Actionable guidance for low probability (UI-SEM-082: gated on
            hasThreshold too — no "Target may be ambitious" against an
            auto-threshold the user never set). */}
        {hasThreshold && isPostAnalysis && achievementIsCritical && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            Target may be ambitious.{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-danger underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                openNodeInspector(props.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Adjust target
            </button>
            {' '}or{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                useGuidanceStore.getState()._sendMessage?.('How can I strengthen the key factors to improve my chance of reaching the goal?')
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              strengthen key factors
            </button>
          </p>
        )}

        {/* Pre-analysis primary CTA: "Run analysis". This stays in the body
            because it's a primary action button rather than coaching — moving
            it to a hover popover would make it nearly undiscoverable for
            first-time users. */}
        {hasThreshold && !isPostAnalysis && (
          <div className="mt-1.5">
            <NodeChip chipId="goal_run_analysis" actionType="run_analysis" label="Run analysis" message="Run the analysis now" />
          </div>
        )}

        {/* Coaching chip "Is my target realistic?" moved to popover (Standard)
            / Detailed inline layer-2. See `layer2Content` above. */}

        {/* Layer 2: inline in Detailed view */}
        {showLayer2Inline && layer2Content}
      </BaseNode>

      {/* Layer 2: popover in Standard view (only for goals with threshold, post-analysis) */}
      {!isDetailed && showPopoverTrigger && (
        <NodePopover
          visible={showPopover}
          width={280}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

GoalNode.displayName = 'GoalNode'

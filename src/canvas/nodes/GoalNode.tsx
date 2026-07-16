/**
 * Goal node component — v3 wireframe
 *
 * Layer 1 (always visible):
 *  - No threshold pre-analysis: "What does success look like for you?" + chip
 *  - No threshold post-analysis: "Analysis complete. Set a target to see your chances." + chip
 *  - With threshold: "Target: [value]" + provenance icon
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
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { formatTargetValue } from '../../components/results/utils/formatTargetValue'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { DataBar, type DataBarColour } from '../ui/shared/DataBar'
import { getStabilityClassification } from '../../lib/stability'
import { isCurrencyUnit } from '../utils/labelUtils'
import { NodeChip, NodePopover, ScienceIcon } from './shared'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useHasAnyRealProbability } from '../ui/inspector-v2/useAnalysisResults'
import type { CEEGoalConstraint } from '../../adapters/cee/types'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  const report = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'
  // Phase 2.3 — null-probability guard. Post-analysis without any finite
  // per-option win_probability means the engine finished but produced no
  // probability. We must not render "Analysis complete" copy in that case.
  const hasAnyProbability = useHasAnyRealProbability()
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
    const warnings = (report as any)?.inference_warnings ?? (report as any)?.robustness?.inference_warnings
    if (!Array.isArray(warnings)) return false
    return warnings.some((w: any) => w.code === 'CONSTRAINT_NODE_DEFAULT_BASE')
  }, [report, isPostAnalysis])

  // Border: dashed warning for no target, dashed by stability for post-analysis
  const goalBorderOverride = useMemo(() => {
    if (!hasThreshold) return 'border-warning border-dashed'
    if (!robustnessData) return undefined
    switch (robustnessData.level) {
      case 'moderate': return 'border-info border-dashed'
      case 'low': return 'border-danger border-dashed'
      default: return undefined
    }
  }, [hasThreshold, robustnessData])

  // Format threshold display
  const thresholdDisplay = useMemo(() => {
    if (!hasThreshold) return null
    const raw = typeof thresholdRaw === 'number' ? thresholdRaw : Number(thresholdRaw)
    if (Number.isNaN(raw)) return String(thresholdRaw)
    const u = typeof thresholdUnit === 'string' ? thresholdUnit.toLowerCase() : ''
    if (u === '%' || u === 'percent' || u === 'percentage') return formatTargetValue(Math.round(raw), 'percent')
    if (u === 'count' || u === '') return formatTargetValue(raw)
    if (thresholdUnit && isCurrencyUnit(thresholdUnit)) return formatTargetValue(raw, 'currency', thresholdUnit)
    return `${raw.toLocaleString()} ${thresholdUnit}`
  }, [hasThreshold, thresholdRaw, thresholdUnit])

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
          {displayMetadata.achievementProbability !== null && displayMetadata.achievementProbability < 0.10 && (
            <NodeChip label="Why is this so low?" message="Why is the probability of reaching my goal target so low? What are the main drivers?" />
          )}
          <NodeChip label="Is my target realistic?" message="Is my current goal target realistic given the factors in my model? What would be a more achievable target?" />
        </div>
      )}
    </>
  ) : null

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
        {/* No target, post-analysis: analysis done but no threshold to evaluate.
            Null-probability guard swaps the copy when the run produced no
            finite win_probability (BoundaryError / null probs / stale state). */}
        {!hasThreshold && isPostAnalysis && (
          <>
            <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>
              {hasAnyProbability
                ? 'Analysis complete. Set a target to see your chances.'
                : 'Analysis finished. Set a target and check the graph for incomplete inputs.'}
            </p>
            <div className="mt-1.5">
              <NodeChip label="Help me set a target" message="Help me define what success looks like for this goal. What metrics or thresholds should I aim for?" />
            </div>
          </>
        )}

        {/* No target, pre-analysis: the "goal gap". Surface the missing target
            clearly (Paul-authored copy — brief primary + A1 secondary), then keep
            the existing coaching chip. */}
        {!hasThreshold && !isPostAnalysis && (
          <>
            <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>Goal target missing</p>
            <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
              Add a measurable success target, e.g. metric, threshold or deadline
            </p>
            <div className="mt-1.5">
              <NodeChip label="Help me set a target" message="Help me define what success looks like for this goal. What metrics or thresholds should I aim for?" />
            </div>
          </>
        )}

        {/* With target: display it */}
        {hasThreshold && (
          <div className={`${typography.nodeLabel} text-text-light mt-1`}>
            Target: {thresholdDisplay}
          </div>
        )}

        {/* Audit §8 P1 goal-state matrix: target SET + analysis ran + no
            probability for it (target set after the run, or the run produced
            none). The old branches ignored this quadrant, leaving a card
            that showed a target with no path to a probability. No new CTA —
            the edit affordance and Run flows already exist elsewhere. */}
        {hasThreshold && isPostAnalysis && displayMetadata.achievementProbability === null && (
          <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>
            Target set. Rerun the analysis to update your results.
          </p>
        )}

        {/* Post-analysis: achievement probability.
            UI-SEM-082 (Lane 4, Paul ruled; extends UI-SEM-071 doctrine): gate on
            the target being SET (hasThreshold) — never on producer value presence
            alone. The producer synthesises an auto_goal_threshold and returns a
            goal_probability even when the USER set no target (UI-SEM-071 class),
            so without this gate the "N% chance of reaching target" line would
            crown a target the user never set AND co-render with the "Set a target
            to see your chances" invitation above. hasThreshold makes the two
            mutually exclusive by construction. */}
        {hasThreshold && displayMetadata.isResultsMode && displayMetadata.achievementProbability !== null && (
          <div className={`${typography.nodeLabel} mt-1 ${
            displayMetadata.achievementProbability < 0.10 ? 'text-danger' : 'text-text-body'
          }`}>
            {displayMetadata.achievementProbability > 0 && displayMetadata.achievementProbability < 0.01
              ? '< 1'
              : Math.round(displayMetadata.achievementProbability * 100)}% chance of reaching target
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

        {/* Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): the
            achievement-probability number above is scored from a MODELLED
            forward-propagated outcome distribution, not a directly-elicited
            base — same gate + shared wording as OptionCards' caveat
            (GOAL_FIT_BASIS_CAVEAT_COPY), rendered adjacent to the number it
            qualifies, never separately, never invented. */}
        {hasThreshold &&
          displayMetadata.isResultsMode &&
          displayMetadata.achievementProbability !== null &&
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
        {hasThreshold && isPostAnalysis && displayMetadata.achievementProbability !== null && displayMetadata.achievementProbability < 0.10 && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            Target may be ambitious.{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-danger underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                useCanvasStore.getState().setShowInspectorPanel(true)
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
            <NodeChip label="Run analysis" message="Run the analysis now" />
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

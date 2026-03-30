/**
 * Decision node component — v3.1 wireframe (Decision Graph Spec v1.1 Section 5.1)
 *
 * Pre-analysis Standard: health pills (gaps / estimates / biases), coaching chips,
 *   science icons in header, popover with model readiness breakdown.
 * Post-analysis Standard: compound winner + risk sentence, coaching chips.
 * Pre-analysis Detailed: full model readiness breakdown inline.
 * Post-analysis Detailed: stability label inline.
 */
import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { typography } from '../../styles/typography'
import { NodeChip, ScienceIcon, NodePopover } from './shared'
import { isGoalDefined } from '../../utils/isGoalDefined'

// ---- Health pill helpers ----

interface HealthPill {
  label: string
  colour: 'danger' | 'warning'
}

interface ModelReadiness {
  gapCount: number
  estimateCount: number
  biasCount: number
  pills: HealthPill[]
  // breakdown for popover / detailed view
  explicitCount: number
  inferredCount: number
  missingCount: number
  externalCount: number
  biasTriggers: string[]
  totalFactors: number
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

    // Bias triggers
    const biasTriggers: string[] = []
    if (optionNodes.length < 3) biasTriggers.push('Narrow framing: fewer than 3 options')
    if (riskNodes.length <= 1) biasTriggers.push('Missing risks: 1 or fewer risk nodes')
    const hasBaseline = optionNodes.some(n => (n.data as Record<string, unknown> | undefined)?.is_baseline === true)
    if (hasBaseline) biasTriggers.push('Status quo bias: baseline option present')
    // Overconfidence: top factor is inferred
    const topInferred = factorNodes.some(n => {
      const os = (n.data as Record<string, unknown> | undefined)?.observedState as Record<string, unknown> | undefined
      return os?.extractionType === 'inferred'
    })
    if (topInferred) biasTriggers.push('Overconfidence: key factor value is estimated')

    const gapCount = missingCount
    const estimateCount = inferredCount
    const biasCount = biasTriggers.length

    const pills: HealthPill[] = []
    if (gapCount > 0) pills.push({ label: `${gapCount} gap${gapCount !== 1 ? 's' : ''}`, colour: 'danger' })
    if (estimateCount > 0) pills.push({ label: `${estimateCount} estimate${estimateCount !== 1 ? 's' : ''}`, colour: 'warning' })
    if (biasCount > 0) pills.push({ label: `${biasCount} bias${biasCount !== 1 ? 'es' : ''}`, colour: 'warning' })

    return {
      gapCount,
      estimateCount,
      biasCount,
      pills,
      explicitCount,
      inferredCount,
      missingCount,
      externalCount,
      biasTriggers,
      totalFactors: factorNodes.length,
    }
  }, [nodes, edges, decisionId])
}

// ---- Pill colour map ----
const pillColourClasses: Record<HealthPill['colour'], string> = {
  danger: 'border-danger/30 text-danger',
  warning: 'border-warning/30 text-warning',
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

  const scienceIcons = useScienceIcons(id, 'decision')
  const readiness = useModelReadiness(id)
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  const optionCount = useMemo(() => {
    const outgoingEdges = edges.filter(e => e.source === id)
    return outgoingEdges.filter(e => {
      const targetNode = nodes.find(n => n.id === e.target)
      return targetNode?.type === 'option' || targetNode?.data?.type === 'option'
    }).length
  }, [edges, nodes, id])

  // All factor values present?
  const allFactorsPresent = readiness.missingCount === 0
  const goalDefined = isGoalDefined(goalThreshold, goalConstraints)
  const showRunAnalysis = allFactorsPresent && goalDefined

  // ---- Post-analysis: winner headline ----
  const headline = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    const recommendedId = robustness?.recommended_option_id ?? robustness?.recommendedOptionId
    if (!recommendedId) return null

    const winnerNode = nodes.find(n => n.id === recommendedId)
    const winnerLabel = (winnerNode?.data?.label as string | undefined) ?? null
    if (!winnerLabel) return null

    const optionProbs = (report as any)?.option_probabilities ?? {}
    const winProb = optionProbs[recommendedId]?.win_probability as number | undefined

    return { winnerLabel, winProb }
  }, [isPostAnalysis, report, nodes])

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
    store.onSelectionChange({ nodes: [{ id: biggestRisk.nodeId } as any], edges: [] })
    store.setShowInspectorPanel(true)
    setTimeout(() => store.setHighlightedNodes([]), 3000)
  }, [biggestRisk])

  const truncatedRiskLabel = biggestRisk
    ? (biggestRisk.label.length > 22 ? `${biggestRisk.label.slice(0, 22)}...` : biggestRisk.label)
    : null

  // Stability label for post-analysis Detailed view
  const stabilityLabel = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    const stability = robustness?.recommendation_stability as number | undefined
    if (stability == null) return null
    if (stability >= 0.85) return 'Very stable'
    if (stability >= 0.70) return 'Stable'
    if (stability >= 0.55) return 'Moderately stable'
    return 'Sensitive'
  }, [isPostAnalysis, report])

  // Graph completeness % for Detailed pre-analysis
  const completeness = useMemo(() => {
    if (readiness.totalFactors === 0) return 0
    const filled = readiness.explicitCount + readiness.inferredCount + readiness.externalCount
    return Math.round((filled / readiness.totalFactors) * 100)
  }, [readiness])

  // Chip actions via _sendMessage
  const handleChip = useCallback((message: string) => {
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(message)
  }, [])

  // ---- Render ----

  const headerSlot = scienceIcons.length > 0 ? (
    <span className="inline-flex items-center gap-1">
      {scienceIcons.map(si => (
        <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
      ))}
    </span>
  ) : undefined

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      <BaseNode
        nodeType="decision"
        icon={Crosshair}
        id={id}
        data={data}
        selected={selected}
        maxWidth={320}
        headerSlot={headerSlot}
      >
        {/* ===== POST-ANALYSIS ===== */}
        {headline ? (
          <div className="mt-1">
            <div className={`${typography.nodeLabel} text-text-body`}>
              {headline.winnerLabel} wins {headline.winProb != null ? `${Math.round(headline.winProb * 100)}%` : ''} of scenarios{biggestRisk && biggestRisk.label ? (
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

            {/* Post-analysis Detailed: stability label */}
            {isDetailed && stabilityLabel && (
              <div className={`${typography.edgeLabel} text-text-light mt-1`}>
                Stability: {stabilityLabel}
              </div>
            )}

            {/* Post-analysis chips */}
            <div className="flex gap-1 flex-wrap mt-1.5">
              <NodeChip label="Challenge this result" message="What assumptions would need to change for a different option to win?" />
              <NodeChip label="Compare options" message="Compare the options side by side" />
            </div>
          </div>
        ) : optionCount > 0 ? (
          <>
            {/* ===== PRE-ANALYSIS ===== */}
            <div className={`${typography.nodeLabel} text-text-light mt-1`}>
              {optionCount} option{optionCount !== 1 ? 's' : ''} compared
            </div>

            {/* Health pills */}
            {readiness.pills.length > 0 && (
              <div className="flex gap-[3px] mt-1.5 items-center flex-wrap">
                {readiness.pills.map(pill => (
                  <span
                    key={pill.label}
                    className={`${typography.edgeLabel} px-[5px] py-[1px] rounded-[10px] border bg-transparent ${pillColourClasses[pill.colour]}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            )}

            {/* Pre-analysis Detailed: full model readiness breakdown */}
            {isDetailed && (
              <div className={`${typography.edgeLabel} text-text-light mt-1.5 space-y-0.5`}>
                <div>Factors: {readiness.explicitCount} explicit, {readiness.inferredCount} inferred, {readiness.missingCount} missing, {readiness.externalCount} external</div>
                {readiness.biasTriggers.length > 0 && (
                  <div className="text-warning">
                    Biases: {readiness.biasTriggers.join('; ')}
                  </div>
                )}
                <div>Graph completeness: {completeness}%</div>
              </div>
            )}

            {/* Coaching chips */}
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              <NodeChip label="Explore more options" message="Suggest a third option I haven't considered for this decision" />
              <NodeChip label="What could go wrong?" message="What could go wrong with this decision?" />
              {showRunAnalysis && (
                <NodeChip label="Run analysis" message="Run the analysis now" />
              )}
            </div>
          </>
        ) : null}
      </BaseNode>

      {/* Pre-analysis popover — model readiness breakdown */}
      {!isPostAnalysis && optionCount > 0 && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          <div className={`${typography.edgeLabel} text-text-body space-y-1`}>
            <div className="font-medium text-text-heading">Model readiness</div>
            <div>Explicit: {readiness.explicitCount}</div>
            <div>Inferred: {readiness.inferredCount}</div>
            <div>Missing: {readiness.missingCount}</div>
            <div>External: {readiness.externalCount}</div>
            {readiness.biasTriggers.length > 0 && (
              <>
                <div className="font-medium text-text-heading mt-1">Active bias triggers</div>
                {readiness.biasTriggers.map(trigger => (
                  <div key={trigger} className="text-warning">{trigger}</div>
                ))}
              </>
            )}
            <div className="mt-1.5">
              <NodeChip label="Review model readiness" message="Review the model readiness for this decision" />
            </div>
          </div>
        </NodePopover>
      )}
    </div>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode

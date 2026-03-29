import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit, QUALITATIVE_FACTOR_TYPES } from '../utils/labelUtils'
import { detectBaseline } from '../utils/baselineDetection'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { NodeChip, ActionIcons, BriefIcon, MetricPills, NodePopover } from './shared'

interface InterventionChip {
  factorId: string
  label: string
  value: number
  unit?: string
  factorType?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
}

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')

  const nodes = useCanvasStore(state => state.nodes)
  const resultsReport = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const isPostAnalysis = resultsStatus === 'complete'

  const isRecommended = useMemo(() => {
    if (!displayMetadata.isResultsMode || displayMetadata.winRate === null) return false
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    if (optionNodes.length < 2) return false
    const visibleOptionIds = new Set(optionNodes.map(n => n.id))
    const report = resultsReport as any
    const optionProbabilities: Record<string, { win_probability?: number }> = report?.option_probabilities ?? {}
    const allRates = Object.entries(optionProbabilities)
      .filter(([id]) => visibleOptionIds.has(id))
      .map(([, v]) => typeof v?.win_probability === 'number' ? v.win_probability : null)
      .filter((v): v is number => v !== null)
    if (allRates.length === 0) return false
    const maxRate = Math.max(...allRates)
    return displayMetadata.winRate >= maxRate - 0.0001
  }, [displayMetadata.isResultsMode, displayMetadata.winRate, nodes, resultsReport])

  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const setHoveredOption = useCanvasStore(state => state.setHoveredOption)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isDetailed = viewMode === 'expert'

  const interventionChips = useMemo<InterventionChip[]>(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    const interventions = ceeOption?.interventions
    if (!interventions || typeof interventions !== 'object') return []
    return Object.entries(interventions)
      .map(([factorId, rawValue]) => {
        const value = typeof rawValue === 'number' ? rawValue :
                     (rawValue && typeof rawValue === 'object' && 'value' in rawValue) ?
                     Number((rawValue as { value: unknown }).value) : 0
        const factorNode = nodes.find(n => n.id === factorId)
        const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
        const stripped = cleanFactorLabel(rawLabel)
        const cleanedLabel = stripped.length > 0
          ? stripped.charAt(0).toUpperCase() +
            stripped.slice(1).replace(/\b([A-Za-z]+)\b/g, (word) =>
              /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()
            )
          : stripped
        const observedState = factorNode?.data?.observedState as {
          unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
        } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        return {
          factorId, label: cleanedLabel, value, unit,
          factorType: observedState?.factor_type, cap: observedState?.cap,
          observedValue: observedState?.value, observedRawValue: observedState?.raw_value,
        }
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3)
  }, [ceeAnalysisReady, props.id, nodes])

  const hasInterventions = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    return !!(ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0)
  }, [ceeAnalysisReady, props.id])

  const isBaselineOption = useMemo(() => {
    if ((props.data as any)?.is_baseline === true) return true
    const label = (props.data?.label as string | undefined) ?? ''
    return detectBaseline(label).isBaseline
  }, [props.data])

  const baselineOptionInterventions = useMemo<Record<string, number> | null>(() => {
    if (isBaselineOption) return null
    const options = ceeAnalysisReady?.options
    if (!options) return null
    const baselineNode = nodes.find(n => {
      if (n.id === props.id) return false
      if (n.type !== 'option' && n.data?.type !== 'option') return false
      if ((n.data as any)?.is_baseline === true) return true
      const lbl = (n.data?.label as string | undefined) ?? ''
      return detectBaseline(lbl).isBaseline
    })
    if (!baselineNode) return null
    const baseCeeOption = options.find(opt => opt.id === baselineNode.id)
    if (!baseCeeOption?.interventions) return null
    return Object.fromEntries(
      Object.entries(baseCeeOption.interventions).map(([fid, rv]) => {
        const v = typeof rv === 'number' ? rv :
          (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : 0
        return [fid, v]
      })
    )
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  const binaryFactorIds = useMemo<Set<string>>(() => {
    const options = ceeAnalysisReady?.options
    if (!options) return new Set()
    const valuesPerFactor = new Map<string, number[]>()
    for (const opt of options) {
      if (!opt.interventions) continue
      for (const [fid, rv] of Object.entries(opt.interventions)) {
        const v = typeof rv === 'number' ? rv :
          (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : null
        if (v == null) continue
        const arr = valuesPerFactor.get(fid)
        if (arr) arr.push(v)
        else valuesPerFactor.set(fid, [v])
      }
    }
    const result = new Set<string>()
    for (const [fid, vals] of valuesPerFactor) {
      if (vals.every(v => v === 0 || v === 1)) result.add(fid)
    }
    return result
  }, [ceeAnalysisReady])

  // Standard pre-analysis: brief summary of what changes
  const decisionViewSummary = useMemo(() => {
    if (viewMode !== 'standard' || interventionChips.length === 0) return null
    const changed = interventionChips.filter(c => {
      const baselineVal = baselineOptionInterventions?.[c.factorId] ?? c.observedValue
      if (baselineVal === undefined) return true
      return Math.abs(c.value - baselineVal) >= 1e-6
    })
    if (changed.length === 0) return null
    return changed.map(c => {
      const isBinary = binaryFactorIds.has(c.factorId)
      const shortVal = isBinary
        ? (c.value === 1 ? 'on' : c.value === 0 ? 'off' : formatInterventionValue(c.value, c.unit, c.factorType, c.cap, c.observedValue, c.observedRawValue))
        : formatInterventionValue(c.value, c.unit, c.factorType, c.cap, c.observedValue, c.observedRawValue)
      const shortLabel = c.label.length > 28 ? `${c.label.slice(0, 28)}...` : c.label
      return `${shortLabel} ${shortVal}`
    }).join(', ')
  }, [viewMode, interventionChips, baselineOptionInterventions, binaryFactorIds])

  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) setHoveredOption(props.id)
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  const isOptionFromCee = useMemo(() =>
    ceeAnalysisReady?.options?.some(opt => opt.id === props.id) ?? false,
  [ceeAnalysisReady, props.id])

  // "Wins via" -- top-ranked sensitivity factor that this option intervenes on
  const winsVia = useMemo(() => {
    if (!isPostAnalysis || !isRecommended || !resultsReport) return null
    const report = resultsReport as any
    const sensitivity = report?.enrichment?.sensitivity_analysis?.factors ?? report?.factor_sensitivity ?? []
    if (!Array.isArray(sensitivity) || sensitivity.length === 0) return null

    // Build ranked factor IDs
    const rankedFactors = [...sensitivity]
      .map((f: any) => ({
        id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string | undefined,
        score: Math.abs(f.elasticity ?? f.sensitivity_score ?? f.importance_score ?? 0),
      }))
      .sort((a, b) => b.score - a.score)

    // Cross-reference with this option's intervention keys
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    const interventionKeys = new Set(Object.keys(ceeOption?.interventions ?? {}))

    for (const f of rankedFactors) {
      if (f.id && interventionKeys.has(f.id)) {
        const factorNode = nodes.find(n => n.id === f.id)
        if (factorNode) {
          return {
            id: f.id,
            label: cleanFactorLabel((factorNode.data?.label as string) ?? '') || ((factorNode.data?.label as string) ?? ''),
          }
        }
      }
    }
    return null
  }, [isPostAnalysis, isRecommended, resultsReport, ceeAnalysisReady, props.id, nodes])

  // Goal probability for warning
  const goalProbability = useMemo(() => {
    if (!isPostAnalysis || !resultsReport) return null
    const report = resultsReport as any
    const optionProbs = report?.option_probabilities?.[props.id]
    return typeof optionProbs?.goal_probability === 'number' ? optionProbs.goal_probability : null
  }, [isPostAnalysis, resultsReport, props.id])

  // "Behind:" reason for non-winner options (including status quo)
  const behindReason = useMemo<string | null>(() => {
    if (!isPostAnalysis || isRecommended) return null
    // Status quo: always "no changes from current state"
    if (isBaselineOption) return 'no changes from current state'
    const report = resultsReport as any
    if (!report) return null

    // 1. Find the recommended option's ID
    const recommendedOptionId = report?.robustness?.recommended_option_id as string | undefined
    if (!recommendedOptionId) return null

    // 2. Get the #1 sensitivity factor (sorted by importance_score descending)
    const sensitivity = report?.enrichment?.sensitivity_analysis?.factors ?? report?.factor_sensitivity ?? []
    if (!Array.isArray(sensitivity) || sensitivity.length === 0) return 'fewer key changes'

    const rankedFactors = [...sensitivity]
      .map((f: any) => ({
        id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string | undefined,
        label: (f.label ?? f.node_label) as string | undefined,
        score: Math.abs(f.importance_score ?? f.elasticity ?? f.sensitivity_score ?? 0),
      }))
      .sort((a, b) => b.score - a.score)

    const topFactor = rankedFactors[0]
    if (!topFactor?.id) return 'fewer key changes'

    // Resolve a display label -- prefer sensitivity label, fallback to canvas node label
    const factorNode = nodes.find(n => n.id === topFactor.id)
    const factorLabel = topFactor.label
      ?? (factorNode ? (cleanFactorLabel((factorNode.data?.label as string) ?? '') || (factorNode.data?.label as string)) : null)
      ?? null

    if (!factorLabel) return 'fewer key changes'

    // 3. Compare: does the winner intervene on this factor while this option doesn't?
    const winnerCee = ceeAnalysisReady?.options?.find(opt => opt.id === recommendedOptionId)
    const thisCee = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)

    const winnerInterventions = winnerCee?.interventions ?? {}
    const thisInterventions = thisCee?.interventions ?? {}

    const winnerHasFactor = topFactor.id in winnerInterventions
    const thisHasFactor = topFactor.id in thisInterventions

    if (winnerHasFactor && !thisHasFactor) {
      return `no ${factorLabel.toLowerCase()} added`
    }

    if (winnerHasFactor && thisHasFactor) {
      // Both intervene but potentially different levels
      const winnerVal = (() => {
        const rv = winnerInterventions[topFactor.id]
        return typeof rv === 'number' ? rv :
          (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : 0
      })()
      const thisVal = (() => {
        const rv = thisInterventions[topFactor.id]
        return typeof rv === 'number' ? rv :
          (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : 0
      })()
      if (Math.abs(winnerVal - thisVal) >= 1e-6) {
        return `${factorLabel.toLowerCase()} lower`
      }
    }

    return 'fewer key changes'
  }, [isPostAnalysis, isRecommended, isBaselineOption, resultsReport, ceeAnalysisReady, props.id, nodes])

  const handleWinsViaClick = useCallback(() => {
    if (!winsVia) return
    const store = useCanvasStore.getState()
    store.setHighlightedNodes([winsVia.id])
    setTimeout(() => store.setHighlightedNodes([]), 3000)
  }, [winsVia])

  const handleGoalReviewClick = useCallback(() => {
    const store = useCanvasStore.getState()
    const goalNode = store.nodes.find(n => n.type === 'goal' || n.data?.type === 'goal')
    if (goalNode) {
      store.onSelectionChange({ nodes: [goalNode as any], edges: [] })
      store.setShowInspectorPanel(true)
    }
  }, [])

  // "View parameters" handler (Detailed view)
  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.onSelectionChange({ nodes: [{ id: props.id } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [props.id])

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Whether to show Layer 2 content inline (Detailed view)
  const showLayer2Inline = isDetailed

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = (
    <>
      {/* Goal probability warning (< 10%) — moved from Layer 1, post-analysis only */}
      {isPostAnalysis && goalProbability !== null && goalProbability < 0.10 && (
        <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
          {'< '}
          {goalProbability < 0.01 ? '1' : Math.round(goalProbability * 100)}% chance of target.{' '}
          <button
            type="button"
            className={`${typography.edgeLabel} text-danger underline cursor-pointer nodrag nopan`}
            onClick={handleGoalReviewClick}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Review
          </button>
        </p>
      )}

      {/* "What this option changes:" intervention list */}
      {interventionChips.length > 0 && (() => {
        const chipsWithMeta = interventionChips.map(chip => {
          const baselineNorm = isBaselineOption
            ? chip.observedValue
            : (baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue)
          const isNoChange = baselineNorm !== undefined && Math.abs(chip.value - baselineNorm) < 1e-6
          return { chip, isNoChange }
        })
        const allNoChange = chipsWithMeta.length > 0 && chipsWithMeta.every(c => c.isNoChange)
        if (allNoChange) return <p className={`${typography.edgeLabel} text-text-light m-0`}>No changes from current state</p>

        return (
          <>
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>What this option changes:</p>
            <div className="flex flex-col gap-0.5">
              {chipsWithMeta.map(({ chip, isNoChange }) => {
                if (isNoChange) return null
                const effectiveUnit = chip.unit && !isSuppressedUnit(chip.unit) ? chip.unit : undefined
                const ft = chip.factorType?.toLowerCase().trim()
                const isQualitativeFactor = !effectiveUnit && chip.cap == null && (!ft || QUALITATIVE_FACTOR_TYPES.has(ft))
                const isBinary = isQualitativeFactor && binaryFactorIds.has(chip.factorId)
                let targetFormatted: string
                if (isBinary) {
                  targetFormatted = chip.value === 1 ? 'On' : chip.value === 0 ? 'Off' : formatInterventionValue(chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
                } else {
                  targetFormatted = formatInterventionValue(chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
                }
                let deltaDisplay: string | null = null
                if (!isBaselineOption) {
                  const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
                  if (baselineNorm !== undefined) {
                    const scaleBase = inferInterventionScaleBase(chip.cap, chip.observedValue, chip.observedRawValue)
                    const hasUnit = !!chip.unit && chip.unit !== 'fraction' && chip.unit !== 'proportion'
                    const isQualitative = !chip.factorType || ['quality', 'demand', 'other'].includes(chip.factorType.toLowerCase())
                    if ((hasUnit || !isQualitative) && scaleBase != null) {
                      const denormedBaseline = denormaliseInterventionValue(baselineNorm, chip.cap, chip.observedValue, chip.observedRawValue)
                      const denormedTarget = denormaliseInterventionValue(chip.value, chip.cap, chip.observedValue, chip.observedRawValue)
                      if (Math.abs(denormedBaseline) > 0.01) {
                        const pct = ((denormedTarget - denormedBaseline) / Math.abs(denormedBaseline)) * 100
                        const sign = pct >= 0 ? '+' : ''
                        const baselineFormatted = isBinary
                          ? (baselineNorm === 1 ? 'On' : baselineNorm === 0 ? 'Off' : formatInterventionValue(baselineNorm, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue))
                          : formatInterventionValue(baselineNorm, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
                        deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                      }
                    }
                  }
                }
                return (
                  <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                    <span className="text-text-light">{chip.label.length > 28 ? `${chip.label.slice(0, 28)}...` : chip.label}:</span>{' '}
                    <span className="font-medium">{deltaDisplay ?? targetFormatted}</span>
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}


      {isOptionFromCee && (
        <div className="mt-0.5">
          <BriefIcon />
        </div>
      )}
    </>
  )

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      onMouseEnter={() => {
        handleMouseEnter()
        nodeHandlers.onMouseEnter()
      }}
      onMouseLeave={() => {
        handleMouseLeave()
        nodeHandlers.onMouseLeave()
      }}
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      {/* Winner badge -- top-right */}
      {isRecommended && (
        <span className={`absolute -top-2 -right-2 z-10 ${typography.edgeLabel} font-medium bg-panel border-2 border-option text-text-body rounded-full px-1.5 py-0.5`}>
          Winner
        </span>
      )}
      <BaseNode {...props} nodeType="option" icon={metadata.icon} maxWidth={240}>
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* Win probability bar (post-analysis, both views) */}
        {displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
          <div className="mt-1.5 mb-1">
            <div className={`${typography.nodeLabel} text-text-body`}>
              {Math.round(displayMetadata.winRate * 100)}% win probability
            </div>
            <div className="h-1 bg-panel-border rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-option rounded-full transition-all duration-300"
                style={{ width: displayMetadata.winRate > 0 ? `max(4px, ${Math.round(displayMetadata.winRate * 100)}%)` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* "Wins via [factor]" link (winner, post-analysis) */}
        {isPostAnalysis && isRecommended && winsVia && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Wins via{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={handleWinsViaClick}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {winsVia.label.length > 22 ? `${winsVia.label.slice(0, 22)}...` : winsVia.label}
            </button>
            , the #1 driver
          </p>
        )}

        {/* "Behind:" reason (non-winner, post-analysis — includes status quo) */}
        {isPostAnalysis && !isRecommended && behindReason && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Behind: {behindReason}
          </p>
        )}

        {/* Pre-analysis: brief intervention summary */}
        {!isPostAnalysis && decisionViewSummary && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light line-clamp-2`}>
            {decisionViewSummary}
          </div>
        )}

        {/* Pre-analysis: status quo "No changes" */}
        {!isPostAnalysis && isBaselineOption && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
            No changes from current state
          </div>
        )}

        {/* Post-analysis: status quo bias — MetricPills with EyeOff bias */}
        {isPostAnalysis && isBaselineOption && (
          <MetricPills
            biasType="status-quo"
            biasTip="Status quo bias: inaction risks often underestimated."
            biasLinkLabel="Explore risks of inaction"
            biasLinkMessage="What are the risks of choosing to do nothing?"
          />
        )}

        {/* Coaching chips (winner, post-analysis) */}
        {isPostAnalysis && isRecommended && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="Biggest threat?" message={`What's the biggest risk to ${(props.data?.label as string) ?? 'this option'}?`} />
            <NodeChip label="Why does this win?" message={`Why does ${(props.data?.label as string) ?? 'this option'} win over the other options?`} />
          </div>
        )}

        {/* Coaching chip (non-winner, non-baseline, post-analysis) */}
        {isPostAnalysis && !isRecommended && !isBaselineOption && displayMetadata.winRate !== null && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="What would make this win?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to win?`} />
          </div>
        )}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) ===== */}
        {showLayer2Inline && layer2Content}

        {/* "View parameters" link (Detailed, post-analysis) */}
        {isDetailed && isPostAnalysis && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1.5 nodrag nopan`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            View parameters
          </button>
        )}

        {/* Action icons: edit (bottom-right) */}
        <ActionIcons nodeId={props.id} showEdit />
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, post-analysis, desktop hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

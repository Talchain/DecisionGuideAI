import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit } from '../utils/labelUtils'
import { formatFactorDisplayValue } from '../../utils/formatFactorDisplayValue'
import { detectBaseline } from '../utils/baselineDetection'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { NodeChip, ActionIcons, BriefIcon, MetricPills, NodePopover, ScienceIcon } from './shared'

/** Strip known suffixes from factor labels for contextual display. */
const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i
function stripFactorSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

/** Format an intervention value contextually, avoiding banned "On"/"Off" content. */
function formatChipValue(chip: { label: string; value: number; unit?: string; factorType?: string; cap?: number; observedValue?: number; observedRawValue?: string | number }): string {
  // Denormalize intervention value when cap is available (intervention values are 0-1 normalized)
  const effectiveUnit = chip.unit && !isSuppressedUnit(chip.unit) ? chip.unit : null
  let rawValue: number | string | null = null
  if (effectiveUnit && chip.cap != null && chip.cap > 1) {
    rawValue = chip.value * chip.cap
  }
  const contextual = formatFactorDisplayValue({
    label: chip.label,
    value: chip.value,
    raw_value: rawValue,
    unit: effectiveUnit,
    factor_type: chip.factorType ?? null,
    cap: chip.cap ?? null,
  })
  if (contextual) return contextual
  // Fallback: prefer numeric formatting over qualitative tier labels ("Low"/"Medium"/"High")
  const fallback = formatInterventionValue(chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
  // If the fallback produced a tier label, show percentage instead
  if (/^(Very low|Low|Medium|High|Very high)$/i.test(fallback)) {
    return `${Math.round(chip.value * 100)}%`
  }
  return fallback
}

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

/** Structured delta for spec Section 13 pre-analysis display. */
interface StructuredDelta {
  factorId: string
  label: string
  direction: 'up' | 'down' | 'equal'
  /** Formatted numeric delta (e.g. "+2") or null for non-numeric changes */
  numericDelta?: string
}

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')
  const scienceIcons = useScienceIcons(props.id, 'option')

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
    // Primary: ceeAnalysisReady.options[optionId].interventions
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    let interventionEntries: [string, unknown][] = []

    if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
      interventionEntries = Object.entries(ceeOption.interventions)
    } else {
      // Fallback: option node data.interventions (pre-CEE state)
      const optionNode = nodes.find(n => n.id === props.id)
      const nodeInterventions = (optionNode?.data as any)?.interventions
      if (nodeInterventions && typeof nodeInterventions === 'object') {
        interventionEntries = Object.entries(nodeInterventions)
      }
    }

    if (interventionEntries.length === 0) return []

    return interventionEntries
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
    if (ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0) return true
    // Fallback: option node data.interventions
    const optionNode = nodes.find(n => n.id === props.id)
    const nodeInterventions = (optionNode?.data as any)?.interventions
    return !!(nodeInterventions && typeof nodeInterventions === 'object' && Object.keys(nodeInterventions).length > 0)
  }, [ceeAnalysisReady, props.id, nodes])

  /** Total intervention count (all factors, not capped at 3). */
  const totalInterventionCount = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
      return Object.keys(ceeOption.interventions).length
    }
    const optionNode = nodes.find(n => n.id === props.id)
    const nodeInterventions = (optionNode?.data as any)?.interventions
    if (nodeInterventions && typeof nodeInterventions === 'object') {
      return Object.keys(nodeInterventions).length
    }
    return 0
  }, [ceeAnalysisReady, props.id, nodes])

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

  // Structured deltas per spec Section 13
  const structuredDeltas = useMemo<StructuredDelta[]>(() => {
    if (interventionChips.length === 0) return []
    return interventionChips
      .map(c => {
        const baseline = baselineOptionInterventions?.[c.factorId] ?? c.observedValue
        const shortLabel = c.label.length > 20 ? c.label.slice(0, 20).trimEnd() : c.label

        if (baseline === undefined) {
          // No baseline to compare — show as "up" (intervention exists)
          return { factorId: c.factorId, label: shortLabel, direction: 'up' as const }
        }

        const diff = c.value - baseline
        if (Math.abs(diff) < 1e-6) return null // no change

        const direction: 'up' | 'down' = diff > 0 ? 'up' : 'down'

        // For quantitative factors with units, show numeric delta
        const hasUnit = !!c.unit && !isSuppressedUnit(c.unit)
        let numericDelta: string | undefined
        if (hasUnit) {
          const scaleBase = inferInterventionScaleBase(c.cap, c.observedValue, c.observedRawValue)
          if (scaleBase != null) {
            const denormedBaseline = denormaliseInterventionValue(baseline, c.cap, c.observedValue, c.observedRawValue)
            const denormedTarget = denormaliseInterventionValue(c.value, c.cap, c.observedValue, c.observedRawValue)
            const rawDelta = denormedTarget - denormedBaseline
            const sign = rawDelta >= 0 ? '+' : ''
            const formatted = Math.abs(rawDelta) >= 100
              ? Math.round(rawDelta).toString()
              : rawDelta.toFixed(1)
            numericDelta = `${sign}${formatted}`
          }
        }

        return { factorId: c.factorId, label: shortLabel, direction, numericDelta }
      })
      .filter((d): d is StructuredDelta => d !== null)
  }, [interventionChips, baselineOptionInterventions])

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

    const rankedFactors = [...sensitivity]
      .map((f: any) => ({
        id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string | undefined,
        score: Math.abs(f.elasticity ?? f.sensitivity_score ?? f.importance_score ?? 0),
      }))
      .sort((a, b) => b.score - a.score)

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
    if (isBaselineOption) return 'no changes from current state'
    const report = resultsReport as any
    if (!report) return null

    const recommendedOptionId = report?.robustness?.recommended_option_id as string | undefined
    if (!recommendedOptionId) return null

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

    const factorNode = nodes.find(n => n.id === topFactor.id)
    const factorLabel = topFactor.label
      ?? (factorNode ? (cleanFactorLabel((factorNode.data?.label as string) ?? '') || (factorNode.data?.label as string)) : null)
      ?? null

    if (!factorLabel) return 'fewer key changes'

    const winnerCee = ceeAnalysisReady?.options?.find(opt => opt.id === recommendedOptionId)
    const thisCee = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)

    const winnerInterventions = winnerCee?.interventions ?? {}
    const thisInterventions = thisCee?.interventions ?? {}

    const winnerHasFactor = topFactor.id in winnerInterventions
    const thisHasFactor = topFactor.id in thisInterventions

    const strippedLabel = stripFactorSuffixes(factorLabel) || factorLabel

    if (winnerHasFactor && !thisHasFactor) {
      return `no ${strippedLabel.toLowerCase()} added`
    }

    if (winnerHasFactor && thisHasFactor) {
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
        return `${strippedLabel.toLowerCase()} lower`
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

  // Total factor count for completeness assessment (Detailed pre-analysis)
  const totalFactorCount = useMemo(() => {
    return nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor').length
  }, [nodes])

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = useMemo(() => (
    <>
      {/* Goal probability warning (< 10%) -- post-analysis only */}
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

      {/* "What this option changes:" intervention list (never for baseline) */}
      {!isBaselineOption && interventionChips.length > 0 && (() => {
        const chipsWithMeta = interventionChips.map(chip => {
          const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
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
                const targetFormatted = formatChipValue(chip)
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
                        const baselineFormatted = formatChipValue({ ...chip, value: baselineNorm })
                        deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                      }
                    }
                  }
                }
                return (
                  <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                    <span className="text-text-light">{chip.label.length > 30 ? `${chip.label.slice(0, 30)}...` : chip.label}:</span>{' '}
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
  ), [isPostAnalysis, goalProbability, handleGoalReviewClick, interventionChips, isBaselineOption, baselineOptionInterventions, isOptionFromCee])

  // ----- Pre-analysis popover content -----
  const preAnalysisPopoverContent = useMemo(() => {
    if (isPostAnalysis) return null
    if (isBaselineOption) return (
      <p className={`${typography.edgeLabel} text-text-light m-0`}>No changes from current state</p>
    )
    if (totalInterventionCount === 0) return null

    return (
      <>
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>
          This option changes {totalInterventionCount} factor{totalInterventionCount !== 1 ? 's' : ''}.
        </p>
        {interventionChips.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {interventionChips.map(chip => {
              const targetFormatted = formatChipValue(chip)
              return (
                <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                  <span className="text-text-light">{chip.label.length > 30 ? `${chip.label.slice(0, 30)}...` : chip.label}:</span>{' '}
                  <span className="font-medium">{targetFormatted}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-1">
          <NodeChip label="Is this option complete?" message={`Is ${(props.data?.label as string) ?? 'this option'} fully specified? Are there any missing interventions?`} />
        </div>
      </>
    )
  }, [isPostAnalysis, isBaselineOption, totalInterventionCount, interventionChips, props.data])

  // Completeness assessment for Detailed pre-analysis view
  const completenessText = useMemo(() => {
    if (isPostAnalysis || totalInterventionCount === 0 || totalFactorCount === 0) return null
    return `[${totalInterventionCount} of ${totalFactorCount}] factors specified`
  }, [isPostAnalysis, totalInterventionCount, totalFactorCount])

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
      <BaseNode
        {...props}
        nodeType="option"
        icon={metadata.icon}
        maxWidth={240}
        headerSlot={scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
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

        {/* "Behind:" reason (non-winner, post-analysis -- includes status quo) */}
        {isPostAnalysis && !isRecommended && behindReason && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Behind: {behindReason}
          </p>
        )}

        {/* Pre-analysis: structured deltas (spec Section 13) */}
        {!isPostAnalysis && !isBaselineOption && structuredDeltas.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1.5">
            {structuredDeltas.map(d => (
              <div key={d.factorId} className={`${typography.edgeLabel} inline-flex items-center gap-1`}>
                {d.direction === 'up' ? (
                  <ArrowUp size={12} className="text-success flex-shrink-0" />
                ) : (
                  <ArrowDown size={12} className="text-danger flex-shrink-0" />
                )}
                <span className="text-text-body">
                  {d.numericDelta ? `${d.numericDelta} ` : ''}{d.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pre-analysis: status quo "No changes" */}
        {!isPostAnalysis && isBaselineOption && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
            No changes
          </div>
        )}

        {/* Post-analysis: status quo bias -- MetricPills with EyeOff bias */}
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
            <NodeChip label="What would change this?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to no longer be the best choice?`} />
            <NodeChip label="Why does this win?" message={`Why does ${(props.data?.label as string) ?? 'this option'} win over the other options?`} />
          </div>
        )}

        {/* Coaching chip (non-winner, non-baseline, post-analysis) */}
        {isPostAnalysis && !isRecommended && !isBaselineOption && displayMetadata.winRate !== null && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="What would make this win?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to win?`} />
          </div>
        )}

        {/* Pre-analysis: coaching chip for all options */}
        {!isPostAnalysis && !isBaselineOption && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="What could go wrong?" message={`What could go wrong if we choose ${(props.data?.label as string) ?? 'this option'}?`} />
          </div>
        )}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) ===== */}
        {showLayer2Inline && !isPostAnalysis && !isBaselineOption && (
          <>
            {/* Detailed pre-analysis: full intervention list + completeness */}
            {interventionChips.length > 0 && (
              <>
                <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>Interventions:</p>
                <div className="flex flex-col gap-0.5">
                  {interventionChips.map(chip => {
                    const targetFormatted = formatChipValue(chip)
                    return (
                      <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                        <span className="text-text-light">{chip.label.length > 30 ? `${chip.label.slice(0, 30)}...` : chip.label}:</span>{' '}
                        <span className="font-medium">{targetFormatted}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {completenessText && (
              <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>{completenessText}</p>
            )}
          </>
        )}

        {showLayer2Inline && isPostAnalysis && layer2Content}

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

      {/* ===== LAYER 2: Popover (Standard view, hover) ===== */}
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

      {/* Pre-analysis popover (Standard view, hover) */}
      {!isDetailed && !isPostAnalysis && preAnalysisPopoverContent && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          {preAnalysisPopoverContent}
        </NodePopover>
      )}
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, compactFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit, isCurrencyUnit, unwrapInterventionValue } from '../utils/labelUtils'
import { formatFactorDisplayValue } from '../../utils/formatFactorDisplayValue'
import { detectBaseline } from '../utils/baselineDetection'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { NodeChip, ActionIcons, BriefIcon, MetricPills, NodePopover, ScienceIcon } from './shared'

/** Truncate text at word boundary to avoid mid-word cuts. */
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '...'
}

/** Strip known suffixes from factor labels for contextual display. */
const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i
function stripFactorSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

/**
 * Strip echo — if displayValue starts with (or contains) the factor label, remove the overlap.
 * Example: label="Technical leadership", value="Technical leadership active" → "active"
 */
function stripEcho(label: string, displayValue: string): string {
  const normalLabel = label.trim().toLowerCase()
  const normalValue = displayValue.trim().toLowerCase()
  if (normalValue.startsWith(normalLabel)) {
    const remainder = displayValue.trim().slice(label.trim().length).trimStart()
    return remainder || displayValue
  }
  return displayValue
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
  // Fallback: prefer numeric formatting over qualitative tier labels and raw normalised values
  const fallback = formatInterventionValue(chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
  // Tier labels and raw normalised decimals → percentage
  if (/^(Very low|Low|Medium|High|Very high)$/i.test(fallback)) {
    return `${Math.round(chip.value * 100)}%`
  }
  // Raw normalised number (no unit, value in [0,1] like "0.15" or "0.85") → percentage
  if (!effectiveUnit && chip.value >= 0 && chip.value <= 1 && /^0\.\d+$/.test(fallback)) {
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
      .flatMap(([factorId, rawValue]) => {
        // Drop entries that fail to unwrap. Prior to this fix, malformed
        // entries (e.g. { value: null }) were coerced to 0 via Number(...)
        // and rendered as deliberate-looking zero chips.
        const value = unwrapInterventionValue(rawValue)
        if (value == null) return []
        const factorNode = nodes.find(n => n.id === factorId)
        const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
        // Graph v1.1 Task 6: do NOT strip suffixes here. The popover / Detailed
        // intervention list wants the readable form ("Technical leadership"),
        // and compactFactorLabel needs the full phrase ("Technical leadership
        // presence") to look up wireframe v4 short forms. Each render path
        // applies its own truncation.
        const cleaned = cleanFactorLabel(rawLabel)
        const cleanedLabel = cleaned.length > 0
          ? cleaned.charAt(0).toUpperCase() +
            cleaned.slice(1).replace(/\b([A-Za-z]+)\b/g, (word) =>
              /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()
            )
          : cleaned
        const observedState = factorNode?.data?.observedState as {
          unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
        } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        return [{
          factorId, label: cleanedLabel, value, unit,
          factorType: observedState?.factor_type, cap: observedState?.cap,
          observedValue: observedState?.value, observedRawValue: observedState?.raw_value,
        }]
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
    // Drop entries that fail to unwrap. Downstream lookup
    // (`baselineOptionInterventions?.[c.factorId] ?? c.observedValue`) will
    // fall back to the observed value, which is a more honest baseline than
    // a Number()-coerced 0.
    return Object.fromEntries(
      Object.entries(baseCeeOption.interventions).flatMap(([fid, rv]) => {
        const v = unwrapInterventionValue(rv)
        return v != null ? [[fid, v] as const] : []
      })
    )
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  // Structured deltas per spec Section 13
  const structuredDeltas = useMemo<StructuredDelta[]>(() => {
    if (interventionChips.length === 0) return []
    return interventionChips
      .map(c => {
        const baseline = baselineOptionInterventions?.[c.factorId] ?? c.observedValue
        // Graph v1.1 Task 6: aggressive compaction for pre-analysis pills.
        const shortLabel = compactFactorLabel(c.label, 15)

        if (baseline === undefined) {
          // No baseline to compare — show as "up" (intervention exists)
          return { factorId: c.factorId, label: shortLabel, direction: 'up' as const }
        }

        const diff = c.value - baseline
        if (Math.abs(diff) < 1e-6) return null // no change

        const direction: 'up' | 'down' = diff > 0 ? 'up' : 'down'

        // For quantitative factors with units, show formatted numeric delta (e.g. "£55,000").
        // Graph v1.1 polish 4 Task 1: a unit of "scale" with no raw_value is a
        // normalised number with no real-world meaning — suppress the numeric
        // delta entirely so the pill renders as just "↑ factor".
        const effectiveUnit = c.unit && !isSuppressedUnit(c.unit) ? c.unit : null
        const isScaleUnit = effectiveUnit?.toLowerCase().trim() === 'scale'
        const hasRawAnchor = c.observedRawValue != null
        let numericDelta: string | undefined
        if (effectiveUnit && !(isScaleUnit && !hasRawAnchor)) {
          const scaleBase = inferInterventionScaleBase(c.cap, c.observedValue, c.observedRawValue)
          if (scaleBase != null) {
            const denormedTarget = denormaliseInterventionValue(c.value, c.cap, c.observedValue, c.observedRawValue)
            const rounded = Math.round(denormedTarget)
            // Format with unit symbol
            if (isCurrencyUnit(effectiveUnit)) {
              numericDelta = `${effectiveUnit}${rounded.toLocaleString('en-GB')}`
            } else if (effectiveUnit === '%') {
              numericDelta = `${rounded}%`
            } else {
              numericDelta = `${rounded.toLocaleString('en-GB')} ${effectiveUnit}`
            }
          }
        }
        // No unit (or meaningless "scale" unit) → direction + label only

        return { factorId: c.factorId, label: shortLabel, direction, numericDelta }
      })
      .filter((d): d is StructuredDelta => d !== null)
  }, [interventionChips, baselineOptionInterventions])

  /**
   * Polish 4 Task 5: differentiator factor — the intervention where this
   * option diverges most from the average of the other (non-status-quo)
   * options. Returns null when:
   *   - this is the status quo (it changes nothing),
   *   - there are fewer than 2 other non-status-quo options to compare against,
   *   - all options change the same factors by similar amounts (max diff < 0.1
   *     normalised, i.e. less than a 10% spread on the 0–1 axis).
   */
  const differentiatorLabel = useMemo<string | null>(() => {
    if (isPostAnalysis) return null
    if (isBaselineOption) return null
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    if (optionNodes.length < 2) return null

    // Build a map of option id → factorId → numeric value (unwrapped).
    const optionInterventions = new Map<string, Map<string, number>>()
    for (const optNode of optionNodes) {
      const isBaseline = (optNode.data as any)?.is_baseline === true
        || detectBaseline((optNode.data?.label as string) ?? '').isBaseline
      if (isBaseline) continue
      const ceeOpt = ceeAnalysisReady?.options?.find(o => o.id === optNode.id)
      const interventions = ceeOpt?.interventions ?? (optNode.data as any)?.interventions
      if (!interventions || typeof interventions !== 'object') continue
      const map = new Map<string, number>()
      for (const [fid, raw] of Object.entries(interventions)) {
        const v = unwrapInterventionValue(raw)
        if (v != null) map.set(fid, v)
      }
      optionInterventions.set(optNode.id, map)
    }

    const myValues = optionInterventions.get(props.id)
    if (!myValues || myValues.size === 0) return null
    if (optionInterventions.size < 2) return null // need at least one other option

    // For each factor I touch, compute the average value across other options
    // (treating absent factors as 0) and the absolute difference from mine.
    let bestFactorId: string | null = null
    let bestDiff = 0
    for (const [factorId, myValue] of myValues.entries()) {
      let sum = 0
      let count = 0
      for (const [otherId, otherValues] of optionInterventions.entries()) {
        if (otherId === props.id) continue
        sum += otherValues.get(factorId) ?? 0
        count += 1
      }
      if (count === 0) continue
      const avgOthers = sum / count
      const diff = Math.abs(myValue - avgOthers)
      if (diff > bestDiff) {
        bestDiff = diff
        bestFactorId = factorId
      }
    }

    // Threshold: less than 10% spread on the 0–1 axis means options are too
    // similar to call out a differentiator.
    if (bestFactorId == null || bestDiff < 0.1) return null

    const factorNode = nodes.find(n => n.id === bestFactorId)
    const rawLabel = (factorNode?.data?.label as string | undefined) ?? bestFactorId
    return compactFactorLabel(cleanFactorLabel(rawLabel), 20)
  }, [isPostAnalysis, isBaselineOption, ceeAnalysisReady, nodes, props.id])

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
      // unwrapInterventionValue returns null for malformed entries; treat
      // those as "no comparable value" and skip the lower-than message.
      const winnerVal = unwrapInterventionValue(winnerInterventions[topFactor.id])
      const thisVal = unwrapInterventionValue(thisInterventions[topFactor.id])
      if (winnerVal != null && thisVal != null && Math.abs(winnerVal - thisVal) >= 1e-6) {
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
                const displayVal = deltaDisplay ?? targetFormatted
                // Polish 4 review: when the intervention value is empty
                // (scale-unit factor with no raw_value anchor), suppress the
                // "→" separator and show only the label so the row reads as
                // a discovery cue rather than misleading "→ 0.1 scale".
                const echoStripped = displayVal ? stripEcho(chip.label, displayVal) : ''
                return (
                  <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                    <span className="text-text-body">{truncateAtWord(chip.label, 30)}</span>
                    {echoStripped && (
                      <>
                        <span className="text-text-light"> → </span>
                        <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* Status quo fallback — current baseline, no interventions */}
      {isBaselineOption && (
        <>
          <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p>
          {isPostAnalysis && displayMetadata.winRate !== null && (
            <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
              {Math.round((displayMetadata.winRate ?? 0) * 100)}% win rate across simulations
            </p>
          )}
          <div className="mt-1 flex gap-1 flex-wrap">
            <NodeChip label="Why does this win/lose?" message={`Why does the status quo (${(props.data?.label as string) ?? 'keep current'}) win or lose compared to other options?`} />
            <NodeChip label="Risks of inaction" message="What are the risks of choosing to do nothing?" />
          </div>
        </>
      )}

      {isOptionFromCee && !isBaselineOption && (
        <div className="mt-0.5">
          <BriefIcon />
        </div>
      )}
    </>
  ), [isPostAnalysis, goalProbability, handleGoalReviewClick, interventionChips, isBaselineOption, baselineOptionInterventions, isOptionFromCee, props.data])

  // ----- Pre-analysis popover content -----
  const preAnalysisPopoverContent = useMemo(() => {
    if (isPostAnalysis) return null
    // Polish 4 review: pre-analysis status quo popover used to carry a
    // "Risks of inaction" chip. The audit table says status quo gets no chip
    // pre-analysis (the EyeOff bias icon handles coaching). The "Is this
    // option complete?" chip on the no-interventions branch was likewise
    // outside the audit. Both removed.
    if (isBaselineOption) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p>
      </>
    )
    if (totalInterventionCount === 0) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>No interventions specified for this option.</p>
      </>
    )

    return (
      <>
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>
          This option changes {totalInterventionCount} factor{totalInterventionCount !== 1 ? 's' : ''}.
        </p>
        {interventionChips.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {interventionChips.map(chip => {
              const targetFormatted = formatChipValue(chip)
              const echoStripped = targetFormatted ? stripEcho(chip.label, targetFormatted) : ''
              return (
                <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                  <span className="text-text-body">{truncateAtWord(chip.label, 30)}</span>
                  {echoStripped && (
                    <>
                      <span className="text-text-light"> → </span>
                      <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
          Leading option
        </span>
      )}
      <BaseNode
        {...props}
        nodeType="option"
        icon={metadata.icon}
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
            Leads via{' '}
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

        {/* Pre-analysis: structured deltas — Graph v1.1 Task 6 wireframe v4
            OptionWinnerPre. Outlined pills (10px, panel-border, rounded-full)
            laid out horizontally so several fit per row. Labels are compacted
            via compactFactorLabel before reaching here. */}
        {!isPostAnalysis && !isBaselineOption && structuredDeltas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {structuredDeltas.map(d => (
              <span
                key={d.factorId}
                className="inline-flex items-center gap-0.5 font-sans leading-tight px-[5px] py-[1px] rounded-full border border-panel-border bg-transparent text-text-body"
                style={{ fontSize: 10, borderWidth: '0.5px' }}
              >
                {d.direction === 'up' ? (
                  <ArrowUp size={10} className="text-success flex-shrink-0" />
                ) : (
                  <ArrowDown size={10} className="text-danger flex-shrink-0" />
                )}
                {d.numericDelta ? `${d.numericDelta} ` : ''}{d.label}
              </span>
            ))}
          </div>
        )}

        {/* Polish 4 Task 5: differentiator line — what's strategically unique
            about this option vs the others. Standard view only (Detailed
            already shows the full intervention list). */}
        {!isPostAnalysis && !isBaselineOption && !isDetailed && differentiatorLabel && (
          <p className={`${typography.edgeLabel} text-text-light mt-1 m-0`}>
            {differentiatorLabel.charAt(0).toUpperCase() + differentiatorLabel.slice(1)} is the key difference
          </p>
        )}

        {/* Pre-analysis: status quo "No changes" */}
        {!isPostAnalysis && isBaselineOption && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
            No changes to factors
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
            <NodeChip label="Why does this lead?" message={`Why does ${(props.data?.label as string) ?? 'this option'} lead over the other options?`} />
          </div>
        )}

        {/* Coaching chip (non-winner, non-baseline, post-analysis) */}
        {isPostAnalysis && !isRecommended && !isBaselineOption && displayMetadata.winRate !== null && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="What would make this lead?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to lead?`} />
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
                    const echoStripped = targetFormatted ? stripEcho(chip.label, targetFormatted) : ''
                    return (
                      <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                        <span className="text-text-body">{truncateAtWord(chip.label, 30)}</span>
                        {echoStripped && (
                          <>
                            <span className="text-text-light"> → </span>
                            <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                          </>
                        )}
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
          anchorRef={nodeElRef}
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
          anchorRef={nodeElRef}
        >
          {preAnalysisPopoverContent}
        </NodePopover>
      )}
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

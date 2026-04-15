import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, compactFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit, isCurrencyUnit, unwrapInterventionValue, classifyUnit, formatWinProbability, placeholderDirectionLabel, isTierLabel } from '../utils/labelUtils'
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
 * Compute differentiator labels for ALL non-baseline options in one pass.
 * Returns a Map<optionId, string | null> where the string is the complete
 * sentence to render (e.g. "Tech lead hired is the key difference" or
 * "Tech lead hired → 90%").
 *
 * When two options share the same top-differentiating factor, values are
 * appended to disambiguate. If the values are also identical (or both
 * produce empty formatted text), the differentiator is suppressed for both.
 */
function computeAllDifferentiators(
  nodes: readonly { id: string; type?: string; data?: any }[],
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null,
): Map<string, string | null> {
  const result = new Map<string, string | null>()

  const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
  if (optionNodes.length < 2) return result

  // Build option id → factorId → { value, displayValue }. The displayValue
  // field carries CEE's `display_value` through to Phase 3 so the
  // disambiguation sentence ("X → {value}") can render the CEE string
  // verbatim instead of re-formatting the numeric value.
  type InterventionEntry = { value: number; displayValue?: string }
  const optionInterventions = new Map<string, Map<string, InterventionEntry>>()
  for (const optNode of optionNodes) {
    // Explicit flag wins; regex fallback only fires when flag is null/undefined.
    // Explicit `false` must suppress the regex (prevents "Status Quo" labels on
    // non-baseline options from being treated as baseline).
    const explicit = (optNode.data as any)?.is_baseline as boolean | null | undefined
    const isBaseline = explicit ?? detectBaseline((optNode.data?.label as string) ?? '').isBaseline
    if (isBaseline) continue
    const ceeOpt = ceeAnalysisReady?.options?.find(o => o.id === optNode.id)
    const interventions = ceeOpt?.interventions ?? (optNode.data as any)?.interventions
    if (!interventions || typeof interventions !== 'object') continue
    const map = new Map<string, InterventionEntry>()
    for (const [fid, raw] of Object.entries(interventions)) {
      const { value, displayValue } = unwrapInterventionValue(raw)
      if (value != null) map.set(fid, { value, displayValue: displayValue ?? undefined })
    }
    optionInterventions.set(optNode.id, map)
  }

  if (optionInterventions.size < 2) return result

  // Observed baseline resolver
  const observedBaselineFor = (factorId: string): number => {
    const factorNode = nodes.find(n => n.id === factorId)
    const obs = (factorNode?.data as any)?.observedState as { value?: number } | undefined
    return typeof obs?.value === 'number' ? obs.value : 0
  }

  // Phase 1: find each option's best differentiating factor
  const bestFactors = new Map<string, { factorId: string; diff: number; myValue: number; myDisplayValue?: string }>()
  for (const [optionId, myValues] of optionInterventions.entries()) {
    if (myValues.size === 0) continue
    let bestFactorId: string | null = null
    let bestDiff = 0
    let bestMyValue = 0
    let bestMyDisplayValue: string | undefined
    for (const [factorId, entry] of myValues.entries()) {
      const myValue = entry.value
      const baseline = observedBaselineFor(factorId)
      let sum = 0
      let count = 0
      for (const [otherId, otherValues] of optionInterventions.entries()) {
        if (otherId === optionId) continue
        const other = otherValues.get(factorId)
        sum += other !== undefined ? other.value : baseline
        count += 1
      }
      if (count === 0) continue
      const avgOthers = sum / count
      const diff = Math.abs(myValue - avgOthers)
      if (diff > bestDiff) {
        bestDiff = diff
        bestFactorId = factorId
        bestMyValue = myValue
        bestMyDisplayValue = entry.displayValue
      }
    }
    if (bestFactorId == null || bestDiff < 0.1) continue
    bestFactors.set(optionId, { factorId: bestFactorId, diff: bestDiff, myValue: bestMyValue, myDisplayValue: bestMyDisplayValue })
  }

  // Phase 2: count how many options claim each factor as their top differentiator
  const factorClaimCount = new Map<string, number>()
  for (const { factorId } of bestFactors.values()) {
    factorClaimCount.set(factorId, (factorClaimCount.get(factorId) ?? 0) + 1)
  }

  // Phase 3: build label for each option
  const candidateLabels = new Map<string, string>()
  for (const [optionId, { factorId, myValue, myDisplayValue }] of bestFactors.entries()) {
    const factorNode = nodes.find(n => n.id === factorId)
    const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
    const compactLabel = compactFactorLabel(cleanFactorLabel(rawLabel), 20)

    if ((factorClaimCount.get(factorId) ?? 0) <= 1) {
      // Unique factor — simple sentence
      candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} is the key difference`)
    } else if (myDisplayValue) {
      // Shared factor with CEE display_value — render verbatim, skip unit/tier inference.
      candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} \u2192 ${myDisplayValue}`)
    } else {
      // Shared factor — disambiguate. Placeholder-unit factors (scale, index, score, …)
      // have no real-world anchor, so tier labels like "Very high" are meaningless.
      // For those, skip formatting entirely and use directional language against
      // the observed baseline. For units with genuine anchors, format the value.
      const obs = (factorNode?.data as any)?.observedState as {
        unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
      } | undefined
      const unit = (factorNode?.data?.unit as string | undefined) ?? obs?.unit
      const effectiveUnit = unit && !isSuppressedUnit(unit) ? unit : undefined
      const unitKind = classifyUnit(effectiveUnit).kind
      const directional = (): string =>
        placeholderDirectionLabel(myValue, observedBaselineFor(factorId), compactLabel)
          ?? `Does not change ${compactLabel}`
      if (unitKind === 'placeholder') {
        candidateLabels.set(optionId, directional())
      } else {
        const formatted = formatInterventionValue(
          myValue,
          effectiveUnit,
          obs?.factor_type,
          obs?.cap,
          obs?.value,
          obs?.raw_value,
        )
        // A unitless qualitative factor (e.g. factor_type="quality", no unit)
        // still reaches formatInterventionValue's qualitativeTierLabel branch
        // and returns "Very high" / "High" / …. These tier labels are just as
        // meaningless in differentiator text as the placeholder-unit ones,
        // so force directional phrasing whenever the formatter returned one.
        if (formatted && !isTierLabel(formatted)) {
          candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} \u2192 ${formatted}`)
        } else {
          candidateLabels.set(optionId, directional())
        }
      }
    }
  }

  // Phase 4: suppress any labels that are still identical across options
  const labelCount = new Map<string, number>()
  for (const label of candidateLabels.values()) {
    labelCount.set(label, (labelCount.get(label) ?? 0) + 1)
  }

  for (const [optionId, label] of candidateLabels.entries()) {
    if ((labelCount.get(label) ?? 0) > 1) {
      result.set(optionId, null)
    } else {
      result.set(optionId, label)
    }
  }

  return result
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
function formatChipValue(chip: { label: string; value: number; displayValue?: string; unit?: string; factorType?: string; cap?: number; observedValue?: number; observedRawValue?: string | number }): string {
  // CEE-provided display_value wins over any UI-side formatting.
  if (chip.displayValue) return chip.displayValue
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
  if (isTierLabel(fallback)) {
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
  /** CEE-provided display_value, if present. Rendered verbatim in preference
   * to numeric formatting (see formatChipValue). */
  displayValue?: string
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

  // Graph v2 Task 4: close-call gap in percentage points. Non-zero only when
  // this option is a non-leader within 5pp of the leader's win probability.
  // Prefers report.robustness.recommended_option_id; falls back to max scan if
  // missing. Returns null when not in close-call territory or pre-analysis.
  const closeCallGapPp = useMemo<number | null>(() => {
    if (!isPostAnalysis || isRecommended) return null
    const report = resultsReport as any
    const probs: Record<string, { win_probability?: number }> | undefined = report?.option_probabilities
    if (!probs) return null
    const thisWin = probs[props.id]?.win_probability
    if (typeof thisWin !== 'number') return null
    let leaderWin: number | null = null
    const recommendedId = report?.robustness?.recommended_option_id as string | undefined
    if (recommendedId && typeof probs[recommendedId]?.win_probability === 'number') {
      leaderWin = probs[recommendedId]!.win_probability!
    } else {
      // Fallback: scan for max
      for (const id in probs) {
        const w = probs[id]?.win_probability
        if (typeof w === 'number' && (leaderWin == null || w > leaderWin)) leaderWin = w
      }
    }
    if (leaderWin == null) return null
    const gap = leaderWin - thisWin
    if (gap < 0 || gap > 0.05) return null
    // Floor to at least 1pp so the line never reads "within 0 percentage
    // points". A truly zero gap is already filtered by the isRecommended
    // early return (within-0.0001 tolerance), but rounding can still produce
    // 0 from a small positive gap like 0.004.
    return Math.max(1, Math.round(gap * 100))
  }, [isPostAnalysis, isRecommended, resultsReport, props.id])

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
        const { value, displayValue } = unwrapInterventionValue(rawValue)
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
          factorId, label: cleanedLabel, value, displayValue: displayValue ?? undefined, unit,
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
    // Explicit flag wins; regex only fires when flag absent (null/undefined).
    const explicit = (props.data as any)?.is_baseline as boolean | null | undefined
    if (typeof explicit === 'boolean') return explicit
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
      const explicit = (n.data as any)?.is_baseline as boolean | null | undefined
      if (typeof explicit === 'boolean') return explicit
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
        const { value: v } = unwrapInterventionValue(rv)
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
        // Graph v1.1 Task 6: compaction for pre-analysis pills. Bumped from 15
        // to 22 so multi-word factor labels (e.g. "Senior technical leadership")
        // read more meaningfully before truncation; still fits MAX_NODE_W=300.
        const shortLabel = compactFactorLabel(c.label, 22)

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
   * Differentiator line — a complete sentence describing what's strategically
   * unique about this option (Standard pre-analysis only).
   *
   * Delegates to computeAllDifferentiators() which computes all options in
   * one pass. See that helper's docblock for the algorithm, thresholds, and
   * deduplication logic. Returns null for baseline/post-analysis.
   */
  const differentiatorLabel = useMemo<string | null>(() => {
    if (isPostAnalysis) return null
    if (isBaselineOption) return null
    const allDiffs = computeAllDifferentiators(nodes, ceeAnalysisReady)
    return allDiffs.get(props.id) ?? null
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
      const { value: winnerVal } = unwrapInterventionValue(winnerInterventions[topFactor.id])
      const { value: thisVal } = unwrapInterventionValue(thisInterventions[topFactor.id])
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

  // ----- Coaching chip cluster (shared between Standard popover and Detailed inline) -----
  // All option AI chips live here. Body never renders chips directly.
  const optionChips = useMemo(() => {
    const optionLabel = (props.data?.label as string) ?? 'this option'
    if (isPostAnalysis) {
      if (isBaselineOption) {
        // Baseline chips already pre-existed inside layer2Content; keep them.
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="Why does this win/lose?" message={`Why does the status quo (${optionLabel}) win or lose compared to other options?`} />
            <NodeChip label="Risks of inaction" message="What are the risks of choosing to do nothing?" />
          </div>
        )
      }
      if (isRecommended) {
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="What would change this?" message={`What would need to change for ${optionLabel} to no longer be the best choice?`} />
            <NodeChip label="Why does this lead?" message={`Why does ${optionLabel} lead over the other options?`} />
          </div>
        )
      }
      // Non-winner, non-baseline
      if (displayMetadata.winRate !== null) {
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {closeCallGapPp != null && (
              <NodeChip
                label="What would change this?"
                message={`What would need to change for ${optionLabel} to become the leader?`}
              />
            )}
            <NodeChip label="What would make this lead?" message={`What would need to change for ${optionLabel} to lead?`} />
          </div>
        )
      }
      return null
    }
    // Pre-analysis: only non-baseline gets a chip
    if (!isBaselineOption) {
      return (
        <div className="flex gap-1 flex-wrap mt-1.5">
          <NodeChip label="What could go wrong?" message={`What could go wrong if we choose ${optionLabel}?`} />
        </div>
      )
    }
    return null
  }, [isPostAnalysis, isBaselineOption, isRecommended, displayMetadata.winRate, closeCallGapPp, props.data])

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
                // Skip delta arithmetic when CEE provided a qualitative displayValue
                // for the target — pairing "Doubled capacity" with "(+70%)" produces
                // scale mismatch (numeric delta on a non-numeric framing). The
                // verbatim target string already conveys the change.
                if (!isBaselineOption && !chip.displayValue) {
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
                        // Strip displayValue — it describes the target intervention, not the baseline.
                        const baselineFormatted = formatChipValue({ ...chip, value: baselineNorm, displayValue: undefined })
                        // Polish 4 review fix: only build the delta string when
                        // both formatChipValue calls produced meaningful output.
                        // Otherwise we'd render " → ()" for scale-unit factors
                        // (empty baselineFormatted + empty targetFormatted).
                        if (baselineFormatted && targetFormatted) {
                          deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                        }
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
              {formatWinProbability(displayMetadata.winRate ?? 0)} win rate across simulations
            </p>
          )}
        </>
      )}

      {isOptionFromCee && !isBaselineOption && (
        <div className="mt-0.5">
          <BriefIcon />
        </div>
      )}

      {/* Coaching chips — Standard view: live in popover; Detailed view: live
          in this inline layer-2 block. Body never renders chips directly. */}
      {optionChips}
    </>
  ), [isPostAnalysis, goalProbability, handleGoalReviewClick, interventionChips, isBaselineOption, baselineOptionInterventions, isOptionFromCee, props.data, displayMetadata.winRate, optionChips])

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
        {optionChips}
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
        {optionChips}
      </>
    )
  }, [isPostAnalysis, isBaselineOption, totalInterventionCount, interventionChips, props.data, optionChips])

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
              {formatWinProbability(displayMetadata.winRate)} win probability
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

        {/* Graph v2 Task 4: close-call line — only when within 5pp of leader.
            Renders ABOVE the existing "Behind:" reason so users see both the
            closeness signal and the causal explanation. */}
        {closeCallGapPp != null && (
          <p className={`${typography.nodeLabel} text-warning mt-0.5 m-0`}>
            Close call: within {closeCallGapPp} percentage point{closeCallGapPp !== 1 ? 's' : ''}
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
                style={{ fontSize: 11, borderWidth: '0.5px' }}
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
            {differentiatorLabel}
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

        {/* Coaching chips moved into popover (Standard) / Detailed inline
            layer-2. See `optionChips` useMemo above and the popover branches
            at the bottom of this file. */}

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
            {/* Coaching chips inline (Detailed pre-analysis) — Standard renders
                them in the popover instead. */}
            {optionChips}
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

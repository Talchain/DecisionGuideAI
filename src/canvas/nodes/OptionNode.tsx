import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { FileText, Cpu } from 'lucide-react'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit, QUALITATIVE_FACTOR_TYPES } from '../utils/labelUtils'
import { detectBaseline } from '../utils/baselineDetection'

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

  // T7b: Win probability post-analysis
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')

  const nodes = useCanvasStore(state => state.nodes)
  const resultsReport = useCanvasStore(state => state.results.report)

  // T7b: "Recommended" badge — highest winRate option among visible canvas options only
  const isRecommended = useMemo(() => {
    if (!displayMetadata.isResultsMode || displayMetadata.winRate === null) return false
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    if (optionNodes.length < 2) return false
    // Compare only visible canvas option IDs — ignores stale/hidden options in the report
    const visibleOptionIds = new Set(optionNodes.map(n => n.id))
    const report = resultsReport as any
    const optionProbabilities: Record<string, { win_probability?: number }> = report?.option_probabilities ?? {}
    const allRates = Object.entries(optionProbabilities)
      .filter(([id]) => visibleOptionIds.has(id))
      .map(([, v]) => typeof v?.win_probability === 'number' ? v.win_probability : null)
      .filter((v): v is number => v !== null)
    if (allRates.length === 0) return false
    const maxRate = Math.max(...allRates)
    return displayMetadata.winRate >= maxRate - 0.0001 // float tolerance
  }, [displayMetadata.isResultsMode, displayMetadata.winRate, nodes, resultsReport])
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const setHoveredOption = useCanvasStore(state => state.setHoveredOption)

  // T8: Readable intervention chips with cleaned labels and formatted values
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
        // Sentence case: uppercase first char, lowercase subsequent words
        // unless they look like acronyms (all-caps, ≥2 chars — e.g. ICP, ROI)
        const cleanedLabel = stripped.length > 0
          ? stripped.charAt(0).toUpperCase() +
            stripped.slice(1).replace(/\b([A-Za-z]+)\b/g, (word) =>
              /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()
            )
          : stripped
        const observedState = factorNode?.data?.observedState as {
          unit?: string
          factor_type?: string
          cap?: number
          value?: number
          raw_value?: string | number
        } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        const factorType = observedState?.factor_type
        const cap = observedState?.cap
        return {
          factorId,
          label: cleanedLabel,
          value,
          unit,
          factorType,
          cap,
          observedValue: observedState?.value,
          observedRawValue: observedState?.raw_value,
        }
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3)
  }, [ceeAnalysisReady, props.id, nodes])

  const hasInterventions = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    return !!(ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0)
  }, [ceeAnalysisReady, props.id])

  // T: Detect if this option is the baseline (status quo). Baseline options show
  // absolute values; non-baseline options show "baseline → target (+X%)" deltas.
  const isBaselineOption = useMemo(() => {
    if ((props.data as any)?.is_baseline === true) return true
    const label = (props.data?.label as string | undefined) ?? ''
    return detectBaseline(label).isBaseline
  }, [props.data])

  // P0.2: Baseline option's intervention values per factor, for delta display.
  // Finds the baseline option node among canvas nodes and reads its CEE interventions.
  // Falls back to undefined if no baseline option exists or doesn't intervene on a factor.
  const baselineOptionInterventions = useMemo<Record<string, number> | null>(() => {
    if (isBaselineOption) return null // baseline option shows absolute, not delta
    const options = ceeAnalysisReady?.options
    if (!options) return null

    // Find the baseline option node on canvas
    const baselineNode = nodes.find(n => {
      if (n.id === props.id) return false // skip self
      if (n.type !== 'option' && n.data?.type !== 'option') return false
      if ((n.data as any)?.is_baseline === true) return true
      const lbl = (n.data?.label as string | undefined) ?? ''
      return detectBaseline(lbl).isBaseline
    })
    if (!baselineNode) return null

    const baseCeeOption = options.find(opt => opt.id === baselineNode.id)
    if (!baseCeeOption?.interventions) return null

    // Normalise to Record<string, number>
    return Object.fromEntries(
      Object.entries(baseCeeOption.interventions).map(([fid, rv]) => {
        const v = typeof rv === 'number' ? rv :
          (rv && typeof rv === 'object' && 'value' in rv) ?
          Number((rv as { value: unknown }).value) : 0
        return [fid, v]
      })
    )
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  // Binary factor detection: a factor is truly binary if ALL its intervention values
  // across ALL options are exactly 0 or 1 (no intermediate values like 0.5).
  const binaryFactorIds = useMemo<Set<string>>(() => {
    const options = ceeAnalysisReady?.options
    if (!options) return new Set()
    // Collect all intervention values per factor across all options
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

  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) setHoveredOption(props.id)
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  // UI-SEM-048: Option provenance inferred from creation context.
  // CEE schema gap: provenance_source not emitted on option nodes (DraftChat CIL 0.2
  // strips it). Workaround: if the option ID appears in ceeAnalysisReady.options, it
  // was generated from the user's brief; otherwise it was user-created or from a template.
  // Remove when CEE provides provenance_source on option nodes.
  const isOptionFromCee = useMemo(() =>
    ceeAnalysisReady?.options?.some(opt => opt.id === props.id) ?? false,
  [ceeAnalysisReady, props.id])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      {/* Winner badge — absolute top-right, outside node body */}
      {isRecommended && (
        <span className={`absolute -top-2 -right-2 z-10 ${typography.nodeLabel} bg-panel border border-success/30 text-text-body rounded-full px-1.5 py-0.5`}>
          Winner
        </span>
      )}
      <BaseNode {...props} nodeType="option" icon={metadata.icon}>
        {/* T7b: Win probability — only in results mode */}
        {displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
          <div className="mt-2 mb-2">
            <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
              <span className={`${typography.nodeTitle} font-semibold text-text-body`}>
                {Math.round(displayMetadata.winRate * 100)}%
              </span>
              <span className={`${typography.nodeLabel} text-text-light`}>win probability</span>
            </div>
            <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full bg-option rounded-full transition-all duration-300"
                style={{ width: displayMetadata.winRate > 0 ? `max(8px, ${Math.round(displayMetadata.winRate * 100)}%)` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* T8: Readable intervention chips with delta for non-baseline options */}
        {interventionChips.length > 0 && (() => {
          // Determine which chips represent no change (baseline = intervention).
          // A chip is "no change" when its value matches the baseline value within tolerance.
          const chipsWithMeta = interventionChips.map(chip => {
            const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
            const isNoChange = !isBaselineOption && baselineNorm !== undefined &&
              Math.abs(chip.value - baselineNorm) < 1e-6
            return { chip, isNoChange }
          })
          // Guard: if hiding no-change chips would remove ALL chips, keep them all dimmed instead
          const allNoChange = chipsWithMeta.length > 0 && chipsWithMeta.every(c => c.isNoChange)

          if (allNoChange) {
            return (
              <div className={`${typography.nodeLabel} mt-1 text-text-light`}>
                No changes from current state
              </div>
            )
          }

          return (
            <div className={`${typography.nodeLabel} mt-1 flex flex-col gap-1`}>
              {chipsWithMeta.map(({ chip, isNoChange }, idx) => {
                // Skip no-change chips
                if (isNoChange) return null

                // Binary qualitative On/Off display
                const effectiveUnit = chip.unit && !isSuppressedUnit(chip.unit) ? chip.unit : undefined
                const ft = chip.factorType?.toLowerCase().trim()
                const isQualitativeFactor = !effectiveUnit && chip.cap == null &&
                  (!ft || QUALITATIVE_FACTOR_TYPES.has(ft))
                const isBinary = isQualitativeFactor && binaryFactorIds.has(chip.factorId)

                let targetFormatted: string
                if (isBinary) {
                  targetFormatted = chip.value === 1 ? 'On' : chip.value === 0 ? 'Off' : formatInterventionValue(
                    chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue,
                  )
                } else {
                  targetFormatted = formatInterventionValue(
                    chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue,
                  )
                }

                // Delta display: show "baseline → target (+X%)" for non-baseline options
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
                          ? (baselineNorm === 1 ? 'On' : baselineNorm === 0 ? 'Off' : formatInterventionValue(
                              baselineNorm, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue,
                            ))
                          : formatInterventionValue(
                              baselineNorm, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue,
                            )
                        deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                      }
                    }
                  }
                }

                return (
                  <div
                    key={idx}
                    className="inline-flex items-baseline gap-1 flex-wrap text-text-body"
                  >
                    <span className="text-text-light truncate" style={{ maxWidth: '150px' }} title={chip.label}>
                      {chip.label}:
                    </span>
                    <span className="font-semibold shrink-0">
                      {deltaDisplay ?? targetFormatted}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {isOptionFromCee && (
          <div className="flex justify-end mt-1">
            <FileText size={14} className="text-text-light" aria-hidden="true" title="Values from your brief" />
          </div>
        )}

        {typeof props.data?.description === 'string' && props.data.description && (
          <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
            {props.data.description}
          </div>
        )}
      </BaseNode>
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

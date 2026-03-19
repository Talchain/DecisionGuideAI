import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase } from '../utils/labelUtils'
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

  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) setHoveredOption(props.id)
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ height: '100%', width: '100%' }}
    >
      <BaseNode {...props} nodeType="option" icon={metadata.icon}>
        {/* T7b: Win probability — only in results mode */}
        {displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
          <div className="mt-2 mb-2">
            <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
              <span className={`${typography.nodeTitle} font-semibold text-option`}>
                {Math.round(displayMetadata.winRate * 100)}%
              </span>
              <span className={`${typography.nodeLabel} text-text-light`}>win probability</span>
              {isRecommended && (
                <span className={`${typography.nodeLabel} bg-panel border border-success/30 text-text-body rounded-full px-1.5 py-0.5 ml-auto`}>
                  Recommended
                </span>
              )}
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
        {interventionChips.length > 0 && (
          <div className={`${typography.nodeLabel} mt-1 flex flex-col gap-1`}>
            {interventionChips.map((chip, idx) => {
              const targetFormatted = formatInterventionValue(
                chip.value,
                chip.unit,
                chip.factorType,
                chip.cap,
                chip.observedValue,
                chip.observedRawValue,
              )

              // Delta display: show "baseline → target (+X%)" for non-baseline options.
              // Priority: baseline option's intervention value for this factor (P0.2 fix);
              // fallback to the factor's own observed state value when no baseline option exists.
              let deltaDisplay: string | null = null
              if (!isBaselineOption) {
                // Prefer the baseline option's intervention value; fall back to observedState
                const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
                if (baselineNorm !== undefined) {
                  const scaleBase = inferInterventionScaleBase(chip.cap, chip.observedValue, chip.observedRawValue)
                  const hasUnit = !!chip.unit && chip.unit !== 'fraction' && chip.unit !== 'proportion'
                  const isQualitative = !chip.factorType || ['quality', 'demand', 'other'].includes(chip.factorType.toLowerCase())

                  if ((hasUnit || !isQualitative) && scaleBase != null) {
                    // Denormalise both sides to the same real-world scale for delta %
                    const denormedBaseline = denormaliseInterventionValue(baselineNorm, chip.cap, chip.observedValue, chip.observedRawValue)
                    const denormedTarget = denormaliseInterventionValue(chip.value, chip.cap, chip.observedValue, chip.observedRawValue)
                    if (Math.abs(denormedBaseline) > 0.01) {
                      const pct = ((denormedTarget - denormedBaseline) / Math.abs(denormedBaseline)) * 100
                      const sign = pct >= 0 ? '+' : ''
                      const baselineFormatted = formatInterventionValue(
                        baselineNorm,
                        chip.unit,
                        chip.factorType,
                        chip.cap,
                        chip.observedValue,
                        chip.observedRawValue,
                      )
                      deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                    }
                  }
                }
              }

              return (
                <div
                  key={idx}
                  className="text-text-body inline-flex items-baseline gap-1 flex-wrap"
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
        )}

        {/* TODO(CIL): provenance_source stripped by DraftChat CIL 0.2 — reinstate when edge data carries provenance.
            OptionNode has no provenance pill because DraftChat does not preserve provenance_source on option nodes.
            Once DraftChat maps provenance_source through, add a pill here mirroring FactorNode / GoalNode pattern. */}

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

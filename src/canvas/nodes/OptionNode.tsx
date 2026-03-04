import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue } from '../utils/labelUtils'

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
  const interventionChips = useMemo(() => {
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
        // Sentence case: first letter upper, rest lower (preserves words ≤3 chars as-is to protect acronyms)
        // Sentence case: uppercase first char, lowercase subsequent words
        // unless they look like acronyms (all-caps, ≥2 chars — e.g. ICP, ROI)
        const cleanedLabel = stripped.length > 0
          ? stripped.charAt(0).toUpperCase() +
            stripped.slice(1).replace(/\b([A-Za-z]+)\b/g, (word) =>
              /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()
            )
          : stripped
        const observedState = factorNode?.data?.observedState as { unit?: string; factor_type?: string } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        const factorType = observedState?.factor_type
        return { label: cleanedLabel, value, unit, factorType }
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3)
  }, [ceeAnalysisReady, props.id, nodes])

  const hasInterventions = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    return !!(ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0)
  }, [ceeAnalysisReady, props.id])

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
      style={{ height: '100%', width: '100%', minWidth: '238px' }}
    >
      <BaseNode {...props} nodeType="option" icon={metadata.icon} maxWidth={238}>
        {/* T7b: Win probability — only in results mode */}
        {displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
          <div className="mt-2 mb-2">
            <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
              <span className={`${typography.nodeTitle} font-semibold text-option`}>
                {Math.round(displayMetadata.winRate * 100)}%
              </span>
              <span className={`${typography.nodeLabel} text-text-light`}>win probability</span>
              {isRecommended && (
                <span className={`${typography.nodeLabel} bg-success-light text-success rounded-full px-1.5 py-0.5 ml-auto`}>
                  Recommended
                </span>
              )}
            </div>
            <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full bg-option rounded-full transition-all duration-300"
                style={{ width: `${Math.round(displayMetadata.winRate * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* T8: Readable intervention chips */}
        {interventionChips.length > 0 && (
          <div className={`${typography.nodeLabel} mt-1 flex flex-col gap-0.5`}>
            {interventionChips.map((chip, idx) => (
              <div
                key={idx}
                className="bg-factor-light text-text-body inline-flex items-baseline gap-1"
                style={{ padding: '2px 8px', borderRadius: '4px' }}
              >
                <span className="text-text-light truncate" style={{ maxWidth: '150px' }} title={chip.label}>
                  {chip.label}:
                </span>
                <span className="font-medium shrink-0">
                  {formatInterventionValue(chip.value, chip.unit, chip.factorType)}
                </span>
              </div>
            ))}
          </div>
        )}

        {props.data?.description && (
          <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
            {props.data.description}
          </div>
        )}
      </BaseNode>
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

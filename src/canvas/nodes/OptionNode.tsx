import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { formatDisplayValue } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option

  // Decision Graph Display v2 Task 7: Win rate display
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')

  // Decision Graph Display v2 Task 7: Intervention delta display
  // Fix: Read interventions from ceeAnalysisReady, NOT from props.data.interventions
  // The interventions live in ceeAnalysisReady.options[] after CEE response, not on node data
  const nodes = useCanvasStore(state => state.nodes)
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const setHoveredOption = useCanvasStore(state => state.setHoveredOption)

  const interventionDeltas = useMemo(() => {
    // Look up this option's interventions from ceeAnalysisReady
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    const interventions = ceeOption?.interventions
    if (!interventions || typeof interventions !== 'object') return []

    // Fix 2: Convert to array and get top 2 by absolute value
    // Handle both formats: Record<string, number> and Record<string, {value: number}>
    return Object.entries(interventions)
      .map(([factorId, rawValue]) => {
        // Extract numeric value - handle both number and {value: number} formats
        const value = typeof rawValue === 'number' ? rawValue :
                     (rawValue && typeof rawValue === 'object' && 'value' in rawValue) ?
                     Number(rawValue.value) : 0

        const factorNode = nodes.find(n => n.id === factorId)
        const factorLabel = factorNode?.data?.label || factorId
        const unit = factorNode?.data?.unit as string | undefined
        return { factorLabel, value, unit }
      })
      .filter(delta => delta.value !== 0) // Fix 2: Filter out zero interventions
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 2)
  }, [ceeAnalysisReady, props.id, nodes])

  // Decision Graph Display v2 Task 11: Intervention highlighting on hover
  // Fix: Check ceeAnalysisReady for interventions, not props.data
  const hasInterventions = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    return ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0
  }, [ceeAnalysisReady, props.id])

  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) {
      setHoveredOption(props.id)
    }
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ height: '100%', width: '100%' }}>
      <BaseNode {...props} nodeType="option" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 7 (partial): Win rate */}
      {displayMetadata.winRate !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-info-600`}>
          Wins {Math.round(displayMetadata.winRate * 100)}% of scenarios
        </div>
      )}

      {/* Decision Graph Display v2 Task 7 + Task E + Task 4: Intervention deltas with formatted values */}
      {interventionDeltas.length > 0 && (
        <div className={`${typography.nodeLabel} text-slate-500 mt-1`}>
          {interventionDeltas.map((delta, idx) => {
            // Task 4: Better value formatting with sign prefix
            const sign = delta.value > 0 ? '+' : ''
            let formattedValue: string
            if (delta.unit === 'fraction') {
              // Fraction → percentage
              formattedValue = `${sign}${Math.round(delta.value * 100)}%`
            } else if (delta.unit) {
              // Other unit → formatted value with space and unit
              formattedValue = `${sign}${formatDisplayValue(delta.value, delta.unit)} ${delta.unit}`
            } else {
              // No unit → just formatted value with sign
              formattedValue = `${sign}${formatDisplayValue(delta.value)}`
            }

            // Task E: Truncate label if > 20 chars, add title for full label on hover
            const truncatedLabel = delta.factorLabel.length > 20
              ? delta.factorLabel.substring(0, 20) + '...'
              : delta.factorLabel

            return (
              <div key={idx} className="mb-0.5">
                <span className="font-medium" title={delta.factorLabel}>{truncatedLabel}:</span>{' '}
                <span className="text-success-600">
                  {formattedValue}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

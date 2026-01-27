import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option

  // Decision Graph Display v2 Task 7: Win rate display
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')

  // Decision Graph Display v2 Task 7: Intervention delta display
  const nodes = useCanvasStore(state => state.nodes)
  const setHoveredOption = useCanvasStore(state => state.setHoveredOption)

  const interventionDeltas = useMemo(() => {
    const interventions = props.data?.interventions
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
  }, [props.data?.interventions, nodes])

  // Decision Graph Display v2 Task 11: Intervention highlighting on hover
  const handleMouseEnter = useMemo(() => () => {
    if (props.data?.interventions) {
      setHoveredOption(props.id)
    }
  }, [props.id, props.data?.interventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ height: '100%', width: '100%' }}>
      <BaseNode {...props} nodeType="option" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 7 (partial): Win rate */}
      {displayMetadata.winRate !== null && (
        <div className="text-xs font-semibold mb-1 text-info-600">
          Wins {Math.round(displayMetadata.winRate * 100)}% of scenarios
        </div>
      )}

      {/* Decision Graph Display v2 Task 7 + Task E: Intervention deltas with unit formatting */}
      {interventionDeltas.length > 0 && (
        <div className="text-xs text-slate-500 mt-1">
          {interventionDeltas.map((delta, idx) => {
            // Task E + Fix 6: Format value based on unit (with space between value and unit)
            let formattedValue: string
            if (delta.unit === 'fraction') {
              // Fraction → percentage
              formattedValue = `${delta.value > 0 ? '+' : ''}${(delta.value * 100).toFixed(0)}%`
            } else if (delta.unit) {
              // Other unit → append unit with space
              formattedValue = `${delta.value > 0 ? '+' : ''}${delta.value} ${delta.unit}`
            } else {
              // No unit → just value with sign
              formattedValue = `${delta.value > 0 ? '+' : ''}${delta.value}`
            }

            // Task E: Truncate label if > 20 chars
            const truncatedLabel = delta.factorLabel.length > 20
              ? delta.factorLabel.substring(0, 20) + '...'
              : delta.factorLabel

            return (
              <div key={idx} className="mb-0.5">
                <span className="font-medium">{truncatedLabel}:</span>{' '}
                <span className="text-success-600">
                  {formattedValue}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {props.data?.description && (
        <div className="text-xs opacity-70">
          {props.data.description}
        </div>
      )}
    </BaseNode>
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

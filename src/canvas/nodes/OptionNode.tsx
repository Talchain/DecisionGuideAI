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
    const interventions = props.data?.interventions as Record<string, number> | undefined
    if (!interventions || typeof interventions !== 'object') return []

    // Convert to array and get top 2 by absolute value
    return Object.entries(interventions)
      .map(([factorId, value]) => {
        const factorNode = nodes.find(n => n.id === factorId)
        const factorLabel = factorNode?.data?.label || factorId
        const unit = factorNode?.data?.unit as string | undefined
        return { factorLabel, value, unit }
      })
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
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#2563eb' }}>
          Wins {Math.round(displayMetadata.winRate * 100)}% of scenarios
        </div>
      )}

      {/* Decision Graph Display v2 Task 7 + Task E: Intervention deltas with unit formatting */}
      {interventionDeltas.length > 0 && (
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
          {interventionDeltas.map((delta, idx) => {
            // Task E: Format value based on unit
            let formattedValue: string
            if (delta.unit === 'fraction') {
              // Fraction → percentage
              formattedValue = `${delta.value > 0 ? '+' : ''}${(delta.value * 100).toFixed(0)}%`
            } else if (delta.unit) {
              // Other unit → append unit
              formattedValue = `${delta.value > 0 ? '+' : ''}${delta.value}${delta.unit}`
            } else {
              // No unit → just value with sign
              formattedValue = `${delta.value > 0 ? '+' : ''}${delta.value}`
            }

            // Task E: Truncate label if > 20 chars
            const truncatedLabel = delta.factorLabel.length > 20
              ? delta.factorLabel.substring(0, 20) + '...'
              : delta.factorLabel

            return (
              <div key={idx} style={{ marginBottom: '2px' }}>
                <span style={{ fontWeight: 500 }}>{truncatedLabel}:</span>{' '}
                <span style={{ color: '#059669' }}>
                  {formattedValue}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {props.data?.description && (
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

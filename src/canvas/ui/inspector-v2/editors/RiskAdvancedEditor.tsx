/**
 * RiskAdvancedEditor — structured technical detail for risk nodes.
 * Groups: Post-analysis (per option exposure), Metadata.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'

interface RiskAdvancedEditorProps {
  nodeId: string
}

export function RiskAdvancedEditor({ nodeId }: RiskAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const optionComparison = useCanvasStore(s => (s.results?.report as any)?.option_comparison) as
    Array<{ option_id: string; option_label?: string; win_probability?: number }> | undefined

  const data = node?.data as Record<string, unknown> | undefined
  const inboundCount = edges.filter(e => e.target === nodeId).length
  const isResultsMode = resultsStatus === 'complete'

  // Per-option exposure from results (placeholder — uses win_probability as proxy until risk exposure data exists)
  const optionStats = useMemo(() => {
    if (!isResultsMode || !optionComparison) return []
    return optionComparison.map(o => ({
      label: o.option_label ?? o.option_id,
      exposure: o.win_probability != null ? `${Math.round(o.win_probability * 100)}%` : '—',
    }))
  }, [isResultsMode, optionComparison])

  if (!node) return null

  return (
    <div className="space-y-1">
      {optionStats.length > 0 && (
        <AdvancedFieldGroup title="Post-analysis (per option)">
          {optionStats.map((o, i) => (
            <AdvancedField
              key={i}
              label={`${o.label}: exposure`}
              value={o.exposure}
              type="readonly"
            />
          ))}
        </AdvancedFieldGroup>
      )}

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField label="Node ID" value={nodeId} type="readonly" />
        <AdvancedField label="Kind" value="risk" type="readonly" />
        <AdvancedField label="Inbound factors" value={inboundCount} type="readonly" />
        <AdvancedField
          label="Description"
          value={(data?.description as string) ?? ''}
          onChange={v => mutations.setDescription(v as string)}
          type="textarea"
          placeholder="Risk description"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

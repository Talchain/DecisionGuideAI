/**
 * OutcomeAdvancedEditor — structured technical detail for outcome nodes.
 * Groups: Metadata, Post-analysis (readonly).
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'

interface OutcomeAdvancedEditorProps {
  nodeId: string
}

export function OutcomeAdvancedEditor({ nodeId }: OutcomeAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const optionComparison = useCanvasStore(s => (s.results?.report as any)?.option_comparison) as
    Array<{ option_id: string; option_label?: string; outcome?: { mean?: number }; win_probability?: number; p10?: number; p90?: number }> | undefined

  const data = node?.data as Record<string, unknown> | undefined
  const inboundCount = edges.filter(e => e.target === nodeId).length
  const isResultsMode = resultsStatus === 'complete'

  // Per-option post-analysis stats
  const optionStats = useMemo(() => {
    if (!isResultsMode || !optionComparison) return []
    return optionComparison.map(o => ({
      label: o.option_label ?? o.option_id,
      mean: o.outcome?.mean,
      p10: o.p10,
      p90: o.p90,
    }))
  }, [isResultsMode, optionComparison])

  if (!node) return null

  return (
    <div className="space-y-1">
      {optionStats.length > 0 && (
        <AdvancedFieldGroup title="Post-analysis (per option)">
          {optionStats.map((o, i) => (
            <div key={i}>
              <AdvancedField
                label={`${o.label}: mean`}
                value={o.mean != null ? o.mean.toFixed(0) : '—'}
                type="readonly"
              />
              {o.p10 != null && o.p90 != null && (
                <AdvancedField
                  label={`${o.label}: CI [5th, 95th]`}
                  value={`[${o.p10.toFixed(0)}, ${o.p90.toFixed(0)}]`}
                  type="readonly"
                />
              )}
            </div>
          ))}
        </AdvancedFieldGroup>
      )}

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField label="Node ID" value={nodeId} type="readonly" />
        <AdvancedField label="Kind" value="outcome" type="readonly" />
        <AdvancedField label="Inbound factors" value={inboundCount} type="readonly" />
        <AdvancedField
          label="Description"
          value={(data?.description as string) ?? ''}
          onChange={v => mutations.setDescription(v as string)}
          type="textarea"
          placeholder="Outcome description"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

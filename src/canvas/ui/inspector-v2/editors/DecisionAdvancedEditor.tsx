/**
 * DecisionAdvancedEditor — minimal technical detail for decision nodes.
 */

import { useCanvasStore } from '../../../store'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'

interface DecisionAdvancedEditorProps {
  nodeId: string
}

export function DecisionAdvancedEditor({ nodeId }: DecisionAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const edges = useCanvasStore(s => s.edges)

  const optionCount = edges.filter(e => e.source === nodeId).length

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Metadata">
        <AdvancedField label="Node ID" value={nodeId} type="readonly" />
        <AdvancedField label="Kind" value="decision" type="readonly" />
        <AdvancedField label="Connected options" value={optionCount} type="readonly" />
      </AdvancedFieldGroup>
    </div>
  )
}

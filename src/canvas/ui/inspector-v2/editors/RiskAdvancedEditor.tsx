/**
 * RiskAdvancedEditor — structured technical detail for risk nodes.
 * Groups: Metadata.
 *
 * #2747 r2 (BLOCKING 7): the "Post-analysis (per option)" group is removed. It printed each option's WIN SHARE as that
 * option's "exposure" to this risk, a different quantity under the wrong name (its own comment called it a placeholder
 * proxy). No producer sends a per-option risk exposure, so nothing replaces it.
 */

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

  const data = node?.data as Record<string, unknown> | undefined
  const inboundCount = edges.filter(e => e.target === nodeId).length

  if (!node) return null

  return (
    <div className="space-y-1">
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

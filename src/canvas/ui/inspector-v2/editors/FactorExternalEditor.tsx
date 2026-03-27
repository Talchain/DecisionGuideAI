/**
 * FactorExternalEditor — structured technical detail for external factors.
 * Groups: Prior distribution, Classification.
 */

import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'

interface FactorExternalEditorProps {
  nodeId: string
}

export function FactorExternalEditor({ nodeId }: FactorExternalEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const prior = data?.prior as Record<string, unknown> | undefined
  const rangeMin = prior?.range_min as number | undefined
  const rangeMax = prior?.range_max as number | undefined

  const mu = rangeMin != null && rangeMax != null ? ((rangeMin + rangeMax) / 2).toFixed(2) : '—'
  const sigma = rangeMin != null && rangeMax != null ? ((rangeMax - rangeMin) / Math.sqrt(12)).toFixed(2) : '—'

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Prior distribution">
        <AdvancedField
          label="Distribution type"
          value="uniform"
          type="readonly"
        />
        <AdvancedField
          label="Range minimum"
          value={rangeMin}
          onChange={v => mutations.setPriorRange(v as number, rangeMax ?? 1)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        <AdvancedField
          label="Range maximum"
          value={rangeMax}
          onChange={v => mutations.setPriorRange(rangeMin ?? 0, v as number)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        <p className={`${typography.panelMeta} text-text-light mt-1`}>
          ISL converts to Normal({'\u03BC'}={mu}, {'\u03C3'}={sigma})
        </p>
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Classification">
        <AdvancedField
          label="Category"
          value="external"
          type="readonly"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

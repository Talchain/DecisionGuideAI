/**
 * FactorObservableEditor — structured technical detail for observable factors.
 * Same as controllable minus: factor_type, uncertainty_drivers. Category locked.
 */

import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'

const EXTRACTION_OPTIONS = [
  { value: 'explicit', label: 'Explicit' },
  { value: 'inferred', label: 'Inferred' },
]

interface FactorObservableEditorProps {
  nodeId: string
}

export function FactorObservableEditor({ nodeId }: FactorObservableEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const obs = data?.observedState as Record<string, unknown> | undefined
  const stateSpace = data?.state_space as Record<string, unknown> | undefined
  const ssRange = stateSpace?.range as Record<string, unknown> | undefined

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Observed state">
        <AdvancedField
          label="Normalised value"
          value={obs?.value as number | undefined}
          onChange={v => mutations.setObservedValue(v as number)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        <AdvancedField
          label="Raw value"
          value={obs?.raw_value as number | undefined}
          onChange={v => mutations.setObservedRawValue(v as number)}
          type="number"
          placeholder="Original units"
        />
        <AdvancedField
          label="Unit"
          value={(obs?.unit as string) ?? ''}
          onChange={v => mutations.setObservedUnit(v as string)}
          type="text"
          placeholder="£, %, users…"
        />
        <AdvancedField
          label="Scale cap"
          value={obs?.cap as number | undefined}
          onChange={v => mutations.setObservedCap(v as number)}
          type="number"
          min={0}
        />
        <AdvancedField
          label="Baseline"
          value={obs?.baseline as number | undefined}
          onChange={v => mutations.setObservedBaseline(v as number)}
          type="number"
        />
        <AdvancedField
          label="Source"
          value={(obs?.source as string) ?? ''}
          onChange={v => mutations.setObservedSource(v as string)}
          type="text"
          placeholder="e.g. Q3 report"
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Classification">
        <AdvancedField
          label="Category"
          value="observable"
          type="readonly"
        />
        <AdvancedField
          label="Extraction type"
          value={(data?.extractionType as string) ?? ''}
          onChange={v => mutations.setExtractionType(v as 'explicit' | 'inferred')}
          type="select"
          options={EXTRACTION_OPTIONS}
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Normalisation range">
        <AdvancedField
          label="Range minimum"
          value={ssRange?.min as number | undefined}
          onChange={v => mutations.setStateSpaceRange(v as number, (ssRange?.max as number) ?? 1)}
          type="number"
        />
        <AdvancedField
          label="Range maximum"
          value={ssRange?.max as number | undefined}
          onChange={v => mutations.setStateSpaceRange((ssRange?.min as number) ?? 0, v as number)}
          type="number"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

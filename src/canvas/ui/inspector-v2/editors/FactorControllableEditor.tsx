/**
 * FactorControllableEditor — structured technical detail for controllable factors.
 * Groups: Observed state, Classification, Normalisation range, Uncertainty drivers.
 */

import { useState, useCallback } from 'react'
import { X, Plus } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { getProvenanceLabel } from '../inspectorStrings'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'
import { unwrapInterventionValue } from '../../../utils/labelUtils'

const FACTOR_TYPES = [
  { value: '', label: '—' },
  { value: 'cost', label: 'Cost' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'time', label: 'Time' },
  { value: 'effort', label: 'Effort' },
  { value: 'quality', label: 'Quality' },
  { value: 'risk_factor', label: 'Risk factor' },
  { value: 'satisfaction', label: 'Satisfaction' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_OPTIONS = [
  { value: 'controllable', label: 'Controllable' },
  { value: 'observable', label: 'Observable' },
  { value: 'external', label: 'External' },
]

const EXTRACTION_OPTIONS = [
  { value: 'explicit', label: 'Explicit' },
  { value: 'inferred', label: 'Inferred' },
]

interface FactorControllableEditorProps {
  nodeId: string
}

export function FactorControllableEditor({ nodeId }: FactorControllableEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const obs = data?.observedState as Record<string, unknown> | undefined
  const stateSpace = data?.state_space as Record<string, unknown> | undefined
  const ssRange = stateSpace?.range as Record<string, unknown> | undefined
  const drivers = (data?.uncertainty_drivers as string[]) ?? []

  // Defensive unwrap: observedState.value / raw_value / baseline / std should
  // be plain numbers, but legacy / future CEE shapes may wrap them as
  // `{ value: number }` objects. AdvancedField does `String(value ?? '')`
  // unconditionally, which produces "[object Object]" in the editor input
  // for compound shapes. unwrapInterventionValue is generic numeric defense.
  // Same fix class as the panel-level unwraps in Task 2.
  const obsValue = unwrapInterventionValue(obs?.value).value ?? undefined
  const obsRawValue = unwrapInterventionValue(obs?.raw_value).value ?? undefined
  const obsBaseline = unwrapInterventionValue(obs?.baseline).value ?? undefined
  const obsStd = unwrapInterventionValue(obs?.std).value ?? undefined
  const obsCap = unwrapInterventionValue(obs?.cap).value ?? undefined

  const [newDriver, setNewDriver] = useState('')

  const handleAddDriver = useCallback(() => {
    const trimmed = newDriver.trim()
    if (!trimmed) return
    mutations.setUncertaintyDrivers([...drivers, trimmed])
    setNewDriver('')
  }, [newDriver, drivers, mutations])

  const handleRemoveDriver = useCallback((index: number) => {
    mutations.setUncertaintyDrivers(drivers.filter((_, i) => i !== index))
  }, [drivers, mutations])

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Observed state">
        <AdvancedField
          label="Normalised value"
          value={obsValue}
          onChange={v => mutations.setObservedValue(v as number)}
          type="number"
          min={0}
          max={1}
          step={0.01}
        />
        <AdvancedField
          label="Raw value"
          value={obsRawValue}
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
          value={obsCap}
          onChange={v => mutations.setObservedCap(v as number)}
          type="number"
          min={0}
          helperText="Upper bound for normalisation. raw/cap = normalised."
        />
        <AdvancedField
          label="Baseline"
          value={obsBaseline}
          onChange={v => mutations.setObservedBaseline(v as number)}
          type="number"
          placeholder="Reference value"
        />
        <AdvancedField
          label="Observation uncertainty (σ)"
          value={obsStd}
          onChange={v => mutations.setObservedStd(v as number)}
          type="number"
          min={0}
          helperText="Node-level uncertainty (future use)."
        />
        <AdvancedField
          label="Source"
          value={(obs?.source as string) ?? ''}
          onChange={v => mutations.setObservedSource(v as string)}
          type="text"
          placeholder="e.g. Q3 report"
          helperText={obs?.source ? `Displays as: ${getProvenanceLabel(obs.source as string)}` : undefined}
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Classification">
        <AdvancedField
          label="Category"
          value={(data?.category as string) ?? 'controllable'}
          onChange={v => mutations.setCategory(v as 'controllable' | 'observable' | 'external')}
          type="select"
          options={CATEGORY_OPTIONS}
        />
        <AdvancedField
          label="Extraction type"
          value={(data?.extractionType as string) ?? ''}
          onChange={v => mutations.setExtractionType(v as 'explicit' | 'inferred')}
          type="select"
          options={EXTRACTION_OPTIONS}
        />
        <AdvancedField
          label="Factor type"
          value={(data?.factor_type as string) ?? ''}
          onChange={v => mutations.setFactorType(v as string)}
          type="select"
          options={FACTOR_TYPES}
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

      <AdvancedFieldGroup title="Uncertainty drivers">
        <div className="space-y-1">
          {drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={`${typography.panelMeta} text-text-body flex-1 truncate`}>{d}</span>
              <button
                onClick={() => handleRemoveDriver(i)}
                className="p-0.5 rounded hover:bg-panel-hover transition-colors flex-shrink-0"
                aria-label={`Remove driver: ${d}`}
              >
                <X size={11} className="text-text-light" />
              </button>
            </div>
          ))}
          {drivers.length === 0 && (
            <p className={`${typography.panelMeta} text-text-light`}>No drivers defined</p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <input
              value={newDriver}
              onChange={e => setNewDriver(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddDriver() }}
              placeholder="Add driver…"
              className={`${typography.panelMeta} flex-1 h-7 px-2 rounded bg-transparent border border-panel-border focus:border-primary focus:outline-none transition-colors`}
            />
            <button
              onClick={handleAddDriver}
              disabled={!newDriver.trim()}
              className="p-1 rounded hover:bg-panel-hover transition-colors disabled:opacity-30"
              aria-label="Add driver"
            >
              <Plus size={12} className="text-info" />
            </button>
          </div>
        </div>
      </AdvancedFieldGroup>
    </div>
  )
}

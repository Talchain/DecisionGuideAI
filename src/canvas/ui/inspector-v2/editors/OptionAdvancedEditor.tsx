/**
 * OptionAdvancedEditor — structured technical detail for option nodes.
 * Groups: Interventions.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'
import { unwrapInterventionValue } from '../../../utils/labelUtils'

interface OptionAdvancedEditorProps {
  nodeId: string
}

export function OptionAdvancedEditor({ nodeId }: OptionAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const nodes = useCanvasStore(s => s.nodes)
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  // Map values may be plain numbers or UIInterventionValue/CEEInterventionV3
  // objects ({ value, source, ... }); unwrapInterventionValue normalises both.
  // Entries that fail to unwrap are dropped (AdvancedField type='number'
  // requires a finite numeric value).
  const interventions = (data?.interventions as Record<string, unknown>) ?? {}

  // Build intervention rows with factor labels
  const rows = useMemo(() => {
    return Object.entries(interventions).flatMap(([factorId, rawValue]) => {
      const value = unwrapInterventionValue(rawValue)
      if (value == null) return []
      const factor = nodes.find(n => n.id === factorId)
      const factorData = factor?.data as Record<string, unknown> | undefined
      const obs = factorData?.observedState as Record<string, unknown> | undefined
      return [{
        factorId,
        label: String(factorData?.label ?? factorId),
        value,
        unit: (obs?.unit as string) ?? '',
        cap: obs?.cap as number | undefined,
      }]
    })
  }, [interventions, nodes])

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Interventions">
        {rows.length === 0 ? (
          <p className={`${typography.panelMeta} text-text-light`}>No interventions defined</p>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.factorId} className="space-y-0.5">
                <div className={`${typography.panelMeta} text-text-body font-medium truncate`}>
                  {row.label}
                </div>
                <AdvancedField
                  label="Normalised value"
                  value={row.value}
                  onChange={v => mutations.setIntervention(row.factorId, v as number)}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            ))}
          </div>
        )}
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField label="Node ID" value={nodeId} type="readonly" />
        <AdvancedField label="Kind" value="option" type="readonly" />
        <AdvancedField
          label="Description"
          value={(data?.description as string) ?? ''}
          onChange={v => mutations.setDescription(v as string)}
          type="textarea"
          placeholder="Option description"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

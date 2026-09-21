/**
 * OptionAdvancedEditor — structured technical detail for option nodes.
 * Groups: Interventions.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { useOptionInterventionCommit } from '../shared/useOptionInterventionCommit'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { parseDraftingNotes, composeDescription } from '../draftingNote'

interface OptionAdvancedEditorProps {
  nodeId: string
}

export function OptionAdvancedEditor({ nodeId }: OptionAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const nodes = useCanvasStore(s => s.nodes)
  const mutations = useNodeMutations(nodeId)

  /**
   * ⭐ THE SAME OWNER THE PANEL ABOVE USES. These tech-mode rows are the same
   * gesture on the same data as the option panel's intervention rows, and
   * before this they were a SECOND call to `mutations.setIntervention` — a pure
   * local write. Sharing the hook is what stops a fix landing on one surface
   * and not the other, which is how 3 of 5 options on the founder's board came
   * to carry no effect at all.
   */
  const { commit: commitIntervention, notice: interventionNotice } =
    useOptionInterventionCommit(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  // Map values may be plain numbers or UIInterventionValue/CEEInterventionV3
  // objects ({ value, source, ... }); unwrapInterventionValue normalises both.
  // Entries that fail to unwrap are dropped (AdvancedField type='number'
  // requires a finite numeric value).
  const interventions = (data?.interventions as Record<string, unknown>) ?? {}

  // Build intervention rows with factor labels
  const rows = useMemo(() => {
    return Object.entries(interventions).flatMap(([factorId, rawValue]) => {
      const { value } = unwrapInterventionValue(rawValue)
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
                <div className={`${typography.panelMeta} text-text-body truncate`}>
                  {row.label}
                </div>
                <AdvancedField
                  label="Normalised value"
                  value={row.value}
                  onChange={v => commitIntervention(row.factorId, v as number)}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            ))}
            {/* ⛔ THE REFUSAL, SAID OUT LOUD HERE TOO. A tech-mode surface is
                still a surface: a control that silently does nothing is the
                defect this change closes, wearing a different face. The copy is
                the hook's, not this file's, so the two surfaces cannot drift
                into describing one refusal two ways. */}
            {interventionNotice !== null && (
              <p
                className={`${typography.panelMeta} text-text-light`}
                data-testid="option-advanced-intervention-notice"
                role="status"
              >
                {interventionNotice}
              </p>
            )}
          </div>
        )}
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField label="Node ID" value={nodeId} type="readonly" />
        <AdvancedField label="Kind" value="option" type="readonly" />
        {/* ROADMAP 2.1204 — the SECOND path that reaches the description. It
            bound the raw field and wrote back raw, so a tech-mode user could
            silently erase a rephrase-absorption note that the main panel had
            just gone to trouble to protect. Same parse/compose as OptionPanel:
            a guarantee that holds on only one of its paths is not a guarantee. */}
        <AdvancedField
          label="Description"
          value={parseDraftingNotes(data?.description as string | undefined).body}
          onChange={v =>
            mutations.setDescription(
              composeDescription(
                parseDraftingNotes(data?.description as string | undefined).notes,
                v as string,
              ),
            )
          }
          type="textarea"
          placeholder="Option description"
        />
      </AdvancedFieldGroup>
    </div>
  )
}

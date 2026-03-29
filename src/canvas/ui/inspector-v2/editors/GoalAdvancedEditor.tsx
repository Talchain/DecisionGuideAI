/**
 * GoalAdvancedEditor — structured technical detail for goal nodes.
 * Groups: Threshold parameters, Constraints.
 */

import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'

interface GoalAdvancedEditorProps {
  nodeId: string
}

export function GoalAdvancedEditor({ nodeId }: GoalAdvancedEditorProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const goalThresholdRaw = data?.goal_threshold_raw as number | undefined
  const goalThresholdUnit = (data?.goal_threshold_unit as string) ?? ''
  const goalThresholdCap = data?.goal_threshold_cap as number | undefined
  const goalThreshold = data?.goal_threshold as number | undefined

  // Constraints from canvas store
  const constraints = useCanvasStore(s => {
    const n = s.nodes.find(n => n.id === nodeId)
    return (n?.data as Record<string, unknown>)?.goal_constraints as Array<Record<string, unknown>> | undefined
  }) ?? []

  if (!node) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Threshold parameters">
        <AdvancedField
          label="Normalised threshold"
          value={goalThreshold}
          type="readonly"
          helperText="Computed from raw / cap."
        />
        <AdvancedField
          label="Raw threshold"
          value={goalThresholdRaw}
          onChange={v => mutations.setThreshold(v as number, goalThresholdUnit)}
          type="number"
        />
        <AdvancedField
          label="Threshold unit"
          value={goalThresholdUnit}
          onChange={v => mutations.setThreshold(goalThresholdRaw ?? 0, v as string)}
          type="text"
          placeholder="e.g. revenue, users"
        />
        <AdvancedField
          label="Scale cap"
          value={goalThresholdCap}
          onChange={v => mutations.setGoalCap(v as number)}
          type="number"
          min={0}
          helperText="Upper bound for goal scale."
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Constraints">
        {constraints.length === 0 ? (
          <p className={`${typography.panelMeta} text-text-light`}>No constraints defined</p>
        ) : (
          <div className="space-y-1.5">
            {constraints.map((c, i) => (
              <div key={i} className={`${typography.panelMeta} text-text-body flex items-center gap-1`}>
                <span className="truncate flex-1">{String(c.label ?? c.node_id ?? `#${i + 1}`)}</span>
                <span className="text-text-light">{String(c.operator ?? '≥')}</span>
                <span className="tabular-nums">{String(c.value ?? '—')}</span>
              </div>
            ))}
          </div>
        )}
      </AdvancedFieldGroup>
    </div>
  )
}

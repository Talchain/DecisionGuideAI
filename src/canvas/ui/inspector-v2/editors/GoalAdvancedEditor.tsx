/**
 * GoalAdvancedEditor — structured technical detail for goal nodes.
 * Groups: Threshold parameters, Constraints.
 */

import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { typography } from '../../../../styles/typography'
import { goalConstraintText } from '../../../utils/goalConstraintText'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'

interface GoalAdvancedEditorProps {
  nodeId: string
}

export function GoalAdvancedEditor({ nodeId }: GoalAdvancedEditorProps) {
  /**
   * The whole node list, not a `.find` selector — `goalConstraintText` resolves
   * each constraint's target label against it, and the parent `GoalPanel`
   * already subscribes to `s.nodes` (`:58`), so this component re-renders on any
   * node change regardless and the wider subscription costs nothing.
   */
  const nodes = useCanvasStore(s => s.nodes)
  const node = nodes.find(n => n.id === nodeId)
  const mutations = useNodeMutations(nodeId)

  const data = node?.data as Record<string, unknown> | undefined
  const goalThresholdRaw = data?.goal_threshold_raw as number | undefined
  const goalThresholdUnit = (data?.goal_threshold_unit as string) ?? ''
  const goalThresholdCap = data?.goal_threshold_cap as number | undefined
  const goalThreshold = data?.goal_threshold as number | undefined

  /**
   * ⚠ THE STORE SLICE, not the node's data bag — and the distinction was a DEAD
   * READ, not a style point. This read was
   * `(n.data as …).goal_constraints`, and NOTHING IN THE PRODUCT WRITES THAT
   * KEY: measured at `2e8e6d43`, all 89 production occurrences of
   * `goal_constraints` are this camelCase slice, `results.report
   * .goal_constraints`, the persisted graph's TOP-LEVEL `graph.goal_constraints`,
   * the wire request, or the debug bundle. `domain/nodes.ts:26-29` states it
   * outright — constraints are "badge data on GoalNode
   * (store.goalConstraints + results.report.goal_constraints), not as standalone
   * canvas nodes". So this group rendered "No constraints defined" permanently,
   * including for a model whose constraints sat one selector away.
   *
   * The sweep was contrast-controlled, so "no writer" is a fact rather than a
   * blind probe: the same probe over the sibling `goal_threshold_raw` — read off
   * the same bag eight lines above — finds three node-data writes
   * (`useInspectorMutations.ts:284-288`, `applyDraftResult.ts:692-694`,
   * `applyV5State.ts:1084`).
   *
   * ⚠ `| null` IS THE INITIAL VALUE, not merely a possibility — a fresh user is
   * in it (`store.ts:1941`), so the `?? []` is load-bearing.
   */
  const constraints: CEEGoalConstraint[] = useCanvasStore(s => s.goalConstraints) ?? []

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
          /* ⭐ ONE FORMATTED STRING, NOT THREE SPANS — and the collapse is the
             honesty fix, not a tidy-up. The three spans were
             `label ?? node_id`, `operator ?? '≥'`, `value ?? '—'`, and each
             carried its own defect the moment constraints actually flowed:

               · `?? c.node_id` printed a RAW WIRE ID as the constraint's NAME.
                 `CEEGoalConstraint.label` is documented "genuinely absent in
                 practice" (`adapters/cee/types.ts:278-285`) and production node
                 ids are HASHES, so this was the normal case, not the edge.
               · `?? '≥'` FABRICATED a direction — a claim about the user's own
                 boundary — for a constraint whose operator was missing.
               · `String(c.operator)` echoed the wire's ASCII `<=` at the user.
               · and there was no room for PROVENANCE at all, so an Olumi-
                 INFERRED limit read identically to one the user stated.

             `goalConstraintText` is the one formatter for this sentence and
             answers all four: it resolves the target label via
             `resolveElementLabel` (which returns `'Untitled'` and is never
             given an id), renders `<=` as `≤`, formats the unit, appends
             `· Inferred limit` / `· Proxy limit`, and says
             `limit not captured` rather than inventing a direction. Splitting
             its output back into three spans would mean re-deriving those
             pieces here — a second formatter, which is how the estate's label
             surfaces drifted apart in the first place. */
          <div className="space-y-1.5">
            {constraints.map((c, i) => (
              <p
                key={c.constraint_id ?? c.id ?? i}
                className={`${typography.panelMeta} text-text-body break-words`}
              >
                {goalConstraintText(c, nodes)}
              </p>
            ))}
          </div>
        )}
      </AdvancedFieldGroup>
    </div>
  )
}

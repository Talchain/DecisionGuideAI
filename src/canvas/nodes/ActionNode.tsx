import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NodeChip } from './shared'
import { NODE_REGISTRY } from '../domain/nodes'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { resolveElementLabel } from '../domain/elementLabel'

const authoredText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null

export const ActionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.action
  const description = authoredText(props.data?.description)
  const body = authoredText(props.data?.body)
  const summary = description ?? body
  // Display-only composition keeps both authored fields reachable through the
  // existing chevron. Canonical data and the selected context for Ask stay intact.
  const fullDescription = description && body && body.trim() !== description.trim()
    ? `${description}\n\n${body}`
    : summary
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)

  // An edge supplies context, not proof of what this action tests or achieves.
  const connections = useMemo(() => edges.flatMap(edge => {
    if (edge.source !== props.id && edge.target !== props.id) return []
    const outbound = edge.source === props.id
    const other = nodes.find(node => node.id === (outbound ? edge.target : edge.source))
    if (!other) return []
    return [{ id: edge.id, label: resolveElementLabel(other.data) }]
  }), [edges, nodes, props.id])

  /**
   * ⭐ THE ACTION CARD ASKED NOTHING — the only card-shaped kind with no
   * invitation on it at all.
   *
   * Measured at `9748b336`: `git grep -c NodeChip` per node file reads
   * ActionNode **0** against Risk 4, Factor 4, Goal 5, Outcome 5, Decision 6,
   * Option 9 (contrast control in the same sweep: `git grep -c export` on this
   * file reads 1, so the file was read). The card stated what the action IS and
   * never asked what would have to hold for it to work — so the one node kind
   * that represents a thing the team could DO was the one kind that invited no
   * thinking about it.
   *
   * The question is assumption-surfacing rather than evaluative on purpose: an
   * action's honest weak point is its preconditions, and this node carries no
   * number to challenge (0 `METRIC_NOUN`, 0 `NodeMetricRow`, 0 `lodMetric`) so
   * there is nothing here to falsify in the sense `OutcomeNode` uses.
   *
   * On the CARD FACE, not behind a hover: this kind has no `NodePopover`
   * machinery, and the invitation is the point (`DecisionNode`'s own note —
   * "THE INVITATIONS BELONG ON THE CARD, NOT BEHIND A HOVER").
   *
   * `actionType={null}` because the schemas `ActionType` enum carries no honest
   * value for an assumption-surfacing prompt, and `NodeChip`'s contract is
   * explicit that a wrong one must never be forced.
   */
  const actionLabel = resolveElementLabel(props.data)
  const actionChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip
        chipId="action_what_must_be_true"
        actionType={null}
        label="What has to be true?"
        message={`What has to be true for ${actionLabel || 'this action'} to work, and how would we know if it were not?`}
      />
    </div>
  ), [actionLabel])

  return (
    <BaseNode {...props} data={{ ...props.data, description: fullDescription ?? undefined }} nodeType="action" icon={metadata.icon}>
      <div className="space-y-1.5">
        {summary ? (
          <p
            data-testid="action-summary"
            className={`${typography.nodeLabel} text-text-light m-0 break-words whitespace-pre-wrap line-clamp-2 group-aria-expanded:hidden`}
          >
            {summary}
          </p>
        ) : (
          <p className={`${typography.nodeLabel} text-text-light m-0`}>No action details captured.</p>
        )}

        {connections.length > 0 && (
          <p data-testid="action-connections" className={`${typography.nodeLabel} text-text-light m-0 line-clamp-1 break-words`}>
            Linked: {connections[0].label}{connections.length > 1 ? ` (+${connections.length - 1})` : ''}
          </p>
        )}

        {actionChips}
      </div>
    </BaseNode>
  )
})

ActionNode.displayName = 'ActionNode'

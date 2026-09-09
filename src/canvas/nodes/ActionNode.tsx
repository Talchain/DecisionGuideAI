import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
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
      </div>
    </BaseNode>
  )
})

ActionNode.displayName = 'ActionNode'

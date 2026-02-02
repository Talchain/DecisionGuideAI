/**
 * ModelSnapshot - Accordion showing graph structure summary
 *
 * Collapsed by default.
 * Right-side of accordion header: {n} nodes · {n} edges
 * One SnapshotRow per node kind present in the graph.
 *
 * Node kind → icon mapping:
 * - Target/goal
 * - GitBranch/decision
 * - Lightbulb/option
 * - Settings/factor
 * - AlertTriangle/risk
 * - TrendingUp/outcome
 *
 * Uses existing graph colours per kind from the codebase.
 */

import { useState, useCallback } from 'react'
import {
  Target,
  GitBranch,
  Lightbulb,
  Settings,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { Accordion, NodeLink } from './primitives'
import type { NodesByKind } from './hooks/usePreAnalysisData'
import type { Node } from '@xyflow/react'

interface ModelSnapshotProps {
  /** Nodes grouped by kind */
  nodesByKind: NodesByKind
  /** Total edge count */
  edgeCount: number
  /** Click handler for node focus (no-op in M1) */
  onFocusNode?: (nodeId: string) => void
}

/** Node kind configuration */
const kindConfig: Record<keyof NodesByKind, {
  icon: typeof Target
  label: string
  colorClass: string
}> = {
  goal: { icon: Target, label: 'Goals', colorClass: 'text-goal' },
  decision: { icon: GitBranch, label: 'Decisions', colorClass: 'text-info' },
  option: { icon: Lightbulb, label: 'Options', colorClass: 'text-option' },
  factor: { icon: Settings, label: 'Factors', colorClass: 'text-factor' },
  risk: { icon: AlertTriangle, label: 'Risks', colorClass: 'text-danger' },
  outcome: { icon: TrendingUp, label: 'Outcomes', colorClass: 'text-success' },
}

/** Order of kinds to display */
const kindOrder: (keyof NodesByKind)[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

interface SnapshotRowProps {
  kind: keyof NodesByKind
  nodes: Node[]
  onFocusNode?: (nodeId: string) => void
}

function SnapshotRow({ kind, nodes, onFocusNode }: SnapshotRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = kindConfig[kind]
  const Icon = config.icon

  // Truncate beyond 5 items unless expanded
  const maxVisible = 5
  const visibleNodes = isExpanded ? nodes : nodes.slice(0, maxVisible)
  const hiddenCount = nodes.length - maxVisible

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const getNodeLabel = (node: Node): string => {
    return (node.data as { label?: string })?.label ?? node.id
  }

  return (
    <div className="flex items-start gap-2 py-1">
      {/* Icon */}
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.colorClass}`} aria-hidden="true" />

      {/* Kind label - coloured text permitted here */}
      <span className={`text-xs font-medium w-16 flex-shrink-0 ${config.colorClass}`}>
        {config.label}
      </span>

      {/* Node links */}
      <div className="flex-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {visibleNodes.map((node, idx) => (
          <span key={node.id} className="inline-flex items-center">
            <NodeLink
              targetId={node.id}
              targetType="node"
              onClick={() => onFocusNode?.(node.id)}
              className="text-xs"
            >
              {getNodeLabel(node)}
            </NodeLink>
            {idx < visibleNodes.length - 1 && (
              <span className="text-text-light">,</span>
            )}
          </span>
        ))}

        {/* Expander link */}
        {hiddenCount > 0 && !isExpanded && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="text-xs text-info hover:underline ml-1"
          >
            (+{hiddenCount})
          </button>
        )}
        {isExpanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="text-xs text-info hover:underline ml-1"
          >
            (show less)
          </button>
        )}
      </div>
    </div>
  )
}

export function ModelSnapshot({
  nodesByKind,
  edgeCount,
  onFocusNode,
}: ModelSnapshotProps) {
  // Calculate total node count
  const totalNodes = Object.values(nodesByKind).reduce((sum, nodes) => sum + nodes.length, 0)

  // Filter to kinds that have nodes
  const presentKinds = kindOrder.filter(kind => nodesByKind[kind].length > 0)

  return (
    <Accordion
      title="Model Snapshot"
      defaultExpanded={false}
      rightContent={`${totalNodes} nodes · ${edgeCount} edges`}
      testId="model-snapshot-accordion"
    >
      <div className="space-y-1">
        {presentKinds.map(kind => (
          <SnapshotRow
            key={kind}
            kind={kind}
            nodes={nodesByKind[kind]}
            onFocusNode={onFocusNode}
          />
        ))}

        {presentKinds.length === 0 && (
          <p className="text-xs text-text-light py-2">
            No nodes in the model yet
          </p>
        )}
      </div>
    </Accordion>
  )
}

export default ModelSnapshot

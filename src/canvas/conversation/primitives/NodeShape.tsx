/**
 * NodeShape — shared SVG shape renderer for chat panel.
 *
 * Wraps NodeShapeIndicator with a BriefElementKind mapping so the guidance
 * strip, thinking indicator, and empty state can reference shapes by brief
 * element name without knowing the internal NodeType taxonomy.
 */

import { NodeShapeIndicator } from '../../nodes/NodeShapeIndicator'
import type { NodeType } from '../../domain/nodes'

export type BriefElementKind = 'goal' | 'options' | 'metric' | 'constraints' | 'risks'

/** Map brief element kinds to their DS v4 node types. */
const BRIEF_TO_NODE: Record<BriefElementKind, NodeType> = {
  goal:        'goal',        // diamond
  options:     'option',      // square
  metric:      'outcome',     // upward triangle
  constraints: 'decision',    // hexagon
  risks:       'risk',        // inverted triangle
}

interface NodeShapeProps {
  kind: BriefElementKind | NodeType
  size?: number
  className?: string
  fill?: string
}

export function NodeShape({ kind, size = 12, className, fill }: NodeShapeProps) {
  const nodeKind: NodeType = (kind in BRIEF_TO_NODE)
    ? BRIEF_TO_NODE[kind as BriefElementKind]
    : kind as NodeType

  return <NodeShapeIndicator nodeKind={nodeKind} size={size} className={className} fillOverride={fill} />
}

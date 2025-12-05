/**
 * InsightItem - Renders individual insight with structured node/edge references
 *
 * Parses markdown-like syntax for node and edge references:
 * - `[node:node-id]` → Interactive node badge
 * - `[edge:edge-id]` → Interactive edge badge
 * - `[node:node-id:Custom Label]` → Badge with custom label
 *
 * Example:
 * "Sales revenue increased because [node:demand] improved and [edge:demand-revenue] strengthened."
 */

import { Fragment } from 'react'
import { NodeBadge, EdgeBadge } from './NodeReferenceBadges'

export interface InsightItemProps {
  text: string
  onNodeClick?: (nodeId: string) => void
  onEdgeClick?: (edgeId: string) => void
  className?: string
}

interface ParsedSegment {
  type: 'text' | 'node' | 'edge'
  content: string
  label?: string
  id?: string
}

/**
 * Parse insight text into segments with node/edge references
 *
 * Patterns:
 * - `[node:node-id]` → node reference with ID as label
 * - `[node:node-id:Custom Label]` → node reference with custom label
 * - `[edge:edge-id]` → edge reference
 * - `[edge:edge-id:Custom Label]` → edge reference with custom label
 */
function parseInsightText(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  const regex = /\[(node|edge):([^\]:]+)(?::([^\]]+))?\]/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      })
    }

    // Add the reference
    const [, type, id, label] = match
    segments.push({
      type: type as 'node' | 'edge',
      content: match[0],
      id,
      label,
    })

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return segments
}

/**
 * InsightItem Component
 *
 * Renders insight text with interactive node and edge badges.
 * Automatically parses references and makes them clickable.
 */
export function InsightItem({
  text,
  onNodeClick,
  onEdgeClick,
  className = '',
}: InsightItemProps): JSX.Element {
  const segments = parseInsightText(text)

  return (
    <div className={`text-sm text-charcoal-900 ${className}`}>
      {segments.map((segment, idx) => {
        if (segment.type === 'text') {
          return <Fragment key={idx}>{segment.content}</Fragment>
        }

        if (segment.type === 'node' && segment.id) {
          return (
            <NodeBadge
              key={idx}
              nodeId={segment.id}
              label={segment.label}
              onClick={onNodeClick}
              className="mx-1"
            />
          )
        }

        if (segment.type === 'edge' && segment.id) {
          return (
            <EdgeBadge
              key={idx}
              edgeId={segment.id}
              label={segment.label}
              onClick={onEdgeClick}
              className="mx-1"
            />
          )
        }

        return null
      })}
    </div>
  )
}

/**
 * Base node component
 * Shared structure and styling for all node types
 * British English: visualisation, colour
 *
 * Features:
 * - Double-click to expand/collapse
 * - Expandable description with sanitized markdown
 * - Smooth transitions
 */

import { memo, useState, useCallback, type ReactNode } from 'react'
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { getNodeTheme, NODE_SIZES, NODE_SHADOWS, NODE_TRANSITIONS } from '../theme/nodes'
import type { NodeType } from '../domain/nodes'
import { useIsDark } from '../hooks/useTheme'
import type { LucideIcon } from 'lucide-react'
import { sanitizeMarkdown } from '../utils/markdown'
import { UnknownKindWarning } from '../components/UnknownKindWarning'

interface BaseNodeProps extends NodeProps {
  nodeType: NodeType
  icon: LucideIcon
  children?: ReactNode
}

/**
 * Base node with shared header and structure
 * Includes connection handles and accessibility attributes
 * Double-click to expand/collapse description
 */
export const BaseNode = memo(({ id, nodeType, icon: Icon, data, selected, children }: BaseNodeProps) => {
  const isDark = useIsDark()
  const theme = getNodeTheme(nodeType, isDark)
  const label = data?.label || 'Untitled'
  const description = data?.description

  // Local state for expand/collapse (no persistence per spec)
  const [isExpanded, setIsExpanded] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()

  // Accessible name combines node type and label
  const accessibleName = `${nodeType} node: ${label}`

  // Toggle expand on double-click
  const handleDoubleClick = useCallback(() => {
    if (!description) return  // Only expand if description exists

    setIsExpanded(prev => !prev)

    // Update node internals after layout change (debounced to avoid thrash)
    setTimeout(() => {
      updateNodeInternals(id)
    }, 100)
  }, [id, description, updateNodeInternals])

  // Dynamic sizing based on expansion state
  const nodeWidth = isExpanded ? 300 : NODE_SIZES.minWidth
  const nodeMinHeight = isExpanded ? 120 : NODE_SIZES.minHeight

  return (
    <div
      role="group"
      aria-label={accessibleName}
      aria-expanded={description ? isExpanded : undefined}
      className="base-node"
      onDoubleClick={handleDoubleClick}
      style={{
        background: theme.background,
        border: `2px solid ${theme.border}`,
        borderRadius: NODE_SIZES.radius,
        padding: NODE_SIZES.padding,
        width: nodeWidth,
        minHeight: nodeMinHeight,
        boxShadow: selected ? NODE_SHADOWS.selected : NODE_SHADOWS.default,
        transition: NODE_TRANSITIONS.default,
        position: 'relative',
        cursor: description ? 'pointer' : 'default',
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: theme.border,
          width: 12,
          height: 12,
          border: '2px solid white',
        }}
        aria-label="Input connection"
      />
      
      {/* Node header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          <Icon size={16} strokeWidth={2} />
        </span>

        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.badgeText,
            background: theme.badge,
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {nodeType}
        </span>

        {/* S1-UNK: Warning chip for unknown backend kinds */}
        {data?.unknownKind && data?.originalKind && (
          <UnknownKindWarning originalKind={data.originalKind} />
        )}
      </div>
      
      {/* Node label */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: theme.text,
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {label}
      </div>

      {/* Expanded description (markdown) */}
      {isExpanded && description && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: theme.text,
            opacity: 0.85,
            lineHeight: 1.5,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
          className="node-description"
          dangerouslySetInnerHTML={{
            __html: sanitizeMarkdown(description)
          }}
        />
      )}

      {/* Optional children (description, metrics, etc.) */}
      {children && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: theme.text,
            opacity: 0.8,
          }}
        >
          {children}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: theme.border,
          width: 12,
          height: 12,
          border: '2px solid white',
        }}
        aria-label="Output connection"
      />
    </div>
  )
})

BaseNode.displayName = 'BaseNode'

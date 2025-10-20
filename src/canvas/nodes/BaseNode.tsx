/**
 * Base node component
 * Shared structure and styling for all node types
 * British English: visualisation, colour
 */

import { memo, type ReactNode } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeTheme, NODE_SIZES, NODE_SHADOWS, NODE_TRANSITIONS } from '../theme/nodes'
import type { NodeType } from '../domain/nodes'
import { useIsDark } from '../hooks/useTheme'
import type { LucideIcon } from 'lucide-react'

interface BaseNodeProps extends NodeProps {
  nodeType: NodeType
  icon: LucideIcon
  children?: ReactNode
}

/**
 * Base node with shared header and structure
 * Includes connection handles and accessibility attributes
 */
export const BaseNode = memo(({ nodeType, icon: Icon, data, selected, children }: BaseNodeProps) => {
  const isDark = useIsDark()
  const theme = getNodeTheme(nodeType, isDark)
  const label = data?.label || 'Untitled'
  
  // Accessible name combines node type and label
  const accessibleName = `${nodeType} node: ${label}`
  
  return (
    <div
      role="group"
      aria-label={accessibleName}
      className="base-node"
      style={{
        background: theme.background,
        border: `2px solid ${theme.border}`,
        borderRadius: NODE_SIZES.radius,
        padding: NODE_SIZES.padding,
        minWidth: NODE_SIZES.minWidth,
        minHeight: NODE_SIZES.minHeight,
        boxShadow: selected ? NODE_SHADOWS.selected : NODE_SHADOWS.default,
        transition: NODE_TRANSITIONS.default,
        position: 'relative',
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

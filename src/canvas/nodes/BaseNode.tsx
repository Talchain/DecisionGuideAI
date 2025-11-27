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
import type { NodeType } from '../domain/nodes'
import type { LucideIcon } from 'lucide-react'
import { sanitizeMarkdown } from '../utils/markdown'
import { UnknownKindWarning } from '../components/UnknownKindWarning'
import { NodeBadge } from '../components/NodeBadge'
import { useCEEInsights } from '../../hooks/useCEEInsights'
import { useISLValidation } from '../../hooks/useISLValidation'
import { useCanvasStore } from '../store'
import { nodeColors } from './colors'
import { typography } from '../../styles/typography'

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
  const label = data?.label || 'Untitled'
  const description = data?.description

  // Phase 3: Get node colors from new system
  const colors = nodeColors[nodeType as keyof typeof nodeColors] || nodeColors.factor

  // Local state for expand/collapse (no persistence per spec)
  const [isExpanded, setIsExpanded] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()

  // Phase 2: Badge system integration
  const { data: ceeInsights } = useCEEInsights()
  const { data: islValidation } = useISLValidation()

  // Phase 3: Node highlighting
  // React #185 FIX: Return primitive boolean from selector to prevent re-renders
  // on every store update. Selecting the entire Set causes infinite loops since
  // Set references change on each store update.
  const isHighlighted = useCanvasStore(s => s.highlightedNodes.has(id))

  const ceeWarnings = ceeInsights?.structural_health.warnings || []
  const islAffected = islValidation?.suggestions.some(suggestion =>
    suggestion.affectedNodes.includes(id)
  ) || false

  // Open diagnostics tab in OutputsDock using DOM click pattern
  // (Same approach as DegradedBanner.tsx for consistency - avoids undefined store methods)
  const handleBadgeClick = () => {
    try {
      const btn = document.querySelector('[data-testid="outputs-dock-tab-diagnostics"]') as HTMLButtonElement | null
      if (btn) {
        btn.click()
        btn.focus()
        return
      }
      // Fallback: update sessionStorage so OutputsDock opens on next render
      if (typeof sessionStorage !== 'undefined') {
        const existingRaw = sessionStorage.getItem('canvas.outputsDock.v1')
        let next: { isOpen: boolean; activeTab: string } = { isOpen: true, activeTab: 'diagnostics' }
        if (existingRaw) {
          try {
            const parsed = JSON.parse(existingRaw)
            next = { ...parsed, isOpen: true, activeTab: 'diagnostics' }
          } catch {
            // ignore parse errors
          }
        }
        sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify(next))
      }
    } catch {
      // noop - badge click is best-effort
    }
  }

  // Phase 2: Uncertain node styling
  const isUncertain = (data?.uncertainty ?? 0) > 0.4
  const borderStyle = isUncertain ? 'border-dashed' : ''

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

  return (
    <div
      role="group"
      aria-label={accessibleName}
      aria-expanded={description ? isExpanded : undefined}
      className={`
        relative rounded-lg border-2 shadow-sm
        ${colors.border} ${borderStyle}
        transition-all duration-300
        ${description ? 'cursor-pointer' : 'cursor-default'}
        ${selected ? 'ring-2 ring-sky-500 ring-offset-2' : ''}
        ${isHighlighted ? 'ring-4 ring-sun-500 ring-opacity-50' : ''}
      `}
      style={{
        backgroundColor: 'white', // Solid background
        padding: '12px',
        minWidth: '140px',
        maxWidth: isExpanded ? '300px' : '200px',
        minHeight: isExpanded ? '120px' : undefined,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Phase 3: Border color overlay for subtle tint */}
      <div className={`absolute inset-0 rounded-lg ${colors.bg} opacity-10 -z-10`} />
      {/* Phase 2: Node badges for CEE/ISL warnings */}
      <NodeBadge
        nodeId={id}
        ceeWarnings={ceeWarnings}
        islAffected={islAffected}
        onClick={handleBadgeClick}
      />
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className={`${colors.border.replace('border-', 'bg-')}`}
        style={{
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
          className={`${typography.caption} ${colors.text} ${colors.bg} uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded`}
        >
          {nodeType}
        </span>

        {/* S1-UNK: Warning chip for unknown backend kinds */}
        {data?.unknownKind && data?.originalKind && (
          <UnknownKindWarning originalKind={data.originalKind} />
        )}
      </div>
      
      {/* Node label */}
      <div className={`${typography.nodeTitle} ${colors.text} break-words`}>
        {label}
      </div>

      {/* Expanded description (markdown) */}
      {isExpanded && description && (
        <div
          className={`${typography.nodeLabel} ${colors.text} opacity-85 mt-3 max-h-[200px] overflow-y-auto node-description`}
          dangerouslySetInnerHTML={{
            __html: sanitizeMarkdown(description)
          }}
        />
      )}

      {/* Optional children (description, metrics, etc.) */}
      {children && (
        <div className={`${typography.nodeLabel} ${colors.text} opacity-80 mt-2`}>
          {children}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${colors.border.replace('border-', 'bg-')}`}
        style={{
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

/**
 * Base node component
 * Shared structure and styling for all node types
 * British English: visualisation, colour
 *
 * Features:
 * - Chevron icon to expand/collapse description
 * - Expandable description with sanitized markdown
 * - Smooth transitions
 */

import { memo, useState, useCallback, type ReactNode } from 'react'
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeType, Controllability } from '../domain/nodes'
import { ChevronDown, ChevronUp, Flag as FlagIcon, ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react'
import { useEditPreviewStore } from '../stores/editPreviewStore'
import { sanitizeMarkdown } from '../../lib/renderSafeRichText'
import { UnknownKindWarning } from '../components/UnknownKindWarning'
import { NodeBadge } from '../components/NodeBadge'
import { useCEEInsights } from '../../hooks/useCEEInsights'
import { useISLValidation } from '../../hooks/useISLValidation'
import { useCanvasStore } from '../store'
import { useLayoutStore } from '../layoutStore'
import { nodeColors } from './colors'
import { typography } from '../../styles/typography'
import { getControllabilityBorderStyle } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { isGoalDefined } from '../../utils/isGoalDefined'
import { isGraphLensEnabled } from '../../flags'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { NODE_REGISTRY } from '../domain/nodes'

interface BaseNodeProps extends NodeProps {
  nodeType: NodeType
  icon: LucideIcon
  children?: ReactNode
  maxWidth?: number
  headerSlot?: ReactNode
  /** Override border colour + style classes (e.g. 'border-info border-dashed'). Replaces entity colour. */
  borderClassOverride?: string
}

/**
 * Base node with shared header and structure
 * Includes connection handles and accessibility attributes
 * Click chevron icon to expand/collapse description
 */
export const BaseNode = memo(({ id, nodeType, icon: _icon, data, selected, children, maxWidth, headerSlot, borderClassOverride }: BaseNodeProps) => {
  const label = typeof data?.label === 'string' && data.label ? data.label : 'Untitled'
  const description = typeof data?.description === 'string' ? data.description : undefined

  // Phase 3: Get node colours from new system
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

  // Graph Interaction P1: Node dimming for path highlighting
  // Nodes not on the highlighted path are dimmed (opacity ~0.4)
  const isDimmed = useCanvasStore(s => s.dimmedNodeIds.has(id))

  // Graph Lens: lens-mode dimming (20% opacity for inactive nodes in option mode)
  // Uses primitive boolean selector (React #185 pattern) to avoid re-render loops
  const isLensDimmed = useCanvasStore(s =>
    isGraphLensEnabled() && s.lens._dimmedNodeIds.has(id)
  )

  // Expanded lenses: hidden (causal), evidence classification, active mode
  // Defensive ?.has/?.get — test mocks may not include expanded lens fields
  const isLensHidden = useCanvasStore(s =>
    isGraphLensEnabled() && s.lens._hiddenNodeIds?.has(id) === true
  )
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full')
  const evidenceClass = useCanvasStore(s => {
    if (!isGraphLensEnabled() || s.lens.active !== 'evidence') return null
    return s.lens._evidenceNodeClass?.get(id) ?? null
  })

  // Layout-computed node width: when a layout has run, use its computed width
  // so the rendered node matches ELK's sizing assumptions.
  const layoutNodeWidth = useLayoutStore(s => s.layoutNodeWidth)

  // Decision Graph Display v2: Get Results-mode display metadata
  const displayMetadata = useNodeDisplayMetadata(id, nodeType)

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
  const isUncertain = Number(data?.uncertainty ?? 0) > 0.4

  // B.I.10: Pre-run overlay — show dashed goal border for incomplete nodes
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const goalConstraints = useCanvasStore(s => s.goalConstraints)
  const edges = useCanvasStore(s => s.edges)
  const isPreRunMode = resultsStatus !== 'complete'
  const isIncomplete = (() => {
    if (!isPreRunMode) return false
    if (nodeType === 'factor') {
      const obs = data?.observedState as { value?: number } | undefined
      return obs?.value === undefined
    }
    if (nodeType === 'goal') {
      return !isGoalDefined(goalThreshold, goalConstraints)
    }
    if (nodeType === 'decision') {
      const hasOptions = edges.some(e => e.source === id)
      return !hasOptions
    }
    return false
  })()

  // Decision Graph Display v2 Task 6 + P1 Hotfix: Controllability-based border style for factors
  // P1 Hotfix: Don't default factors to dashed — only show dashed when explicitly 'partial'
  // When controllability is undefined or 'unknown', use solid (we don't claim anything)
  const controllability = nodeType === 'factor' ? (data?.controllability as Controllability | undefined) : undefined
  const borderStyle = (() => {
    if (nodeType === 'factor' && controllability) {
      return getControllabilityBorderStyle(controllability)
    }
    // Only uncertain non-factor nodes get dashed border
    // P1 Hotfix: Factors no longer default to dashed — solid is the default (no claim)
    if (isUncertain && nodeType !== 'factor') {
      return 'border-dashed'
    }
    return ''
  })()

  // Accessible name combines node type and label
  const accessibleName = `${nodeType} node: ${label}`

  // Toggle expand via chevron icon click
  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()  // Prevent node selection/drag
    if (!description) return

    setIsExpanded(prev => !prev)

    // Update node internals after layout change (debounced to avoid thrash)
    setTimeout(() => {
      updateNodeInternals(id)
    }, 100)
  }, [id, description, updateNodeInternals])

  // P6: Factor border width — 1px baseline (no category), 2px when category is explicit
  // All other node types always use border-2 (their category is inherent to their type)
  const borderWidth = (() => {
    if (nodeType === 'factor' && !controllability) return 'border'
    return 'border-2'
  })()

  // Graph Editing Experience Task 5: Edit impact preview indicator
  const impactDirection = useEditPreviewStore(s => s.impactMap.get(id))

  // Causal lens: hide organisational nodes entirely
  if (isLensHidden) return null

  // Evidence lens: node fill colour based on evidence classification
  const evidenceBgStyle = (() => {
    if (lensMode !== 'evidence' || !evidenceClass) return undefined
    switch (evidenceClass) {
      case 'grounded': return 'var(--semantic-success-light, #dcfce7)'
      case 'assumed': return 'var(--semantic-warning-light, #fef9c3)'
      case 'none': return 'var(--semantic-danger-light, #fee2e2)'
      case 'na': return undefined
    }
  })()

  // Causal lens: strip all type-specific styling, render as neutral node
  const isCausalLens = lensMode === 'causal'
  // Evidence lens: suppress detail — show label + provenance pill only
  const isEvidenceLens = lensMode === 'evidence'
  const causalBorderClass = isCausalLens
    ? (nodeType === 'goal' ? 'border-text-light border-dashed' : 'border-text-light')
    : undefined

  return (
    <div
      role="group"
      aria-label={accessibleName}
      aria-expanded={description ? isExpanded : undefined}
      {...(isIncomplete ? { 'data-testid': nodeType === 'goal' ? 'overlay-missing-threshold-node' : 'overlay-missing-value' } : {})}
      className={`
        relative rounded-lg ${isCausalLens ? 'border' : borderWidth} shadow-1
        ${isCausalLens ? (causalBorderClass ?? '') : isIncomplete ? (nodeType === 'goal' ? 'border-goal border-dashed' : `${colors.border} border-dashed`) : borderClassOverride ?? `${colors.border} ${borderStyle}`}
        transition-all duration-200
        cursor-default
        ${selected ? 'ring-2 ring-info ring-offset-2' : ''}
        ${isHighlighted ? 'ring-4 ring-goal/50' : ''}
        ${isLensDimmed ? 'opacity-20' : isDimmed ? 'opacity-40' : ''}
      `}
      style={{
        backgroundColor: evidenceBgStyle ?? '#FEFEFE',
        padding: '12px',
        minWidth: '140px',
        maxWidth: isExpanded ? '300px' : `${maxWidth ?? layoutNodeWidth ?? 200}px`,
        minHeight: isExpanded ? '120px' : undefined,
      }}
    >
      {/* Phase 2: Node badges for CEE/ISL warnings */}
      <NodeBadge
        nodeId={id}
        ceeWarnings={ceeWarnings}
        islAffected={islAffected}
        onClick={handleBadgeClick}
      />

      {/* Context menu: Assumption flag badge (Hard rule 3 — UI-only annotation) */}
      {Boolean(data?.flagged_as_assumption) && (
        <div
          className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-panel shadow-1"
          title="Flagged as assumption"
          data-testid="assumption-badge"
        >
          <FlagIcon size={12} className="text-warning" />
        </div>
      )}

      {/* B.I.10: "?" badge for incomplete goal nodes */}
      {isIncomplete && nodeType === 'goal' && (
        <div
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full bg-goal text-white flex items-center justify-center ${typography.nodeLabel} font-bold`}
          title="Set a success threshold to enable analysis"
          data-testid="overlay-missing-threshold"
        >
          ?
        </div>
      )}

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
      
      {/* Graph Editing Experience Task 5: Impact preview indicator */}
      {impactDirection && (
        <div
          className="absolute -top-3 -right-3 z-20 rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
          style={{
            backgroundColor: impactDirection === 'increase' ? 'var(--semantic-success, #22c55e)'
              : impactDirection === 'decrease' ? 'var(--semantic-danger, #ef4444)'
              : 'var(--text-muted, #9ca3af)',
          }}
        >
          {impactDirection === 'increase' && <ArrowUp className="w-3 h-3 text-white" />}
          {impactDirection === 'decrease' && <ArrowDown className="w-3 h-3 text-white" />}
          {impactDirection === 'mixed' && <Minus className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Node header — stripped in causal lens; simplified in evidence lens */}
      {!isCausalLens && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {/* T1: Shape indicator (Design System v4 §10.1) + sentence-case type label */}
        <NodeShapeIndicator nodeKind={nodeType} size={12} />
        {/* Decision Graph Display v2 Task 5: Sensitivity rank badge (Results mode, top 3 factors) */}
        {typeof displayMetadata.sensitivityRank === 'number' && (
          <span
            className={`${typography.nodeLabel} font-semibold text-text-body bg-panel-border rounded-full flex items-center justify-center`}
            style={{ minWidth: '20px', height: '20px', padding: '0 4px', pointerEvents: 'none' }}
            title={`Key driver #${displayMetadata.sensitivityRank}: ranked by influence on the outcome`}
          >
            #{displayMetadata.sensitivityRank}
          </span>
        )}
        <span
          className={`${typography.nodeLabel} ${colors.text} font-semibold leading-none`}
        >
          {NODE_REGISTRY[nodeType]?.label ?? nodeType}
        </span>

        {/* S1-UNK: Warning chip for unknown backend kinds */}
        {Boolean(data?.unknownKind) && typeof data?.originalKind === 'string' && (
          <UnknownKindWarning originalKind={data.originalKind} />
        )}

        {/* Optional right-aligned header content (e.g. category label) */}
        {headerSlot ? (
          <span className="ml-auto">{headerSlot as ReactNode}</span>
        ) : null}

        {/* Expand/collapse chevron for nodes with description */}
        {description && (
          <button
            onClick={handleExpandToggle}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan ml-auto p-0.5 hover:bg-black/5 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse description' : 'Expand description'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp size={14} className="text-text-light" />
            ) : (
              <ChevronDown size={14} className="text-text-light" />
            )}
          </button>
        )}
      </div>
      )}

      {/* Node label */}
      <div className={`${typography.nodeTitle} text-text-body break-words`}>
        {label}
      </div>

      {/* Expanded description (markdown) — hidden in causal/evidence lens */}
      {!isCausalLens && !isEvidenceLens && isExpanded && description && (
        <div
          className={`${typography.nodeLabel} text-text-body opacity-85 mt-3 max-h-[200px] overflow-y-auto node-description`}
          // eslint-disable-next-line no-restricted-syntax -- sanitised via DOMPurify (sanitizeMarkdown)
          dangerouslySetInnerHTML={{
            __html: sanitizeMarkdown(description)
          }}
        />
      )}

      {/* Optional children (description, metrics, etc.) — hidden in causal/evidence lens */}
      {!isCausalLens && !isEvidenceLens && children ? (
        <div className={`${typography.nodeLabel} text-text-body opacity-80 mt-2`}>
          {children as ReactNode}
        </div>
      ) : null}
      
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

/**
 * ValidationPanel - Critique display with severity tiers
 *
 * Features:
 * - Severity tiers: blocker (red), warning (yellow), info (blue)
 * - Clickable node/edge references
 * - Suggested fixes with action buttons
 * - Collapsible sections (expanded when blockers exist)
 *
 * Design System:
 * - Background: paper-50 (#FEF9F3)
 * - Borders: sand-200 (#E1D8C7)
 * - Typography: Inter (via typography tokens)
 */

import { useState, useCallback, useMemo } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Wrench,
  ExternalLink,
  X,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'

export type CritiqueSeverity = 'blocker' | 'warning' | 'info'

export interface CritiqueItem {
  level: CritiqueSeverity
  message: string
  code?: string
  node_id?: string
  edge_id?: string
  suggested_fix?: string
  auto_fixable?: boolean
}

export interface AutoFixState {
  fixing: Set<string>
  success: Set<string>
  error: Set<string>
}

interface ValidationPanelProps {
  critique: CritiqueItem[]
  onAutoFix?: (item: CritiqueItem) => Promise<boolean>
  onDismiss?: (item: CritiqueItem) => void
}

// Severity configuration - neutral backgrounds, semantic colors for text/icons only
const SEVERITY_CONFIG = {
  blocker: {
    icon: AlertCircle,
    label: 'Critical Issues',
    bgColor: 'bg-paper-50',
    borderColor: 'border-sand-200',
    iconColor: 'text-red-600',
    labelColor: 'text-red-700',
    description: 'blocks analysis',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warnings',
    bgColor: 'bg-paper-50',
    borderColor: 'border-sand-200',
    iconColor: 'text-amber-600',
    labelColor: 'text-amber-700',
    description: 'recommended',
  },
  info: {
    icon: Info,
    label: 'Information',
    bgColor: 'bg-paper-50',
    borderColor: 'border-sand-200',
    iconColor: 'text-sky-600',
    labelColor: 'text-sky-700',
    description: '',
  },
} as const

/**
 * Group critique items by severity
 */
function groupBySeverity(critique: CritiqueItem[]): Record<CritiqueSeverity, CritiqueItem[]> {
  return {
    blocker: critique.filter(c => c.level === 'blocker'),
    warning: critique.filter(c => c.level === 'warning'),
    info: critique.filter(c => c.level === 'info'),
  }
}

/**
 * Generate a unique key for a critique item to properly track fix/dismiss state
 * across multiple items with the same code
 */
function getItemKey(item: CritiqueItem): string {
  const code = item.code || 'UNKNOWN'
  const nodeId = item.node_id || ''
  const edgeId = item.edge_id || ''
  return `${code}|${nodeId}|${edgeId}`
}

export function ValidationPanel({ critique, onAutoFix, onDismiss }: ValidationPanelProps) {
  // Group by severity
  const grouped = useMemo(() => groupBySeverity(critique), [critique])
  const hasBlockers = grouped.blocker.length > 0

  // Sections start expanded if blockers exist, collapsed otherwise
  const [expandedSections, setExpandedSections] = useState<Set<CritiqueSeverity>>(() => {
    const initial = new Set<CritiqueSeverity>()
    if (grouped.blocker.length > 0) initial.add('blocker')
    if (grouped.warning.length > 0 && !hasBlockers) initial.add('warning')
    return initial
  })

  // Dismissed items (session-only) - keyed by unique item key, not just code
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())

  // Auto-fix states: track which items are being fixed, succeeded, or failed
  // Using unique item keys to handle multiple items with same code
  const [fixingItems, setFixingItems] = useState<Set<string>>(new Set())
  const [fixedItems, setFixedItems] = useState<Set<string>>(new Set())
  const [failedItems, setFailedItems] = useState<Set<string>>(new Set())

  const toggleSection = useCallback((severity: CritiqueSeverity) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(severity)) {
        next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    focusNodeById(nodeId)
  }, [])

  const handleEdgeClick = useCallback((edgeId: string) => {
    focusEdgeById(edgeId)
  }, [])

  const handleDismiss = useCallback((item: CritiqueItem) => {
    const itemKey = getItemKey(item)
    setDismissedKeys(prev => new Set([...prev, itemKey]))
    onDismiss?.(item)
  }, [onDismiss])

  // Handle auto-fix with loading state management
  const handleAutoFix = useCallback(async (item: CritiqueItem) => {
    if (!onAutoFix) return

    const itemKey = getItemKey(item)

    // Set fixing state
    setFixingItems(prev => new Set([...prev, itemKey]))
    setFailedItems(prev => {
      const next = new Set(prev)
      next.delete(itemKey)
      return next
    })

    try {
      const success = await onAutoFix(item)

      if (success) {
        // Mark as fixed and auto-dismiss after brief success indicator
        setFixedItems(prev => new Set([...prev, itemKey]))
        setTimeout(() => {
          setDismissedKeys(prev => new Set([...prev, itemKey]))
          setFixedItems(prev => {
            const next = new Set(prev)
            next.delete(itemKey)
            return next
          })
        }, 1500)
      } else {
        setFailedItems(prev => new Set([...prev, itemKey]))
      }
    } catch {
      setFailedItems(prev => new Set([...prev, itemKey]))
    } finally {
      setFixingItems(prev => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }, [onAutoFix])

  // Filter out dismissed items using unique keys
  const visibleCritique = useMemo(() => {
    return critique.filter(c => !dismissedKeys.has(getItemKey(c)))
  }, [critique, dismissedKeys])

  const visibleGrouped = useMemo(() => groupBySeverity(visibleCritique), [visibleCritique])

  // Don't render if no visible items
  if (visibleCritique.length === 0) {
    return null
  }

  return (
    <div className="bg-paper-50 rounded-xl border border-sand-200 overflow-hidden">
      {/* Render each severity section */}
      {(['blocker', 'warning', 'info'] as const).map(severity => {
        const items = visibleGrouped[severity]
        if (items.length === 0) return null

        const config = SEVERITY_CONFIG[severity]
        const Icon = config.icon
        const isExpanded = expandedSections.has(severity)

        return (
          <div key={severity} className="border-b border-sand-200 last:border-b-0">
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(severity)}
              className={`w-full flex items-center gap-3 p-4 hover:bg-sand-100/50 transition-colors ${config.bgColor}`}
              aria-expanded={isExpanded}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor}`}>
                <Icon className={`w-5 h-5 ${config.iconColor}`} aria-hidden="true" />
              </div>
              <div className="flex-1 text-left">
                <span className={`${typography.label} ${config.labelColor}`}>
                  {config.label}
                </span>
                {config.description && (
                  <span className={`${typography.caption} text-ink-500 ml-2`}>
                    ({config.description})
                  </span>
                )}
              </div>
              <span className={`${typography.label} ${config.labelColor}`}>
                {items.length}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-ink-500" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-ink-500" aria-hidden="true" />
              )}
            </button>

            {/* Section content */}
            {isExpanded && (
              <div className="p-4 pt-0 space-y-3">
                {items.map((item, index) => {
                  const itemKey = getItemKey(item)
                  return (
                    <CritiqueItemRow
                      key={itemKey}
                      item={item}
                      severity={severity}
                      onNodeClick={handleNodeClick}
                      onEdgeClick={handleEdgeClick}
                      onAutoFix={onAutoFix ? handleAutoFix : undefined}
                      onDismiss={severity !== 'blocker' ? handleDismiss : undefined}
                      isFixing={fixingItems.has(itemKey)}
                      isFixed={fixedItems.has(itemKey)}
                      hasFailed={failedItems.has(itemKey)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface CritiqueItemRowProps {
  item: CritiqueItem
  severity: CritiqueSeverity
  onNodeClick: (nodeId: string) => void
  onEdgeClick: (edgeId: string) => void
  onAutoFix?: (item: CritiqueItem) => void
  onDismiss?: (item: CritiqueItem) => void
  isFixing?: boolean
  isFixed?: boolean
  hasFailed?: boolean
}

function CritiqueItemRow({
  item,
  severity,
  onNodeClick,
  onEdgeClick,
  onAutoFix,
  onDismiss,
  isFixing = false,
  isFixed = false,
  hasFailed = false,
}: CritiqueItemRowProps) {
  const config = SEVERITY_CONFIG[severity]

  // Determine border color based on fix state
  const borderColorClass = isFixed
    ? 'border-green-500'
    : hasFailed
    ? 'border-red-500'
    : config.borderColor

  return (
    <div
      className={`rounded-lg border-l-4 ${borderColorClass} bg-white p-3 shadow-sm transition-all duration-300 ${
        isFixed ? 'opacity-60' : ''
      }`}
      data-testid={`critique-item-${item.code || 'unknown'}`}
    >
      {/* Message with clickable node/edge references */}
      <div className={`${typography.body} text-ink-900`}>
        {item.message}
      </div>

      {/* Node/edge link */}
      {(item.node_id || item.edge_id) && (
        <button
          type="button"
          onClick={() => item.node_id ? onNodeClick(item.node_id) : onEdgeClick(item.edge_id!)}
          className="inline-flex items-center gap-1 mt-2 text-sky-600 hover:text-sky-700 hover:underline"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          <span className={typography.caption}>
            View on canvas
          </span>
        </button>
      )}

      {/* Suggested fix */}
      {item.suggested_fix && (
        <div className={`${typography.caption} text-ink-600 mt-2 flex items-start gap-2`}>
          <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{item.suggested_fix}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3">
        {item.auto_fixable && onAutoFix && (
          <button
            type="button"
            onClick={() => onAutoFix(item)}
            disabled={isFixing || isFixed}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              isFixed
                ? 'bg-green-500 text-white cursor-default'
                : isFixing
                ? 'bg-amber-400 text-white cursor-wait'
                : hasFailed
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-sun-500 text-white hover:bg-sun-600'
            } disabled:opacity-80 disabled:cursor-not-allowed`}
            aria-busy={isFixing}
            data-testid={`auto-fix-btn-${item.code || 'unknown'}`}
          >
            {isFixing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                Fixing...
              </>
            ) : isFixed ? (
              <>
                <CheckCircle className="w-3 h-3" aria-hidden="true" />
                Fixed!
              </>
            ) : hasFailed ? (
              <>
                <Wrench className="w-3 h-3" aria-hidden="true" />
                Retry fix
              </>
            ) : (
              <>
                <Wrench className="w-3 h-3" aria-hidden="true" />
                Fix automatically
              </>
            )}
          </button>
        )}

        {severity !== 'blocker' && onDismiss && !isFixed && (
          <button
            type="button"
            onClick={() => onDismiss(item)}
            disabled={isFixing}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-sand-300 text-ink-600 text-xs font-medium hover:bg-sand-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Dismiss
          </button>
        )}
      </div>

      {/* Error message */}
      {hasFailed && !isFixing && (
        <p className={`${typography.caption} text-red-600 mt-2`}>
          Fix failed - please try manually or contact support
        </p>
      )}
    </div>
  )
}

export default ValidationPanel

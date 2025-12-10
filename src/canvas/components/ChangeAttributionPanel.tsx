/**
 * ChangeAttributionPanel Component
 *
 * Shows attribution for changes made to nodes and edges.
 * Provides audit trail visibility for who/what made changes and when.
 *
 * Shows:
 * - Change history with timestamps
 * - Source attribution (user, AI, template, import)
 * - Affected elements (nodes/edges)
 * - Option to revert changes
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Cpu,
  FileText,
  Download,
  RotateCcw,
  History,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

export type ChangeSource = 'user' | 'ai' | 'template' | 'import' | 'system'

export interface ChangeRecord {
  id: string
  timestamp: Date | string
  source: ChangeSource
  /** User name or AI model name */
  actor?: string
  /** Brief description of the change */
  description: string
  /** IDs of affected nodes */
  affectedNodeIds?: string[]
  /** IDs of affected edges */
  affectedEdgeIds?: string[]
  /** Whether change can be reverted */
  revertable?: boolean
}

interface ChangeAttributionPanelProps {
  /** List of changes, newest first */
  changes: ChangeRecord[]
  /** Maximum changes to display (default 10) */
  maxVisible?: number
  /** Callback when revert is requested */
  onRevert?: (changeId: string) => void
  /** Callback when element is clicked for focus */
  onFocusElement?: (nodeId: string) => void
  /** Start expanded */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

const SOURCE_CONFIG: Record<
  ChangeSource,
  {
    label: string
    icon: typeof User
    className: string
  }
> = {
  user: {
    label: 'Manual Edit',
    icon: User,
    className: 'text-info-700',
  },
  ai: {
    label: 'AI Generated',
    icon: Cpu,
    className: 'text-violet-700',
  },
  template: {
    label: 'From Template',
    icon: FileText,
    className: 'text-amber-700',
  },
  import: {
    label: 'Imported',
    icon: Download,
    className: 'text-green-700',
  },
  system: {
    label: 'System',
    icon: Clock,
    className: 'text-ink-500',
  },
}

function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = Date.now()
  const elapsed = now - date.getTime()

  const minutes = Math.floor(elapsed / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

function ChangeItem({
  change,
  onRevert,
  onFocusElement,
}: {
  change: ChangeRecord
  onRevert?: (id: string) => void
  onFocusElement?: (nodeId: string) => void
}) {
  const config = SOURCE_CONFIG[change.source]
  const Icon = config.icon
  const formattedTime = formatTimestamp(change.timestamp)
  const affectedCount =
    (change.affectedNodeIds?.length ?? 0) + (change.affectedEdgeIds?.length ?? 0)

  return (
    <div
      className="flex items-start gap-2 py-2 border-b border-sand-100 last:border-b-0"
      data-testid="change-item"
    >
      {/* Source icon */}
      <Tooltip content={config.label}>
        <div className={`p-1 rounded ${config.className} bg-opacity-10`}>
          <Icon className={`w-4 h-4 ${config.className}`} aria-hidden="true" />
        </div>
      </Tooltip>

      {/* Change details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`${typography.bodySmall} text-ink-900 truncate`}>
            {change.description}
          </span>
          <span className={`${typography.caption} text-ink-500 flex-shrink-0`}>
            {formattedTime}
          </span>
        </div>

        {/* Actor and affected elements */}
        <div className="flex items-center gap-2 mt-0.5">
          {change.actor && (
            <span className={`${typography.caption} text-ink-500`}>
              by {change.actor}
            </span>
          )}
          {affectedCount > 0 && (
            <span className={`${typography.caption} text-ink-400`}>
              ({affectedCount} element{affectedCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Affected elements - clickable */}
        {change.affectedNodeIds && change.affectedNodeIds.length > 0 && onFocusElement && (
          <div className="flex flex-wrap gap-1 mt-1">
            {change.affectedNodeIds.slice(0, 3).map((nodeId) => (
              <button
                key={nodeId}
                type="button"
                onClick={() => onFocusElement(nodeId)}
                className={`${typography.code} text-[10px] px-1.5 py-0.5 rounded bg-sand-100 text-ink-600 hover:bg-info-100 hover:text-info-700 transition-colors`}
              >
                {nodeId.slice(0, 8)}
              </button>
            ))}
            {change.affectedNodeIds.length > 3 && (
              <span className={`${typography.caption} text-ink-400`}>
                +{change.affectedNodeIds.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Revert button */}
      {change.revertable && onRevert && (
        <Tooltip content="Revert this change">
          <button
            type="button"
            onClick={() => onRevert(change.id)}
            className="p-1 rounded hover:bg-sand-100 text-ink-400 hover:text-ink-600 transition-colors"
            aria-label="Revert change"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

export function ChangeAttributionPanel({
  changes,
  maxVisible = 10,
  onRevert,
  onFocusElement,
  defaultExpanded = true,
  className = '',
}: ChangeAttributionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  // Sort by timestamp, newest first
  const sortedChanges = useMemo(() => {
    return [...changes].sort((a, b) => {
      const dateA = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp
      const dateB = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp
      return dateB.getTime() - dateA.getTime()
    })
  }, [changes])

  const visibleChanges = showAll ? sortedChanges : sortedChanges.slice(0, maxVisible)
  const hasMore = sortedChanges.length > maxVisible

  // Group by source for summary
  const sourceCounts = useMemo(() => {
    const counts: Record<ChangeSource, number> = {
      user: 0,
      ai: 0,
      template: 0,
      import: 0,
      system: 0,
    }
    for (const change of changes) {
      counts[change.source]++
    }
    return counts
  }, [changes])

  if (changes.length === 0) {
    return (
      <div
        className={`rounded-lg border border-sand-200 bg-paper-50 p-4 ${className}`}
        data-testid="change-attribution-panel"
      >
        <div className="flex items-center gap-2 text-ink-500">
          <History className="w-5 h-5" aria-hidden="true" />
          <span className={typography.body}>No changes recorded</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border border-sand-200 bg-paper-50 ${className}`}
      data-testid="change-attribution-panel"
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-3 py-2"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="change-history"
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-ink-600" aria-hidden="true" />
          <span className={`${typography.label} text-ink-900`}>
            Change History
          </span>
          <span className={`${typography.code} text-ink-500 tabular-nums`}>
            ({changes.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Source breakdown pills */}
          <div className="hidden sm:flex items-center gap-1">
            {Object.entries(sourceCounts).map(([source, count]) => {
              if (count === 0) return null
              const config = SOURCE_CONFIG[source as ChangeSource]
              const SourceIcon = config.icon
              return (
                <Tooltip key={source} content={`${count} ${config.label.toLowerCase()}`}>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${config.className} bg-opacity-10`}>
                    <SourceIcon className={`w-3 h-3 ${config.className}`} />
                    <span className={`${typography.code} text-[10px] ${config.className}`}>
                      {count}
                    </span>
                  </div>
                </Tooltip>
              )
            })}
          </div>

          <span className="text-ink-400">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </span>
        </div>
      </button>

      {/* Change list */}
      {isExpanded && (
        <div
          id="change-history"
          className="px-3 pb-3 border-t border-sand-100"
          data-testid="change-list"
        >
          <div className="mt-2 space-y-0">
            {visibleChanges.map((change) => (
              <ChangeItem
                key={change.id}
                change={change}
                onRevert={onRevert}
                onFocusElement={onFocusElement}
              />
            ))}
          </div>

          {/* Show more/less */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={`${typography.labelSmall} text-info-600 hover:text-info-700 mt-2`}
            >
              {showAll
                ? 'Show less'
                : `Show ${sortedChanges.length - maxVisible} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact inline attribution for single element
 */
export function AttributionInline({
  source,
  actor,
  timestamp,
  className = '',
}: {
  source: ChangeSource
  actor?: string
  timestamp?: Date | string
  className?: string
}) {
  const config = SOURCE_CONFIG[source]
  const Icon = config.icon

  return (
    <Tooltip content={`${config.label}${actor ? ` by ${actor}` : ''}`}>
      <div
        className={`inline-flex items-center gap-1 ${config.className} ${className}`}
        data-testid="attribution-inline"
      >
        <Icon className="w-3 h-3" aria-hidden="true" />
        {actor && (
          <span className={`${typography.caption}`}>{actor}</span>
        )}
        {timestamp && (
          <span className={`${typography.caption} opacity-75`}>
            {formatTimestamp(timestamp)}
          </span>
        )}
      </div>
    </Tooltip>
  )
}

/**
 * CappedList Component
 *
 * Reusable component for displaying a list with a maximum visible count.
 * Shows "See all (+N more)" toggle to reveal hidden items.
 *
 * Features:
 * - Generic type support
 * - Optional sorting and deduplication
 * - Configurable max visible count
 * - Accessible expand/collapse
 */

import { useState, useMemo, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface CappedListProps<T> {
  /** Items to display */
  items: T[]
  /** Maximum number of items to show initially */
  maxVisible: number
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode
  /** Optional key extractor - returns stable key for React reconciliation. Defaults to index if not provided. */
  getKey?: (item: T, index: number) => string
  /** Optional overflow label (default: "+{n} more") */
  overflowLabel?: (hiddenCount: number) => string
  /** Optional sort function */
  sortFn?: (a: T, b: T) => number
  /** Optional dedupe function - returns key for deduplication */
  dedupeFn?: (item: T) => string
  /** Empty state message */
  emptyMessage?: string
  /** Accessible label for the expand button */
  expandButtonAriaLabel?: string
}

/**
 * Generic capped list component with expand/collapse.
 */
export function CappedList<T>({
  items,
  maxVisible,
  renderItem,
  getKey,
  overflowLabel = (n) => `+${n} more`,
  sortFn,
  dedupeFn,
  emptyMessage = 'No items',
  expandButtonAriaLabel = 'Show more items',
}: CappedListProps<T>): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false)

  // Process items: dedupe, then sort
  const processedItems = useMemo(() => {
    let result = [...items]

    // Deduplicate if function provided
    if (dedupeFn) {
      const seen = new Set<string>()
      result = result.filter(item => {
        const key = dedupeFn(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    // Sort if function provided
    if (sortFn) {
      result.sort(sortFn)
    }

    return result
  }, [items, sortFn, dedupeFn])

  // Calculate visible items and hidden count
  const visibleItems = isExpanded
    ? processedItems
    : processedItems.slice(0, maxVisible)
  const hiddenCount = Math.max(0, processedItems.length - maxVisible)

  // Empty state
  if (processedItems.length === 0) {
    return (
      <p className={`${typography.caption} text-ink-400 italic`}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {visibleItems.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index}>{renderItem(item, index)}</div>
      ))}

      {/* Expand/collapse toggle */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`${typography.caption} flex items-center gap-1 text-sky-600 hover:text-sky-700 transition-colors mt-2`}
          aria-expanded={isExpanded}
          aria-label={expandButtonAriaLabel}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {isExpanded ? 'Show fewer' : overflowLabel(hiddenCount)}
        </button>
      )}
    </div>
  )
}

export default CappedList

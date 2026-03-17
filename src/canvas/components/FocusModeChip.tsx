/**
 * FocusModeChip - Floating indicator for path highlighting mode
 *
 * When a node is selected and paths are highlighted, this chip shows
 * which node is focused and provides a clear action to exit focus mode.
 *
 * Design System:
 * - Background: paper-50 (#FEF9F3)
 * - Border: 1px sand-200 (#E1D8C7)
 * - Border radius: pill (999px)
 * - Shadow: shadow-1 (0 1px 2px rgba(38,38,38,0.06))
 * - Text: ink-900 (#262626) @ 70% opacity, 14px
 * - Clear button: sky-500 (#2B7FA2)
 * - Z-index: 100 (dropdown level)
 */

import { memo, useMemo } from 'react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../store'

interface FocusModeChipProps {
  /** Optional className for positioning overrides */
  className?: string
}

export const FocusModeChip = memo(function FocusModeChip({ className = '' }: FocusModeChipProps) {
  // React #185 FIX: Use primitive selectors to avoid infinite loops
  const selectionSize = useCanvasStore((s) => s.selection.nodeIds.size)
  const highlightedEdgesSize = useCanvasStore((s) => s.highlightedEdges.size)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  // Get selected node ID (only meaningful when size === 1)
  const selectedId = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    return s.selection.nodeIds.values().next().value ?? null
  })

  // Get node title for display
  const nodeTitle = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    const id = s.selection.nodeIds.values().next().value
    if (!id) return null
    const node = s.nodes.find((n) => n.id === id)
    return node?.data?.label ?? node?.id ?? 'Node'
  })

  // Determine if chip should be visible
  const isVisible = useMemo(() => {
    return selectionSize === 1 && highlightedEdgesSize > 0 && selectedId !== null
  }, [selectionSize, highlightedEdgesSize, selectedId])

  // Don't render if not in focus mode
  if (!isVisible) return null

  // Truncate long titles
  const displayTitle = nodeTitle && nodeTitle.length > 25
    ? `${nodeTitle.slice(0, 24)}...`
    : nodeTitle

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-paper-50 border border-sand-200 rounded-full
        shadow-[0_1px_2px_rgba(38,38,38,0.06)]
        transition-opacity duration-200
        motion-reduce:transition-none
        ${className}
      `}
      role="status"
      aria-live="polite"
      data-testid="focus-mode-chip"
    >
      <span className="text-sm text-ink-900/70">
        Showing paths from{' '}
        <strong className="font-medium" title={nodeTitle ?? undefined}>
          {displayTitle}
        </strong>{' '}
        to goal
      </span>
      <button
        type="button"
        onClick={clearSelection}
        className="p-1 text-sky-500 hover:text-sky-600 rounded-full hover:bg-sky-100/50 transition-colors"
        aria-label="Clear selection and exit focus mode"
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  )
})

export default FocusModeChip

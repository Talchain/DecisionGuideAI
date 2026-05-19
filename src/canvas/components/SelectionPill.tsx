import { memo } from 'react'
import { typo } from '../../styles/typography'
import { useSelectionContext } from '../hooks/useSelectionContext'

/**
 * SelectionPill — shows "Selected: [label]" when a single canvas element is
 * selected. Renders above the persistent input strip. Hidden when nothing
 * (or more than one element) is selected.
 */
export const SelectionPill = memo(function SelectionPill() {
  const selection = useSelectionContext()
  if (!selection) return null

  return (
    <div
      className="px-3 py-1 flex items-center gap-1.5"
      data-testid="ai-panel-selection-pill"
    >
      <span className={typo('panelMeta', 'text-text-light')}>Selected:</span>
      <span className={typo('panelMeta', 'text-text-body truncate max-w-[220px]')}>{selection.label}</span>
    </div>
  )
})

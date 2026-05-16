import { memo } from 'react'
import { typography } from '../../styles/typography'
import { useSelectionContext } from './hooks/useSelectionContext'

// Brief §6.1 (primary cue): "Selected: [element label]" pill rendered at
// the top of the AI zone scroll area when a canvas element is selected.
// The pill is the *primary* selection cue — colour tint on the pull-tab
// is supplementary. Returns null when nothing is selected.

export const SelectionPill = memo(function SelectionPill() {
  const { hasSelection, label } = useSelectionContext()
  if (!hasSelection || !label) return null

  return (
    <div
      data-testid="ai-panel-v2-selection-pill"
      aria-live="polite"
      className="flex items-center justify-start px-3 py-1"
    >
      <span
        className={[
          'inline-flex items-center px-2 py-0.5 rounded-full',
          'bg-panel border border-panel-border text-text-light',
          typography.panelMeta,
        ].join(' ')}
      >
        Selected: {label}
      </span>
    </div>
  )
})

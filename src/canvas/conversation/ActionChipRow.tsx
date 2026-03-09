/**
 * ActionChipRow — Horizontal row of action chips
 *
 * Renders coaching chips and suggested actions below assistant messages.
 * Chip budget (max 4 per turn) is enforced by useConversation.
 */

import { memo } from 'react'
import type { ActionChip } from './types'
import styles from './Conversation.module.css'

interface ActionChipRowProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => void
}

const INTENT_STYLES: Record<ActionChip['intent'], string> = {
  primary: styles.chipPrimary,
  secondary: styles.chipSecondary,
  undo: styles.chipUndo,
}

export const ActionChipRow = memo(function ActionChipRow({
  chips,
  onChipClick,
}: ActionChipRowProps) {
  // Central guard: only render chips that can actually dispatch
  const dispatchable = chips.filter(c => c.intent === 'undo' || !!c.message)
  if (dispatchable.length === 0) return null

  return (
    <div className={styles.chipRow} role="group" aria-label="Suggested actions">
      {dispatchable.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={INTENT_STYLES[chip.intent]}
          onClick={() => onChipClick(chip)}
          data-testid={`chip-${chip.id}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
})

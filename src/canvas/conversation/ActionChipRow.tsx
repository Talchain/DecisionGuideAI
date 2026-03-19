/**
 * ActionChipRow — Horizontal row of action chips
 *
 * Renders coaching chips and suggested actions below assistant messages.
 * Chip budget (max 4 per turn) is enforced by useConversation.
 *
 * Role dots: chips with a `role` field (facilitator/challenger/scientist) render
 * a small coloured dot prefix, matching SuggestedChips. This ensures historical
 * chips retain role differentiation after a new turn arrives.
 */

import { memo } from 'react'
import type { ActionChip } from './types'
import styles from './Conversation.module.css'

interface ActionChipRowProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => Promise<void>
  /**
   * When true, chips are visible but non-interactive (historical turn or in-flight).
   * Applies reduced opacity and disables pointer events.
   */
  disabled?: boolean
}

const INTENT_STYLES: Record<ActionChip['intent'], string> = {
  primary: styles.chipPrimary,
  secondary: styles.chipSecondary,
  undo: styles.chipUndo,
}

// Role dot colours — mirrors SuggestedChips ROLE_DOT_CLASS (DS v5 §21.4 + §21.2)
const ROLE_DOT_CLASS: Record<string, string> = {
  facilitator: 'bg-info',
  challenger: 'bg-danger',
  scientist: 'bg-goal',
}

export const ActionChipRow = memo(function ActionChipRow({
  chips,
  onChipClick,
  disabled = false,
}: ActionChipRowProps) {
  // Central guard: only render chips that can actually dispatch
  const dispatchable = chips.filter(c => c.intent === 'undo' || !!c.message)
  if (dispatchable.length === 0) return null

  return (
    <div
      className={styles.chipRow}
      role="group"
      aria-label="Suggested actions"
      style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
    >
      {dispatchable.map((chip, i) => {
        const dotClass = chip.role ? (ROLE_DOT_CLASS[chip.role] ?? null) : null
        const roleLabel = chip.role
          ? chip.role.charAt(0).toUpperCase() + chip.role.slice(1)
          : null
        const ariaLabel = roleLabel ? `${roleLabel}: ${chip.label}` : undefined

        return (
          <button
            key={chip.id ?? `chip-${i}`}
            type="button"
            className={INTENT_STYLES[chip.intent]}
            onClick={() => !disabled && onChipClick(chip)}
            disabled={disabled}
            aria-disabled={disabled}
            aria-label={ariaLabel}
            data-testid={`chip-${chip.id}`}
            data-chip-role={chip.role ?? undefined}
          >
            {dotClass && (
              <span
                className={`inline-block rounded-full flex-shrink-0 ${dotClass}`}
                style={{ width: 8, height: 8, marginRight: 6 }}
                aria-hidden="true"
                data-testid={`chip-role-dot-${chip.id}`}
              />
            )}
            {chip.label}
          </button>
        )
      })}
    </div>
  )
})

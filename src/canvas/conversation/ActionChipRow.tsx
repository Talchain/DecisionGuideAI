/**
 * ActionChipRow — Horizontal row of action chips
 *
 * Renders coaching chips and suggested actions below assistant messages.
 * Chip budget (max 4 per turn) is enforced by useConversation.
 *
 * Role metadata (facilitator/challenger/scientist) is preserved on chips via
 * data-chip-role and aria-label for styling hooks and accessibility, but is
 * not rendered as visible text or indicators.
 */

import { memo } from 'react'
import { isChipRenderable } from './chipDispatch'
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

export const ActionChipRow = memo(function ActionChipRow({
  chips,
  onChipClick,
  disabled = false,
}: ActionChipRowProps) {
  // Central guard: only render chips that can actually dispatch.
  // ROADMAP 2.138 — shared with SuggestedChips and ChatThread (`chipDispatch.ts`).
  // The guard used to be inlined here as `intent === 'undo' || !!c.message`,
  // one of three divergent copies of the same rule; none of them knew about
  // chips ConversationPanel routes by id, which carry no message by design.
  const dispatchable = chips.filter(isChipRenderable)
  if (dispatchable.length === 0) return null

  return (
    <div
      className={styles.chipRow}
      role="group"
      aria-label="Suggested actions"
      style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
    >
      {dispatchable.map((chip, i) => {
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
            {chip.label}
          </button>
        )
      })}
    </div>
  )
})

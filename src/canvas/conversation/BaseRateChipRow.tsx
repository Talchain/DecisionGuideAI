/**
 * BaseRateChipRow — Frequency-framed chips for base rate elicitation
 *
 * Renders when a MISSING_BASE_RATE guidance item with a "discuss" action is
 * present. Lets non-expert users set factor base rates using frequency
 * framing ("uncommon", "sometimes", "common") instead of raw numbers.
 *
 * Ephemeral: the entire row disappears after the user clicks any chip or
 * types a free-form response (next turn clears it).
 *
 * Mapping values (0.10, 0.40, 0.75) pending Neil review — see Science/UX Architecture Q7
 */

import { memo, useState, useCallback } from 'react'
import type { BaseRateChipSet } from './types'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'
import styles from './Conversation.module.css'

interface BaseRateChipRowProps {
  chipSet: BaseRateChipSet
  onSendMessage: (text: string) => void
  disabled?: boolean
}

/** Numeric base rate values for frequency-framed chips */
const BASE_RATE_VALUES: Record<string, number> = {
  rarely: 0.2,
  sometimes: 0.5,
  usually: 0.8,
}

/** Build the 4 chips for a given factor label */
function buildChips(factorLabel: string) {
  return [
    { id: 'br-uncommon', label: `${factorLabel} is uncommon`, message: 'rarely' },
    { id: 'br-sometimes', label: `${factorLabel} happens sometimes`, message: 'sometimes' },
    { id: 'br-common', label: `${factorLabel} is common`, message: 'usually' },
    { id: 'br-unsure', label: 'Not sure', message: `I'm not sure about ${factorLabel}` },
  ] as const
}

export const BaseRateChipRow = memo(function BaseRateChipRow({
  chipSet,
  onSendMessage,
  disabled = false,
}: BaseRateChipRowProps) {
  const [consumed, setConsumed] = useState(false)
  const chips = buildChips(chipSet.factorLabel)

  const handleClick = useCallback(
    (chip: typeof chips[number]) => {
      if (consumed || disabled) return
      setConsumed(true)

      const dispatch = useGuidanceStore.getState()._dispatchAction
      const numericValue = BASE_RATE_VALUES[chip.message]
      if (dispatch && numericValue != null && chipSet.factorId) {
        // Known factor + known value → deterministic set_factor_value
        dispatch({
          action_type: 'set_factor_value',
          parameters: {
            target_id: chipSet.factorId,
            value: numericValue,
          },
          label: chip.label,
          message: chip.message,
          source: 'base_rate',
        })
      } else if (dispatch) {
        // "Not sure" or missing factorId → conversation turn without action_type
        dispatch({
          label: chip.label,
          message: chip.message,
          source: 'base_rate',
        })
      } else {
        onSendMessage(chip.message)
      }
    },
    [consumed, disabled, chipSet.factorId, onSendMessage],
  )

  if (consumed) return null

  return (
    <div className={styles.baseRateSection} data-testid="base-rate-chips">
      <span
        className={`${typography.bodySmall} ${styles.baseRateLabel}`}
        data-testid="base-rate-label"
      >
        How common is {chipSet.factorLabel}?
      </span>
      <div
        className={styles.baseRateRow}
        role="group"
        aria-label={`How common is ${chipSet.factorLabel}?`}
      >
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`${typography.caption} ${styles.baseRateChip}`}
            onClick={() => handleClick(chip)}
            disabled={disabled || consumed}
            aria-disabled={disabled || consumed}
            data-testid={chip.id}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
})

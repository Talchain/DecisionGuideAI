/**
 * SuggestedChips — stagger-animated action chips after AI messages.
 *
 * Each chip fades in + slides up with 70ms delay between.
 * Up to 2 chips (DS v5 §21.4 cap). Chip base: bg-panel, border
 * border-panel-border, hover:bg-panel-hover. Role metadata preserved via
 * data-chip-role and aria-label for styling/accessibility.
 *
 * In-flight behaviour: when isThinking=true all chips in this turn are disabled
 * (greyed out, not clickable). Re-enabled if request fails.
 * Historical chips (isHistorical=true) are not rendered.
 *
 * Click failures show a brief inline error that auto-dismisses after 5s.
 */

import { useState, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import type { ActionChip } from '../types'

interface SuggestedChipsProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => Promise<void>
  /** When true, all chips are disabled while a response is pending */
  isThinking?: boolean
  /**
   * When true, this turn's chips are historical (a newer response has arrived).
   * Historical chips are not rendered.
   */
  isHistorical?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestedChips({
  chips,
  onChipClick,
  isThinking = false,
  isHistorical = false,
}: SuggestedChipsProps) {
  const [chipError, setChipError] = useState<string | null>(null)

  // Historical chips removed entirely — no false affordance.
  if (isHistorical) return null
  // DS v5 §21.4: max 2 suggested action chips
  const visible = chips.filter(c => !!(c.message || c.prompt)).slice(0, 2)
  if (visible.length === 0) return null

  // Auto-dismiss chip error after 5s
  useEffect(() => {
    if (!chipError) return
    const timer = setTimeout(() => setChipError(null), 5_000)
    return () => clearTimeout(timer)
  }, [chipError])

  const disabled = isThinking || isHistorical

  function handleClick(chip: ActionChip) {
    if (disabled) return
    setChipError(null)
    onChipClick(chip).catch(() => {
      setChipError("That didn't work. Try typing your request instead.")
    })
  }

  return (
    <div className="flex flex-col self-start gap-1 mb-4">
      <div
        className="flex flex-wrap gap-2 mt-4"
        data-testid="suggested-chips"
      >
        {visible.map((chip, i) => {
          const roleLabel = chip.role
            ? chip.role.charAt(0).toUpperCase() + chip.role.slice(1)
            : null
          const ariaLabel = roleLabel
            ? `${roleLabel}: ${chip.label}`
            : chip.label

          return (
            <button
              key={chip.id ?? `chip-${i}`}
              type="button"
              onClick={() => handleClick(chip)}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-disabled={disabled}
              className={[
                'suggested-chip chip-stagger-in',
                'inline-flex items-center gap-1.5',
                'bg-panel border border-panel-border rounded-full',
                'px-4 py-2 min-h-[44px]',
                'hover:bg-panel-hover active:bg-panel-border/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
                'text-text-body cursor-pointer font-sans',
                typography.bodySmall,
                'disabled:opacity-40 disabled:pointer-events-none',
                'transition-colors duration-200',
              ].join(' ')}
              style={{ animationDelay: `${i * 70}ms` }}
              data-testid={`suggested-chip-${chip.id}`}
              data-chip-role={chip.role ?? undefined}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {chipError && (
        <p
          className={`${typography.bodySmall} text-danger`}
          style={{ margin: 0, paddingLeft: 2 }}
          data-testid="chip-error"
        >
          {chipError}
        </p>
      )}

      <style>{`
        @keyframes chipStaggerIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .chip-stagger-in {
          animation: chipStaggerIn 250ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .suggested-chip:not(:disabled):active {
          transform: scale(0.97);
          opacity: 0.85;
        }
        @media (prefers-reduced-motion: reduce) {
          .chip-stagger-in { animation: none; opacity: 1; }
          .suggested-chip:not(:disabled):active { transform: none; }
        }
      `}</style>
    </div>
  )
}

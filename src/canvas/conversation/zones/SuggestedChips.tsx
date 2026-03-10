/**
 * SuggestedChips — stagger-animated action chips after AI messages.
 *
 * Each chip fades in + slides up with 70ms delay between.
 * Max 2 chips. DS v4 outlined pills: bg-transparent, hover bg-panel-hover + info border.
 *
 * Render-level safety: chips without message are filtered (final defensive net
 * after validateResponse and enforceChipBudget). Click failures show a brief
 * inline error that auto-dismisses after 5s.
 */

import { useState, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import type { ActionChip } from '../types'

interface SuggestedChipsProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => Promise<void>
}

export function SuggestedChips({ chips, onChipClick }: SuggestedChipsProps) {
  const [chipError, setChipError] = useState<string | null>(null)

  // Render-level filter: never show a chip that can't dispatch
  const visible = chips.filter(c => !!c.message).slice(0, 2)
  if (visible.length === 0) return null

  // Auto-dismiss chip error after 5s
  useEffect(() => {
    if (!chipError) return
    const timer = setTimeout(() => setChipError(null), 5_000)
    return () => clearTimeout(timer)
  }, [chipError])

  function handleClick(chip: ActionChip) {
    setChipError(null)
    onChipClick(chip).catch(() => {
      setChipError("That didn't work. Try typing your request instead.")
    })
  }

  return (
    <div className="flex flex-col self-start" style={{ gap: 4 }}>
      <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }} data-testid="suggested-chips">
        {visible.map((chip, i) => (
          <button
            key={chip.id ?? `chip-${i}`}
            type="button"
            onClick={() => handleClick(chip)}
            className={`suggested-chip chip-stagger-in bg-transparent text-text-body cursor-pointer ${typography.panelBody}`}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid var(--border-default, #EEE6D8)',
              fontFamily: 'inherit',
              transition: 'all 150ms ease',
              animationDelay: `${i * 70}ms`,
            }}
            data-testid={`suggested-chip-${chip.id}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {chipError && (
        <p
          className={`${typography.panelBody} text-danger`}
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
        .suggested-chip:hover {
          background: var(--bg-panel-hover, #FEF9F3);
          border-color: var(--info, #63ADCF) !important;
        }
        .suggested-chip:focus-visible {
          outline: 2px solid var(--info, #63ADCF);
          outline-offset: 2px;
        }
        .suggested-chip:active {
          transform: scale(0.97);
          opacity: 0.85;
        }
        @media (prefers-reduced-motion: reduce) {
          .chip-stagger-in { animation: none; opacity: 1; }
          .suggested-chip:active { transform: none; }
        }
      `}</style>
    </div>
  )
}

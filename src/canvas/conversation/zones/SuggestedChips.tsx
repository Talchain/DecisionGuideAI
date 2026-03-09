/**
 * SuggestedChips — stagger-animated action chips after AI messages.
 *
 * Each chip fades in + slides up with 70ms delay between.
 * Max 2 chips. DS v4 outlined pills: bg-transparent, hover bg-panel-hover + info border.
 */

import type { ActionChip } from '../types'

interface SuggestedChipsProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => void
}

export function SuggestedChips({ chips, onChipClick }: SuggestedChipsProps) {
  const visible = chips.slice(0, 2)
  if (visible.length === 0) return null

  return (
    <div className="flex flex-wrap self-start" style={{ gap: 6, marginTop: 10 }} data-testid="suggested-chips">
      {visible.map((chip, i) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChipClick(chip)}
          className="suggested-chip chip-stagger-in bg-transparent text-text-body cursor-pointer"
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            border: '1px solid var(--border-default, #EEE6D8)',
            fontSize: 12, // panelBody token
            fontFamily: 'inherit',
            lineHeight: 1.33, // 16/12 — matches panelBody
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: `${i * 70}ms`,
          }}
          data-testid={`suggested-chip-${chip.id}`}
        >
          {chip.label}
        </button>
      ))}

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
        @media (prefers-reduced-motion: reduce) {
          .chip-stagger-in { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  )
}

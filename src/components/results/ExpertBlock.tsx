/**
 * ExpertBlock — wrapper for expert-mode-only content.
 *
 * DS v5 §4.3: panelBody (12px), info-tinted background, proper spacing.
 *
 * Inline style rather than `bg-info/4`, per DS v5 §3.15. That note used to read
 * "opacity modifiers on CSS vars MAY fail silently"; it is now measured, and it
 * is not a maybe. tailwind.config.js declares `info.DEFAULT: 'var(--info)'`
 * with no `<alpha-value>` placeholder, so Tailwind 3.4 cannot inject alpha and
 * DROPS the utility entirely — `bg-info/15` and `border-info/30` emit NO CSS
 * (positive control: `bg-red-500/50` emits `rgb(239 68 68 / 0.5)`).
 *
 * The tint is therefore expressed with color-mix, DERIVED from the token. It
 * previously restated #63ADCF — a pre-D1 blue — as a channel triple, which no
 * hex-based sweep could see, so it had silently orphaned from --info.
 */

import type { ReactNode } from 'react'

interface ExpertBlockProps {
  children: ReactNode
}

export function ExpertBlock({ children }: ExpertBlockProps) {
  return (
    <div
      className="rounded-md px-3 py-2 mt-1"
      style={{ backgroundColor: 'color-mix(in srgb, var(--info) 4%, transparent)' }}
    >
      {children}
    </div>
  )
}

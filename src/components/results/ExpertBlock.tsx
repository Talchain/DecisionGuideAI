/**
 * ExpertBlock — wrapper for expert-mode-only content.
 *
 * DS v5 §4.3: panelBody (12px), info-tinted background, proper spacing.
 *
 * Inline style rather than `bg-info/5`, per DS v5 §3.15. The tint is 4%, and 4
 * is not a step on Tailwind's opacity scale (0/5/10/…), so no bare utility
 * expresses it exactly: `/5` is the nearest legal step, and the exact 4% comes
 * from the color-mix below. An illegal step is not a near-miss that renders
 * slightly wrong: it emits NO CSS AT ALL, so the tint would vanish silently.
 *
 * Since #379 the semantic colours are declared as
 * `rgb(var(--info-rgb) / <alpha-value>)`, so LEGAL steps such as `bg-info/15`
 * and `border-info/30` now emit. Before it they were bare `var(--info)`, which
 * gave Tailwind 3.4 nowhere to inject alpha and dropped every modified utility.
 *
 * The tint is expressed with color-mix, DERIVED from the token. It previously
 * restated #63ADCF — a pre-D1 blue — as a channel triple, which no hex-based
 * sweep could see, so it had silently orphaned from --info.
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

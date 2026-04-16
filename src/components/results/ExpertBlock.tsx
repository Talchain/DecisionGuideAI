/**
 * ExpertBlock — wrapper for expert-mode-only content.
 *
 * DS v5 §4.3: panelBody (12px), info-tinted background, proper spacing.
 * Inline rgba() style per DS v5 §3.15 — Tailwind opacity modifiers on CSS
 * vars may fail silently if the var resolves to hex rather than RGB channels.
 */

import type { ReactNode } from 'react'

interface ExpertBlockProps {
  children: ReactNode
}

export function ExpertBlock({ children }: ExpertBlockProps) {
  return (
    <div
      className="rounded-md px-3 py-2 mt-1"
      style={{ backgroundColor: 'rgba(99, 173, 207, 0.04)' }}
    >
      {children}
    </div>
  )
}

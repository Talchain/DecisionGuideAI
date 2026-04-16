/**
 * PrimaryControlCard — visual wrapper for the single primary editing surface
 * in a panel (strength slider, factor value input, intervention list, etc.).
 *
 * Sits inside the "Your input" PanelGroup and signals that this is THE thing
 * the user is here to do — everything else is visually secondary.
 */

import type { ReactNode } from 'react'

interface PrimaryControlCardProps {
  children: ReactNode
  className?: string
}

export function PrimaryControlCard({ children, className = '' }: PrimaryControlCardProps) {
  return (
    <div
      className={`bg-panel border border-panel-border rounded-lg px-3 py-2.5 ${className}`}
    >
      {children}
    </div>
  )
}

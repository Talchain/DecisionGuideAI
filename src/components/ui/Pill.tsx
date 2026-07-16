/**
 * Pill — the DS's outlined-only status pill, as a component.
 *
 * The DS law this encodes (so it can't drift per-surface): pills are ALWAYS
 * `bg-transparent`, colour arrives ONLY through the border (main colour at
 * ~30-40%) and an optional dot; the text stays `text-text-body` so a row of
 * pills never shouts. Filled pills are a Don't (see DESIGN_SYSTEM.md §Pills).
 * Extracted from the results-hero status pills — the instance every other
 * surface was copying by hand.
 */
import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE: Record<PillTone, { border: string; dot: string | null }> = {
  success: { border: 'border-success/40', dot: 'bg-success' },
  warning: { border: 'border-warning/50', dot: 'bg-warning' },
  danger: { border: 'border-danger/40', dot: 'bg-danger' },
  info: { border: 'border-info/40', dot: 'bg-info' },
  neutral: { border: 'border-panel-border', dot: null },
}

export interface PillProps {
  tone?: PillTone
  /** Show the tone dot (never shown for neutral). */
  dot?: boolean
  children: ReactNode
  className?: string
  title?: string
}

export function Pill({ tone = 'neutral', dot = false, children, className = '', title }: PillProps) {
  const t = TONE[tone]
  return (
    <span
      title={title}
      className={`${typography.panelMeta} inline-flex items-center gap-1.5 rounded-full border bg-transparent px-2 py-0.5 text-text-body ${t.border} ${className}`}
    >
      {dot && t.dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> : null}
      {children}
    </span>
  )
}

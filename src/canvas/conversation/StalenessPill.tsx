/**
 * StalenessPill — freshness indicator above an assistant message bubble.
 *
 * Renders only for `stale` and `unknown` freshness; callers must filter
 * `fresh` and `none` (which produce no pill). Outlined-only per DS v5 §8.5
 * — no filled backgrounds, no coloured text. Border carries the semantic.
 *
 * Source of truth: CEEAnalysisReady.freshness on the inline graph_patch block.
 */

import { AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../styles/typography'

export type StalenessFreshness = 'stale' | 'unknown'

interface StalenessPillProps {
  freshness: StalenessFreshness
}

const COPY: Record<StalenessFreshness, string> = {
  stale: 'Model changed since last analysis',
  unknown: 'Based on latest available analysis',
}

export function StalenessPill({ freshness }: StalenessPillProps) {
  // DS v5 §8.5 / CLAUDE.md: outlined-only pills, border carries the semantic;
  // never text-{colour} on the pill (text or icon). The icon's *shape*
  // (AlertTriangle vs Info) differentiates the two states without colour.
  // Padding 4×12px → py-1 px-3.
  const Icon = freshness === 'stale' ? AlertTriangle : Info
  const borderClass = freshness === 'stale' ? 'border-warning/30' : 'border-info/30'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="staleness-pill"
      data-freshness={freshness}
      className={`${typography.panelMeta} inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-transparent border ${borderClass} text-text-body`}
    >
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
      <span>{COPY[freshness]}</span>
    </div>
  )
}

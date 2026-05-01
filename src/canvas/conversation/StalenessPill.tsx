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
  const Icon = freshness === 'stale' ? AlertTriangle : Info
  // Border carries the semantic on the pill itself; the icon also carries
  // the semantic colour (text-warning / text-info) as a status-indicator
  // exception to the "no text-{colour} on pills" rule — the rule applies
  // to the pill's *text*, which remains text-text-body.
  const borderClass = freshness === 'stale' ? 'border-warning/30' : 'border-info/30'
  const iconColourClass = freshness === 'stale' ? 'text-warning' : 'text-info'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="staleness-pill"
      data-freshness={freshness}
      className={`${typography.panelMeta} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-transparent border ${borderClass} text-text-body`}
    >
      <Icon aria-hidden="true" className={`w-3.5 h-3.5 ${iconColourClass}`} />
      <span>{COPY[freshness]}</span>
    </div>
  )
}

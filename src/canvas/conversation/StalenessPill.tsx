/**
 * StalenessPill — freshness indicator above an assistant message bubble.
 *
 * Renders only for `stale` and `unknown` freshness; callers must filter
 * `fresh` and `none` (which produce no pill). Outlined-only per DS v5 §8.5
 * — no filled backgrounds, no coloured text. Border carries the semantic.
 *
 * Source of truth: CEEAnalysisReady.freshness on the inline graph_patch block.
 *
 * Scope: this component renders pills for assistant messages whose
 * `blocks` carry a `graph_patch` with an `analysis_ready.freshness` of
 * `'stale'` or `'unknown'`. V5 top-level responses that emit
 * `analysis_ready` only at the response root (not on a graph_patch block)
 * write freshness to the canvas store via `applyV5State` but do NOT
 * surface a pill on the assistant message — out of scope for this brief
 * by deliberate decision. Plumbing top-level freshness onto
 * `ConversationMessage` is a separate task that requires tracing the V5
 * message-construction path; track it in a follow-up brief if needed.
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

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

import { useEffect } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { claimStalenessVoice, useMayStalenessVoiceSpeak } from './stalenessVoice'

export type StalenessFreshness = 'stale' | 'unknown'

interface StalenessPillProps {
  freshness: StalenessFreshness
}

const COPY: Record<StalenessFreshness, string> = {
  stale: 'Model changed since last analysis',
  unknown: 'Based on latest available analysis',
}

export function StalenessPill({ freshness }: StalenessPillProps) {
  /**
   * L-42 — ONE staleness communication per turn view. The applied-edit card's
   * freshness note outranks this pill (it is attached to the change that caused
   * the staleness); when that card is on screen this pill stands down rather
   * than saying the same thing a second time.
   *
   * Scoped to the 'stale' variant on purpose. The 'unknown' pill does NOT make
   * the card's claim — it says currency cannot be confirmed, which is a
   * different fact, and the card never states it. Silencing it here would be
   * suppressing an honest statement nothing else makes (the §1 authority-parity
   * rule: never claim which state is current, and never withhold the admission
   * that we cannot tell).
   */
  const isStaleClaim = freshness === 'stale'
  const maySpeak = useMayStalenessVoiceSpeak('pill')
  const speaking = !isStaleClaim || maySpeak
  useEffect(() => {
    if (!speaking || !isStaleClaim) return
    return claimStalenessVoice('pill')
  }, [speaking, isStaleClaim])

  if (!speaking) return null

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

/**
 * V7Hero — the new top-of-panel hero (V7 Lane L4, spec row 3).
 *
 * A win gauge reading the live winner win probability + a headline composed
 * VERBATIM from production headline templates (see buildV7Headline) + an
 * optional subline, with the two honest signal chips (V7SignalRow) and the
 * max-2 suggested chips (V7SuggestedChips) beneath it.
 *
 * This hero does NOT own the robustness verdict — that stays the single
 * responsibility of the sticky `AnalysisFooter` in OutputsDock (spec P1). The
 * hero speaks only to WHO leads and BY HOW MUCH, from live results.
 *
 * Honest absence: no winner → empty headline → the hero renders nothing (the
 * gauge only renders when a finite win probability exists). COMPLETE borders.
 */

import { typography } from '@/styles/typography'
import { formatPercent } from '@/utils/formatPercent'
import type { DecisionResultData, DecisionState, DriverItem } from '../types'
import { buildV7Headline } from './buildV7Headline'
import { V7SignalRow } from './V7SignalRow'
import { V7SuggestedChips } from './V7SuggestedChips'

type FragileEdge = {
  edge_id?: string
  from_id?: string
  from_label: string
  to_label: string
  switch_probability: number
}

export interface V7HeroProps {
  recommendation: DecisionResultData
  decisionState: DecisionState
  topDrivers?: DriverItem[]
  fragileEdges?: FragileEdge[]
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}

/** Gauge geometry — r=22 donut, circumference ≈ 138.23. */
const GAUGE_R = 22
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_R

export function V7Hero({
  recommendation,
  decisionState,
  topDrivers,
  fragileEdges,
  onFocusNode,
  onSendMessage,
}: V7HeroProps) {
  const model = buildV7Headline(recommendation, decisionState)

  // Honest absence — nothing to headline means no hero.
  if (!model.headline) return null

  const winPct = model.winProbability
  const dash = winPct != null ? `${Math.max(0, Math.min(1, winPct)) * GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}` : null

  return (
    <section
      aria-label="Analysis"
      data-testid="v7-hero"
      className="rounded-lg border border-panel-border bg-panel px-3 py-3"
    >
      <div className="flex items-start gap-3">
        {winPct != null && dash && (
          <div className="relative h-[52px] w-[52px] flex-none" data-testid="v7-hero-gauge">
            <svg viewBox="0 0 52 52" className="h-[52px] w-[52px]">
              <circle cx="26" cy="26" r={GAUGE_R} fill="none" stroke="currentColor" strokeWidth="5" className="text-panel-border" />
              <circle
                cx="26"
                cy="26"
                r={GAUGE_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={dash}
                transform="rotate(-90 26 26)"
                className="text-info"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className={`${typography.panelHeader} text-text-header`}>
                {formatPercent(winPct, { fromDecimal: true })}
              </span>
              <span className="text-[8.5px] text-text-light">wins</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`${typography.panelHeader} text-text-header`} data-testid="v7-hero-headline">
            {model.headline}
          </h2>
          {model.subline && (
            <p className={`${typography.panelBody} text-text-light mt-0.5`} data-testid="v7-hero-subline">
              {model.subline}
            </p>
          )}
        </div>
      </div>

      <V7SignalRow topDrivers={topDrivers} fragileEdges={fragileEdges} onFocusNode={onFocusNode} />
      <V7SuggestedChips onSendMessage={onSendMessage} />
    </section>
  )
}

export default V7Hero

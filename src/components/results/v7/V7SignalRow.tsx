/**
 * V7SignalRow — the two honest signal chips under the V7 hero (V7 Lane L4).
 *
 * Spec row 4 (V6-RESPEC-2026-07-23): a flip-risk chip + a main-driver chip on
 * one line, composed from `fragile_edges[0]` + `factor_sensitivity[0]`.
 * Passthrough only:
 *   · Flip-risk chip ← `confidence.challengeFragileEdges[0]` (switch_probability
 *     + from_label) — the SAME fragile-edge slice StressTestSection consumes.
 *   · Main-driver chip ← `drivers.topDrivers[0]` (factorLabel) — the top row of
 *     the drivers table, already ranked upstream.
 *
 * Honest absence: a signal with no backing data renders nothing — no
 * placeholder chip. When neither signal exists the row itself is empty.
 * COMPLETE borders only (L1 guard): chips carry a full `border` on all sides.
 */

import { AlertTriangle, Zap } from 'lucide-react'
import { typography } from '@/styles/typography'
import { formatPercent } from '@/utils/formatPercent'
import type { DriverItem } from '../types'

type FragileEdge = {
  edge_id?: string
  from_id?: string
  from_label: string
  to_label: string
  switch_probability: number
}

export interface V7SignalRowProps {
  /** Ranked drivers — `resultsSectionData.drivers.topDrivers`. */
  topDrivers?: DriverItem[]
  /** Fragile edges — `resultsSectionData.confidence.challengeFragileEdges`. */
  fragileEdges?: FragileEdge[]
  /** Focus the matching canvas element when a chip is clicked. */
  onFocusNode?: (nodeId: string) => void
}

export function V7SignalRow({ topDrivers, fragileEdges, onFocusNode }: V7SignalRowProps) {
  const flip = fragileEdges?.[0]
  const flipPct =
    flip && typeof flip.switch_probability === 'number' && Number.isFinite(flip.switch_probability)
      ? flip.switch_probability
      : null
  const mainDriver = topDrivers?.[0]

  const chips: React.ReactNode[] = []

  // Flip-risk chip — only when a fragile edge with a finite switch probability exists.
  if (flip && flipPct != null) {
    const focusId = flip.from_id
    chips.push(
      <button
        key="flip"
        type="button"
        data-testid="v7-signal-flip-risk"
        disabled={!focusId || !onFocusNode}
        onClick={focusId && onFocusNode ? () => onFocusNode(focusId) : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body enabled:hover:bg-panel-hover disabled:cursor-default`}
      >
        <AlertTriangle className="h-3 w-3 flex-none text-warning" aria-hidden />
        <span>
          <span className="font-semibold text-text-header">
            {formatPercent(flipPct, { fromDecimal: true })}
          </span>{' '}
          flip risk · {flip.from_label}
        </span>
      </button>,
    )
  }

  // Main-driver chip — only when a top driver exists.
  if (mainDriver) {
    const focusId = mainDriver.canFocus ? (mainDriver.matchedNodeId ?? mainDriver.factorKey) : undefined
    chips.push(
      <button
        key="driver"
        type="button"
        data-testid="v7-signal-main-driver"
        disabled={!focusId || !onFocusNode}
        onClick={focusId && onFocusNode ? () => onFocusNode(focusId) : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body enabled:hover:bg-panel-hover disabled:cursor-default`}
      >
        <Zap className="h-3 w-3 flex-none text-info" aria-hidden />
        <span>
          <span className="font-semibold text-text-header">Main driver</span> · {mainDriver.factorLabel}
        </span>
      </button>,
    )
  }

  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="v7-signal-row">
      {chips}
    </div>
  )
}

export default V7SignalRow

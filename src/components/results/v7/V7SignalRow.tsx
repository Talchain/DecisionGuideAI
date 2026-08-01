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
import { selectFlipRisk, type FlipThresholdLike } from '../utils/selectFlipRisk'

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
  /**
   * Producer flip thresholds — `recommendation.flipThresholds`. The honest-
   * absence gate (ROADMAP 2.276): without them this chip cannot know whether
   * the run produced any flip at all.
   */
  flipThresholds?: FlipThresholdLike[]
  /** Focus the matching canvas element when a chip is clicked. */
  onFocusNode?: (nodeId: string) => void
}

export function V7SignalRow({ topDrivers, fragileEdges, flipThresholds, onFocusNode }: V7SignalRowProps) {
  // ROADMAP 2.276 — TWO defects closed here, both witnessed on staging
  // `a27cadf7` (witness-2267 §10):
  //
  //  1. This chip took `fragileEdges[0]` POSITIONALLY. That array is sorted by
  //     `marginal_switch_probability` desc, but the chip RENDERS
  //     `switch_probability` — so it printed a number that had not determined
  //     its own rank. On run 3 it read "15% flip risk · Hybrid Delivery
  //     Approach": ranked on marginal 0.33, displayed switch 0.1485, while the
  //     displayed metric's own maximum on that turn was 0.519.
  //  2. It never consulted `flip_thresholds`, so it named a flip risk on a
  //     turn whose six thresholds were ALL non-flipping — disagreeing, on the
  //     same screen, with the hero's "Top flip risk: Vendor Platform Fit".
  //
  // `selectFlipRisk` owns the gate, the floor and the ranking, and it ranks by
  // the SAME metric this chip prints. Never re-rank here.
  //
  // NOT a no-op on payloads carrying no flip thresholds: this chip previously
  // applied NO visibility floor, so one whose every fragile edge sits at or
  // below UI-SEM-013 (0.15) now renders nothing where it used to render a
  // chip. Intended — the witnessed "15%" was itself 0.1485, i.e. below the
  // floor every sibling fragile-edge surface already honours.
  const flipSelection = selectFlipRisk(
    flipThresholds,
    (fragileEdges ?? []).map((e) => ({
      label: e.from_label,
      switchProbability: e.switch_probability,
      targetId: e.from_id,
      joinId: e.from_id,
    })),
  )
  const flip = flipSelection.topFlipRisk
  const flipPct = flip?.switchProbability ?? null
  const mainDriver = topDrivers?.[0]

  const chips: React.ReactNode[] = []

  // Flip-risk chip — only when the producer's flip evidence permits naming one.
  if (flip && flipPct != null) {
    const focusId = flip.targetId
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
          flip risk · {flip.label}
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

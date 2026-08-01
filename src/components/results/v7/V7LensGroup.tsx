/**
 * V7LensGroup — the single lens control + four lens bodies (V7 Lane L5,
 * spec rows 6/6a/6b/6c/6d).
 *
 * ONE control switches four lenses over the SAME resultsSectionData the live
 * panel below consumes:
 *   · Likely outcome — p10/p50/p90 range bars + win probability per option,
 *     from recommendation.allOptions (the fields OptionCards consumes), on the
 *     shared OptionCards scale.
 *   · Goal fit — per-option goal probability, gated exactly like OptionCards'
 *     "Hits target"; the honest gate distinguishes no-target from producer-gap.
 *   · Stability — the honest gap (not produced; Olumi will not infer it).
 *   · What changed in the result — run-over-run comparison from local run
 *     history (read-only; see V7WhatChangedLens), else the honest empty state.
 *
 * WAI-ARIA tabs: role=tablist with roving tabindex (Left/Right + Home/End),
 * only the active tab in the tab order. All four tabs always render and stay
 * selectable; a lens without data is muted (with a screen-reader cue) and its
 * body renders the honest gate — never a dead tab, never a fabricated chart.
 * Lens switching is pure local render state (no fetch, no rerun).
 *
 * ADDITIVE + PASSTHROUGH: reads existing store data, returns null when there
 * are no analysed options, invents no numbers, ships flagless. COMPLETE
 * borders only (L1 guard) — the tab strip and card carry full borders, the
 * selected tab uses the bg-primary treatment (no one-sided underline accent).
 */

import { useEffect, useRef, useState } from 'react'
import { typography } from '@/styles/typography'
import { formatPercent, formatProbabilityWithResolution } from '@/utils/formatPercent'
import { loadRuns, type StoredRun } from '@/canvas/store/runHistory'
import * as runsBus from '@/canvas/store/runsBus'
import type { OptionResult } from '../types'
import { OptionRangeBar } from '../shared/OptionRangeBar'
import type { V7LensesModel } from './buildV7Lenses'
import { V7_LENS_COPY } from './v7LensCopy'
import { SUB_ONE_PERCENT_FLOOR } from '../utils/displayFloors'
import { V7WhatChangedLens, hasComparableRuns } from './V7WhatChangedLens'

export type V7Lens = 'outcome' | 'goal' | 'stability' | 'whatChanged'

const ALL_LENSES: readonly V7Lens[] = ['outcome', 'goal', 'stability', 'whatChanged']

export interface V7LensGroupProps {
  /** The lens model, built once in V7TopMatter (buildV7Lenses). */
  model: V7LensesModel
}

/** Likely-outcome option row: label + win readout, then the range bar. */
function OutcomeRow({
  option,
  isWinner,
  globalMin,
  globalMax,
}: {
  option: OptionResult
  isWinner: boolean
  globalMin: number
  globalMax: number
}) {
  const win =
    typeof option.winProbability === 'number' && Number.isFinite(option.winProbability)
      ? formatProbabilityWithResolution(option.winProbability, option.nValidSamples)
      : null
  const p10 = option.outcome?.p10
  const p90 = option.outcome?.p90
  const hasRange = typeof p10 === 'number' && typeof p90 === 'number'
  return (
    <div className="space-y-1" data-testid="v7-outcome-row" data-option-id={option.id}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`${typography.panelBody} min-w-0 truncate ${isWinner ? 'text-text-header font-semibold' : 'text-text-body'}`}
          title={option.label}
        >
          {option.label}
        </span>
        {win && (
          <span className={`${typography.panelMeta} whitespace-nowrap ${isWinner ? 'text-text-header' : 'text-text-light'}`}>
            {V7_LENS_COPY.outcome.winReadout(win)}
          </span>
        )}
      </div>
      {hasRange && (
        <OptionRangeBar
          p10={p10 as number}
          p50={option.outcome?.p50 ?? option.outcome?.mean ?? undefined}
          p90={p90 as number}
          globalMin={globalMin}
          globalMax={globalMax}
          data-testid="v7-range-bar"
        />
      )}
    </div>
  )
}

/** Goal-fit probability bar (mirrors OptionCards' "Hits target" StatBar). */
function GoalRow({
  label,
  probability,
  isWinner,
  isSubstitutedJoint,
}: {
  label: string
  probability: number
  isWinner: boolean
  /** Possessive gate — see `goalAnchorCopy`. Read from the model, never re-derived. */
  isSubstitutedJoint: boolean
}) {
  const readout =
    probability < SUB_ONE_PERCENT_FLOOR
      ? V7_LENS_COPY.goal.subOnePercent
      : formatPercent(probability, { fromDecimal: true })
  const widthPct = Math.max(2, Math.min(100, Math.round(probability * 100)))
  return (
    <div className="space-y-1" data-testid="v7-goal-row">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`${typography.panelBody} min-w-0 truncate ${isWinner ? 'text-text-header font-semibold' : 'text-text-body'}`}
          title={label}
        >
          {label}
        </span>
        <span className={`${typography.panelMeta} whitespace-nowrap ${isWinner ? 'text-text-header' : 'text-text-light'}`}>
          {V7_LENS_COPY.goal.hitReadout(readout, isSubstitutedJoint)}
        </span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: 'var(--border-default)' }}>
        <div className="h-full rounded-full bg-info" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  )
}

function GateLine({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p className={`${typography.panelBody} text-text-light`} data-testid={testId}>
      {children}
    </p>
  )
}

export function V7LensGroup({ model }: V7LensGroupProps) {
  const [active, setActive] = useState<V7Lens>('outcome')
  const tabRefs = useRef<Partial<Record<V7Lens, HTMLButtonElement | null>>>({})

  // Live run history (read-only) — powers the What-changed lens body and its
  // tab availability. One read here; V7WhatChangedLens is a pure leaf.
  const [runs, setRuns] = useState<StoredRun[]>(() => loadRuns())
  useEffect(() => {
    const unsub = runsBus.on(() => setRuns(loadRuns()))
    return unsub
  }, [])

  // Analysis-presence guard (belt-and-suspenders — V7TopMatter already gates).
  if (model.outcome.options.length === 0) return null

  const available: Record<V7Lens, boolean> = {
    outcome: model.outcome.available,
    goal: model.goal.available,
    stability: false, // per-option stability is never on the wire (honest gap)
    whatChanged: hasComparableRuns(runs),
  }

  const moveTo = (index: number) => {
    const count = ALL_LENSES.length
    const next = ALL_LENSES[(index + count) % count]
    setActive(next)
    tabRefs.current[next]?.focus()
  }
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveTo(index - 1)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(ALL_LENSES.length - 1)
        break
    }
  }

  const panelId = 'v7-lens-panel'

  return (
    <section
      aria-label="Results lens"
      data-testid="v7-lens-group"
      className="rounded-lg border border-panel-border bg-panel px-3 py-3"
    >
      <div
        role="tablist"
        aria-label={V7_LENS_COPY.tablistAria}
        className="flex gap-0.5 rounded-full border border-panel-border p-0.5"
      >
        {ALL_LENSES.map((lens, index) => {
          const selected = lens === active
          const isAvailable = available[lens]
          return (
            <button
              key={lens}
              ref={(el) => {
                tabRefs.current[lens] = el
              }}
              type="button"
              role="tab"
              id={`${panelId}-tab-${lens}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(lens)}
              onKeyDown={(e) => onKeyDown(e, index)}
              data-testid={`v7-lens-tab-${lens}`}
              data-available={isAvailable ? 'true' : 'false'}
              className={`${typography.panelMeta} flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                selected
                  ? 'bg-primary text-text-on-color'
                  : isAvailable
                    ? 'bg-transparent text-text-light hover:bg-panel-hover hover:text-text-body'
                    : 'bg-transparent text-text-light opacity-60 hover:bg-panel-hover'
              }`}
            >
              {V7_LENS_COPY.lensLabel[lens]}
              {!isAvailable && <span className="sr-only"> ({V7_LENS_COPY.srLensUnavailable})</span>}
            </button>
          )
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${active}`} className="mt-3">
        {active === 'outcome' &&
          (model.outcome.available ? (
            <div className="space-y-2.5" data-testid="v7-lens-outcome">
              {model.outcome.options.map((o) => (
                <OutcomeRow
                  key={o.id}
                  option={o}
                  isWinner={o.id === model.outcome.winnerId}
                  globalMin={model.outcome.globalMin}
                  globalMax={model.outcome.globalMax}
                />
              ))}
              {model.outcome.hasRange && (
                <p className={`${typography.panelMeta} text-text-light`}>{V7_LENS_COPY.outcome.caption}</p>
              )}
            </div>
          ) : (
            <GateLine testId="v7-lens-outcome-gate">{V7_LENS_COPY.outcome.gate}</GateLine>
          ))}

        {active === 'goal' &&
          (model.goal.available ? (
            <div className="space-y-2.5" data-testid="v7-lens-goal">
              {model.goal.options.map((o) => (
                <GoalRow
                  key={o.id}
                  label={o.label}
                  probability={o.goalProbability}
                  isWinner={o.isWinner}
                  isSubstitutedJoint={o.goalFitIsSubstitutedJoint}
                />
              ))}
              {/* The caption takes the SAME flag the rows do. It is a
                  property of the RUN, not of a row (every row is scored on
                  one basis), and any substituted row withholds the possessive
                  for the whole block — the safe direction, and the identical
                  derivation `WinGauge`'s goal block uses. */}
              <p className={`${typography.panelMeta} text-text-light`}>
                {V7_LENS_COPY.goal.caption(
                  model.goal.options.some((o) => o.goalFitIsSubstitutedJoint === true),
                )}
              </p>
            </div>
          ) : (
            <GateLine testId="v7-lens-goal-gate">
              {model.goal.gate === 'no_target'
                ? V7_LENS_COPY.goal.gateNoTarget
                : V7_LENS_COPY.goal.gateProducerGap}
            </GateLine>
          ))}

        {active === 'stability' && (
          <div data-testid="v7-lens-stability">
            <p className={`${typography.panelBody} text-text-header font-semibold`}>
              {V7_LENS_COPY.stability.heading}
            </p>
            <GateLine testId="v7-lens-stability-gate">{V7_LENS_COPY.stability.gate}</GateLine>
          </div>
        )}

        {active === 'whatChanged' && (
          <div data-testid="v7-lens-what-changed">
            <V7WhatChangedLens runs={runs} />
          </div>
        )}
      </div>
    </section>
  )
}

export default V7LensGroup

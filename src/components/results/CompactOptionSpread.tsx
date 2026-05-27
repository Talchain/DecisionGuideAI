/**
 * CompactOptionSpread — single-line option summary for the V17 Analysis tab.
 *
 * Replaces the full OptionCards block in the Analysis tab when the
 * `analysisHeroV17` flag is on. The Compare tab retains the full cards via
 * its own render path (CompareTabBodyV2) — this component does not affect
 * the Compare tab.
 *
 * Format: "Option spread: <leader> NN% · <runner-up> NN% · others NN%  [Compare options]"
 * The "others" segment is omitted when only two options carry a probability
 * or when the rolled-up rest is effectively zero.
 */

import { useUIStore } from '../../stores/uiStore'
import { trackCompareOpened } from '../../canvas/utils/sandboxTelemetry'
import { formatPercent } from '../../utils/formatPercent'
import { typography } from '../../styles/typography'
import type { OptionResult } from './types'

interface Props {
  options: OptionResult[]
}

/**
 * Returns true when CompactOptionSpread will render a visible spread for
 * the given options. Mirrors the in-component filter so the parent can
 * decide whether to render the section wrapper at all, avoiding an orphan
 * "Your options" header when no finite probabilities are available.
 */
export function canRenderCompactOptionSpread(options: OptionResult[]): boolean {
  let finite = 0
  for (const o of options) {
    if (typeof o.winProbability === 'number' && Number.isFinite(o.winProbability)) {
      finite += 1
      if (finite >= 2) return true
    }
  }
  return false
}

export function CompactOptionSpread({ options }: Props) {
  // Number.isFinite excludes NaN / Infinity in case upstream emits a
  // degenerate probability — a NaN would otherwise corrupt the sort and
  // render as "NaN%".
  const sorted = options
    .filter((o): o is OptionResult & { winProbability: number } =>
      typeof o.winProbability === 'number' && Number.isFinite(o.winProbability),
    )
    .sort((a, b) => b.winProbability - a.winProbability)
  if (sorted.length < 2) return null

  const [first, second, ...rest] = sorted
  const restPct = rest.reduce((sum, o) => sum + o.winProbability, 0)
  const parts: string[] = [
    `${first.label} ${formatPercent(first.winProbability, { fromDecimal: true })}`,
    `${second.label} ${formatPercent(second.winProbability, { fromDecimal: true })}`,
  ]
  // Only surface "others" when the rolled-up rest rounds to ≥1% — anything
  // ≤0.5% would format as "0%", which reads as missing data rather than a
  // negligible tail.
  if (restPct > 0.005) {
    parts.push(`others ${formatPercent(restPct, { fromDecimal: true })}`)
  }

  return (
    <div
      className="flex items-center justify-between gap-2 py-2"
      data-testid="compact-option-spread"
    >
      <p className={`${typography.panelBody} text-text-body min-w-0 truncate`}>
        <span className="font-semibold">Option spread:</span> {parts.join(' · ')}
      </p>
      <button
        type="button"
        onClick={() => {
          // Fire the same telemetry the Compare tab-click handler emits
          // (sandbox.compare.opened). Without this, switching tabs via the
          // hero link silently bypasses compare-open measurement.
          trackCompareOpened()
          useUIStore.getState().setActiveOutputTab('compare')
        }}
        className={`flex-shrink-0 text-info hover:underline ${typography.panelBody} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 rounded`}
        data-testid="compact-option-spread-compare"
      >
        Compare options
      </button>
    </div>
  )
}

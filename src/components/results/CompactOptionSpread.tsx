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
import { formatPercent } from '../../utils/formatPercent'
import { typography } from '../../styles/typography'
import type { OptionResult } from './types'

interface Props {
  options: OptionResult[]
}

export function CompactOptionSpread({ options }: Props) {
  const sorted = options
    .filter((o): o is OptionResult & { winProbability: number } => typeof o.winProbability === 'number')
    .sort((a, b) => b.winProbability - a.winProbability)
  if (sorted.length < 2) return null

  const [first, second, ...rest] = sorted
  const restPct = rest.reduce((sum, o) => sum + o.winProbability, 0)
  const parts: string[] = [
    `${first.label} ${formatPercent(first.winProbability, { fromDecimal: true })}`,
    `${second.label} ${formatPercent(second.winProbability, { fromDecimal: true })}`,
  ]
  if (rest.length > 0 && restPct > 0.005) {
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
        onClick={() => useUIStore.getState().setActiveOutputTab('compare')}
        className={`flex-shrink-0 text-info hover:underline ${typography.panelBody} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 rounded`}
        data-testid="compact-option-spread-compare"
      >
        Compare options
      </button>
    </div>
  )
}

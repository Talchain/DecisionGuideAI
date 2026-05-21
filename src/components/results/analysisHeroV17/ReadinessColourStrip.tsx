/**
 * ReadinessColourStrip — 4-segment dimension strip + legend.
 *
 * Per docs/investigations/analysis-hero-v17.md §4.2. v1 segments are
 * Structure / Evidence / Coverage / Verified; "User input" is the future
 * label once per-factor provenance is plumbed.
 *
 * `checkedCount` (e.g. "No inputs verified" / "3 inputs verified") is
 * surfaced on the Verified segment's tooltip + aria-label only — never
 * rendered as visible text (see docs/investigations/analysis-hero-v17-top-section.md
 * task 2).
 */

import { typography } from '@/styles/typography'
import type { DimensionSegment } from './analysisHeroVM.types'
import { STRIP_FILL_CLASS } from './tokens'

interface Props {
  checkedCount: string | null
  dimensions: DimensionSegment[]
}

export function ReadinessColourStrip({ checkedCount, dimensions }: Props) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="hero-v17-strip">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${typography.panelHeader} text-text-header`}>Strengthen this decision</p>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Decision readiness dimensions">
        {dimensions.map(d => {
          const pct = Math.round(d.value * 100)
          const isVerified = d.label === 'Verified'
          const composite = isVerified && checkedCount
            ? `${d.label}: ${pct}% (${checkedCount})`
            : `${d.label}: ${pct}%`
          return (
            <div
              key={d.label}
              className="h-1.5 rounded-full bg-panel-hover overflow-hidden"
              title={composite}
              aria-label={isVerified ? composite : undefined}
              data-testid={`strip-${d.label.toLowerCase()}`}
            >
              <div
                className={`h-full rounded-full ${STRIP_FILL_CLASS[d.token]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {dimensions.map(d => (
          <span key={d.label} className={`flex items-center gap-1 ${typography.panelMeta} text-text-light truncate`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STRIP_FILL_CLASS[d.token]}`} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

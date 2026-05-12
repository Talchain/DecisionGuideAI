/**
 * HeroResultContext — result line + reason line + meta pills.
 *
 * Per docs/investigations/analysis-hero-v17.md §4.1. The "Result fragile"
 * pill is bound to stability < 0.5 upstream in buildAnalysisHeroViewModel
 * (anti-drift test in accessibility.spec.tsx).
 */

import { typography } from '@/styles/typography'
import type { MetaPill } from './analysisHeroVM.types'
import { META_PILL_CLASS } from './tokens'

interface Props {
  resultLine: string
  reasonLine: string | null
  metaPills: MetaPill[]
}

export function HeroResultContext({ resultLine, reasonLine, metaPills }: Props) {
  return (
    <section
      className="rounded-md border border-panel-border p-2.5 flex flex-col gap-1.5"
      aria-label="Result context"
      data-testid="hero-v17-result-context"
    >
      <p className={`${typography.panelHeader} text-text-header`}>{resultLine}</p>
      {reasonLine && <p className={`${typography.panelBody} text-text-body`}>{reasonLine}</p>}
      {metaPills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {metaPills.map(p => (
            <span
              key={p.label}
              className={`inline-flex items-center px-2 py-0.5 rounded-full border ${typography.panelMeta} bg-transparent ${META_PILL_CLASS[p.tone]}`}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

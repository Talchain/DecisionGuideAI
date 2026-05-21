/**
 * HeroResultContext — result line + dependency line.
 *
 * Per docs/investigations/analysis-hero-v17-top-section.md:
 * - The result line uses "comes out ahead most often" framing (Olumi
 *   communication glossary — probabilistic, not categorical).
 * - The dependency line surfaces below the result line when a safe
 *   dominant-factor source is available. Built upstream in
 *   `buildAnalysisHeroViewModel.buildDependencyLine`; null hides the line.
 * - The flip-risk reason line and the meta pills (stability + evidence
 *   bands) were removed (2026-05-21). Flip-risk content already surfaces
 *   in Row 1 of the input rows below; stability and evidence signals
 *   remain in HeroFooter checks.
 */

import { typography } from '@/styles/typography'

interface Props {
  resultLine: string
  dependencyLine: string | null
}

export function HeroResultContext({ resultLine, dependencyLine }: Props) {
  return (
    <section
      className="rounded-md border border-panel-border p-2.5 flex flex-col gap-1.5"
      aria-label="Result context"
      data-testid="hero-v17-result-context"
    >
      <p className={`${typography.panelHeader} text-text-header`}>{resultLine}</p>
      {dependencyLine && (
        <p
          className={`${typography.panelBody} text-text-body`}
          data-testid="hero-v17-dependency-line"
        >
          {dependencyLine}
        </p>
      )}
    </section>
  )
}

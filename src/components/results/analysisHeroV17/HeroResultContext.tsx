/**
 * HeroResultContext — result line + dependency line.
 *
 * Per docs/investigations/analysis-hero-v17-top-section.md and the
 * 2026-05-21 correction pass:
 * - The result line uses "comes out ahead most often" framing (Olumi
 *   communication glossary — probabilistic, not categorical).
 * - The dependency line surfaces below the result line when a safe
 *   dominant-factor source is available. Built upstream in
 *   `buildAnalysisHeroViewModel.buildDependencyLine`; null hides the line.
 * - The flip-risk reason line and the meta pills (stability + evidence
 *   bands) were removed earlier. Flip-risk content already surfaces in
 *   Row 1 of the input rows below.
 * - Visual chrome (rounded-md border + padding) was removed in the 2026-05-21
 *   correction pass. The result + dependency lines now read as plain prose
 *   inside the outer hero card, separated from neighbours by the parent's
 *   `space-y-3`. The outer hero card already provides the border.
 */

import { typography } from '@/styles/typography'

interface Props {
  resultLine: string
  dependencyLine: string | null
}

export function HeroResultContext({ resultLine, dependencyLine }: Props) {
  return (
    <section
      className="flex flex-col gap-1"
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

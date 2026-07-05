/**
 * AnalysisHeroContainer — the ONE authorised mount of the analysis hero.
 *
 * Mounted exclusively by ResultsBody (enforced by __tests__/inertness.spec.ts)
 * inside a SectionErrorBoundary, behind the `analysisHeroPanel` flag. Bridges
 * the store-aware hook to the store-free presentational panel and fails
 * closed: an empty model renders nothing, leaving the existing tab unchanged.
 *
 * Props are the SAME objects ResultsBody already holds for the existing
 * panels — the hero introduces no second data path.
 */
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { AnalysisHeroPanel } from './AnalysisHeroPanel'
import { useAnalysisHero } from './useAnalysisHero'

export interface AnalysisHeroContainerProps {
  data: ResultsSectionDataReturn
  /** ResultsBody's existing staleness signal (OutputsDock freshness verdict). */
  isStale?: boolean
  /**
   * OutputsDock's existing apply-threshold route (set goal threshold +
   * rerun) — powers the promoted Focus-next success-target action. Optional:
   * absent, the promoted line renders as plain text.
   */
  onApplyTarget?: (value: number) => void
}

export function AnalysisHeroContainer({
  data,
  isStale = false,
  onApplyTarget,
}: AnalysisHeroContainerProps) {
  const { model, onRerun, rerunDisabled, focusPanelMounted } = useAnalysisHero(data)
  if (model.kind === 'empty') return null
  return (
    <AnalysisHeroPanel
      model={model}
      isStale={isStale}
      onRerun={onRerun}
      rerunDisabled={rerunDisabled}
      focusPanelMounted={focusPanelMounted}
      onApplyTarget={onApplyTarget}
    />
  )
}

export default AnalysisHeroContainer

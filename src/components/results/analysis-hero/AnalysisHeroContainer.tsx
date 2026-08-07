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
import { useCallback } from 'react'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { AnalysisHeroPanel } from './AnalysisHeroPanel'
import { useAnalysisHero } from './useAnalysisHero'

export interface AnalysisHeroContainerProps {
  data: ResultsSectionDataReturn
  /**
   * OutputsDock's existing apply-threshold route (set goal threshold +
   * rerun) — powers the promoted Focus-next success-target action. Optional:
   * absent, the promoted line renders as plain text.
   */
  onApplyTarget?: (value: number) => void
  /**
   * Opens the Define-success modal (built by another lane at
   * src/components/results/modals/) — threaded through untouched to the
   * goal-lens inline CTA. Optional: absent, the CTA is hidden entirely.
   */
  onDefineSuccess?: () => void
}

export function AnalysisHeroContainer({
  data,
  onApplyTarget,
  onDefineSuccess,
}: AnalysisHeroContainerProps) {
  const { model, rerunDisabled, focusPanelSelector, nextRecommendation } =
    useAnalysisHero(data)
  // §6.5 quick links + evidence rows: focus the target on canvas through the
  // universal fail-closed resolver (Parity P1) — node id, edge id, or the
  // synthetic `${source}->${target}` edge form all resolve; a target that no
  // longer exists on the graph is a silent no-op, never a crash.
  const onFocusTarget = useCallback((targetId: string) => {
    focusModelTarget(targetId)
  }, [])
  if (model.kind === 'empty') return null
  return (
    <AnalysisHeroPanel
      model={model}
      rerunDisabled={rerunDisabled}
      focusPanelSelector={focusPanelSelector}
      nextRecommendation={nextRecommendation}
      onApplyTarget={onApplyTarget}
      onDefineSuccess={onDefineSuccess}
      onFocusTarget={onFocusTarget}
    />
  )
}

export default AnalysisHeroContainer

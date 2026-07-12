/**
 * useAnalysisHero — the ONE store/flag-aware file in the analysis-hero
 * module.
 *
 * Receives the SAME adapted object the Results Panel consumes (passed down
 * from ResultsBody as a prop — no second data path, no fetch, no direct
 * CEE/PLoT access) and wires the two live concerns the presentational panel
 * must not own:
 *   - re-run analysis via the canonical runner (stale Focus-next);
 *   - whether the coaching panel below is mounted (isFocusNowPanelEnabled),
 *     which gates the Focus-next scroll affordance so it is never a dead
 *     link.
 *
 * The model is memoised on the data object identity — lens switching and row
 * disclosure live in the panel as local render state and never re-run this
 * mapping.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { executeCanonicalRun } from '@/canvas/analysis/canonicalRunRegistry'
import { isFocusNowPanelEnabled } from '@/flags'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { buildHeroModel } from './buildHeroModel'
import type { HeroModel } from './heroTypes'

export interface UseAnalysisHeroReturn {
  model: HeroModel
  onRerun: () => void
  rerunDisabled: boolean
  focusPanelMounted: boolean
}

export function useAnalysisHero(data: ResultsSectionDataReturn): UseAnalysisHeroReturn {
  const resultsStatus = useCanvasStore((s) => s.results.status)
  const isAnalysing =
    resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  const model = useMemo(() => buildHeroModel(data), [data])

  // Wave F-B: the hero rerun routes through the canonical runner — its old
  // private useV2Run instance bypassed the dock's run gate and the V5 fact
  // path (no cross-instance mutex; audit F-77).
  const onRerun = useCallback(() => {
    void executeCanonicalRun({ source: 'analysis-hero' })
  }, [])

  return {
    model,
    onRerun,
    rerunDisabled: isAnalysing,
    focusPanelMounted: isFocusNowPanelEnabled(),
  }
}

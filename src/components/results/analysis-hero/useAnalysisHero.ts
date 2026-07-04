/**
 * useAnalysisHero — the ONE store/flag-aware file in the analysis-hero
 * module.
 *
 * Receives the SAME adapted object the Results Panel consumes (passed down
 * from ResultsBody as a prop — no second data path, no fetch, no direct
 * CEE/PLoT access) and wires the two live concerns the presentational panel
 * must not own:
 *   - re-run analysis via the existing useV2Run path (stale Focus-next);
 *   - whether the coaching panel below is mounted (isFocusNowPanelEnabled),
 *     which gates the Focus-next scroll affordance so it is never a dead
 *     link.
 *
 * The model is memoised on the data object identity — lens switching and row
 * disclosure live in the panel as local render state and never re-run this
 * mapping.
 */
import { useCallback, useMemo } from 'react'
import { useV2Run } from '@/canvas/hooks/useV2Run'
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
  const { runV2Analysis, isRunning } = useV2Run()

  const model = useMemo(() => buildHeroModel(data), [data])

  const onRerun = useCallback(() => {
    void runV2Analysis()
  }, [runV2Analysis])

  return {
    model,
    onRerun,
    rerunDisabled: isRunning,
    focusPanelMounted: isFocusNowPanelEnabled(),
  }
}

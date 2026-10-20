/**
 * The run pair's chances, ONLY through the chance gate (`pairChanceFigures`, DL ruling 20 Oct 2026): this run's side from
 * its canonical view, the earlier run's from run_delta's own licensed sides. One hook, so the Compare tab and Reasoning's
 * one-glance receipt can never say different figures for the same pair.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useCanonicalAnalysisViewStore } from '../stores/canonicalAnalysisViewStore'
import { pairChanceFigures, runViewOf, type PairChanceFigures } from '../runView/runView'
import type { RunDeltaView } from '../../components/results/analysisNew/runDeltaView'

export function usePairChanceFigures(view: RunDeltaView | null, responseHash: string | null | undefined): PairChanceFigures | null {
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const report = useCanvasStore(s => (s.results?.hash === responseHash ? s.results?.report : null))
  const canonical = useCanonicalAnalysisViewStore(s => (s.scenarioId === scenarioId ? s.view : null))
  return useMemo(() => (view === null ? null : pairChanceFigures(view, runViewOf(report, canonical))), [view, report, canonical])
}

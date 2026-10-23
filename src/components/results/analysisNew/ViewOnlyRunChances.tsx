/**
 * DL ruling A (23 Oct): a board read that carries only CEE's `canonical_analysis_view` (no `analysis_result`) says the
 * bound, current Run's served cells and goal-chance sentence in the pre-run slot, in CEE's own words. Display only: the
 * binding and currentness are `runViewOf`'s (run id AND graph hash, `stale === false`); no licence, chance or value logic.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { optionChanceCell, runViewGoalChanceSentence, runViewOf } from '../../../canvas/runView/runView'
import { typography } from '../../../styles/typography'

export interface ViewOnlyRunChances {
  readonly sentence: string | null
  readonly cells: readonly { readonly optionId: string; readonly text: string }[]
}

const CTX = { goalChanceHeroSays: false, labelOf: () => null }

/** The bound, current view-only Run's served words; null where a report is held, or the view is unbound or not current. */
export function useViewOnlyRunChances(): ViewOnlyRunChances | null {
  const report = useCanvasStore(s => s.results?.report ?? null)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const canonical = useCanonicalAnalysisViewStore(s => (s.scenarioId === scenarioId ? s.view : null))
  return useMemo(() => {
    if (report != null || canonical === null) return null
    const view = runViewOf(null, canonical)
    if (!view.boundToCurrentCanonical()) return null
    const cells = canonical.options.flatMap(({ option_id: optionId }) => {
      const text = optionChanceCell(view, optionId, CTX).text
      return text === null ? [] : [{ optionId, text }]
    })
    const sentence = runViewGoalChanceSentence(view)
    return cells.length === 0 && sentence === null ? null : { sentence, cells }
  }, [report, canonical])
}

export function ViewOnlyRunChancesBlock({ chances }: { chances: ViewOnlyRunChances }) {
  return (
    <div className="space-y-1" data-testid="analysis-view-only-chances">
      {chances.sentence === null ? null : (
        <p className={`${typography.panelBody} text-text-body`} data-testid="analysis-view-only-chances-sentence">
          {chances.sentence}
        </p>
      )}
      {chances.cells.map(cell => (
        <p key={cell.optionId} className={`${typography.panelBody} text-text-body`}
          data-testid={`analysis-view-only-chance-${cell.optionId}`}>
          {cell.text}
        </p>
      ))}
    </div>
  )
}

/**
 * DL ruling A (23 Oct): a board read that carries only CEE's `canonical_analysis_view` (no `analysis_result`) says the
 * bound, current Run's served cells and goal-chance sentence in the pre-run slot, in CEE's own words. Display only: the
 * binding and currentness are `runViewOf`'s (run id AND graph hash, `stale === false`); no licence, chance or value logic.
 * A withheld cell says CEE's face and its `why`; options withheld with the same words are said once, since those words
 * name no option.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { optionChanceCell, runViewGoalChanceSentence, runViewOf } from '../../../canvas/runView/runView'
import { typography } from '../../../styles/typography'

export interface ViewOnlyRunChanceLine {
  readonly optionIds: readonly string[]
  readonly text: string
  readonly why: string | null
}

export interface ViewOnlyRunChances {
  readonly sentence: string | null
  readonly lines: readonly ViewOnlyRunChanceLine[]
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
    const lines: { optionIds: string[]; text: string; why: string | null; withheld: boolean }[] = []
    for (const { option_id: optionId } of canonical.options) {
      const cell = optionChanceCell(view, optionId, CTX)
      if (cell.text === null) continue
      const withheld = cell.kind === 'withheld'
      const why = withheld ? cell.why ?? null : null
      const same = withheld ? lines.find(l => l.withheld && l.text === cell.text && l.why === why) : undefined
      if (same) same.optionIds.push(optionId)
      else lines.push({ optionIds: [optionId], text: cell.text, why, withheld })
    }
    const sentence = runViewGoalChanceSentence(view)
    return lines.length === 0 && sentence === null ? null : { sentence, lines }
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
      {chances.lines.map(line => (
        <div key={line.optionIds.join('+')} data-testid={`analysis-view-only-chance-${line.optionIds.join('+')}`}>
          <p className={`${typography.panelBody} text-text-body`}>{line.text}</p>
          {line.why === null ? null : <p className={`${typography.panelMeta} text-text-light`}>{line.why}</p>}
        </div>
      ))}
    </div>
  )
}

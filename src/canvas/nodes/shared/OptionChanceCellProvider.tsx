import { createContext, useMemo, type ReactNode } from 'react'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import type { OptionResult } from '../../../components/results/types'
import { stripEncodingNotation } from '../../../components/results/utils/cleanFactorLabel'
import { goalChanceHeroSays } from '../../../components/results/utils/goalChanceLicence'
import { optionChanceCell, runViewOf, type OptionChanceCell } from '../../runView/runView'

export type CanvasOptionChanceCell = OptionChanceCell &
  Pick<OptionResult, 'goalFitBaseCaveat' | 'goalFitIsModelledBasis'>

// The context's empty value is RunView's no-source cell, resolved once at module load.
const NONE = optionChanceCell(runViewOf(null), '', { goalChanceHeroSays: false, labelOf: () => null })
export const CanvasOptionChanceContext = createContext<(optionId: string) => CanvasOptionChanceCell>(() => NONE)

/** One Results projection per canvas; cards only read the held per-option cells and basis metadata. */
export function OptionChanceCellProvider({ children }: { children: ReactNode }) {
  const data = useResultsSectionData({ registerCanvasRows: false })
  const rec = data.recommendation
  const chanceCellOf = useMemo(() => {
    const options = new Map(rec.allOptions.map(option => [option.id, option]))
    const labelOf = (id: string) => {
      const option = options.get(id)
      return option ? stripEncodingNotation(option.label) : null
    }
    const view = data.runView ?? runViewOf(null)
    const heroSays = goalChanceHeroSays(rec.goalThreshold, rec.allOptions, data.goalChanceLicence ?? null)
    const cells = new Map<string, CanvasOptionChanceCell>(rec.allOptions.map(option => [option.id, {
      ...optionChanceCell(view, option.id, {
        goalChanceHeroSays: heroSays,
        hasGoalTarget: rec.hasGoalTarget ?? rec.goalThreshold != null,
        goalFiguresWithheldMessage: rec.goalFiguresWithheldMessage,
        goalCertaintyUnearned: option.goalCertaintyUnearned,
        notAnalysed: option.notAnalysed,
        labelOf,
        rangeLabelOf: data.goalChanceDriverNames?.labelOf ?? labelOf,
      }),
      goalFitBaseCaveat: option.goalFitBaseCaveat,
      goalFitIsModelledBasis: option.goalFitIsModelledBasis,
    }]))
    return (optionId: string) => cells.get(optionId) ?? NONE
  }, [rec, data.runView, data.goalChanceLicence, data.goalChanceDriverNames])

  return <CanvasOptionChanceContext.Provider value={chanceCellOf}>{children}</CanvasOptionChanceContext.Provider>
}

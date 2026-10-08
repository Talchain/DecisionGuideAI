import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { optionChanceCell, runViewOf } from '../../canvas/runView/runView'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { goalChanceHeroSays } from './utils/goalChanceLicence'

/** All three surfaces supply the same Results context to RunView's sole resolver. */
export function optionChanceCellFromResults(data: ResultsSectionDataReturn, optionId: string) {
  const rec = data.recommendation
  const option = rec.allOptions.find(row => row.id === optionId)
  const labelOf = (id: string) => {
    const row = rec.allOptions.find(candidate => candidate.id === id)
    return row ? stripEncodingNotation(row.label) : null
  }
  const view = data.runView ?? { ...runViewOf(null), goalChance: data.goalChanceLicence ?? null, goalChanceRange: data.goalChanceRange ?? null }
  return optionChanceCell(view, optionId, {
    goalChanceHeroSays: goalChanceHeroSays(rec.goalThreshold, rec.allOptions, data.goalChanceLicence ?? null),
    goalFiguresWithheldMessage: rec.goalFiguresWithheldMessage,
    goalCertaintyUnearned: option?.goalCertaintyUnearned,
    notAnalysed: option?.notAnalysed,
    labelOf,
    rangeLabelOf: data.goalChanceDriverNames?.labelOf ?? labelOf,
  })
}

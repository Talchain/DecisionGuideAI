import { createContext, type ReactNode } from 'react'
import type { OptionResult } from '../../../components/results/types'
import { optionChanceCell, runViewOf, type OptionChanceCell } from '../../runView/runView'

export type CanvasOptionChanceCell = OptionChanceCell &
  Pick<OptionResult, 'goalFitBaseCaveat' | 'goalFitIsModelledBasis'>

// The context's empty value is RunView's no-source cell, resolved once at module load.
const NONE = optionChanceCell(runViewOf(null), '', { goalChanceHeroSays: false, labelOf: () => null })
export const CanvasOptionChanceContext = createContext<(optionId: string) => CanvasOptionChanceCell>(() => NONE)
const noChance = (): CanvasOptionChanceCell => NONE

/**
 * #2747 re-scope 2 (U0): the canvas option cards show NO chance in C — neither CEE's cell nor a withheld face. Chances are
 * said on the journey path only (the Analysis tab's hero, option cards and range lines, and the chat analysis card), in
 * CEE's words. Every card reads the no-source cell, so its readout slot stays empty and no figure caveat is drawn.
 * Interim limit; the restore trigger is the chance's own served string and Run licence on the canvas (post-C).
 */
export function OptionChanceCellProvider({ children }: { children: ReactNode }) {
  return <CanvasOptionChanceContext.Provider value={noChance}>{children}</CanvasOptionChanceContext.Provider>
}

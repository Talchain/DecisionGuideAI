import { createContext, useMemo, type ReactNode } from 'react'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import type { OptionResult } from '../../../components/results/types'
import { optionChanceCell, runViewOf, type OptionChanceCell } from '../../runView/runView'

export type CanvasOptionChanceCell = OptionChanceCell &
  Pick<OptionResult, 'goalFitBaseCaveat' | 'goalFitIsModelledBasis'> & {
    /** CEE's whole face, for the card's tooltip and accessible name when `text` drops the option's own label. */
    readonly detail?: string
  }

/**
 * The card already names its option, and CEE's face opens with that name ("‘Start a loyalty card’: about 39% chance of …"),
 * so in the card's one truncated line the figure never showed (served 22 Oct). The slot says the face from the figure on:
 * CEE's own words, less only the leading quoted label; the whole face stays in the tooltip.
 */
export function faceWithoutOwnLabel(face: string): string {
  const rest = face.replace(/^‘[^’]*’: /, '')
  return rest === '' ? face : rest
}

// The context's empty value is RunView's no-source cell, resolved once at module load.
const NONE = optionChanceCell(runViewOf(null), '', { goalChanceHeroSays: false, labelOf: () => null })
export const CanvasOptionChanceContext = createContext<(optionId: string) => CanvasOptionChanceCell>(() => NONE)

/**
 * The first post-C UI item (DL, 12 Oct): a canvas option card says CEE's served cell for its option, verbatim — the
 * canonical cell `servedCellOf` holds for a matching Run known to be current (its face, else its display; a withheld
 * cell's own face and why). Nothing else: no figure the UI derives, no withheld face of the UI's own, no figure caveat
 * of the UI's own, and nothing for a Run that is not current. In C the cards showed no chance (U0); this restores CEE's
 * words only.
 */
export function OptionChanceCellProvider({ children }: { children: ReactNode }) {
  const data = useResultsSectionData({ registerCanvasRows: false })
  const view = data.runView ?? null
  const servedCellOf = useMemo(() => (optionId: string): CanvasOptionChanceCell => {
    const cell = view?.servedCellOf(optionId) ?? null
    if (cell?.kind === 'figure' || cell?.kind === 'range') {
      return cell.face === undefined ? { kind: cell.kind, text: cell.display } : { kind: cell.kind, text: faceWithoutOwnLabel(cell.face), detail: cell.face }
    }
    if (cell?.kind === 'withheld' && cell.face !== undefined) {
      return { kind: 'withheld', text: cell.face, ...(cell.why === undefined ? {} : { why: cell.why }) }
    }
    return NONE
  }, [view])
  return <CanvasOptionChanceContext.Provider value={servedCellOf}>{children}</CanvasOptionChanceContext.Provider>
}

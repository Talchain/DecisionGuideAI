/**
 * The lenses on the core lane's canvas (DL 4 Nov: the hidden surfaces back on, fed from core's View only). The legacy lens bar reads the
 * legacy node shapes, which a View card does not carry; this lane draws its own (`ViewLensBar`), with the lenses the View can fill:
 * Model (no lens) and Rests on (`restsOnOf`). The others wait on View fields (What would change: the driver's card; If it failed: core's
 * stories; Trade-offs: core's gains and gives-up) or are the card's own (What if: ✎ → Try). View only: a lens writes nothing.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { cardNumbersOf, restsOnOf, type RestsOnItem } from './layout'
import { useViewStore } from './store'

export type ViewLens = 'full' | 'rests_on'
export const VIEW_LENSES: readonly ViewLens[] = ['full', 'rests_on']
export const useViewLens = create<{ lens: ViewLens }>(() => ({ lens: 'full' }))

/** What the model on screen rests on, worked out once per View. */
export function useRestsOn(): { items: ReadonlyMap<string, RestsOnItem>; olumi: number } {
  const model = useViewStore((s) => s.view?.model ?? null)
  return useMemo(() => (model === null ? { items: new Map(), olumi: 0 } : restsOnOf(model)), [model])
}

/** The card's place in the Rests on lens while it is on, else null. */
export function useRestsOnItem(id: string): RestsOnItem | null {
  const on = useViewLens((s) => s.lens === 'rests_on')
  const { items } = useRestsOn()
  return on ? items.get(id) ?? null : null
}

/** The card's number on the canvas (O1, F1, OC1, …), worked out once per View. */
export function useCardNumber(id: string): string | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const numbers = useMemo(() => (model === null ? new Map<string, string>() : cardNumbersOf(model)), [model])
  return numbers.get(id) ?? null
}

import { create } from 'zustand'

export type Pair<T> = readonly [T, T]

type CompareSelection = {
  byScenario: ReadonlyMap<string | null, Pair<string>>
  setPair: (sid: string | null, pair: Pair<string> | null) => void
}

export const useCompareSelection = create<CompareSelection>()((set) => ({
  byScenario: new Map(),
  setPair: (sid, pair) => set(({ byScenario }) => {
    const next = new Map(byScenario)
    if (pair === null) next.delete(sid)
    else next.set(sid, pair)
    return { byScenario: next }
  }),
}))

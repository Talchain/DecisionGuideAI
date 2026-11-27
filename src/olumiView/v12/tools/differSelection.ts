import { create } from 'zustand'

interface DifferSelection {
  readonly bySid: Readonly<Record<string, string>>
  readonly choose: (sid: string, id: string) => void
}

export const useDifferSelection = create<DifferSelection>()((set) => ({
  bySid: {},
  choose: (sid, id) => set((state) => ({ bySid: { ...state.bySid, [sid]: id } })),
}))

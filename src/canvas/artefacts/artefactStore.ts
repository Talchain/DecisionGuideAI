/**
 * Which thinking tool is open beside the model (28 Sep study §3.1: one artefact at a time, opened by the user's press
 * or by the arrival of the artefact they asked for). Holds no artefact content: each tool reads its own owner. It also
 * holds the two pieces of attention the tools share: the figure the user has picked, and the figures that became the
 * user's while they worked, which stay lit until seen.
 */
import { create } from 'zustand'

export type ArtefactId = 'assumptions' | 'premortem'

interface ArtefactState {
  readonly open: ArtefactId | null
  show: (id: ArtefactId) => void
  close: () => void
  /** The rail's press: opens a tool, or closes it when it is already open. */
  toggle: (id: ArtefactId) => void
  /** The figure picked in a tool or on the canvas, as `kind:id`. */
  readonly picked: string | null
  pick: (key: string | null) => void
  /** Figures that moved to the user's own while the tools watched, as `kind:id`, until the user has seen each. */
  readonly settled: readonly string[]
  settle: (keys: readonly string[]) => void
  seen: (key: string) => void
  /** The scenario the state above belongs to. Entering another one starts with nothing open, picked or lit. */
  readonly scenarioId: string | null
  enter: (scenarioId: string | null) => void
}

export const useArtefactStore = create<ArtefactState>((set) => ({
  open: null,
  show: (id) => set({ open: id }),
  close: () => set({ open: null }),
  toggle: (id) => set((s) => ({ open: s.open === id ? null : id })),
  picked: null,
  pick: (key) => set({ picked: key }),
  settled: [],
  settle: (keys) => set((s) => {
    const fresh = keys.filter((key) => !s.settled.includes(key))
    return fresh.length === 0 ? s : { settled: [...s.settled, ...fresh] }
  }),
  seen: (key) => set((s) => (s.settled.includes(key) ? { settled: s.settled.filter((k) => k !== key) } : s)),
  scenarioId: null,
  enter: (scenarioId) => set((s) => (s.scenarioId === scenarioId ? s : { scenarioId, open: null, picked: null, settled: [] })),
}))

/**
 * The artefact a pressed action is about, opened at once beside the model while Olumi answers in chat. Keyed by CEE's
 * `action_id` (opaque on the wire, `actionBarContract.ts`). The pre-mortem is absent on purpose: its worksheet opens
 * itself when it arrives (`ArtefactColumn`), because it does not exist until Olumi has written it.
 */
const ARTEFACT_FOR_ACTION: Readonly<Record<string, ArtefactId>> = Object.freeze({
  strengthen: 'assumptions',
  check_estimates: 'assumptions',
  bias_anchoring: 'assumptions',
})

export function showArtefactForAction(actionId: string): void {
  const id = ARTEFACT_FOR_ACTION[actionId]
  if (id !== undefined) useArtefactStore.getState().show(id)
}

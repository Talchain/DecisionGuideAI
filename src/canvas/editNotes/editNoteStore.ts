import { create } from 'zustand'
import { deriveEditNote, type EditNote, type EditNoteInput } from './deriveEditNote'

interface EditNoteState {
  note: EditNote | null
  silences: Record<string, string>
  consecutiveKeeps: number
  fatigued: boolean
  fingerprint: string
  /** `EditNote.onceKey`s already shown; cleared with the notes (a Run, a proposal approval). Session only. */
  seenByRun: Record<string, true>
  clear: () => void
  keep: () => void
  acted: () => void
  reset: () => void
}
const initial = { note: null, silences: {}, consecutiveKeeps: 0, fatigued: false, fingerprint: '', seenByRun: {} }
const keyOf = (note: EditNote) => `${note.elementId}\u0000${note.check}`
export const useEditNoteStore = create<EditNoteState>((set, get) => ({
  ...initial,
  clear: () => set({ note: null, seenByRun: {} }),
  keep: () => {
    const state = get()
    if (!state.note) return
    const consecutiveKeeps = state.consecutiveKeeps + 1
    set({ note: null, silences: { ...state.silences, [keyOf(state.note)]: state.fingerprint }, consecutiveKeeps,
      fatigued: state.fatigued || consecutiveKeeps >= 3 })
  },
  acted: () => set({ note: null, consecutiveKeeps: 0 }),
  reset: () => set(initial),
}))

/** All edit doors end here, with plain data and an explicit receipt verdict. Session only. */
export function reportManualEdit(input: EditNoteInput): void {
  const state = useEditNoteStore.getState()
  const node = input.after.nodes.find(n => n.id === input.edit.elementId)
  const fingerprint = JSON.stringify({ data: node?.data,
    edges: input.after.edges.filter(e => e.source === input.edit.elementId || e.target === input.edit.elementId) })
  const silences = { ...state.silences }
  // A real change to this element re-arms every check silenced on it.
  for (const key of Object.keys(silences)) {
    if (key.startsWith(`${input.edit.elementId}\u0000`) && silences[key] !== fingerprint) delete silences[key]
  }
  const candidate = deriveEditNote(input)
  const seenKey = candidate?.onceKey ?? null
  const note = candidate && (!seenKey || !state.seenByRun[seenKey]) && (!state.fatigued || candidate.tier === 'T1') && silences[keyOf(candidate)] !== fingerprint
    ? candidate : null
  const seenByRun = note && seenKey ? { ...state.seenByRun, [seenKey]: true as const } : state.seenByRun
  useEditNoteStore.setState({ note, silences, fingerprint, seenByRun })
}

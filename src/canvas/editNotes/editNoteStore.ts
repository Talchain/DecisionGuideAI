import { create } from 'zustand'
import { deriveEditNote, type EditNote, type EditNoteInput } from './deriveEditNote'

interface EditNoteState {
  note: EditNote | null
  silences: Record<string, string>
  consecutiveKeeps: number
  fatigued: boolean
  fingerprint: string
  clear: () => void
  keep: () => void
  acted: () => void
  reset: () => void
}
const initial = { note: null, silences: {}, consecutiveKeeps: 0, fatigued: false, fingerprint: '' }
const keyOf = (note: EditNote) => `${note.elementId}\u0000${note.check}`
export const useEditNoteStore = create<EditNoteState>((set, get) => ({
  ...initial,
  clear: () => set({ note: null }),
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
  const note = candidate && (!state.fatigued || candidate.tier === 'T1') && silences[keyOf(candidate)] !== fingerprint
    ? candidate : null
  useEditNoteStore.setState({ note, silences, fingerprint })
}

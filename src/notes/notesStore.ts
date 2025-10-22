/**
 * Notes Store - Minimal store for Decision Note blocks
 * Follows canvas store pattern with undo/redo support
 */
import { create } from 'zustand'

export interface NoteBlock {
  id: string
  type: 'plot_result'
  timestamp: string
  data: {
    template_id?: string
    seed: number
    response_hash: string
    bands: { p10: number; p50: number; p90: number }
    confidence: { level: string; score: number }
    belief_mode: string
  }
}

interface NotesState {
  blocks: NoteBlock[]
  history: {
    past: NoteBlock[][]
    future: NoteBlock[][]
  }
  addBlock: (block: NoteBlock) => void
  undo: () => void
  redo: () => void
}

function pushHistory(blocks: NoteBlock[]) {
  const { history } = useNotesStore.getState()
  
  // Push current state to past
  history.past.push([...blocks])
  
  // Clear future (user took new action after undo)
  history.future = []
  
  // Limit history to 50 entries
  if (history.past.length > 50) {
    history.past.shift()
  }
}

export const useNotesStore = create<NotesState>((set, get) => ({
  blocks: [],
  history: {
    past: [],
    future: []
  },
  
  addBlock: (block: NoteBlock) => {
    const { blocks } = get()
    
    // Push current state to history before mutation
    pushHistory(blocks)
    
    // Add new block (immutable)
    set({ blocks: [...blocks, block] })
  },
  
  undo: () => {
    const { blocks, history } = get()
    
    if (history.past.length === 0) return
    
    // Move current to future
    history.future.push([...blocks])
    
    // Restore previous state
    const previous = history.past.pop()!
    set({ blocks: previous })
  },
  
  redo: () => {
    const { blocks, history } = get()
    
    if (history.future.length === 0) return
    
    // Move current to past
    history.past.push([...blocks])
    
    // Restore next state
    const next = history.future.pop()!
    set({ blocks: next })
  }
}))

// src/lib/plotStorage.ts
// Local storage for plot workspace state

export interface PlotWorkspaceState {
  camera: {
    x: number
    y: number
    zoom: number
  }
  nodes: Array<{
    id: string
    label: string
    x?: number
    y?: number
    type?: string
  }>
  edges: Array<{
    from: string
    to: string
    label?: string
    weight?: number
  }>
  whiteboardPaths?: Array<{
    id: string
    points: Array<{ x: number; y: number }>
    color: string
    width: number
  }>
  stickyNotes?: Array<{
    id: string
    x: number
    y: number
    text: string
    color: string
  }>
  lastSaved?: number
}

const STORAGE_KEY = 'plot_workspace_state'
const AUTOSAVE_INTERVAL = 2000 // 2 seconds

export function saveWorkspaceState(state: PlotWorkspaceState): void {
  try {
    const stateWithTimestamp = {
      ...state,
      lastSaved: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp))
  } catch (error) {
    console.warn('Failed to save workspace state:', error)
  }
}

export function loadWorkspaceState(): PlotWorkspaceState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const state = JSON.parse(stored) as PlotWorkspaceState
    return state
  } catch (error) {
    console.warn('Failed to load workspace state:', error)
    return null
  }
}

export function clearWorkspaceState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear workspace state:', error)
  }
}

export function createAutosaver(
  getState: () => PlotWorkspaceState,
  interval: number = AUTOSAVE_INTERVAL
): () => void {
  const timer = setInterval(() => {
    const state = getState()
    saveWorkspaceState(state)
  }, interval)

  return () => clearInterval(timer)
}

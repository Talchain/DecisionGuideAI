// src/lib/guided.ts
// Minimal undo stack and suggestion types for Guided Mode v1

export type SimpleState = {
  seed: string
  budget: string
  model: string
  simplify: boolean
}

export type Suggestion = {
  id: string
  title: string
  rationale: string
  confidence: 'low' | 'medium' | 'high'
  apply: (s: SimpleState) => SimpleState
}

export function createUndoStack<T>() {
  const stack: T[] = []
  return {
    push(v: T) { stack.push(v) },
    pop(): T | undefined { return stack.pop() },
    get size() { return stack.length },
    clear() { stack.length = 0 },
  }
}

// Provide up to two deterministic suggestions based on the given state
export function getSuggestions(s: SimpleState): Suggestion[] {
  const list: Suggestion[] = []
  // Suggestion 0: Toggle simplify
  list.push({
    id: 'toggle-simplify',
    title: s.simplify ? 'Show all links' : 'Hide weaker links',
    rationale: s.simplify ? 'You can inspect the full graph again.' : 'Fewer weak links may make the structure clearer.',
    confidence: 'medium',
    apply: (prev) => ({ ...prev, simplify: !prev.simplify }),
  })
  // Suggestion 1: Ensure model is set
  const nextModel = s.model && s.model.length ? s.model : 'local-sim'
  list.push({
    id: 'set-model',
    title: s.model ? `Keep model: ${s.model}` : 'Use local model',
    rationale: s.model ? 'Current model is fine.' : 'Using a local model speeds up iteration.',
    confidence: 'low',
    apply: (prev) => ({ ...prev, model: nextModel }),
  })
  return list.slice(0, 2)
}

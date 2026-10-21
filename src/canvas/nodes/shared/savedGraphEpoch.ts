/**
 * A turn or canvas acknowledgement landed, so the saved living model may have moved where the analysis hash did not (a
 * rename, a risk with no chance yet: served d6d2d921, 21 Oct, the goal card kept the old name until a reload). The one
 * shared saved-graph read (`savedGraph.ts`) reads again. No imports, so the applier can bump it without an import cycle.
 */
let epoch = 0
const listeners = new Set<() => void>()

export const savedGraphEpoch = (): number => epoch

export function bumpSavedGraphEpoch(): void {
  epoch += 1
  for (const listener of listeners) listener()
}

export function subscribeSavedGraphEpoch(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

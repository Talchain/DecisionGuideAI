/** Synchronous notice before a full graph replacement; no canvas data is stored here. */
const listeners = new Set<() => void>()

export function subscribeBeforeScenarioReplacement(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function beforeScenarioReplacement(): void {
  for (const listener of [...listeners]) listener()
}

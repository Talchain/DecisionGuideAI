/**
 * Blueprint event bus — singleton extracted from CanvasMVP to allow
 * Vite React Fast Refresh (modules that export mutable singletons
 * alongside React components force full page reloads).
 */

import type { Blueprint } from '../../templates/blueprints/types'
import type { BlueprintEventBus, BlueprintInsertResult } from '../ReactFlowGraph'

interface LocalBlueprintEventBus extends BlueprintEventBus {
  listeners: ((blueprint: Blueprint) => BlueprintInsertResult)[]
  emit: (blueprint: Blueprint) => BlueprintInsertResult
}

export const blueprintEventBus: LocalBlueprintEventBus = {
  listeners: [] as ((blueprint: Blueprint) => BlueprintInsertResult)[],
  emit(blueprint: Blueprint): BlueprintInsertResult {
    const results = this.listeners.map(fn => fn(blueprint))
    return results[0] || {}
  },
  subscribe(fn: (blueprint: Blueprint) => BlueprintInsertResult) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  },
}

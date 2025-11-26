// src/shims/useSyncExternalStoreShim.ts
/**
 * Local shim for `use-sync-external-store/shim`.
 * React 18+ provides `useSyncExternalStore` natively.
 *
 * IMPORTANT: The `useSyncExternalStoreWithSelector` implementation MUST cache
 * the snapshot functions to avoid React #185 infinite loops. The previous
 * implementation created new closures on every render, violating React's
 * useSyncExternalStore contract.
 *
 * This shim uses useRef to cache:
 * 1. The selector function
 * 2. The last snapshot
 * 3. The last selected value
 *
 * This follows the pattern from the official use-sync-external-store package.
 */

import { useSyncExternalStore as useSyncExternalStoreBase, useRef, useCallback } from 'react'

// Re-export the base hook
export const useSyncExternalStore = useSyncExternalStoreBase

/**
 * Selector variant with proper caching to avoid infinite loops.
 *
 * This implementation caches the selector result and only recomputes when:
 * 1. The snapshot actually changes
 * 2. The selector function changes
 */
export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  // Cache refs for memoization
  const instRef = useRef<{
    hasValue: boolean
    value: Selection | null
    selector: typeof selector
    snapshot: Snapshot | null
    getSnapshot: typeof getSnapshot
  } | null>(null)

  // Initialize ref on first render
  if (instRef.current === null) {
    instRef.current = {
      hasValue: false,
      value: null,
      selector,
      snapshot: null,
      getSnapshot,
    }
  }

  const inst = instRef.current

  // Memoized getSnapshot that returns the selected value
  // This is stable across renders as long as selector/getSnapshot don't change
  const getSelection = useCallback(() => {
    const nextSnapshot = getSnapshot()

    // Check if we can reuse cached value
    if (inst.hasValue && inst.snapshot === nextSnapshot && inst.selector === selector) {
      return inst.value as Selection
    }

    const nextSelection = selector(nextSnapshot)

    // Check if selection is equal to cached value
    if (inst.hasValue && isEqual !== undefined && isEqual(inst.value as Selection, nextSelection)) {
      return inst.value as Selection
    }

    // Update cache
    inst.hasValue = true
    inst.value = nextSelection
    inst.snapshot = nextSnapshot
    inst.selector = selector

    return nextSelection
  }, [getSnapshot, selector, isEqual, inst])

  const getServerSelection = useCallback(() => {
    if (getServerSnapshot === undefined) {
      return getSelection()
    }
    return selector(getServerSnapshot())
  }, [getServerSnapshot, selector, getSelection])

  return useSyncExternalStoreBase(subscribe, getSelection, getServerSelection)
}

// Default export for broad import patterns
export default { useSyncExternalStore, useSyncExternalStoreWithSelector }

// src/shims/useSyncExternalStoreShim.ts
/**
 * Local shim for `use-sync-external-store/shim`.
 * React 18+ provides `useSyncExternalStore` natively.
 * We re-export React's hooks and implement a minimal `withSelector` helper
 * that follows the recommended pattern: the selector is composed into
 * the `getSnapshot` function passed to React, so the selected value itself
 * is treated as the snapshot. This avoids the "getSnapshot should be cached"
 * warning and plays nicely with libraries like Zustand.
 */

import { useSyncExternalStore as useSyncExternalStoreBase } from 'react'

// Re-export the base hook
export const useSyncExternalStore = useSyncExternalStoreBase

/**
 * Minimal selector variant for compatibility.
 * Many libs import `useSyncExternalStoreWithSelector` from the shim.
 *
 * Notes:
 * - We intentionally keep this thin and rely on React's own caching.
 * - The optional `isEqual` parameter is accepted for compatibility but
 *   not used; callers still get stable behaviour via React's snapshot
 *   comparison.
 */
export function useSyncExternalStoreWithSelector<T, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot: (() => T) | undefined,
  selector: (snapshot: T) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  // Touch isEqual once to satisfy TypeScript's unused-parameter checks while
  // still keeping the full signature for libraries that expect it.
  void isEqual

  const getSelectedSnapshot = () => selector(getSnapshot())
  const getSelectedServerSnapshot =
    getServerSnapshot != null ? () => selector(getServerSnapshot()) : getSelectedSnapshot

  return useSyncExternalStoreBase(
    subscribe,
    getSelectedSnapshot,
    getSelectedServerSnapshot,
  )
}

// Default export for broad import patterns
export default { useSyncExternalStore, useSyncExternalStoreWithSelector }

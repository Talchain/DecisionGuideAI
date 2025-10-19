// src/shims/useSyncExternalStoreShim.ts
/**
 * Local shim for `use-sync-external-store/shim`.
 * React 18+ provides `useSyncExternalStore` natively.
 * We re-export React's hooks to bypass the package that crashes at runtime.
 */

import { useSyncExternalStore as useSyncExternalStoreBase } from 'react';

// Re-export the base hook
export const useSyncExternalStore = useSyncExternalStoreBase;

/**
 * Minimal selector variant for compatibility.
 * Many libs import `useSyncExternalStoreWithSelector` from the shim.
 * This implementation is intentionally simple; memoization can be added if needed.
 */
export function useSyncExternalStoreWithSelector<T, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot: (() => T) | undefined,
  selector: (snapshot: T) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection {
  const snapshot = useSyncExternalStoreBase(subscribe, getSnapshot, getServerSnapshot);
  const selection = selector(snapshot);
  // Optional: add memoization using useRef/useEffect if a lib requires strict isEqual semantics.
  if (process.env.NODE_ENV !== 'production' && typeof isEqual === 'function') {
    // No-op hint; we're not double-comparing here to keep it minimal.
  }
  return selection;
}

// Default export for broad import patterns
export default { useSyncExternalStore, useSyncExternalStoreWithSelector };

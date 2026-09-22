/**
 * Subscribe a component to the in-flight value for one factor.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the register is
 * module-level transient state (see `conversation/pendingFactorEdit` for why it
 * is deliberately NOT in the canvas store), and a tearing read during a
 * concurrent render would let a card paint a value the register has already
 * settled.
 *
 * ⚠ The snapshot must be a PRIMITIVE. Returning an object here would be a new
 * reference every render and `useSyncExternalStore` would loop — the same
 * React #185 shape `ci:guard:zustand` exists to catch on the store selectors.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { pendingFactorEditValue, subscribePendingFactorEdits } from '../conversation/pendingFactorEdit'

export function usePendingFactorEditValue(nodeId: string | null | undefined): number | null {
  const getSnapshot = useCallback(() => pendingFactorEditValue(nodeId), [nodeId])
  return useSyncExternalStore(subscribePendingFactorEdits, getSnapshot, getSnapshot)
}

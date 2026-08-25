import { useLayoutProgressStore } from '../layoutProgressStore'

/**
 * What a layout attempt reports back. `laidOut: false` means the call RESOLVED
 * without laying anything out — a real and reachable outcome, not an error:
 * `applyLayout`'s post-await commit guard returns early when a newer request
 * superseded this one, and a caller can decline for its own reasons.
 *
 * ⚠ A plain `Promise<void>` is still accepted and still counts as success, so
 * existing call sites keep their exact behaviour. Only a caller that
 * explicitly reports `laidOut: false` changes anything.
 */
export type LayoutAttemptResult = { laidOut: boolean } | void

/**
 * ⭐⭐ THE BANNER MUST NOT CLEAR OVER A GRAPH THAT WAS NEVER LAID OUT.
 *
 * Before this, `succeed()` fired on ANY resolution. `applyLayout` can resolve
 * having committed nothing — its post-await commit guard returns early when the
 * store's nodes changed under it — so "Layout failed. Try again." could vanish
 * while the graph stayed exactly as broken as it was, and the user was left
 * with a stack and no affordance. The banner is the only signal the product
 * gives here; clearing it on a non-event is the same class of defect as the
 * "Layout failed" state itself: the interface asserting something it did not
 * verify.
 *
 * The rule is now explicit and one-way: the banner clears only on a reported
 * layout. `{ laidOut: false }` re-arms the error with its retry intact.
 */
export function handleLayoutWithRecovery(
  layoutFn: () => Promise<LayoutAttemptResult>,
  options?: { onSuccess?: () => void; showLoading?: boolean },
): void {
  const store = useLayoutProgressStore.getState()
  if (options?.showLoading) {
    store.start('Retrying layout…')
  }
  const failWithRetry = (): void => {
    useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {
      handleLayoutWithRecovery(layoutFn, { ...options, showLoading: true })
    })
  }
  layoutFn()
    .then((result) => {
      // `undefined` is the legacy void contract and means success. Only an
      // explicit `laidOut: false` is treated as "nothing happened".
      if (result && result.laidOut === false) {
        failWithRetry()
        return
      }
      useLayoutProgressStore.getState().succeed()
      options?.onSuccess?.()
    })
    .catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[layout] failure:', err)
      }
      failWithRetry()
    })
}

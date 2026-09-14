import { useLayoutProgressStore } from '../layoutProgressStore'
import { logCanvasBreadcrumb, describeError } from '../utils/canvasBreadcrumb'

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
        // ⚠ THE SECOND FAILURE PATH, AND IT HAD NO DIAGNOSTIC AT ALL — not even
        // a DEV one. It produces the SAME banner as a rejection while meaning
        // something quite different: the attempt resolved and declined to lay
        // anything out (a superseded request, or a caller opting out). Reading
        // one as the other is how an investigation looks in the wrong place.
        logCanvasBreadcrumb('layout:failed', { phase: 'declined', laidOut: false })
        failWithRetry()
        return
      }
      useLayoutProgressStore.getState().succeed()
      options?.onSuccess?.()
    })
    .catch((err: unknown) => {
      // ⭐⭐ THE LINE THAT MAKES THE NEXT OCCURRENCE DIAGNOSABLE.
      //
      // This was `if (import.meta.env.DEV) console.warn(...)`. The incident
      // happens on STAGING, which is a production build, so the rejection that
      // could name the cause was discarded every time it occurred — and
      // `layoutFailureIsSurvivable.spec.ts` records the consequence in terms:
      // "IT DOES NOT PIN WHY ELK THREW. That cause is open and may stay open."
      //
      // It is open because nobody has ever held the error. The breadcrumb ring
      // survives a production build and outlives the console, so the evidence
      // is still on the page when someone thinks to look.
      logCanvasBreadcrumb('layout:failed', { phase: 'rejected', err: describeError(err) })
      if (import.meta.env.DEV) {
        console.warn('[layout] failure:', err)
      }
      failWithRetry()
    })
}

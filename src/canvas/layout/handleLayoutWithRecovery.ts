import { useLayoutProgressStore } from '../layoutProgressStore'
import { logCanvasBreadcrumb, describeError } from '../utils/canvasBreadcrumb'
import {
  isChunkLoadErrorWithCause,
  STALE_BUILD_NOTICE_COPY,
  STALE_BUILD_ACTION_COPY,
  reloadForCurrentBuild,
} from '../../lib/staleBuildRecovery'

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

      // ⭐⭐ AND THE LINE THAT ANSWERED IT. Measured on the founder's tab,
      // 19 Sep 2026: the rejection was
      // `TypeError: Failed to fetch dynamically imported module .../elk.bundled-BgtF8tzk.js`,
      // a 404 — staging had deployed new hashed assets at 18:12:44Z while his
      // page, built at f22e15fd, was open. `utils/layout.ts:618` fetches ELK
      // lazily at first use, so the layout engine's own code was simply gone
      // from the origin.
      //
      // ⛔ "Try again" CANNOT WORK IN THAT STATE, and offering it is the real
      // harm: the chunk is permanently absent, so every retry re-requests the
      // same dead URL. He pressed Retry, then Auto-arrange, and reported
      // neither helped — the product had told him to do both. A reload is the
      // only cure, so in this one state it is the only thing offered, and the
      // message says the version changed rather than implying his model broke.
      // ⛔⛔ THIS DELEGATES TO `lib/staleBuildRecovery`, WHICH ALREADY OWNS THE
      // QUESTION — and the first version of this change did not. It shipped a
      // competing detector with its own corpus, which MISSED the MIME/SPA-
      // fallback shape (`Failed to load module script: … MIME type of
      // "text/html"`) that the existing authority has witnessed, so the same
      // retired-asset failure still fell through to the futile Retry path.
      // `stale-build-recovery-single-writer.spec.ts` exists to forbid exactly
      // that and caught it in CI, independently of review.
      //
      // ⚠ THE NOTICE IS ITS COPY, NOT A NEW SENTENCE. Mine promised "nothing in
      // your model is lost"; `reloadForCurrentBuild` verifies no such thing —
      // the crash flush can decline or fail, and the main error boundary
      // conditions its save assurance on that result. The existing line names
      // the cause and the way forward and claims nothing about saved state.
      if (isChunkLoadErrorWithCause(err)) {
        logCanvasBreadcrumb('layout:failed', { phase: 'stale-build', err: describeError(err) })
        useLayoutProgressStore
          .getState()
          .fail(STALE_BUILD_NOTICE_COPY, reloadForCurrentBuild, STALE_BUILD_ACTION_COPY)
        return
      }

      failWithRetry()
    })
}

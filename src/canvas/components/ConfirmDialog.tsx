import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { XCircle } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Replace',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }, [onCancel])

  /*
   * ⭐ PORTALLED TO `document.body`, AND THAT IS LOAD-BEARING, NOT TIDINESS.
   *
   * This overlay is `position: fixed; inset-0`, which fills the VIEWPORT only
   * while no ancestor establishes a containing block for fixed descendants.
   * `TopBar.module.css` sets `backdrop-filter: blur(8px)` on the floating pill
   * — and backdrop-filter does exactly that, invisibly: unlike `transform` it
   * leaves no trace in the layout, so nobody adding a modal thinks to look for
   * it.
   *
   * `KebabMenu` renders this dialog inside that pill, so `inset-0` resolved to
   * the pill's own box. Measured on deployed staging at 1280x800, guest, on two
   * consecutive builds — the defect is older than either of them:
   *
   *     deploy 6a93f806   "Reset canvas?"        overlay 477x43   card top  -73
   *     deploy 6a94047c   "Start a new model?"   overlay 411x43   card top -112
   *
   * A 43px-tall overlay centring a ~270px card puts the TITLE AND FIRST LINE
   * above the fold. On the most destructive control in the top bar, the half a
   * user loses is the half that says what is about to be destroyed.
   *
   * `BottomSheet` already portals for the same reason; this is that idiom, not
   * a new one. Pinned by `ConfirmDialog.portal.spec.tsx` (structure) and
   * `e2e/visual/confirmDialogWithinViewport.visual.spec.ts` (the browser
   * property) — neither is sufficient alone.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-panel rounded-lg shadow-panel p-6 max-w-md mx-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-panel">
            <XCircle className="w-5 h-5 text-danger" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className={`${typography.h4} text-text-header mb-2`}>
              {title}
            </h3>
            <p className={`${typography.body} text-text-body`}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className={`px-4 py-2 ${typography.label} text-text-body bg-panel-hover rounded-lg hover:bg-panel-border focus:outline-none focus:ring-2 focus:ring-panel-border transition-colors`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 ${typography.label} text-text-on-color bg-danger hover:bg-danger/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-danger/50 transition-colors`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

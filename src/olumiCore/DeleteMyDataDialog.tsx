/**
 * "Delete my data" on the olumi-core lane: the dialog the account menu opens (src/components/layout/UserAvatarMenu.tsx).
 *
 * It first asks core what deleting would do (`{"confirm":null}`, src/olumiCore/erase.ts) and shows core's sentences verbatim, one per
 * line, in core's order. Only with those sentences on screen is the destructive button offered; it sends `{"confirm":"delete my data"}`.
 * Cancel, Escape and a press outside close it with nothing more sent. A refusal shows core's own message.
 *
 * Keyboard: the focus starts on Cancel (never on the destructive button), Tab and Shift+Tab stay inside, and Escape cancels.
 * ⚠ Portalled to `document.body`: the menu sits in the top bar's pill, whose `backdrop-filter` would make `fixed inset-0` fill the pill
 * instead of the page (src/canvas/components/ConfirmDialog.tsx says why).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { FLOAT_CLASS } from '../olumiView/look/float'
import { useDialogFocus } from '../olumiView/look/useDialogFocus'
import { typography } from '../styles/typography'
import { CANVAS_LAYER_CLASS } from '../canvas/layers'
import { Button } from '../components/ui/Button'
import { deleteMyData, previewMyDataDeletion } from './erase'
import { TeamApiError } from './team/api'

const messageOf = (e: unknown): string => (e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was deleted.')

export function DeleteMyDataDialog({ onCancel, onDeleted, opener }: { onCancel: () => void; onDeleted: () => void; opener?: HTMLElement | null }) {
  const [words, setWords] = useState<readonly string[] | null>(null)
  const [busy, setBusy] = useState<'reading' | 'deleting' | null>('reading')
  const [error, setError] = useState<string | null>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const live = useRef(true)

  // Opening asks core for the preview only. A preview that answers after Cancel changes nothing.
  useEffect(() => {
    live.current = true
    previewMyDataDeletion().then(
      (w) => { if (live.current) { setWords(w); setBusy(null) } },
      (e) => { if (live.current) { setError(messageOf(e)); setBusy(null) } },
    )
    return () => { live.current = false }
  }, [])

  const { dialogRef, onKeyDown } = useDialogFocus<HTMLDivElement>({
    popup: true,
    initialFocus: () => cancelButton.current,
    opener: () => opener,
    onEscape: onCancel,
    canDismiss: () => busy !== 'deleting',
  })

  const confirm = useCallback(async () => {
    if (busy !== null || words === null) return
    setBusy('deleting'); setError(null)
    try {
      await deleteMyData()
    } catch (e) {
      if (live.current) { setError(messageOf(e)); setBusy(null) }
      return
    }
    onDeleted()
  }, [busy, onDeleted, words])

  return createPortal(
    <div
      className={`fixed inset-0 ${CANVAS_LAYER_CLASS.modalBackdrop} flex items-center justify-center bg-[var(--backdrop)] p-4`}
      data-testid="olumi-core-delete-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="olumi-core-delete-title"
        aria-describedby="olumi-core-delete-about"
        aria-busy={busy !== null}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="olumi-core-delete-dialog"
        className={`${FLOAT_CLASS} w-full max-w-md outline-none`}
      >
        <h2 id="olumi-core-delete-title" className={`${typography.panelHeader} text-text-header`}>Delete your data?</h2>
        <p id="olumi-core-delete-about" className="m-0 text-text-body">
          {words === null ? 'Olumi shows you what deleting would do before anything is deleted.' : 'This is what deleting your data does. It cannot be undone.'}
        </p>

        {busy === 'reading' && (
          <p role="status" className="m-0 text-text-light" data-testid="olumi-core-delete-reading">Finding what would be deleted…</p>
        )}

        {/* Core's sentences, verbatim and in core's order: one per line, nothing rebuilt from the counts. */}
        {words !== null && (
          <ul className="m-0 list-disc space-y-2 pl-5 text-text-body" data-testid="olumi-core-delete-words">
            {words.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}

        {busy === 'deleting' && (
          <p role="status" className="m-0 text-text-light" data-testid="olumi-core-delete-deleting">Deleting your data…</p>
        )}
        {error !== null && (
          <p role="alert" className="m-0 text-warning-ink" data-testid="olumi-core-delete-error">{error}</p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={cancelButton} variant="secondary" size="sm" onClick={onCancel} disabled={busy === 'deleting'} data-testid="olumi-core-delete-cancel">
            Cancel
          </Button>
          {/* Offered only with core's sentences on screen: nothing is deleted unread. */}
          {words !== null && (
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy !== null}
              data-testid="olumi-core-delete-confirm"
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 ${typography.buttonSmall} bg-danger text-text-on-color border border-transparent hover:bg-danger/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete my data
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

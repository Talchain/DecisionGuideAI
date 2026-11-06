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
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { typography } from '../styles/typography'
import { CANVAS_LAYER_CLASS } from '../canvas/layers'
import { Button } from '../components/ui/Button'
import { deleteMyData, previewMyDataDeletion } from './erase'
import { TeamApiError } from './team/api'

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
const messageOf = (e: unknown): string => (e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was deleted.')

export function DeleteMyDataDialog({ onCancel, onDeleted }: { onCancel: () => void; onDeleted: () => void }) {
  const [words, setWords] = useState<readonly string[] | null>(null)
  const [busy, setBusy] = useState<'reading' | 'deleting' | null>('reading')
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const live = useRef(true)

  // Opening asks core for the preview only. A preview that answers after Cancel changes nothing.
  useEffect(() => {
    live.current = true
    cancelButton.current?.focus()
    previewMyDataDeletion().then(
      (w) => { if (live.current) { setWords(w); setBusy(null) } },
      (e) => { if (live.current) { setError(messageOf(e)); setBusy(null) } },
    )
    return () => { live.current = false }
  }, [])

  // The focus never leaves the dialog while it is open (a press on the backdrop, then Tab, would otherwise reach the page behind).
  useEffect(() => {
    const keep = (e: FocusEvent) => {
      if (panel.current && e.target instanceof Node && !panel.current.contains(e.target)) panel.current.focus()
    }
    document.addEventListener('focusin', keep)
    return () => document.removeEventListener('focusin', keep)
  }, [])

  const cancel = useCallback(() => { if (busy !== 'deleting') onCancel() }, [busy, onCancel])

  const confirm = useCallback(async () => {
    setBusy('deleting'); setError(null)
    try {
      await deleteMyData()
    } catch (e) {
      if (live.current) { setError(messageOf(e)); setBusy(null) }
      return
    }
    onDeleted()
  }, [onDeleted])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); return }
    if (e.key !== 'Tab' || !panel.current) return
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    e.preventDefault()
    if (focusable.length === 0) { panel.current.focus(); return }
    const at = focusable.indexOf(document.activeElement as HTMLElement)
    const next = at === -1 ? (e.shiftKey ? focusable.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length
    focusable[next]!.focus()
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${CANVAS_LAYER_CLASS.modalBackdrop} flex items-center justify-center bg-black/50 p-4`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }}
      data-testid="olumi-core-delete-backdrop"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="olumi-core-delete-title"
        aria-describedby="olumi-core-delete-about"
        aria-busy={busy !== null}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="olumi-core-delete-dialog"
        className="w-full max-w-md rounded-md bg-panel shadow-panel p-6 outline-none"
      >
        <h2 id="olumi-core-delete-title" className={`${typography.h4} text-text-header`}>Delete your data?</h2>
        <p id="olumi-core-delete-about" className={`${typography.bodySmall} mt-2 text-text-body`}>
          {words === null ? 'Olumi shows you what deleting would do before anything is deleted.' : 'This is what deleting your data does. It cannot be undone.'}
        </p>

        {busy === 'reading' && (
          <p role="status" className={`${typography.bodySmall} mt-4 text-text-light`} data-testid="olumi-core-delete-reading">Finding what would be deleted…</p>
        )}

        {/* Core's sentences, verbatim and in core's order: one per line, nothing rebuilt from the counts. */}
        {words !== null && (
          <ul className={`${typography.bodySmall} mt-4 list-disc space-y-2 pl-5 text-text-body`} data-testid="olumi-core-delete-words">
            {words.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}

        {busy === 'deleting' && (
          <p role="status" className={`${typography.bodySmall} mt-4 text-text-light`} data-testid="olumi-core-delete-deleting">Deleting your data…</p>
        )}
        {error !== null && (
          <p role="alert" className={`${typography.bodySmall} mt-4 text-danger`} data-testid="olumi-core-delete-error">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button ref={cancelButton} variant="secondary" size="sm" onClick={cancel} disabled={busy === 'deleting'} data-testid="olumi-core-delete-cancel">
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

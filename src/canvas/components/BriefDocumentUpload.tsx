/**
 * "Upload a document" for the first-use brief (ROADMAP 3.8, slice 1).
 *
 * ONE file is read entirely in this browser (`brief-ingest/`); nothing is
 * uploaded. Its text, with a locator marker on every segment and a note for
 * everything not read, is APPENDED to the brief box for the user to check and
 * edit. Nothing is sent: the user still drafts through the box's own send.
 *
 * Scope: the empty-canvas composer only. Adding a document to an existing
 * model is a later slice.
 */
import { useCallback, useId, useState, type ChangeEvent } from 'react'
import { Paperclip } from 'lucide-react'
import { typo } from '../../styles/typography'
import { ACCEPT_ATTRIBUTE } from '../brief-ingest/limits'

export const BRIEF_UPLOAD_COPY = {
  label: 'Upload a document',
  reading: 'Reading your file…',
  check: 'Olumi read this from your file. Check the figures before you draft.',
  privacy: 'Your file stays on this device; only the text you send is kept.',
  remove: 'Remove what was added',
  removeMissing: 'Olumi couldn’t find the added text unchanged, so it was left as it is.',
  unexpected: "Olumi couldn't open this file. It may be damaged, or not the type its name says.",
} as const

interface BriefDocumentUploadProps {
  draft: string
  setDraft: (text: string) => void
  /** Called after text is added, e.g. to return focus to the brief box. */
  onAdded?: () => void
}

export function BriefDocumentUpload({ draft, setDraft, onAdded }: BriefDocumentUploadProps) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<{ block: string; summary: string } | null>(null)

  const handleChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Reset so choosing the same file again still fires a change.
      event.target.value = ''
      if (!file) return
      setBusy(true)
      setError(null)
      try {
        const { readBriefDocument } = await import('../brief-ingest')
        const result = await readBriefDocument(file, draft)
        setDraft(result.text)
        setAdded({ block: result.added, summary: result.summary })
        onAdded?.()
      } catch (err) {
        setError(err instanceof Error && err.name === 'BriefIngestError' ? err.message : BRIEF_UPLOAD_COPY.unexpected)
      } finally {
        setBusy(false)
      }
    },
    [draft, setDraft, onAdded],
  )

  const removeAdded = useCallback(() => {
    if (!added) return
    const at = draft.lastIndexOf(added.block)
    if (at === -1) {
      setError(BRIEF_UPLOAD_COPY.removeMissing)
      setAdded(null)
      return
    }
    setDraft(draft.slice(0, at) + draft.slice(at + added.block.length))
    setAdded(null)
    setError(null)
  }, [added, draft, setDraft])

  return (
    <div className="flex flex-col gap-1 min-w-0" data-testid="brief-document-upload">
      <div className="flex items-center gap-2 flex-wrap">
        <label
          htmlFor={inputId}
          aria-busy={busy}
          className={typo(
            'chatBody',
            'inline-flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-2.5 py-1 text-text-body cursor-pointer hover:bg-panel-hover focus-within:ring-2 focus-within:ring-info',
          )}
        >
          <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? BRIEF_UPLOAD_COPY.reading : BRIEF_UPLOAD_COPY.label}
          <input
            id={inputId}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            disabled={busy}
            onChange={handleChange}
            className="sr-only"
            data-testid="brief-document-input"
          />
        </label>
        {added ? (
          <button
            type="button"
            onClick={removeAdded}
            className={typo('chatBody', 'text-text-light underline hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded')}
            data-testid="brief-document-remove"
          >
            {BRIEF_UPLOAD_COPY.remove}
          </button>
        ) : null}
      </div>
      <div role="status" className={typo('chatBody', 'text-text-body')} data-testid="brief-document-status">
        {added ? `${added.summary} ${BRIEF_UPLOAD_COPY.check}` : ''}
      </div>
      {error ? (
        <p role="alert" className={typo('chatBody', 'text-danger m-0')} data-testid="brief-document-error">
          {error}
        </p>
      ) : null}
      <p className={typo('chatBody', 'text-text-light m-0')}>{BRIEF_UPLOAD_COPY.privacy}</p>
    </div>
  )
}

/**
 * E7 + E8 — the review item's inline editor (prototype `reviewEditorHTML`,
 * P:538; submit P:668-673): belief or proposed wording, evidence or context,
 * and an optional source.
 *
 * ⚠⚠ IT PROPOSES, NEVER APPLIES, AND ITS NOTE SAYS SO. There is no writer for a
 * finding's wording and no model-level evidence store (editability map E8 and
 * E15b), so submit hands one composed message to the caller's ask route
 * (`reviewItemEditPayload`), where the person reads it before sending. Nothing
 * here writes a store.
 *
 * ⚠ NO VALUE FIELD. A factor's number keeps its own editor, `FactorValueControl`
 * ("Change this value"), which writes canonically; a second number field here
 * would be a twin editor with a different write. A verify-list factor, which
 * has no finding wording, gets evidence and source only.
 *
 * ⚠ THE BELIEF FIELD STARTS EMPTY. The item shows the producer's finding above
 * it; copying that text in as "your belief" would put the engine's words in the
 * reader's mouth.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { typography } from '../../../../styles/typography'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import { REVIEW_TOOL_COPY as COPY, reviewItemEditPayload, type ReviewQueueItem } from '../buildReviewQueue'
import { OlumiAiIcon } from '../OlumiAiIcon'
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'

export type ReviewEditorField = 'belief' | 'evidence'

export interface ReviewItemEditorProps {
  item: ReviewQueueItem
  /** Which field takes focus on open. `belief` falls back to evidence when absent. */
  focusField: ReviewEditorField
  onAsk: (payload: AskOlumiPayload) => void
  /** `true` when focus should return to the opener (Cancel, Escape); `false` after a send. */
  onClose: (restoreFocus: boolean) => void
  testIdPrefix: string
}

const fieldClass = `${typography.panelBody} w-full min-h-[64px] rounded-sm border border-field bg-panel px-2 py-1.5 text-text-header ${ACTION_FOCUS}`
const fieldGroupClass = `${typography.panelMeta} flex flex-col gap-0.5 text-text-light`

export function ReviewItemEditor({ item, focusField, onAsk, onClose, testIdPrefix }: ReviewItemEditorProps) {
  const hasBelief = item.recommendation !== null
  const [belief, setBelief] = useState('')
  const [evidence, setEvidence] = useState('')
  const [source, setSource] = useState('')
  const beliefRef = useRef<HTMLTextAreaElement | null>(null)
  const evidenceRef = useRef<HTMLTextAreaElement | null>(null)
  const noteId = useId()
  const beliefId = useId()
  const evidenceId = useId()
  const sourceId = useId()
  const sourceMetaId = useId()

  const focusFirst = () => {
    const target = focusField === 'belief' && hasBelief ? beliefRef.current : evidenceRef.current
    target?.focus()
  }
  useEffect(() => {
    focusFirst()
    // Focus once per open (and per field request), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusField])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose(true)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = reviewItemEditPayload(item, { belief: hasBelief ? belief : '', evidence, source })
    if (!payload) {
      focusFirst()
      return
    }
    onAsk(payload)
    // Focus stays with the ask surface that just opened.
    onClose(false)
  }

  return (
    <form
      onSubmit={submit}
      aria-label={hasBelief ? COPY.editBelief : COPY.addContext}
      className="flex flex-col gap-1.5 pt-1.5"
      data-testid={`${testIdPrefix}-editor`}
    >
      {hasBelief ? (
        <div className={fieldGroupClass}>
          <label htmlFor={beliefId}>{COPY.beliefLabel}</label>
          <textarea
            id={beliefId}
            ref={beliefRef}
            value={belief}
            rows={2}
            placeholder={COPY.beliefPlaceholder}
            onChange={(e) => setBelief(e.target.value)}
            onKeyDown={onKeyDown}
            className={`${fieldClass} min-h-[48px] resize-y`}
            data-testid={`${testIdPrefix}-editor-belief`}
          />
        </div>
      ) : null}
      <div className={fieldGroupClass}>
        <label htmlFor={evidenceId}>{COPY.evidenceLabel}</label>
        <textarea
          id={evidenceId}
          ref={evidenceRef}
          value={evidence}
          rows={2}
          placeholder={COPY.evidencePlaceholder}
          aria-describedby={noteId}
          onChange={(e) => setEvidence(e.target.value)}
          onKeyDown={onKeyDown}
          className={`${fieldClass} min-h-[48px] resize-y`}
          data-testid={`${testIdPrefix}-editor-evidence`}
        />
      </div>
      <div className={fieldGroupClass}>
        <span>
          <label htmlFor={sourceId}>{COPY.sourceLabel}</label> <span id={sourceMetaId}>{COPY.sourceMeta}</span>
        </span>
        <input
          id={sourceId}
          value={source}
          placeholder={COPY.sourcePlaceholder}
          aria-describedby={sourceMetaId}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={onKeyDown}
          className={fieldClass}
          data-testid={`${testIdPrefix}-editor-source`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onClose(true)}
          className={`${action('quiet')} ${typography.panelMeta}`}
          data-testid={`${testIdPrefix}-editor-cancel`}
        >
          {COPY.editCancel}
        </button>
        <button
          type="submit"
          className={`${action('secondary')} ${typography.panelMeta} gap-1`}
          data-testid={`${testIdPrefix}-editor-send`}
        >
          <OlumiAiIcon className={icon('row')} aria-hidden={true} />
          {COPY.editSubmit}
        </button>
      </div>
      <p id={noteId} className={`${typography.panelMeta} text-text-light`} data-testid={`${testIdPrefix}-editor-note`}>
        {COPY.editNote}
      </p>
    </form>
  )
}

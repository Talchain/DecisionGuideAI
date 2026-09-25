/**
 * E1 — "Edit the full question": the inline "Your question" form (prototype
 * `brief-form`, P:559; submit P:666).
 *
 * Prefilled with THIS decision's brief, byte-verbatim. Submit hands Olumi a
 * reframing proposal through the caller's ask route (`openAskOlumi` on the
 * tab), where the person reads the message before sending it.
 *
 * ⚠⚠ IT WRITES NOTHING, AND ITS COPY SAYS SO. There is no canonical writer for
 * the brief: `brief_text` is set when the scenario is registered, and no agent
 * tool edits it. Applying a reframed question is a backend gap (editability
 * map E15b), so this form proposes; it never claims the question changed.
 *
 * ⚠ THE BRIEF IS READ BEHIND THE STORE'S IDENTITY GATE. `contextIntegrityStore`
 * can hold a brief for a decision that is not on screen (its own header records
 * the P0). The prefill is used only when the record's scenario id positively
 * matches the live one; otherwise the field starts empty.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { useCanvasStore } from '../../../../canvas/store'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { typography } from '../../../../styles/typography'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import { OlumiAiIcon } from '../OlumiAiIcon'
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'

/** Copy owned by this form. Sentence case, en-GB. */
export const BRIEF_EDIT_COPY = {
  /** The pencil's tooltip and accessible name (prototype P:535). */
  open: 'Edit the full question',
  label: 'Your question',
  placeholder: 'Write the question you want to work on',
  cancel: 'Cancel',
  submit: 'Continue with Olumi',
  note: 'This goes to Olumi as a proposal in the chat, where you check it before sending. It does not change your question by itself.',
  askLabel: 'Reframe the question',
  askContext: 'A proposed new wording for the question. Olumi discusses it with you.',
  draft: (text: string) => `I propose reframing the question as:\n${text}`,
} as const

/**
 * The brief for the decision on screen, or `null`. The same positive-match
 * rule `WhatIWasGivenSection` renders behind: `null === null` is not a match.
 */
export function useCurrentBriefText(): string | null {
  const recordedScenarioId = useContextIntegrityStore((s) => s.scenarioId)
  const briefText = useContextIntegrityStore((s) => s.briefText)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const matches = typeof recordedScenarioId === 'string' && recordedScenarioId === currentScenarioId
  return matches && typeof briefText === 'string' ? briefText : null
}

/** The ask a submitted question becomes. `null` when there is nothing to send. */
export function briefEditPayload(text: string): AskOlumiPayload | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return {
    context: BRIEF_EDIT_COPY.askContext,
    draft: BRIEF_EDIT_COPY.draft(trimmed),
    label: BRIEF_EDIT_COPY.askLabel,
    source: 'chip',
  }
}

export interface BriefEditFormProps {
  onAsk: (payload: AskOlumiPayload) => void
  onClose: () => void
  /** Changes on every open request; the field takes focus each time. */
  focusRequest?: number
  testIdPrefix: string
}

/**
 * ⛔ THE DRAFT BELONGS TO THE DECISION IT WAS OPENED ON (review 5818752558).
 * Keyed by the current scenario id, so a switch under an open form remounts it
 * with that decision's brief (or empty until it lands) — the previous decision's
 * question, typed or prefilled, can never be sent as this one's reframe. This is
 * the shipped-P0 shape `contextIntegrityStore.ts` records; keying every mount
 * here, rather than each call site, is what keeps a future mount safe too.
 */
export function BriefEditForm(props: BriefEditFormProps) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  return <BriefEditFormForScenario key={scenarioId ?? 'no-scenario'} {...props} />
}

function BriefEditFormForScenario({ onAsk, onClose, focusRequest = 0, testIdPrefix }: BriefEditFormProps) {
  const brief = useCurrentBriefText()
  const inputId = useId()
  const noteId = useId()
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [draft, setDraft] = useState(brief ?? '')
  const touched = useRef(false)

  // The brief can land after the form opens (the cold read is asynchronous).
  // Prefill it then, unless the person has already started typing.
  useEffect(() => {
    if (!touched.current && brief !== null) setDraft(brief)
  }, [brief])

  useEffect(() => {
    inputRef.current?.focus()
  }, [focusRequest])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const payload = briefEditPayload(draft)
    if (!payload) {
      inputRef.current?.focus()
      return
    }
    onAsk(payload)
    onClose()
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-1 pb-1 pt-1"
      data-testid={`${testIdPrefix}-brief-form`}
    >
      <label htmlFor={inputId} className={`${typography.panelMeta} text-text-light`}>
        {BRIEF_EDIT_COPY.label}
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        value={draft}
        rows={4}
        placeholder={BRIEF_EDIT_COPY.placeholder}
        aria-describedby={noteId}
        onChange={(e) => {
          touched.current = true
          setDraft(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        className={`${typography.panelBody} min-h-[64px] w-full resize-y rounded-sm border border-field bg-panel px-2 py-1.5 text-text-header ${ACTION_FOCUS}`}
        data-testid={`${testIdPrefix}-brief-input`}
      />
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={onClose}
          className={`${action('quiet')} ${typography.panelMeta}`}
          data-testid={`${testIdPrefix}-brief-cancel`}
        >
          {BRIEF_EDIT_COPY.cancel}
        </button>
        <button
          type="submit"
          className={`${action('secondary')} ${typography.panelMeta} gap-1`}
          data-testid={`${testIdPrefix}-brief-send`}
        >
          <OlumiAiIcon className={icon('row')} aria-hidden={true} />
          {BRIEF_EDIT_COPY.submit}
        </button>
      </div>
      <p id={noteId} className={`${typography.panelMeta} text-text-light`} data-testid={`${testIdPrefix}-brief-note`}>
        {BRIEF_EDIT_COPY.note}
      </p>
    </form>
  )
}

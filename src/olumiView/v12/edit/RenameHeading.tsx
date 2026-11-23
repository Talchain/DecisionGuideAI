import { useEffect, useRef, useState } from 'react'
import { typography } from '../../../styles/typography'
import { TeamApiError } from '../../../olumiCore/team/api'
import { useWriteSending } from '../../../olumiCore/team/writes'
import type { ViewCard } from '../../client'
import { readAfterSave } from '../../model/editing'
import { useViewStore } from '../../store'
import { editGateNow, type EditGate } from './editGate'
import { FORM_WORDS, submitEdit } from './EditForm'
import { useLaneInspector } from './inspectorStore'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

export function RenameHeading({ card, gate }: { card: ViewCard; gate: EditGate }): JSX.Element {
  const request = useLaneInspector((s) => s.current?.kind === 'details' && s.current.target.id === card.id && s.current.edit === 'name' ? s.current : null)
  const sid = useViewStore((s) => s.sid)
  const draftKey = `${sid}:rename:${card.id}`
  const sending = useWriteSending(draftKey)
  const [draft, setDraft] = useState<{ label: string; base: number; sid: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLButtonElement>(null)
  const restore = useRef(false)

  const start = (at: Extract<EditGate, { ok: true }>) => {
    const kept = useLaneInspector.getState().drafts[draftKey]
    setDraft({ label: kept?.label ?? card.heading, base: kept?.base === undefined ? at.base : Number(kept.base), sid: at.sid })
    setError(null)
  }
  useEffect(() => {
    const at = editGateNow()
    if (request !== null && at.ok) start(at)
    // Each request from a menu or shortcut focuses the field again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])
  useEffect(() => {
    if (draft !== null) { input.current?.focus(); input.current?.select() }
    else if (restore.current) { restore.current = false; heading.current?.focus() }
    // Typing should leave the caret where the person put it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null, request])

  const finish = () => {
    useLaneInspector.getState().forgetDraft(draftKey)
    restore.current = true
    setDraft(null)
    setError(null)
  }
  const save = async () => {
    if (draft === null || sending || !gate.ok || draft.label.trim() === '') return
    setError(null)
    try {
      const showing = useLaneInspector.getState().current
      await submitEdit({ kind: 'rename', record: card.id, current: card.heading, sid: draft.sid, base: draft.base }, { label: draft.label })
      const shown = await readAfterSave(draft.sid)
      if (shown === 'failed') { setError(FORM_WORDS.notShown); return }
      if (shown === 'moved') return
      if (useLaneInspector.getState().current === showing) finish()
      else useLaneInspector.getState().forgetDraft(draftKey)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : FORM_WORDS.failed)
    }
  }

  return (
    <h2 className={`${typography.viewPanelHeadline} break-words text-text-header`} data-testid="lane-inspector-title">
      {draft === null ? (gate.ok ? (
        <button ref={heading} type="button" className={`cursor-pointer rounded-sm text-left hover:underline ${FOCUS}`} onClick={() => start(gate)}>{card.heading}</button>
      ) : card.heading) : (
        <span className="block">
          <input ref={input} aria-label="Name" data-testid="lane-inspector-name" autoComplete="off" value={draft.label} readOnly={sending}
            className={`w-full rounded-sm border border-field bg-panel px-2 py-1 ${FOCUS}`}
            onChange={(e) => {
              const label = e.target.value
              setDraft({ ...draft, label })
              useLaneInspector.getState().setDraft(draftKey, { label, base: String(draft.base) })
              setError(null)
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Escape' || e.key === 'Enter') e.preventDefault()
              if (e.key === 'Escape' && !sending) finish()
              if (e.key === 'Enter') void save()
            }} />
          {error === null ? null : <span role="alert" className={`${typography.viewPanelMeta} block text-danger`}>{error}</span>}
          {gate.ok || sending ? null : <span className={`${typography.viewPanelMeta} block text-text-light`}>{gate.why}</span>}
        </span>
      )}
    </h2>
  )
}

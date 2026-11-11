/**
 * "YES, USE EXISTING TRENDS" on a no-change reference wait row. Core asks, in its own words, whether an option with no settings should
 * use the existing trends in this comparison (`run.waits_on.items[]`, `reference: { option }`, `answer: true`, `edit: null`). The question is
 * drawn by the row from the View verbatim; this is only the person's answer. Olumi never answers it for the team, and nothing here
 * says what the answer means or who gave it: core credits the confirmation in the new version it writes, and the View after the write
 * shows it. States: idle; sending (disabled); done (the View is read again and core replaces the row with the option's chance; the
 * receipt is the version notice, the same as a figure edit's); failed (core's words or a plain line, and it can be sent again, the same
 * request carrying the same op, so it is never recorded twice). A refused base re-reads the View, so the row is core's current one.
 * "Not now" writes nothing: it is closing the row.
 */
import { useState } from 'react'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

export const REFERENCE_YES = 'Yes, use existing trends'

/** `option`: the option's id (the item's `reference.option`); `place`: where it is drawn (its element ids). */
export function ReferenceYes({ option, place = 'act' }: { option: string; place?: string }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:reference:${option}`
  const sending = useWriteSending(key)
  // Core offers a typed write only on a version with no proposal held (`edit_base` null otherwise): nothing is offered then.
  const base = view?.model?.edit_base ?? null
  if (sid === null || view === null || base === null || !isForThisPage(view, me)) return null

  const yes = async () => {
    if (sending) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, option }, (op) => writes.confirmReference(sid, base, option, op!))
      noteEditSaved(saved)
      // The View after the write is core's: the row is gone and the option's chance is drawn, credited to the person who confirmed.
      if (!(await useViewStore.getState().modelChanged())) setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      // A refused base (the model moved on) or a write core did not take: say so in core's words, then read the row again so it is current.
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved. You can send it again.')
      void useViewStore.getState().refresh()
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" data-testid={`${place}-reference-${option}`}>
      <button type="button" disabled={sending} onClick={() => void yes()} data-testid={`${place}-reference-yes-${option}`}
        className={`nodrag ${typography.viewLabel} min-h-[24px] whitespace-nowrap cursor-pointer rounded bg-primary px-2 py-0.5 text-text-on-color disabled:cursor-not-allowed disabled:border-border disabled:bg-border disabled:text-text-light`}>{REFERENCE_YES}</button>
      {error === null ? null : <span role="alert" data-testid={`${place}-reference-error-${option}`} className={`${typography.viewLabel} text-danger`}>{error}</span>}
    </span>
  )
}

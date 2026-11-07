/**
 * REMOVE A LINK (R25 slice 2b, plan v3 phase 3 "removing elements"; Paul's 6 Nov test). Core's contract (API.md R25, `part` DL 7 Nov):
 * `POST …/links/remove { base, record, part, op }` → 201 `{ version, n, receipt }`. The body is the line's `links[].remove` posted verbatim:
 * the one relation record core names on it, and, where the line is one added part of a sum, that part (`part`; null removes the whole
 * record). Saved at once as the person's version with no AI call; core's own words for it (what it took off, and what that leaves without
 * effect) are the version's turn, drawn verbatim in the dock. Offered on a
 * selected or focused link that carries it, on an approved board the person owns, on the live version; one press asks once, a second
 * removes. Every refusal is core's own words (it names what depends on the link); the saved version is core's receipt.
 */
import { useState } from 'react'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

export const REMOVE_LINK_WORDS = { open: 'Remove link', ask: 'Remove this link?', remove: 'Remove', keep: 'Keep' } as const

/** `edge`: the link's React Flow edge id, so focus on these controls keeps the link named (focusedLinkOf). */
export function LinkRemove({ edge, remove }: { edge: string; remove: { readonly record: string; readonly part?: string | null } }): JSX.Element | null {
  // One line's removal: two parts of one sum are two lines with one record, so the record alone never names the control (or its write).
  const id = remove.part == null ? remove.record : `${remove.record}.${remove.part}`
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const [asking, setAsking] = useState(false)
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:remove-link:${id}`
  const sending = useWriteSending(key)
  const live = view?.model?.edit_base ?? null
  if (sid === null || view === null || at !== null || (!asking && live === null) || !isForThisPage(view, me)) return null

  const take = async () => {
    if (sending || base === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, ...remove }, (op) => writes.removeLink(sid, base, remove, op!))
      noteEditSaved(saved)
      if (!(await useViewStore.getState().modelChanged())) setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }
  const quiet = `${typography.viewLabel} min-h-[24px] cursor-pointer px-1`
  return (
    <div className={`nodrag nopan ${typography.viewLabel} max-w-[220px] space-y-1 rounded border border-border bg-panel px-2 py-1 shadow-sm`}
      style={{ pointerEvents: 'auto' }} data-link-for={edge} data-testid={`view-link-remove-${id}`}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) { setAsking(false); setError(null) } }}>
      {asking ? (
        <div className="flex flex-wrap items-center gap-1">
          <span>{REMOVE_LINK_WORDS.ask}</span>
          <button type="button" disabled={sending} data-testid={`view-link-remove-yes-${id}`} onClick={() => void take()}
            className={`${quiet} rounded bg-primary text-text-on-color disabled:opacity-50`}>{REMOVE_LINK_WORDS.remove}</button>
          <button type="button" disabled={sending} onClick={() => { setAsking(false); setError(null) }} className={`${quiet} text-text-light underline underline-offset-2`}>{REMOVE_LINK_WORDS.keep}</button>
        </div>
      ) : (
        <button type="button" data-testid={`view-link-remove-open-${id}`} onClick={() => { setBase(live); setError(null); setAsking(true) }}
          className={`${quiet} text-info underline underline-offset-2`}>{REMOVE_LINK_WORDS.open}</button>
      )}
      {error === null ? null : <p role="alert" className="text-danger" data-testid={`view-link-remove-error-${id}`}>{error}</p>}
    </div>
  )
}

/**
 * REMOVE A LINK (R25 slice 2b, plan v3 phase 3 "removing elements"; Paul's 6 Nov test). Core's contract (API.md R25, `part` DL 7 Nov):
 * `POST …/links/remove { base, record, part, op }` → 201 `{ version, n, receipt }`. The body is the line's `links[].remove` posted verbatim:
 * the one relation record core names on it, and, where the line is one added part of a sum, that part (`part`; null removes the whole
 * record). Saved at once as the person's version with no AI call; core's own words for it (what it took off, and what that leaves without
 * effect) are the version's turn, drawn verbatim in the dock. Offered on a
 * selected or focused link that carries it, on an approved board the person owns, on the live version; one press asks once, a second
 * removes. Every refusal is core's own words (it names what depends on the link); the saved version is core's receipt.
 */
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

export const REMOVE_LINK_WORDS = { open: 'Remove link', ask: 'Remove this link?', remove: 'Remove', keep: 'Keep' } as const

type Removal = { readonly record: string; readonly part?: string | null }
const removalKey = (sid: string | null, remove: Removal): string => `${sid}:remove-link:${remove.part == null ? remove.record : `${remove.record}.${remove.part}`}`
/**
 * Lines whose removal is unsettled: from the press until a refusal has handed focus to Keep, or a success has moved it on. The write runner's
 * own `sending` ends before the refusal is handled (writes.ts), so it cannot hold the ask open (Codex final delta 21205785).
 */
const useUnsettled = create<{ readonly keys: Readonly<Record<string, true>> }>(() => ({ keys: {} }))
const unsettled = (key: string, on: boolean): void => useUnsettled.setState((s) => {
  if (on) return { keys: { ...s.keys, [key]: true } }
  const { [key]: _settled, ...rest } = s.keys
  return { keys: rest }
})
/** For specs. */
export function resetRemovingLinks(): void { useUnsettled.setState({ keys: {} }) }
/**
 * Is this line's removal unsettled? While it is, the link keeps its ask on screen whatever focus or hover does (Codex deltas 4960db98 and
 * 21205785): the edge mounts it on this as well as on selection or focus, so a refusal always has its ask to land in.
 */
export function useRemovingLink(remove: Removal | null | undefined): boolean {
  const sid = useViewStore((s) => s.sid)
  const key = remove == null ? '' : removalKey(sid, remove)
  return useUnsettled((s) => s.keys[key] === true)
}

/**
 * `edge`: the link's React Flow edge id, so focus on these controls keeps the link named (focusedLinkOf). `from`: the card the link leaves,
 * where focus goes once the link is removed (its control goes with it). Focus is never dropped (PL round 1be400fd): the ask takes it on
 * Keep, Keep and Escape hand it back to Remove link, and a refusal leaves it on Keep.
 */
export function LinkRemove({ edge, from, remove }: { edge: string; from: string; remove: { readonly record: string; readonly part?: string | null } }): JSX.Element | null {
  // One line's removal: two parts of one sum are two lines with one record, so the record alone never names the control (or its write).
  const id = remove.part == null ? remove.record : `${remove.record}.${remove.part}`
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const [asking, setAsking] = useState(false)
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusTo, setFocusTo] = useState<'keep' | 'open' | null>(null)
  const keepRef = useRef<HTMLButtonElement | null>(null)
  const openRef = useRef<HTMLButtonElement | null>(null)
  const key = removalKey(sid, remove)
  const sending = useWriteSending(key)
  const live = view?.model?.edit_base ?? null
  // The control that had focus is replaced by the next one on each press, so focus is moved on purpose once it is drawn and enabled.
  useEffect(() => {
    const el = focusTo === 'keep' ? keepRef.current : focusTo === 'open' ? openRef.current : null
    if (el === null) return
    el.focus()
    if (focusTo === 'keep') unsettled(key, false) // a refusal is handled once Keep has focus
    setFocusTo(null)
  }, [focusTo, asking, sending, key])
  // Leaving the board settles it too.
  useEffect(() => () => unsettled(key, false), [key])
  if (sid === null || view === null || at !== null || (!asking && live === null) || !isForThisPage(view, me)) return null

  const take = async () => {
    if (sending || base === null) return
    setError(null)
    unsettled(key, true)
    try {
      const saved = await runWrite(key, { op: true }, { base, ...remove }, (op) => writes.removeLink(sid, base, remove, op!))
      noteEditSaved(saved)
      if (!(await useViewStore.getState().modelChanged())) {
        setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
        setFocusTo('keep')
        return
      }
      Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).find((n) => n.dataset.id === from)?.focus()
      unsettled(key, false)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
      setFocusTo('keep')
    }
  }
  const close = () => { setAsking(false); setError(null); setFocusTo('open') }
  const quiet = `${typography.viewLabel} min-h-[24px] cursor-pointer px-1`
  return (
    <div className={`nodrag nopan ${typography.viewLabel} max-w-[220px] space-y-1 rounded border border-border bg-panel px-2 py-1 shadow-sm`}
      style={{ pointerEvents: 'auto' }} data-link-for={edge} data-testid={`view-link-remove-${id}`}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && asking && !sending) close() }}>
      {asking ? (
        <div className="flex flex-wrap items-center gap-1">
          <span>{REMOVE_LINK_WORDS.ask}</span>
          {/* Never `disabled` while sending: a browser takes focus off a disabled control, and the ask then lost its link (Codex delta
              4960db98). They say so (aria-disabled) and ignore a press instead. */}
          <button type="button" aria-disabled={sending || undefined} data-testid={`view-link-remove-yes-${id}`} onClick={() => void take()}
            className={`${quiet} rounded bg-primary text-text-on-color ${sending ? 'opacity-50' : ''}`}>{REMOVE_LINK_WORDS.remove}</button>
          <button ref={keepRef} type="button" aria-disabled={sending || undefined} data-testid={`view-link-remove-keep-${id}`} onClick={() => { if (!sending) close() }} className={`${quiet} text-text-light underline underline-offset-2 ${sending ? 'opacity-50' : ''}`}>{REMOVE_LINK_WORDS.keep}</button>
        </div>
      ) : (
        <button ref={openRef} type="button" data-testid={`view-link-remove-open-${id}`} onClick={() => { setBase(live); setError(null); setAsking(true); setFocusTo('keep') }}
          className={`${quiet} text-info underline underline-offset-2`}>{REMOVE_LINK_WORDS.open}</button>
      )}
      {error === null ? null : <p role="alert" className="text-danger" data-testid={`view-link-remove-error-${id}`}>{error}</p>}
    </div>
  )
}

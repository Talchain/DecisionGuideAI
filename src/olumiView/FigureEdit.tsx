/**
 * THE PERSON'S OWN FIGURE, CHANGED ON ITS CARD (dgai-on-core G4). Offered exactly where core offers it (`card.figure.edit`, present only on
 * a figure the person may set, with no proposal held), in core's own words: its prompt labels the field. What they type goes to core as
 * typed (`POST …/edit` `typed`, API v1.9), and core reads it as its own page does; a figure it cannot read comes back as that card's
 * `figure.edit.ask`, shown here. Nothing is parsed or converted on this page. The edit is the person's: applied at once, then Olumi replies.
 */
import { useState } from 'react'
import { tryWhatIf } from './whatif'
import { useUIStore, type OutputTab } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'

/**
 * `id`: the quantity (a card's id, or a waits-on item's); `edit`: core's words for changing it; `label`: the button's words; `place`: where
 * it is drawn (its element ids), since the same figure can be offered on its card and as the next step at once; `tab`: the dock tab a try
 * opens, where its answer is drawn; `primary`: what Enter does, saving (`set`) or trying on a copy (`try`, where the control offers a try).
 */
/** On a card the control keeps its place but shows only on hover, focus or selection, so a card is not a column of links (lane C). */
export const QUIET = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
/** With a `glyph` the glyph is the cue and always shows; the words show only on hover, focus or selection (Paul: no static repeating text). */
export const QUIET_WORDS = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

export function FigureEdit({ id, edit, label = 'Change figure', place = 'view-figure', quiet = false, glyph, words = true, lead, tab = 'results', primary = 'set' }: { id: string; edit: { prompt: string; ask: string } | null; label?: string; place?: string; quiet?: boolean; glyph?: string; words?: boolean; lead?: string; tab?: OutputTab; primary?: 'set' | 'try' }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [trying, setTrying] = useState(false)
  const key = `${sid}:edit:${id}`
  const sending = useWriteSending(key)
  const base = view?.model?.edit_base ?? null
  if (!edit || sid === null || base === null || view === null || !isForThisPage(view, me)) return null

  const save = async () => {
    if (typed.trim() === '' || sending) return
    setError(null)
    try {
      await runWrite(key, { op: true }, { base, quantity: id, typed }, (op) => writes.edit(sid, base, id, typed, op!))
      // Saved: the editor closes once the new View shows it; a View that could not be read says so here, never the old figure as current.
      if (await useViewStore.getState().modelChanged()) { setOpen(false); setTyped('') }
      else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }

  /** The same figure on a copy, nothing saved (core's what-if); its answer is drawn over the chances (`tab`, opened for it: Results, or Reasoning when tried there) until the View moves on. */
  const tryIt = async () => {
    if (typed.trim() === '' || sending || trying) return
    setError(null); setTrying(true)
    try { await tryWhatIf(sid, base, id, typed); useUIStore.getState().forceActivateOutputTab(tab) } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was tried.')
    } finally { setTrying(false) }
  }

  if (!open) {
    return (
      glyph === undefined
        ? <button type="button" data-testid={`${place}-edit-${id}`} onClick={() => setOpen(true)}
          className={`nodrag ${typography.nodeLabel} cursor-pointer text-info underline underline-offset-2 ${quiet ? QUIET : ''}`}>{label}</button>
        : <span data-testid={`${place}-give-${id}`}>{lead === undefined ? null : `${lead} `}<button type="button" data-testid={`${place}-edit-${id}`} onClick={() => setOpen(true)} aria-label={label} title={edit.ask}
          className={`nodrag ${typography.nodeLabel} cursor-pointer text-info`}>
          <span aria-hidden="true" data-testid={`${place}-glyph-${id}`}>{glyph}</span>
          {words ? <>{' '}<span aria-hidden="true" data-testid={`${place}-words-${id}`} className={`underline underline-offset-2 ${quiet ? QUIET_WORDS : ''}`}>{label}</span></> : null}
        </button>{lead === undefined ? null : '.'}</span>
    )
  }
  return (
    <form className="nodrag nopan grid gap-1" data-testid={`${place}-form-${id}`}
      onSubmit={(e) => { e.preventDefault(); void (primary === 'try' ? tryIt() : save()) }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) { setOpen(false); setError(null) } }}>
      <label htmlFor={`${place}-${id}`} className={typography.nodeLabel}>{edit.prompt}</label>
      <input id={`${place}-${id}`} data-testid={`${place}-typed-${id}`} autoFocus autoComplete="off" spellCheck={false}
        value={typed} disabled={sending} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
        className={`${typography.nodeLabel} w-full rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`} />
      {error && <p role="alert" data-testid={`${place}-error-${id}`} className={`${typography.nodeLabel} text-danger`}>{error}</p>}
      <div className="flex gap-2">
        <button type={primary === 'set' ? 'submit' : 'button'} data-testid={`${place}-set-${id}`} disabled={sending || typed.trim() === ''} onClick={primary === 'set' ? undefined : () => void save()}
          className={`${typography.nodeLabel} cursor-pointer rounded px-2 py-0.5 disabled:opacity-50 ${primary === 'set' ? 'bg-primary text-text-on-color' : 'border border-border text-text-body'}`}>Set figure</button>
        <button type={primary === 'try' ? 'submit' : 'button'} data-testid={`${place}-try-${id}`} disabled={sending || trying || typed.trim() === ''} onClick={primary === 'try' ? undefined : () => void tryIt()}
          className={`${typography.nodeLabel} cursor-pointer rounded px-2 py-0.5 disabled:opacity-50 ${primary === 'try' ? 'order-first bg-primary text-text-on-color' : 'border border-info/30 text-info'}`}>Try without saving</button>
        <button type="button" disabled={sending} onClick={() => { setOpen(false); setError(null) }}
          className={`${typography.nodeLabel} cursor-pointer text-text-light underline underline-offset-2`}>Cancel</button>
      </div>
    </form>
  )
}

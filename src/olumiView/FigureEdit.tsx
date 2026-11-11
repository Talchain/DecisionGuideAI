/**
 * THE PERSON'S OWN FIGURE, CHANGED ON ITS CARD (dgai-on-core G4). Offered exactly where core offers it (`card.figure.edit`, present only on
 * a figure the person may set, with no proposal held), in core's own words: its prompt labels the field. What they type goes to core as
 * typed (`POST …/edit` `typed`, API v1.9), and core reads it as its own page does; a figure it cannot read comes back as that card's
 * `figure.edit.ask`, shown here. Nothing is parsed or converted on this page. The edit is the person's: applied at once, then Olumi replies.
 */
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { tryWhatIf } from './whatif'
import { useUIStore, type OutputTab } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

/**
 * `id`: the quantity (a card's id, or a waits-on item's); `edit`: core's words for changing it; `label`: the button's words; `place`: where
 * it is drawn (its element ids), since the same figure can be offered on its card and as the next step at once; `tab`: the dock tab a try
 * opens, where its answer is drawn; `primary`: what Enter does, saving (`set`) or trying on a copy (`try`, where the control offers a try).
 */
/** On a card the control keeps its place but shows only on hover, focus or selection, so a card is not a column of links (lane C). */
export const QUIET = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
/** With a `glyph` the glyph is the cue and always shows; the words show only on hover, focus or selection (Paul: no static repeating text). */
export const QUIET_WORDS = 'hidden group-hover:inline group-focus-within:inline'

/**
 * SET ASIDE AND EDIT (R25, Paul's 6 Nov test: "I can't find manual editing"; on his finish line, DL 7 Nov). While a proposal is held core
 * offers no edit (`edit_base` null by contract, core view.ts), so ✎ offers to set the proposal aside first: it shows what is set aside
 * (core's heading and base), sets it aside on the person's press, reads the View again, and opens this card's editor on the base that read
 * returns, never an earlier one; core refuses an edit on any other base in its own words. Two receipts: "set aside" in the editor, then
 * core's saved version. An edit that then fails leaves the set-aside said and the failure in core's words; nothing reads as saved.
 */
export const useAsideEdit = create<{ readonly id: string | null }>()(() => ({ id: null }))
/** Pre-screen row 6 (DL 10 Nov): the card editors that are open, each with the edit core offered when it opened. While a proposal is held
 *  core offers no edit (`figure.edit` null), and the card dropped its editor with the person's typing; an open one is kept until they close it. */
export const useOpenFigureEdits = create<{ readonly open: ReadonlyMap<string, { prompt: string; ask: string }> }>()(() => ({ open: new Map() }))
const keepOpen = (id: string, edit: { prompt: string; ask: string } | null) => useOpenFigureEdits.setState((s) => { const open = new Map(s.open); if (edit) open.set(id, edit); else open.delete(id); return { open } })
export const ASIDE_WORDS = {
  offer: 'Set aside the pending change and edit',
  first: 'To change this figure, Olumi\'s pending change is set aside first. Nothing in it is applied.',
  confirm: 'Set aside and edit',
  done: 'The pending change is set aside. Your figure is saved only when you set it.',
  notShown: 'Set aside, but Olumi could not show the model just now. Reload the page to edit.',
} as const

export function HeldEditOffer({ id, label = 'Change figure', place = 'view-figure' }: { id: string; label?: string; place?: string }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = view?.proposal ?? null
  if (p === null || view === null || sid === null || at !== null || p.base === null || view.model?.edit_base !== null || !isForThisPage(view, me)) return null
  const aside = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await writes.discard(p.id)
      // The editor opens on this card once the View read after the set-aside draws its edit (core's new `edit_base`).
      useAsideEdit.setState({ id })
      if (!(await useViewStore.getState().refresh())) setError(ASIDE_WORDS.notShown)
    } catch (e) {
      useAsideEdit.setState({ id: null })
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was set aside.')
    } finally { setBusy(false) }
  }
  if (!open) return (
    <button type="button" data-testid={`${place}-aside-edit-${id}`} onClick={() => setOpen(true)} aria-label={`${label}: ${ASIDE_WORDS.offer}`} title={ASIDE_WORDS.offer}
      className={`nodrag ${typography.viewLabel} inline-flex min-h-[24px] min-w-[24px] items-center cursor-pointer text-info`}><span aria-hidden="true">✎</span></button>
  )
  return (
    <div className="nodrag nopan grid gap-1" role="group" aria-label={ASIDE_WORDS.offer} data-testid={`${place}-aside-${id}`}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !busy) { setOpen(false); setError(null) } }}>
      <p className={typography.viewLabel}>{ASIDE_WORDS.first}</p>
      <p className={`${typography.viewLabel} text-text-light`}><span data-view="proposal.heading">{p.heading}</span> · <span data-view="proposal.on">{p.on}</span></p>
      {error && <p role="alert" data-testid={`${place}-aside-error-${id}`} className={`${typography.viewLabel} text-danger`}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" autoFocus disabled={busy} onClick={() => void aside()} data-testid={`${place}-aside-confirm-${id}`}
          className={`${typography.viewLabel} min-h-[24px] cursor-pointer rounded bg-primary px-2 py-0.5 text-text-on-color disabled:bg-border disabled:border-border disabled:text-text-light disabled:cursor-not-allowed`}>{ASIDE_WORDS.confirm}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null) }}
          className={`${typography.viewLabel} min-h-[24px] cursor-pointer text-text-light underline underline-offset-2`}>Cancel</button>
      </div>
    </div>
  )
}

/** Said in an open editor once the model has a newer version than the one it opened on, and the press that moves the edit onto it. */
export const MOVED_ON = 'The model has changed since you opened this.', USE_LATEST = 'Use the latest version'

export function FigureEdit({ id, edit, label = 'Change figure', place = 'view-figure', quiet = false, glyph, words = true, lead, tab = 'results', primary = 'set' }: { id: string; edit: { prompt: string; ask: string } | null; label?: string; place?: string; quiet?: boolean; glyph?: string; words?: boolean; lead?: string; tab?: OutputTab; primary?: 'set' | 'try' }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  // Opened by a set-aside on this card (R25): open at once, with the set-aside said until the editor closes.
  const [asideFor] = useState(() => place === 'view-figure' && useAsideEdit.getState().id === id)
  const [open, setOpen] = useState(asideFor)
  useEffect(() => { if (asideFor) useAsideEdit.setState({ id: null }) }, [asideFor])
  // The base the editor opened on (PL 7 Nov): a background re-read while the person types never moves their draft onto a newer version;
  // core refuses an edit on any base but the latest in its own words ("this figure was edited on a different version").
  const live = view?.model?.edit_base ?? null
  const [opened, setOpened] = useState<number | null>(() => (asideFor ? live : null))
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [trying, setTrying] = useState(false)
  const key = `${sid}:edit:${id}`
  const sending = useWriteSending(key)
  // Row 6: an open card editor is on record while it is open, so its card keeps it when core stops offering the edit.
  useEffect(() => { if (place !== 'view-figure') return; keepOpen(id, open ? edit : null); return () => { if (!open) keepOpen(id, null) } }, [place, id, open, edit])
  if (!edit || sid === null || view === null || !isForThisPage(view, me)) return null
  // No version to edit (a proposal is held): nothing is offered, but an editor already open stays, with its typing (row 6).
  if (live === null && !open) return null
  const heldNote = live === null ? view.model_words?.withdrawnHeld ?? null : null
  const base = (open && opened !== null ? opened : live) ?? 0
  const openNow = () => { setOpened(live); setOpen(true) }

  const save = async () => {
    if (typed.trim() === '' || sending || live === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, quantity: id, typed }, (op) => writes.edit(sid, base, id, typed, op!))
      // Core's 201 IS saved (R25, DL ruling: no AI call on its path): its version is said at once, as an approval's is.
      noteEditSaved(saved)
      // Saved: the editor closes once the new View shows it; a View that could not be read says so here, never the old figure as current.
      if (await useViewStore.getState().modelChanged()) { setOpen(false); setTyped('') }
      else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }

  /** The same figure on a copy, nothing saved (core's what-if); its answer is drawn over the chances (`tab`, opened for it: Results, or Reasoning when tried there) until the View moves on. */
  const tryIt = async () => {
    if (typed.trim() === '' || sending || trying || live === null) return
    setError(null); setTrying(true)
    // TM-27: once tried, the editor closes so the card shows the try in place ("Trying …", the way back) and the board can bring the
    // options' chances into view; what was typed is kept for a second look.
    try { await tryWhatIf(sid, base, id, typed); setOpen(false); useUIStore.getState().forceActivateOutputTab(tab) } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was tried.')
    } finally { setTrying(false) }
  }

  if (!open) {
    return (
      glyph === undefined
        ? <button type="button" data-testid={`${place}-edit-${id}`} onClick={openNow}
          className={`nodrag ${typography.viewLabel} inline-flex min-h-[24px] items-center cursor-pointer text-info underline underline-offset-2 ${quiet ? QUIET : ''}`}>{label}</button>
        : <span data-testid={`${place}-give-${id}`}>{lead === undefined ? null : `${lead} `}<button type="button" data-testid={`${place}-edit-${id}`} onClick={openNow} aria-label={label} title={edit.ask}
          className={`nodrag ${typography.viewLabel} inline-flex min-h-[24px] min-w-[24px] items-center cursor-pointer text-text-body hover:text-text-header`}>
          <span aria-hidden="true" data-testid={`${place}-glyph-${id}`}>{glyph}</span>
          {words ? <>{' '}<span aria-hidden="true" data-testid={`${place}-words-${id}`} className={`underline underline-offset-2 ${quiet ? QUIET_WORDS : ''}`}>{label}</span></> : null}
        {/* S1 (Paul's "do now", 11 Nov): core's lead ends on the control ("Give your figure with ✎"); no stop of the UI's after it. */}
        </button></span>
    )
  }
  return (
    // D2 (strategy canvas audit, 10 Nov; the design owner's call): on a card the editor opens as a panel under the card, out of the card's
    // flow, so opening it never changes the card's height and never re-lays out the board; elsewhere it stays in place.
    <form className={`nodrag nopan grid gap-1 ${place === 'view-figure' ? 'absolute left-0 top-full z-30 mt-1 w-[280px] rounded-xl border border-panel-border bg-panel p-3 shadow-2' : ''}`} data-figure-edit-panel={place === 'view-figure' ? id : undefined} data-testid={`${place}-form-${id}`}
      onSubmit={(e) => { e.preventDefault(); void (primary === 'try' ? tryIt() : save()) }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) { setOpen(false); setError(null) } }}>
      {asideFor ? <p className={`${typography.viewLabel} text-text-light`} data-testid={`${place}-aside-done-${id}`}>{ASIDE_WORDS.done}</p> : null}
      <label htmlFor={`${place}-${id}`} className={typography.viewLabel}>{edit.prompt}</label>
      <input id={`${place}-${id}`} data-testid={`${place}-typed-${id}`} autoFocus autoComplete="off" spellCheck={false}
        value={typed} disabled={sending} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
        className={`${typography.viewLabel} w-full rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`} />
      {error && <p role="alert" data-testid={`${place}-error-${id}`} className={`${typography.viewLabel} text-danger`}>{error}</p>}
      {/* Pre-screen row 7 (DL 10 Nov): the model moved on while this editor was open, so core refuses its base every time and only Cancel
          and reopen got out. One press moves this edit onto the latest version and keeps what was typed; it is the person's press, never
          done for them (PL 7 Nov: a re-read never moves their draft by itself). */}
      {heldNote === null ? null : <p role="status" className={`${typography.viewLabel} text-text-body`} data-testid={`${place}-held-${id}`} data-view="model_words.withdrawnHeld">{heldNote}</p>}
      {live !== null && opened !== null && opened !== live ? (
        <p className={`${typography.viewLabel} text-text-body`} data-testid={`${place}-moved-${id}`}>{MOVED_ON}{' '}
          <button type="button" disabled={sending} data-testid={`${place}-rebase-${id}`} className="nodrag inline-flex min-h-[24px] items-center underline underline-offset-2 hover:text-text-header"
            onClick={() => { setOpened(live); setError(null) }}>{USE_LATEST}</button></p>
      ) : null}
      {/* Try is the person's act, in ink, never Olumi's blue (blue audit, 10 Nov). */}
      {/* D2: each button on one line (they wrapped to three in a card); the row wraps between buttons, never inside one. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type={primary === 'set' ? 'submit' : 'button'} data-testid={`${place}-set-${id}`} disabled={sending || typed.trim() === '' || live === null} onClick={primary === 'set' ? undefined : () => void save()}
          className={`${typography.viewLabel} min-h-[24px] whitespace-nowrap cursor-pointer rounded px-2 py-0.5 disabled:bg-border disabled:border-border disabled:text-text-light disabled:cursor-not-allowed ${primary === 'set' ? 'bg-primary text-text-on-color' : 'border border-border text-text-body'}`}>Set figure</button>
        <button type={primary === 'try' ? 'submit' : 'button'} data-testid={`${place}-try-${id}`} disabled={sending || trying || typed.trim() === '' || live === null} onClick={primary === 'try' ? undefined : () => void tryIt()}
          className={`${typography.viewLabel} min-h-[24px] whitespace-nowrap cursor-pointer rounded px-2 py-0.5 disabled:bg-border disabled:border-border disabled:text-text-light disabled:cursor-not-allowed ${primary === 'try' ? 'order-first bg-primary text-text-on-color' : 'border border-panel-border text-text-body hover:text-text-header'}`}>Try without saving</button>
        <button type="button" disabled={sending} onClick={() => { setOpen(false); setError(null) }}
          className={`${typography.viewLabel} min-h-[24px] whitespace-nowrap cursor-pointer text-text-light underline underline-offset-2`}>Cancel</button>
      </div>
    </form>
  )
}

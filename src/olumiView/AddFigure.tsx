/**
 * ADD A FIGURE (R25 slice 2, plan v3 phase 3 "adding elements"; Paul's 6 Nov test: "the ability to manually edit seems to have
 * disappeared"). Core's contract (API.md, R25 7 Nov): `POST …/figures { base, label, typed, unit?, op }` → 201 `{ version, n, receipt,
 * record }`, a figure card in the person's own words, saved at once as their version with no AI call and drawn on the board as theirs.
 * Offered on an approved board the person owns, on the live version (as Rename is). The left toolbar's add menu opens the form;
 * the new card is put in front once drawn. Every refusal is core's own words; the saved version is core's receipt; the
 * UI reads, rounds and formats nothing (core reads the figure as typed, and its unit).
 */
import { useEffect, useRef, useState } from 'react'
import { autoUpdate, flip, FloatingFocusManager, offset, shift, useClick, useDismiss, useFloating, useInteractions, useMergeRefs, useRole } from '@floating-ui/react'
import { OkIcon } from './look/icons'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { MENU_ROW, MENU_SHELL } from './look/menu'
import { HoverButton } from './look/Hover'
import { TOOLBAR_RAIL_ICON } from './look/toolbar'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { useCanvasStore } from '../canvas/store'
import { writes } from './client'
import { useLaneInspector } from './v12/edit/inspectorStore'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

export const ADD_FIGURE_WORDS = {
  open: 'Add a figure', name: 'Name', figure: 'Figure', unit: 'Unit (optional)', add: 'Add', cancel: 'Cancel',
  figureHint: 'One number, or a range like 150 to 400',
  /** Why the + cannot add yet, said on it (hover and its accessible name). */
  heldProposal: 'Accept or set aside Olumi’s proposed changes first', heldNoModel: 'There is no model to add to yet',
  heldOther: 'Olumi cannot take an addition to this model right now',
} as const

/** The new card in front once the canvas has drawn it (the board is laid out after the View is read), or never if it does not come. */
let waiting: (() => void) | null = null
export function focusWhenDrawn(record: string, waitMs = 5000): void {
  waiting?.() // one wait at a time: a newer card supersedes the last
  waiting = null
  const drawn = () => useCanvasStore.getState().nodes.some((n) => n.id === record)
  if (drawn()) { focusNodeById(record); return }
  const done = () => { unsubscribe(); clearTimeout(timer); if (waiting === done) waiting = null }
  const unsubscribe = useCanvasStore.subscribe(() => { if (drawn()) { done(); focusNodeById(record) } })
  const timer = setTimeout(done, waitMs)
  waiting = done
}

export function AddFigure(): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  // The "+" menu is floating-ui's own; the form it opens is one of the five surfaces the one surface store holds (surfaces step 2): opening it closes
  // whatever else was open, anything else opening closes it. Its typed words stay here, whatever closes it.
  const [menu, setMenu] = useState(false)
  const open = useLaneInspector((s) => s.current !== null && s.current.kind === 'add')
  const key = `${sid}:add-figure`
  const [label, setLabel] = useState('')
  const [typed, setTyped] = useState('')
  const [unit, setUnit] = useState('')
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const figureBox = useRef<HTMLInputElement>(null)
  // Form and menu dismissal return focus to the toolbar add control: the form closed by its Cancel, a save or Escape, whichever way the store closed it,
  // and the menu closed by Escape or a press outside. (Another surface opening has taken the focus itself: only focus left on nothing comes back.)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open && (document.activeElement === null || document.activeElement === document.body)) opener.current?.focus()
    wasOpen.current = open
  }, [open])
  // The card going away (or the page leaving) takes an open add form with it: nothing is left holding the one slot.
  useEffect(() => () => { useLaneInspector.getState().close('add') }, [])
  const { refs, floatingStyles, context } = useFloating({
    open: menu, onOpenChange: (next) => { setMenu(next); if (!next) opener.current?.focus() },
    placement: 'right-start', strategy: 'fixed', whileElementsMounted: autoUpdate,
    middleware: [offset(12), flip(), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context), useDismiss(context, { outsidePressEvent: 'click' }), useRole(context, { role: 'menu' }),
  ])
  const reference = useMergeRefs([opener, refs.setReference])
  const sending = useWriteSending(key)
  const live = view?.model?.edit_base ?? null
  if (sid === null || view === null || at !== null || !isForThisPage(view, me)) return null
  // Paul's left menu keeps its + (15 Nov, 2.png): while core gives no edit base it stays in its place, disabled, and says why (no dead control).
  const why = live !== null ? null : view.model == null ? ADD_FIGURE_WORDS.heldNoModel : view.proposal != null ? ADD_FIGURE_WORDS.heldProposal : ADD_FIGURE_WORDS.heldOther

  const close = () => { useLaneInspector.getState().close('add'); setError(null) }
  const add = async () => {
    const name = label.trim(), figure = typed.trim(), u = unit.trim()
    if (name === '' || figure === '' || sending || base === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, label: name, typed: figure, unit: u }, (op) => writes.addFigure(sid, base, name, figure, u === '' ? null : u, op!))
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) {
        setLabel(''); setTyped(''); setUnit(''); close()
        focusWhenDrawn(saved.record) // the new card, theirs, in front once drawn
      } else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
      setTimeout(() => figureBox.current?.focus(), 0) // back to the words, once they are editable again
    }
  }
  const field = `${typography.viewPanelBody} w-full min-h-[44px] rounded-sm border border-field bg-panel px-2 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`
  return (
    <div className="relative flex flex-col nodrag nopan">
      {why !== null ? (
        <HoverButton ref={opener} type="button" disabled words={why} className={TOOLBAR_RAIL_ICON}
          aria-label={`Add to model: ${why}`} data-testid="canvas-add-to-model-held">
          <OkIcon id="add" size={14} decorative inherit />
        </HoverButton>
      ) : (
        <HoverButton ref={reference} type="button" words="Add to model" className={TOOLBAR_RAIL_ICON}
          aria-label="Add to model" data-testid="canvas-add-to-model" {...getReferenceProps()}>
          <OkIcon id="add" size={14} decorative inherit />
        </HoverButton>
      )}
      {menu && live !== null ? <FloatingFocusManager context={context} modal={false} returnFocus={false}>
        <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}
          className={MENU_SHELL} aria-label="Add to model">
          <button type="button" role="menuitem" className={`${MENU_ROW} cursor-pointer text-text-body hover:bg-panel-hover focus-visible:outline focus-visible:outline-2`}
            onClick={() => { setBase(live); setError(null); setMenu(false); useLaneInspector.getState().show({ kind: 'add', busyKey: key }) }}>{ADD_FIGURE_WORDS.open}</button>
        </div>
      </FloatingFocusManager> : null}
      {open ? (
        <form className={`absolute left-full top-0 ml-3 nodrag nopan w-[260px] space-y-2 rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`} data-testid="view-add-figure-form"
          onSubmit={(e) => { e.preventDefault(); void add() }}>
          <label className="block space-y-1"><span className={typography.viewPanelMeta}>{ADD_FIGURE_WORDS.name}</span>
            <input autoFocus autoComplete="off" value={label} disabled={sending} data-testid="view-add-figure-name"
              onChange={(e) => { setLabel(e.target.value); if (error) setError(null) }} className={field} /></label>
          <label className="block space-y-1"><span className={typography.viewPanelMeta}>{ADD_FIGURE_WORDS.figure}</span>
            <input ref={figureBox} autoComplete="off" value={typed} disabled={sending} placeholder={ADD_FIGURE_WORDS.figureHint} data-testid="view-add-figure-typed"
              onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={field} /></label>
          <label className="block space-y-1"><span className={typography.viewPanelMeta}>{ADD_FIGURE_WORDS.unit}</span>
            <input autoComplete="off" value={unit} disabled={sending} data-testid="view-add-figure-unit"
              onChange={(e) => { setUnit(e.target.value); if (error) setError(null) }} className={field} /></label>
          {error === null ? null : <p role="alert" className="text-danger" data-testid="view-add-figure-error">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={sending || label.trim() === '' || typed.trim() === ''} data-testid="view-add-figure-add"
              className={`${typography.viewPanelBody} min-h-[44px] cursor-pointer rounded-sm ${controls.actColours} px-3 disabled:bg-panel-border disabled:border-panel-border disabled:text-text-light disabled:cursor-not-allowed`}>{ADD_FIGURE_WORDS.add}</button>
            <button type="button" disabled={sending} onClick={close} className={`${typography.viewPanelBody} min-h-[44px] cursor-pointer px-2 text-text-light underline underline-offset-2`}>{ADD_FIGURE_WORDS.cancel}</button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

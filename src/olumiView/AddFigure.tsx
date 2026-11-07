/**
 * ADD A FIGURE (R25 slice 2, plan v3 phase 3 "adding elements"; Paul's 6 Nov test: "the ability to manually edit seems to have
 * disappeared"). Core's contract (API.md, R25 7 Nov): `POST …/figures { base, label, typed, unit?, op }` → 201 `{ version, n, receipt,
 * record }`, a figure card in the person's own words, saved at once as their version with no AI call and drawn on the board as theirs.
 * Offered on an approved board the person owns, on the live version (as Rename is). The board's own control, beside the canvas's zoom
 * controls; the new card is put in front once it is drawn. Every refusal is core's own words; the saved version is core's receipt; the
 * UI reads, rounds and formats nothing (core reads the figure as typed, and its unit).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { typography } from '../styles/typography'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { useCanvasStore } from '../canvas/store'
import { writes } from './client'
import { useViewStore } from './store'
import { noteEditSaved } from './notice'

export const ADD_FIGURE_WORDS = {
  open: 'Add a figure', name: 'Name', figure: 'Figure', unit: 'Unit (optional)', add: 'Add', cancel: 'Cancel',
  figureHint: 'One number, or a range like 150 to 400',
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

/** Where the control sits: just above the canvas's zoom controls (the board's other tools), measured, so the two never overlap. */
const GAP = 8
function useAboveViewportControls(): number | null {
  const [bottom, setBottom] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const bar = document.querySelector('nav[aria-label="Viewport controls"]')
      const r = bar?.getBoundingClientRect()
      setBottom(r && r.height > 0 ? window.innerHeight - r.top + GAP : null) // pixels only; no model value is touched here
    }
    measure()
    window.addEventListener('resize', measure)
    const nav = document.querySelector('nav[aria-label="Viewport controls"]')
    const ro = nav && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (nav && ro) ro.observe(nav)
    return () => { window.removeEventListener('resize', measure); ro?.disconnect() }
  }, [])
  return bottom
}

export function AddFigure(): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const bottom = useAboveViewportControls()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [typed, setTyped] = useState('')
  const [unit, setUnit] = useState('')
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const figureBox = useRef<HTMLInputElement>(null)
  // Closing hands focus back to "Add a figure" once it is drawn again (PL 7 Nov: it is not mounted while the form is open).
  const [returning, setReturning] = useState(false)
  useEffect(() => { if (!open && returning) { opener.current?.focus(); setReturning(false) } }, [open, returning])
  const key = `${sid}:add-figure`
  const sending = useWriteSending(key)
  const live = view?.model?.edit_base ?? null
  if (sid === null || view === null || at !== null || (!open && live === null) || !isForThisPage(view, me)) return null

  const close = () => { setOpen(false); setError(null); setReturning(true) }
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
  const field = `${typography.viewPanelBody} w-full min-h-[44px] rounded border border-border bg-panel px-2 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`
  return (
    // Fixed, as the zoom controls it sits above are, so the window-measured place is the place it is drawn (checker, slice 2a).
    <div className="fixed left-3 z-[5]" style={{ bottom: bottom ?? 196 }} data-testid="view-add-figure">
      {open ? (
        <form className={`nodrag nopan w-[260px] space-y-2 rounded-lg border border-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`} data-testid="view-add-figure-form"
          onSubmit={(e) => { e.preventDefault(); void add() }} onKeyDown={(e) => { if (e.key === 'Escape' && !sending) close() }}>
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
              className={`${typography.viewPanelBody} min-h-[44px] cursor-pointer rounded bg-primary px-3 text-text-on-color disabled:opacity-50`}>{ADD_FIGURE_WORDS.add}</button>
            <button type="button" disabled={sending} onClick={close} className={`${typography.viewPanelBody} min-h-[44px] cursor-pointer px-2 text-text-light underline underline-offset-2`}>{ADD_FIGURE_WORDS.cancel}</button>
          </div>
        </form>
      ) : (
        <button ref={opener} type="button" data-testid="view-add-figure-open" className={`${VIEW_CHIP_CLASS} inline-flex items-center gap-1.5 bg-panel shadow-2`}
          onClick={() => { setBase(live); setError(null); setOpen(true) }}>
          <Plus aria-hidden="true" className="h-4 w-4" />{ADD_FIGURE_WORDS.open}
        </button>
      )}
    </div>
  )
}

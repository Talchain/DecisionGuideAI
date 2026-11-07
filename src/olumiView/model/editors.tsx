/**
 * THE MODEL TAB'S EDITORS, PANEL-NATIVE (Paul 7 Nov: "so much easier and slicker … to manually edit the model through this interface").
 *
 * Each one is the canvas editor's write, unchanged: the same route, body, write key and base rule (`FigureEdit.tsx`, `Rename.tsx`), so a
 * write is one write wherever it is pressed and core's answer is the only verdict. What changes is the place and the craft:
 * - the crafted tab's honest edit (legacy `ModelRowView` three-beat): the old value stays on screen while the person types; "Saving…" while
 *   core has it; the editor closes only once the View read after the save shows core's new figure, and says core's version on the row; a
 *   refusal is core's own words with the typing kept and the field focused again;
 * - focus is never dropped: the field stays focusable while core has the write (read-only, not disabled; LinkRemove's rule), and closing
 *   hands focus back to what opened the editor;
 * - an editor closes only itself, and a refusal that lands after its editor left the screen (a group closed, a filter typed) is said on its
 *   row instead (review a4d73faf);
 * - 14px entry and 44px targets (DS v5 §2.1; the lane's main-target floor), `border-field` (the control border that renders); one filled
 *   control while an editor is open: its own Save.
 *
 * Every label is core's (`figure.edit.prompt`) or UI chrome (`MODEL_EDIT_WORDS`). Nothing typed is read, converted or rounded here.
 */
import { useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../../v5/blocks/chipClass'
import { useUIStore } from '../../stores/uiStore'
import { TeamApiError } from '../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../olumiCore/team/writes'
import { writes } from '../client'
import { useViewStore } from '../store'
import { noteEditSaved, noticeWords } from '../notice'
import { tryWhatIf } from '../whatif'
import { editKey, MODEL_EDIT_WORDS as W, useModelEdit } from './editing'
import { useModelTab, type Editing } from './state'

/** The tab's control recipes, from the lane's own (chipClass, AddFigure): one name per role, so no control is styled twice. */
export const RECIPE = {
  primary: VIEW_CHIP_PRIMARY_CLASS,
  secondary: VIEW_CHIP_CLASS.replace('min-h-[28px]', 'min-h-[44px]'),
  action: VIEW_CHIP_CLASS,
  quiet: `${typography.viewPanelBody} inline-flex min-h-[44px] cursor-pointer items-center px-2 text-text-light underline underline-offset-2 hover:text-text-body disabled:opacity-40 ${ACTION_FOCUS}`,
  input: `${typography.viewPanelBody} w-full min-h-[44px] rounded-md border border-field bg-panel px-3 text-text-body placeholder:text-text-light read-only:opacity-70 ${ACTION_FOCUS}`,
  label: `${typography.viewPanelMeta} block text-text-light`,
  error: `${typography.viewPanelMeta} m-0 text-danger`,
  status: `${typography.viewPanelMeta} m-0 text-text-light`,
} as const

/** What core's answer to a save becomes on the row: its version once the View shows it ("Version n saved.", the notice's own words). */
export function sayReceipt(row: string, saved: unknown): void {
  const { sid } = useViewStore.getState()
  const n = (saved as { n?: unknown } | null)?.n
  if (sid !== null && typeof n === 'number' && Number.isInteger(n)) useModelTab.getState().say({ row, words: noticeWords({ kind: 'saved', n, by: null, sid }), tone: 'saved' })
}

/** Focus back on what opened an editor (the row's figure, else its name), once the row has drawn it again. */
export function focusRow(row: string, on: 'value' | 'name'): void {
  setTimeout(() => {
    const el = (on === 'value' ? document.querySelector<HTMLElement>(`[data-model-value-edit="${row}"]`) : null)
      ?? document.querySelector<HTMLElement>(`[data-model-select="${row}"]`)
    el?.focus()
  }, 0)
}

/**
 * One save, for every editor here: the write (`send`), core's receipt, the View read after it, and what the person is told. While core
 * has it, no other editor can open over it; the editor closes only itself; a refusal goes under the field, or on the row if the field is gone.
 */
function useSave(mine: Editing, focusOn: 'value' | 'name') {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const run = async (send: () => Promise<unknown>) => {
    const tab = useModelTab.getState()
    setError(null); tab.setBusy(mine)
    try {
      const saved = await send()
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) {
        useModelTab.getState().setBusy(null)
        useModelTab.getState().closeIf(mine)
        sayReceipt(mine.row, saved)
        focusRow(mine.row, focusOn)
      } else fail(W.savedNotShown)
    } catch (e) {
      fail(e instanceof TeamApiError ? e.message : W.failed)
    } finally {
      if (useModelTab.getState().busy === mine) useModelTab.getState().setBusy(null)
    }
  }
  const fail = (words: string) => {
    useModelTab.getState().setBusy(null)
    if (mounted.current) { setError(words); setTimeout(() => field.current?.focus(), 0) }
    else useModelTab.getState().say({ row: mine.row, words, tone: 'failed' })
  }
  const cancel = () => { useModelTab.getState().closeIf(mine); focusRow(mine.row, focusOn) }
  return { error, setError, field, run, cancel }
}

/**
 * Change one figure (`POST …/edit`, typed as the person wrote it). `quantity` is the figure's own card id: the row's own, or for an aim
 * the target figure, for a link the figure that sizes it. The base is the one the editor opened on, never a later one (FigureEdit rule).
 */
export function FigureEditor({ row, quantity, edit }: { row: string; quantity: string; edit: { prompt: string; ask: string } }): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const [base] = useState(live)
  const [mine] = useState<Editing>(() => ({ row, what: 'figure', quantity }))
  const [typed, setTyped] = useState('')
  const [trying, setTrying] = useState(false)
  const key = editKey.figure(sid, quantity)
  const sending = useWriteSending(key)
  const { error, setError, field, run, cancel } = useSave(mine, 'value')
  if (sid === null || base === null) return null
  const id = `model-edit-${row}`
  // Core has stopped offering the edit since it opened (a change of Olumi's is now held): the typing stays, nothing is sent.
  const offered = live !== null
  const blank = typed.trim() === ''

  const save = () => {
    if (blank || sending || !offered) return
    void run(() => runWrite(key, { op: true }, { base, quantity, typed }, (op) => writes.edit(sid, base, quantity, typed, op!)))
  }
  /** The same figure on a copy, nothing saved (core's what-if), drawn over the chances on the Analysis tab, as the canvas card's is. */
  const tryIt = async () => {
    if (blank || sending || trying || !offered) return
    setError(null); setTrying(true)
    try { await tryWhatIf(sid, base, quantity, typed); useUIStore.getState().forceActivateOutputTab('results') } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.triedFailed)
    } finally { setTrying(false) }
  }

  return (
    <form className="mt-2 space-y-2" data-model-editor={row} data-model-editor-for={quantity} aria-busy={sending || undefined}
      onSubmit={(e) => { e.preventDefault(); save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) cancel() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label} data-view-edit-prompt={quantity}>{edit.prompt}</label>
      <input ref={field} id={id} autoFocus autoComplete="off" spellCheck={false} value={typed} readOnly={sending} data-model-editor-input={row}
        onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={`${RECIPE.input} tabular-nums`} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-editor-error={row}>{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={blank || !offered} aria-disabled={sending || undefined} className={`${RECIPE.primary} ${sending ? 'opacity-60' : ''}`} data-model-editor-save={row}>{W.setFigure}</button>
        <button type="button" disabled={blank || trying || !offered} aria-disabled={sending || undefined} onClick={() => void tryIt()} className={RECIPE.secondary} data-model-editor-try={row}>{W.tryIt}</button>
        <button type="button" aria-disabled={sending || undefined} onClick={() => { if (!sending) cancel() }} className={RECIPE.quiet} data-model-editor-cancel={row}>{W.cancel}</button>
      </div>
      {sending ? <p role="status" className={RECIPE.status} data-model-editor-sending={row}>{W.saving}</p> : null}
    </form>
  )
}

/** Rename one card (`POST …/rename`): saved at once as the person's version; only its name changes (Rename.tsx contract). */
export function RenameEditor({ row, heading }: { row: string; heading: string }): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const [base] = useState(live)
  const [mine] = useState<Editing>(() => ({ row, what: 'rename' }))
  const [typed, setTyped] = useState(heading)
  const key = editKey.rename(sid, row)
  const sending = useWriteSending(key)
  const { error, setError, field, run, cancel } = useSave(mine, 'name')
  if (sid === null || base === null) return null
  const id = `model-rename-${row}`
  const offered = live !== null
  const label = typed.trim()

  const save = () => {
    if (label === '' || sending || !offered) return
    void run(() => runWrite(key, { op: true }, { base, record: row, label }, (op) => writes.rename(sid, base, row, label, op!)))
  }

  return (
    <form className="mt-2 space-y-2" data-model-renamer={row} aria-busy={sending || undefined}
      onSubmit={(e) => { e.preventDefault(); save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) cancel() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label}>{W.newName}</label>
      <input ref={field} id={id} autoFocus autoComplete="off" maxLength={120} value={typed} readOnly={sending} data-model-renamer-input={row}
        onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={RECIPE.input} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-renamer-error={row}>{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={label === '' || !offered} aria-disabled={sending || undefined} className={`${RECIPE.primary} ${sending ? 'opacity-60' : ''}`} data-model-renamer-save={row}>{W.saveName}</button>
        <button type="button" aria-disabled={sending || undefined} onClick={() => { if (!sending) cancel() }} className={RECIPE.quiet}>{W.cancel}</button>
      </div>
      {sending ? <p role="status" className={RECIPE.status}>{W.saving}</p> : null}
    </form>
  )
}

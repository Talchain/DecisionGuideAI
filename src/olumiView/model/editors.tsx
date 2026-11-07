/**
 * THE MODEL TAB'S EDITORS, PANEL-NATIVE (Paul 7 Nov: "so much easier and slicker … to manually edit the model through this interface").
 *
 * Each one is the canvas editor's write, unchanged: the same route, body, write key and base rule (`FigureEdit.tsx`, `Rename.tsx`), so a
 * write is one write wherever it is pressed and core's answer is the only verdict. What changes is the place and the craft:
 * - the crafted tab's honest edit (legacy `ModelRowView` three-beat): the old value stays on screen while the person types; "Saving…" while
 *   core has it and until the View read after it settles; the editor closes only once that read shows core's new figure, and says core's
 *   version on the row; a refusal is core's own words with the typing kept and the field focused again;
 * - what the editor opened on is kept with it (`state.ts` `Editing`): the scenario, core's version and the typing, so a group closed or a
 *   filter typed never loses them, and a save that lands after the page moved to another scenario says nothing there (UI audit of e8ebab94);
 * - focus is never dropped or taken: the field stays focusable while core has the write (read-only, not disabled; LinkRemove's rule),
 *   closing hands focus back to what opened the editor, and only while focus is still the editor's (a person who moved on keeps it there);
 * - an editor closes only itself, and a refusal that lands after its editor left the screen (a group closed, a filter typed) is said on its
 *   row instead (review a4d73faf);
 * - the crafted tab's look (Paul 7 Nov: "the previous model tab was better looking"): a compact 14px field (DS v5 §2.1), its Save a small
 *   filled pill, the other choices text actions, as legacy "Review change" / "Discard" were; `border-field`, the control border that renders.
 *
 * Every label is core's (`figure.edit.prompt`) or UI chrome (`MODEL_EDIT_WORDS`). Nothing typed is read, converted or rounded here.
 */
import { useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { useUIStore } from '../../stores/uiStore'
import { TeamApiError } from '../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../olumiCore/team/writes'
import { writes } from '../client'
import { useViewStore } from '../store'
import { noteEditSaved, noticeWords } from '../notice'
import { tryWhatIf } from '../whatif'
import { editKey, MODEL_EDIT_WORDS as W, readAfterSave, useModelEdit } from './editing'
import { useModelTab, type Editing } from './state'

/**
 * The tab's control recipes, from the lane's own (chipClass, AddFigure): one name per role, so no control is styled twice. The person's own
 * controls are grey, Olumi's hand-offs alone are blue (`olumi`): blue is Olumi's only. Nothing dims (UI audit of 3f7817bd): a control that
 * cannot act keeps its full weight, and a line says why ("Saving…", "Another change is saving…").
 */
export const RECIPE = {
  // The person's commit is an ink pill: `bg-primary` is Olumi's info blue by token (brand.css: --primary-rgb is --info-rgb).
  primary: `${typography.viewPanelMeta} inline-flex h-7 cursor-pointer items-center rounded-full bg-text-header px-3 text-text-on-color hover:bg-text-header/90 disabled:cursor-default aria-disabled:cursor-default ${ACTION_FOCUS}`,
  secondary: `${typography.viewPanelMeta} inline-flex h-7 cursor-pointer items-center rounded-sm px-1.5 text-text-light hover:text-text-body hover:underline disabled:cursor-default aria-disabled:cursor-default ${ACTION_FOCUS}`,
  action: `${typography.viewPanelMeta} inline-flex min-h-[24px] cursor-pointer items-center gap-1 rounded-sm text-text-light hover:text-text-body hover:underline aria-disabled:cursor-default ${ACTION_FOCUS}`,
  quiet: `${typography.viewPanelMeta} inline-flex h-7 cursor-pointer items-center rounded-sm px-1 text-text-light hover:text-text-body hover:underline disabled:cursor-default aria-disabled:cursor-default ${ACTION_FOCUS}`,
  olumi: `${typography.viewPanelMeta} inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 rounded-sm px-1 text-info hover:underline ${ACTION_FOCUS}`,
  input: `${typography.viewPanelBody} h-9 w-full rounded-md border border-field bg-panel px-2.5 text-text-body placeholder:text-text-light ${ACTION_FOCUS}`,
  label: `${typography.viewPanelMeta} block text-text-light`,
  error: `${typography.viewPanelMeta} m-0 text-danger`,
  status: `${typography.viewPanelMeta} m-0 text-text-light`,
} as const

/**
 * What core's answer to a save becomes on a row: its version once the View shows it ("Version n saved.", the notice's own words), in the
 * scenario the write was for, and only while that scenario is still the one on screen.
 */
export function sayReceipt(sid: string, row: string, saved: unknown): void {
  if (useViewStore.getState().sid !== sid) return
  const n = (saved as { n?: unknown } | null)?.n
  if (typeof n === 'number' && Number.isInteger(n)) useModelTab.getState().say({ row, words: noticeWords({ kind: 'saved', n, by: null, sid }), tone: 'saved' })
}

/** Is focus still with this control (or nowhere)? A person who moved on (the chat, another field) keeps their focus where they put it. */
export function focusIsWith(el: Element | null): boolean {
  if (typeof document === 'undefined') return false
  const a = document.activeElement
  return a === null || a === document.body || (el !== null && el.contains(a))
}

/** Core's version number in a write's answer, when it gives one. */
export const versionOf = (saved: unknown): number | null => {
  const n = (saved as { n?: unknown } | null)?.n
  return typeof n === 'number' && Number.isInteger(n) ? n : null
}

/** A row id inside a quoted attribute selector (a link's row holds `:` and `>`, which a quoted value keeps as they are). */
export const rowSel = (row: string): string => row.replace(/["\\]/g, '\\$&')

/** Focus back on what opened an editor (the row's figure, else its name), once the row has drawn it again. */
export function focusRow(row: string, on: 'value' | 'name'): void {
  setTimeout(() => {
    if (!focusIsWith(null)) return // focus found a home meanwhile
    const el = (on === 'value' ? document.querySelector<HTMLElement>(`[data-model-value-edit="${rowSel(row)}"]`) : null)
      ?? document.querySelector<HTMLElement>(`[data-model-select="${rowSel(row)}"]`)
    el?.focus()
  }, 0)
}

/** Why Save is off while the editor is still open: core withdrew its offer to take the edit (edit_base null). */
export function useWithdrawn(): string | null {
  const { base, held } = useModelEdit()
  const at = useViewStore((s) => s.at)
  if (base !== null) return null
  return at !== null ? W.withdrawnPast : held !== null ? W.withdrawnHeld : W.withdrawn
}

/**
 * One save, for every editor here: the write (`send`), core's receipt, the View read after it, and what the person is told. While core
 * has it (and until that read settles), no other write starts from this tab and no editor opens over it; the editor closes only itself; a
 * refusal goes under the field, or on the row if the field is gone; nothing is said in a scenario the page has left.
 */
function useSave(mine: Editing, key: string, focusOn: 'value' | 'name') {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const sending = useWriteSending(key)
  const busy = useModelTab((s) => s.busy === key)
  // Another write of this tab is with core: this editor's presses do nothing until it settles, and look it (inert, still focusable).
  const other = useModelTab((s) => s.busy !== null && s.busy !== key)
  const here = () => useViewStore.getState().sid === mine.sid
  const fail = (words: string) => {
    if (useModelTab.getState().busy === key) useModelTab.getState().setBusy(null)
    if (!mounted.current) { useModelTab.getState().say({ row: mine.row, words, tone: 'failed' }); return }
    setError(words)
    if (focusIsWith(form.current)) setTimeout(() => field.current?.focus(), 0)
  }
  const run = async (send: () => Promise<unknown>) => {
    if (useModelTab.getState().busy !== null || mine.landed !== undefined) return
    setError(null); useModelTab.getState().setBusy(key)
    try {
      const saved = await send()
      if (!here()) return
      noteEditSaved(saved)
      const shown = await readAfterSave(mine.sid)
      if (shown === 'moved') return
      // Saved, not shown: said, and never sent again from this editor (only Cancel is live); a later read that lands settles it.
      if (shown === 'failed') { useModelTab.getState().land(mine, { n: versionOf(saved), view: useViewStore.getState().view }); fail(W.savedNotShown); return }
      useModelTab.getState().setBusy(null)
      useModelTab.getState().closeIf(mine)
      sayReceipt(mine.sid, mine.row, saved)
      focusRow(mine.row, focusOn)
    } catch (e) {
      if (here()) fail(e instanceof TeamApiError ? e.message : W.failed)
    } finally {
      if (useModelTab.getState().busy === key) useModelTab.getState().setBusy(null)
    }
  }
  const cancel = () => { useModelTab.getState().closeIf(mine); focusRow(mine.row, focusOn) }
  const pending = sending || busy
  const landed = mine.landed !== undefined
  // A later read that lands (a View other than the one on screen when the write landed unseen) shows the save: the editor closes and says
  // core's version, as it would have (UI audit of 3f7817bd: "saved, not shown" never outlives the View that showed it).
  const readNow = useViewStore((s) => (s.error === null && !s.stale ? s.view : null))
  useEffect(() => {
    const l = mine.landed
    if (l === undefined || readNow === null || readNow === l.view) return
    useModelTab.getState().closeIf(mine)
    if (l.n !== null) sayReceipt(mine.sid, mine.row, { n: l.n })
  }, [mine, readNow])
  // Its words come with it: an editor drawn again after its write landed unseen still says so (the flag lives with `editing`).
  const said = error ?? (landed ? W.savedNotShown : null)
  return { error: said, setError, field, form, run, cancel, pending, other, landed, inert: pending || other || landed }
}

/**
 * Change one figure (`POST …/edit`, typed as the person wrote it). `mine.quantity` is the figure's own card id: the row's own, or for an
 * aim the target figure, for a link the figure that sizes it. The base is the one the editor opened on, never a later one (FigureEdit rule).
 */
export function FigureEditor({ mine, edit }: { mine: Editing & { readonly what: 'figure' }; edit: { prompt: string; ask: string } }): JSX.Element {
  const { row, quantity, sid, base, typed } = mine
  const [trying, setTrying] = useState(false)
  const key = editKey.figure(sid, quantity)
  const { error, setError, field, form, run, cancel, pending, other, landed, inert } = useSave(mine, key, 'value')
  const withdrawn = useWithdrawn()
  const id = `model-edit-${row}`
  // Core has stopped offering the edit since it opened (a change of Olumi's is now held): the typing stays, nothing is sent, and it says why.
  const offered = withdrawn === null
  const blank = typed.trim() === ''

  const save = () => {
    if (blank || inert || !offered) return
    void run(() => runWrite(key, { op: true }, { base, quantity, typed }, (op) => writes.edit(sid, base, quantity, typed, op!)))
  }
  /** The same figure on a copy, nothing saved (core's what-if), drawn over the chances on the Analysis tab, as the canvas card's is. */
  const tryIt = async () => {
    if (blank || inert || trying || !offered || useModelTab.getState().busy !== null) return
    const here = () => useViewStore.getState().sid === sid
    setError(null); setTrying(true)
    try {
      await tryWhatIf(sid, base, quantity, typed)
      if (here()) useUIStore.getState().forceActivateOutputTab('results') // never raised over another scenario
    } catch (e) {
      if (here()) setError(e instanceof TeamApiError ? e.message : W.triedFailed)
    } finally { setTrying(false) }
  }

  return (
    <form ref={form} className="mt-2 space-y-2" data-model-editor={row} data-model-editor-for={quantity} aria-busy={pending || undefined}
      onSubmit={(e) => { e.preventDefault(); save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !pending) cancel() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label} data-view-edit-prompt={quantity}>{edit.prompt}</label>
      <input ref={field} id={id} autoFocus autoComplete="off" spellCheck={false} value={typed} readOnly={pending || landed} data-model-editor-input={row}
        onChange={(e) => { useModelTab.getState().type(mine, e.target.value); if (error) setError(null) }} className={`${RECIPE.input} tabular-nums`} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-editor-error={row}>{error}</p>}
      {withdrawn === null ? null : <p role="status" className={RECIPE.status} data-model-editor-withdrawn={row}>{withdrawn}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type="submit" disabled={blank || !offered} aria-disabled={inert || undefined} className={RECIPE.primary} data-model-editor-save={row}>{W.setFigure}</button>
        <button type="button" disabled={blank || !offered} aria-disabled={inert || trying || undefined} onClick={() => void tryIt()} className={RECIPE.secondary} data-model-editor-try={row}>{W.tryIt}</button>
        <button type="button" aria-disabled={pending || undefined} onClick={() => { if (!pending) cancel() }} className={RECIPE.quiet} data-model-editor-cancel={row}>{W.cancel}</button>
      </div>
      {pending ? <p role="status" className={RECIPE.status} data-model-editor-sending={row}>{W.saving}</p>
        : other ? <p role="status" className={RECIPE.status} data-model-editor-waiting={row}>{W.savingOther}</p>
          : trying ? <p role="status" className={RECIPE.status} data-model-editor-trying={row}>{W.trying}</p> : null}
    </form>
  )
}

/** Rename one card (`POST …/rename`): saved at once as the person's version; only its name changes (Rename.tsx contract). */
export function RenameEditor({ mine }: { mine: Editing & { readonly what: 'rename' } }): JSX.Element {
  const { row, sid, base, typed } = mine
  const key = editKey.rename(sid, row)
  const { error, setError, field, form, run, cancel, pending, other, landed, inert } = useSave(mine, key, 'name')
  const withdrawn = useWithdrawn()
  const id = `model-rename-${row}`
  const offered = withdrawn === null
  const label = typed.trim()

  const save = () => {
    if (label === '' || inert || !offered) return
    void run(() => runWrite(key, { op: true }, { base, record: row, label }, (op) => writes.rename(sid, base, row, label, op!)))
  }

  return (
    <form ref={form} className="mt-2 space-y-2" data-model-renamer={row} aria-busy={pending || undefined}
      onSubmit={(e) => { e.preventDefault(); save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !pending) cancel() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label}>{W.newName}</label>
      <input ref={field} id={id} autoFocus autoComplete="off" maxLength={120} value={typed} readOnly={pending || landed} data-model-renamer-input={row}
        onFocus={(e) => e.currentTarget.select()} onChange={(e) => { useModelTab.getState().type(mine, e.target.value); if (error) setError(null) }} className={RECIPE.input} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-renamer-error={row}>{error}</p>}
      {withdrawn === null ? null : <p role="status" className={RECIPE.status} data-model-renamer-withdrawn={row}>{withdrawn}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type="submit" disabled={label === '' || !offered} aria-disabled={inert || undefined} className={RECIPE.primary} data-model-renamer-save={row}>{W.saveName}</button>
        <button type="button" aria-disabled={pending || undefined} onClick={() => { if (!pending) cancel() }} className={RECIPE.quiet} data-model-renamer-cancel={row}>{W.cancel}</button>
      </div>
      {pending ? <p role="status" className={RECIPE.status} data-model-renamer-sending={row}>{W.saving}</p>
        : other ? <p role="status" className={RECIPE.status} data-model-renamer-waiting={row}>{W.savingOther}</p> : null}
    </form>
  )
}

/**
 * Core withdrew the edit an editor was open on (Olumi's change is held, or an earlier version is drawn): without core's offer the editor is
 * not drawn, so its row says why, keeps the typing for when core offers the edit again, and lets the person drop it (UI audit of 3f7817bd:
 * an editor never disappears silently).
 */
export function WithdrawnNote({ mine }: { mine: Editing }): JSX.Element {
  const words = useWithdrawn() ?? W.withdrawn
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2" data-model-editor-kept={mine.row} onClick={(e) => e.stopPropagation()}>
      <p role="status" className={RECIPE.status}>{words}</p>
      <button type="button" onClick={() => { useModelTab.getState().closeIf(mine); focusRow(mine.row, 'value') }} className={RECIPE.quiet} data-model-editor-drop={mine.row}>{W.cancel}</button>
    </div>
  )
}

/**
 * THE MODEL TAB'S EDITORS, PANEL-NATIVE (Paul 7 Nov: "so much easier and slicker … to manually edit the model through this interface").
 *
 * Each one is the canvas editor's write, unchanged: the same route, body, write key and base rule (`FigureEdit.tsx`, `Rename.tsx`), so a
 * write is one write wherever it is pressed and core's answer is the only verdict. What changes is the place and the craft:
 * - the crafted tab's honest edit (legacy `ModelRowView` three-beat): the old value stays on screen while the person types; "Saving…" while
 *   core has it; the editor closes only once the View read after the save shows core's new figure; a refusal is core's own words, with the
 *   person's typing kept;
 * - 14px entry and 44px targets (DS v5 §2.1; the lane's main-target floor), `border-field` (the control border that renders);
 * - one filled control while an editor is open: its own Save.
 *
 * Every label is core's (`figure.edit.prompt`) or UI chrome (`MODEL_EDIT_WORDS`). Nothing typed is read, converted or rounded here.
 */
import { useState } from 'react'
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
import { useModelTab } from './state'

/** The tab's control recipes, from the lane's own (chipClass, AddFigure): one name per role, so no control is styled twice. */
export const RECIPE = {
  primary: VIEW_CHIP_PRIMARY_CLASS,
  secondary: VIEW_CHIP_CLASS.replace('min-h-[28px]', 'min-h-[44px]'),
  action: VIEW_CHIP_CLASS,
  quiet: `${typography.viewPanelBody} inline-flex min-h-[44px] cursor-pointer items-center px-2 text-text-light underline underline-offset-2 hover:text-text-body disabled:opacity-40 ${ACTION_FOCUS}`,
  input: `${typography.viewPanelBody} w-full min-h-[44px] rounded-md border border-field bg-panel px-3 text-text-body placeholder:text-text-light ${ACTION_FOCUS}`,
  label: `${typography.viewPanelMeta} block text-text-light`,
  error: `${typography.viewPanelMeta} m-0 text-danger`,
  status: `${typography.viewPanelMeta} m-0 text-text-light`,
} as const

/** The receipt beside the row once the View shows the edit: the notice's own words for the version core saved. */
function sayReceipt(row: string, saved: unknown): void {
  const { sid } = useViewStore.getState()
  const n = (saved as { n?: unknown } | null)?.n
  if (sid !== null && typeof n === 'number' && Number.isInteger(n)) useModelTab.getState().said({ row, words: noticeWords({ kind: 'saved', n, by: null, sid }) })
}

/**
 * Change one figure (`POST …/edit`, typed as the person wrote it). `quantity` is the figure's own card id: the row's own, or for an aim
 * the target figure, for a link the figure that sizes it. The base is the one the editor opened on, never a later one (FigureEdit rule).
 */
export function FigureEditor({ row, quantity, edit }: { row: string; quantity: string; edit: { prompt: string; ask: string } }): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const [base] = useState(live)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [trying, setTrying] = useState(false)
  const key = editKey.figure(sid, quantity)
  const sending = useWriteSending(key)
  const close = () => useModelTab.getState().edit(null)
  if (sid === null || base === null) return null
  const id = `model-edit-${row}`

  const save = async () => {
    if (typed.trim() === '' || sending) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, quantity, typed }, (op) => writes.edit(sid, base, quantity, typed, op!))
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) { close(); sayReceipt(row, saved) } else setError(W.savedNotShown)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.failed)
    }
  }
  /** The same figure on a copy, nothing saved (core's what-if), drawn over the chances on the Analysis tab, as the canvas card's is. */
  const tryIt = async () => {
    if (typed.trim() === '' || sending || trying) return
    setError(null); setTrying(true)
    try { await tryWhatIf(sid, base, quantity, typed); useUIStore.getState().forceActivateOutputTab('results') } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.triedFailed)
    } finally { setTrying(false) }
  }

  return (
    <form className="mt-2 space-y-2" data-model-editor={row} data-model-editor-for={quantity}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) close() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label} data-view-edit-prompt={quantity}>{edit.prompt}</label>
      <input id={id} autoFocus autoComplete="off" spellCheck={false} value={typed} disabled={sending} data-model-editor-input={row}
        onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={`${RECIPE.input} tabular-nums`} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-editor-error={row}>{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={sending || typed.trim() === ''} className={RECIPE.primary} data-model-editor-save={row}>
          {sending ? <span role="status">{W.saving}</span> : W.setFigure}
        </button>
        <button type="button" disabled={sending || trying || typed.trim() === ''} onClick={() => void tryIt()} className={RECIPE.secondary} data-model-editor-try={row}>{W.tryIt}</button>
        <button type="button" disabled={sending} onClick={close} className={RECIPE.quiet} data-model-editor-cancel={row}>{W.cancel}</button>
      </div>
    </form>
  )
}

/** Rename one card (`POST …/rename`): saved at once as the person's version; only its name changes (Rename.tsx contract). */
export function RenameEditor({ row, heading }: { row: string; heading: string }): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const [base] = useState(live)
  const [typed, setTyped] = useState(heading)
  const [error, setError] = useState<string | null>(null)
  const key = editKey.rename(sid, row)
  const sending = useWriteSending(key)
  const close = () => useModelTab.getState().edit(null)
  if (sid === null || base === null) return null
  const id = `model-rename-${row}`

  const save = async () => {
    const label = typed.trim()
    if (label === '' || sending) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, record: row, label }, (op) => writes.rename(sid, base, row, label, op!))
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) { close(); sayReceipt(row, saved) } else setError(W.savedNotShown)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.failed)
    }
  }

  return (
    <form className="mt-2 space-y-2" data-model-renamer={row}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) close() }}
      onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className={RECIPE.label}>{W.newName}</label>
      <input id={id} autoFocus autoComplete="off" maxLength={120} value={typed} disabled={sending} data-model-renamer-input={row}
        onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={RECIPE.input} />
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-renamer-error={row}>{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={sending || typed.trim() === ''} className={RECIPE.primary} data-model-renamer-save={row}>
          {sending ? <span role="status">{W.saving}</span> : W.saveName}
        </button>
        <button type="button" disabled={sending} onClick={close} className={RECIPE.quiet}>{W.cancel}</button>
      </div>
    </form>
  )
}

/**
 * THE WHAT IF LENS ON THE CORE LANE (DL 4 Nov, R2): the legacy lens's words (`WhatIfKey.tsx`) fed by
 * core's what-if on a copy (`whatif.ts`, olumi-core `POST …/whatif`). The person picks a figure they may set (core offers `figure.edit`),
 * types a different value, and runs it on a copy of the version shown: each option's saved lines beside its what-if lines, both in core's
 * row shape and drawn by the dock's own `Row`. Folded, the key is one line: the legend, or core's words for the figure tried.
 *
 * Nothing is saved, and nothing here writes the model: the value goes to the what-if route only, never the edit route (saving stays the
 * card's own ✎). Every word about a result is core's; the key's own words are the legacy lens's (`WHAT_IF_COPY`, `LENS_KEY_COPY`).
 * The figure tried is marked on its card while the lens is on (`useTriedOn`, `ViewCardNode`).
 */
import { useEffect, useId, useState } from 'react'
import { OkIcon } from './look/icons'
import { Hover, HoverButton } from './look/Hover'
import { TOOLBAR_ACTION, TOOLBAR_BAR_SEPARATOR, TOOLBAR_FOCUS, TOOLBAR_ICON, TOOLBAR_LABEL, TOOLBAR_STATUS, TOOLBAR_TITLE, TOOLBAR_TRAY } from './look/toolbar'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import { WHAT_IF_COPY } from '../canvas/artefacts/whatIfCopy'
import { TeamApiError } from '../olumiCore/team/api'
import { isForThisPage, useMe } from '../olumiCore/me'
import { triableCards } from './layout'
import { useViewLens } from './lens'
import { useViewStore } from './store'
import { clearWhatIf, tryWhatIf, useWhatIf } from './whatif'
import { Compare } from './WhatIfCompare'
import { SAVED_NOT_SHOWN, setFigure } from './FigureEdit'
import { takeWhatIfFocus, useWhatIfFocus } from './v12/inspect/whatIfFocus'

export function ViewWhatIfKey(): JSX.Element | null {
  const on = useViewLens((s) => s.lens === 'what_if')
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const shown = useWhatIf((s) => s.shown)
  const [folded, setFolded] = useState(true)
  const [pick, setPick] = useState('')
  const [typed, setTyped] = useState('')
  const [running, setRunning] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const reasonId = useId()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setFolded(true); setError(null) }, [on])
  // "What if" pressed on a figure in the inspector: open the form on that figure (after the reset above, which runs first).
  const focus = useWhatIfFocus((s) => s.id)
  useEffect(() => { if (focus === null || !on) return; setPick(focus); setTyped(''); setFolded(false); takeWhatIfFocus() }, [focus, on])
  const model = view?.model ?? null
  if (!on || model === null || sid === null || view === null) return null

  const base = model.edit_base
  const cards = base === null || !isForThisPage(view, me) ? [] : triableCards(model)
  const picked = cards.find((c) => c.id === pick) ?? cards[0] ?? null
  const current = shown !== null && shown.sid === sid && shown.base === base ? shown : null
  const run = async () => {
    if (picked === null || base === null || typed.trim() === '' || running) return
    setError(null); setRunning(true)
    try { await tryWhatIf(sid, base, picked.id, typed) } catch (e) {
      setError(e instanceof TeamApiError ? e.message : WHAT_IF_COPY.unusable)
    } finally { setRunning(false) }
  }
  const keep = async () => {
    if (current === null || keeping) return
    setError(null); setKeeping(true)
    try {
      if (await setFigure(sid, current.base, current.quantity, current.typed)) clearWhatIf()
      else setError(SAVED_NOT_SHOWN)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setKeeping(false) }
  }
  const keepReason = keeping ? WHAT_IF_BAR.saving : current === null ? WHAT_IF_BAR.tryFirst : null
  const legend = current === null
    ? <p className={`${typography.viewPanelBody} text-text-body`}>{WHAT_IF_COPY.legendEmpty}</p>
    : <>{current.variant.edits.map((e, i) => <p key={e.quantity} className={`${typography.viewPanelBody} text-text-body`} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      <p className={`${typography.viewPanelMeta} text-text-light`}>{WHAT_IF_COPY.nothingSaved}</p></>

  return (
    <section aria-label={view.lens_words.label.what_if} data-testid="view-whatif-key"
      className={`${TOOLBAR_TRAY} w-80 max-w-full`}>
      <header className="flex items-center gap-2">
        <OkIcon id="what-if" size={14} decorative inherit className="text-text-light" />
        <h2 className={`${TOOLBAR_TITLE} min-w-0 flex-1`}>{view.lens_words.label.what_if}</h2>
        <HoverButton type="button" onClick={() => setFolded((f) => !f)} aria-label={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold} aria-expanded={!folded}
          words={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold} data-testid="view-whatif-key-fold" className={TOOLBAR_ICON}>
          <OkIcon id="fold-tray" variant={folded ? 'alt' : undefined} size={14} decorative inherit />
        </HoverButton>
        <HoverButton type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close}
          words={LENS_KEY_COPY.close} data-testid="view-whatif-key-close" className={TOOLBAR_ICON}>
          <OkIcon id="cancel-close" size={14} decorative inherit />
        </HoverButton>
      </header>
      <div role="group" aria-label={view.lens_words.label.what_if} data-testid="view-whatif-bar" className="flex flex-wrap items-center">
        <span data-testid="view-whatif-bar-proposed" className={TOOLBAR_STATUS}>{WHAT_IF_BAR.proposed}</span>
        <span aria-hidden="true" className={TOOLBAR_BAR_SEPARATOR} />
        <button type="button" data-testid="view-whatif-bar-discard" onClick={clearWhatIf} className={TOOLBAR_LABEL}>{WHAT_IF_BAR.discard}</button>
        <HoverButton type="button" words={keepReason} disabled={keepReason !== null} aria-describedby={keepReason === null ? undefined : reasonId}
          data-testid="view-whatif-bar-keep" onClick={() => void keep()} className={`${TOOLBAR_ACTION} ${controls.actColours}`}>{WHAT_IF_BAR.keep}</HoverButton>
      </div>
      {keepReason === null ? null : <p id={reasonId} data-testid="view-whatif-bar-reason" className={`${typography.viewPanelMeta} text-text-light`}>{keepReason}</p>}
      {error === null ? null : <p role="alert" data-testid="view-whatif-key-error" className="text-danger">{error}</p>}
      <div className={`${typography.viewPanelBody} min-h-0 flex-1 space-y-4 overflow-y-auto`}>
        {legend}
        {folded ? null : picked === null ? <p data-testid="view-whatif-key-none">{WHAT_IF_COPY.noFactors}</p> : (
          <form className="grid gap-3" data-testid="view-whatif-key-form" onSubmit={(e) => { e.preventDefault(); void run() }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
            <label className="grid gap-2">
              <span className="text-text-light">{WHAT_IF_COPY.factor}</span>
              <select value={picked.id} data-testid="view-whatif-key-factor" disabled={running}
                onChange={(e) => { setPick(e.target.value); setTyped(''); setError(null) }}
                className={`rounded-sm border border-field bg-panel px-2 py-1 text-text-body ${TOOLBAR_FOCUS}`}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.heading}</option>)}
              </select>
            </label>
            {picked.figure === null ? null : <p><span className="text-text-light">{WHAT_IF_COPY.saved}: </span><Hover words={picked.figure.title}>{picked.figure.text}</Hover></p>}
            <label className="grid gap-2">
              <span className="text-text-light">{picked.figure!.edit!.prompt}</span>
              <input data-testid="view-whatif-key-typed" autoComplete="off" spellCheck={false} value={typed} disabled={running}
                onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
                className={`rounded-sm border border-field bg-panel px-2 py-1 text-text-body ${TOOLBAR_FOCUS}`} />
            </label>
            <div>
              <HoverButton type="submit" data-testid="view-whatif-key-run" disabled={running || typed.trim() === ''}
                words={running ? WHAT_IF_COPY.running : typed.trim() === '' ? 'Enter a value to try' : undefined}
                className={TOOLBAR_LABEL}>{running ? WHAT_IF_COPY.running : WHAT_IF_COPY.run}</HoverButton>
            </div>
          </form>
        )}
        {folded || current === null ? null : <Compare model={model} shown={current} />}
      </div>
    </section>
  )
}

export const WHAT_IF_BAR = { proposed: 'Proposed', discard: 'Discard', keep: 'Keep it', tryFirst: 'Try a value first', saving: 'Saving…' } as const

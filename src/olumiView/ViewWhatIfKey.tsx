/**
 * THE WHAT IF LENS ON THE CORE LANE (DL 4 Nov, R2): the legacy lens's key card (`WhatIfKey.tsx`: its corner, its look, its words) fed by
 * core's what-if on a copy (`whatif.ts`, olumi-core `POST …/whatif`). The person picks a figure they may set (core offers `figure.edit`),
 * types a different value, and runs it on a copy of the version shown: each option's saved lines beside its what-if lines, both in core's
 * row shape and drawn by the dock's own `Row`. Folded, the key is one line: the legend, or core's words for the figure tried.
 *
 * Nothing is saved, and nothing here writes the model: the value goes to the what-if route only, never the edit route (saving stays the
 * card's own ✎). Every word about a result is core's; the key's own words are the legacy lens's (`WHAT_IF_COPY`, `LENS_KEY_COPY`).
 * The figure tried is marked on its card while the lens is on (`useTriedOn`, `ViewCardNode`).
 */
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { OVERLAY_BAND_BOTTOM, OVERLAY_BAND_HEIGHT, OVERLAY_BAND_LEFT_PAD } from '../canvas/components/CanvasOverlayBand'
import { LENS_ICON } from '../canvas/artefacts/lenses'
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

/** The key's width and gap above the canvas's bottom band, as the legacy key card stands (`LensInfoPanel.tsx`). */
const KEY_WIDTH = 320
const KEY_GAP = 8

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
  const Icon = LENS_ICON.what_if
  const legend = current === null
    ? <p className={`${typography.viewPanelBody} text-text-body`}>{WHAT_IF_COPY.legendEmpty}</p>
    : <>{current.variant.edits.map((e, i) => <p key={e.quantity} className={`${typography.viewPanelBody} text-text-body`} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      <p className={`${typography.viewPanelMeta} text-text-light`}>{WHAT_IF_COPY.nothingSaved}</p></>

  return (
    <>
    <WhatIfBar label={view.lens_words.label.what_if} canKeep={current !== null} keeping={keeping} onKeep={() => void keep()} onDiscard={clearWhatIf} />
    <section aria-label={view.lens_words.label.what_if} data-testid="view-whatif-key"
      className="pointer-events-auto absolute z-[1150] flex flex-col rounded-[20px] border border-panel-border bg-panel shadow-2"
      style={{ width: KEY_WIDTH, left: OVERLAY_BAND_LEFT_PAD, bottom: OVERLAY_BAND_BOTTOM + OVERLAY_BAND_HEIGHT + KEY_GAP, maxHeight: 'min(52vh, 460px)' }}>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`}>{view.lens_words.label.what_if}</h2>
        <button type="button" onClick={() => setFolded((f) => !f)} aria-label={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold} aria-expanded={!folded}
          title={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold} data-testid="view-whatif-key-fold"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}>
          {folded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} title={LENS_KEY_COPY.close} data-testid="view-whatif-key-close"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div className={`${typography.viewPanelBody} min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4`}>
        {legend}
        {folded ? null : picked === null ? <p data-testid="view-whatif-key-none">{WHAT_IF_COPY.noFactors}</p> : (
          <form className="grid gap-2" data-testid="view-whatif-key-form" onSubmit={(e) => { e.preventDefault(); void run() }} onKeyDown={(e) => e.stopPropagation()}>
            <label className="grid gap-1">
              <span className="text-text-light">{WHAT_IF_COPY.factor}</span>
              <select value={picked.id} data-testid="view-whatif-key-factor" disabled={running}
                onChange={(e) => { setPick(e.target.value); setTyped(''); setError(null) }}
                className={`rounded border border-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.heading}</option>)}
              </select>
            </label>
            {picked.figure === null ? null : <p><span className="text-text-light">{WHAT_IF_COPY.saved}: </span><span title={picked.figure.title}>{picked.figure.text}</span></p>}
            <label className="grid gap-1">
              <span className="text-text-light">{picked.figure!.edit!.prompt}</span>
              <input data-testid="view-whatif-key-typed" autoComplete="off" spellCheck={false} value={typed} disabled={running}
                onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
                className={`rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`} />
            </label>
            {error === null ? null : <p role="alert" data-testid="view-whatif-key-error" className="text-danger">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" data-testid="view-whatif-key-run" disabled={running || typed.trim() === ''}
                className={`cursor-pointer rounded border border-info/30 px-2 py-0.5 text-info disabled:text-text-light disabled:cursor-not-allowed ${ACTION_FOCUS}`}>{running ? WHAT_IF_COPY.running : WHAT_IF_COPY.run}</button>
              {current === null ? null : <button type="button" data-testid="view-whatif-key-clear" onClick={clearWhatIf}
                className={`cursor-pointer text-text-light underline underline-offset-2 ${ACTION_FOCUS}`}>{WHAT_IF_COPY.clear}</button>}
            </div>
          </form>
        )}
        {folded || current === null ? null : <Compare model={model} shown={current} />}
      </div>
    </section>
    </>
  )
}

export const WHAT_IF_BAR = { proposed: 'Proposed', discard: 'Discard', keep: 'Keep it', tryFirst: 'Try a value first' } as const

/**
 * The what-if bar, floating above the Simple | Detailed pill (the board: "What if", Proposed, Discard, Keep it). Discard drops what was tried (nothing was saved).
 * Keep it saves the tried value through the existing set-figure path and is disabled, with its reason, until a value has been tried.
 */
export function WhatIfBar({ label, canKeep, keeping, onKeep, onDiscard }: { label: string; canKeep: boolean; keeping: boolean; onKeep: () => void; onDiscard: () => void }): JSX.Element {
  const btn = `${typography.viewPanelBody} min-h-[32px] cursor-pointer rounded-full px-3 ${ACTION_FOCUS}`
  return (
    <div role="group" aria-label={label} data-testid="view-whatif-bar"
      className={`pointer-events-auto absolute bottom-[72px] left-1/2 z-[1200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1 shadow-2 ${typography.viewPanelBody}`}>
      <span className="font-medium text-text-header">{label}</span>
      <span data-testid="view-whatif-bar-proposed" className="rounded-full border border-panel-border px-1.5 text-[11px] leading-4 text-text-light">{WHAT_IF_BAR.proposed}</span>
      <button type="button" data-testid="view-whatif-bar-discard" onClick={onDiscard} className={`${btn} text-text-body hover:bg-panel-hover`}>{WHAT_IF_BAR.discard}</button>
      <button type="button" data-testid="view-whatif-bar-keep" aria-disabled={!canKeep || keeping || undefined} title={canKeep ? undefined : WHAT_IF_BAR.tryFirst}
        onClick={() => { if (canKeep && !keeping) onKeep() }}
        className={`${btn} bg-primary text-text-on-color aria-disabled:cursor-not-allowed aria-disabled:bg-border aria-disabled:text-text-light`}>{WHAT_IF_BAR.keep}</button>
      {canKeep ? null : <span data-testid="view-whatif-bar-reason" className={`${typography.viewPanelMeta} text-text-light`}>{WHAT_IF_BAR.tryFirst}</span>}
    </div>
  )
}

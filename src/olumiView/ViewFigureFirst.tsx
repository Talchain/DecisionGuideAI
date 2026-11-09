/**
 * "Let us give our figure first" on the Olumi tab (canon wave step 4, olumi-core `src/app/figure-first.ts`): the blind entry, "Show me
 * Olumi's figure instead", and their figure beside Olumi's. Drawing only: the wiring (the reads and writes, one at a time) is ViewChat.tsx's,
 * so this module imports nothing from it.
 *
 * Every word is core's: the entry's (`GET …/figure-first`), the show answer's (`POST …/figure-first/show`) and the View's
 * (`session.figure_first`). The entry never holds Olumi's figure, so the panel cannot draw it. The side by side draws each figure's own words
 * and places the two on one axis by their numbers (layout.ts figureAxisOf); it writes no number, no distance and no "closer" of its own.
 */
import { create } from 'zustand'
import { ArrowUp, X } from 'lucide-react'
import { typography } from '../styles/typography'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'
import type { FigureFirstEntry, FigureFirstShown } from './client'
import { figureAxisOf, type FigureFirstGiven, type FigureFirstHeadings } from './layout'

interface FigureFirstState {
  /** The scenario (DGAI's uuid) the entry was opened for: another scenario's panel is never drawn. */
  readonly uuid: string | null
  /** The View signature the entry was read against: when the View moves on, the entry is read again or closed (ViewChat.tsx). */
  readonly signature: string | null
  readonly entry: FigureFirstEntry | null
  /** Core's headings, kept from the View when the entry opened: after "Show me Olumi's" the View no longer carries them. */
  readonly headings: FigureFirstHeadings | null
  readonly shown: (FigureFirstShown & { headings: FigureFirstHeadings | null }) | null
  /** Core's words for a read or write that did not go through (the card's ask, "say why, in a few words", a 409). */
  readonly said: string | null
  readonly reading: boolean
  /** What they typed: the figure (sent as typed, core reads it) and their words. Kept across a re-read of the entry. */
  readonly typed: string
  readonly text: string
}

export const FIGURE_FIRST_CLOSED = { entry: null, said: null, reading: false, signature: null } as const
export const useFigureFirst = create<FigureFirstState>()(() => ({ uuid: null, signature: null, entry: null, headings: null, shown: null, said: null, reading: false, typed: '', text: '' }))

const CLOSE = 'inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info'
const FIELD = `${typography.viewPanelBody} block w-full rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed`

/**
 * The blind entry, in core's words: its heading, question, what the figure feeds, the ask (the label of the box the figure is typed in, sent
 * as typed), a box for their words (named by the question, which asks for them), core's note and "Show me Olumi's figure instead". While a
 * read or a write is in flight nothing can be sent. With no entry it says only why (core's words for a refused read).
 */
export function FigureFirstEntryPanel({ held, onGive, onShow, onClose }: { held: boolean; onGive: () => void; onShow: () => void; onClose: () => void }) {
  const { entry, said, reading, typed, text, headings } = useFigureFirst()
  const busy = held || reading
  return (
    <section aria-labelledby={entry === null ? undefined : 'view-ff-heading'} className={`${typography.viewPanelBody} rounded-lg border border-info/40 bg-panel p-3 space-y-2`} data-testid="view-figure-first-entry">
      <div className="flex items-start justify-between gap-2">
        {entry === null ? <span /> : <p id="view-ff-heading" className={typography.panelHeader} data-ff="heading">{entry.heading}</p>}
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className={CLOSE} data-testid="view-figure-first-close"><X className="h-3 w-3" aria-hidden="true" /></button>
      </div>
      {entry === null ? null : (
        <>
          <p id="view-ff-question" data-ff="question">{entry.question}</p>
          {entry.feeds_text === null ? null : <p className={`${typography.chatMeta} text-text-light`} data-ff="feeds_text">{entry.feeds_text}</p>}
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!busy && typed.trim() !== '' && text.trim() !== '') onGive() }}>
            <label htmlFor="view-ff-typed" className={`${typography.chatMeta} block text-text-light`} data-ff="ask">{entry.ask}</label>
            <input id="view-ff-typed" type="text" autoComplete="off" spellCheck={false} value={typed} disabled={busy} className={FIELD} data-testid="view-figure-first-typed"
              onChange={(e) => useFigureFirst.setState({ typed: e.target.value, said: null })} />
            <div className="flex items-end gap-2">
              <textarea aria-labelledby="view-ff-question" rows={2} value={text} disabled={busy} className={`${FIELD} resize-none`} data-testid="view-figure-first-text"
                onChange={(e) => useFigureFirst.setState({ text: e.target.value, said: null })} />
              <button type="submit" disabled={busy || typed.trim() === '' || text.trim() === ''} aria-label="Send" title="Send" data-testid="view-figure-first-send"
                className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-info text-text-on-color hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:bg-border disabled:border-border disabled:text-text-light disabled:cursor-not-allowed">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      )}
      {said === null ? null : <p role="alert" className="text-danger" data-testid="view-figure-first-said">{said}</p>}
      {entry === null ? null : (
        <>
          <p className={`${typography.chatMeta} text-text-light`} data-ff="note">{entry.note}</p>
          {/* Shown only with core's headings to draw the answer under (kept from the View when the entry opened). */}
          {headings === null ? null : <button type="button" disabled={busy} onClick={onShow} className={VIEW_CHIP_CLASS} data-ff="show" data-testid="view-figure-first-show">{entry.show}</button>}
        </>
      )}
    </section>
  )
}

/** "Show me Olumi's figure instead", answered: Olumi's figure in its card's words (its text, and its title, which reads the range), and its basis. */
export function FigureFirstShownPanel({ onClose }: { onClose: () => void }) {
  const shown = useFigureFirst((s) => s.shown)
  if (shown === null) return null
  const h = shown.headings
  return (
    <section className={`${typography.viewPanelBody} rounded-lg border border-panel-border bg-panel p-3 space-y-2`} data-testid="view-figure-first-shown">
      <div className="flex items-start justify-between gap-2">
        <p className={typography.panelHeader} data-ff="shown.label">{shown.label}</p>
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className={CLOSE} data-testid="view-figure-first-shown-close"><X className="h-3 w-3" aria-hidden="true" /></button>
      </div>
      <div className="space-y-0.5">
        {h === null ? null : <p className={`${typography.chatMeta} flex items-center gap-1.5 text-text-light`}><span className="h-2 w-2 rounded-full bg-info" aria-hidden="true" /><span data-ff="shown.headings.olumi">{h.olumi}</span></p>}
        <p className={typography.panelHeader} data-ff="shown.olumi.text">{shown.olumi.text}</p>
        <p className={`${typography.chatMeta} text-text-light`} data-ff="shown.olumi.title">{shown.olumi.title}</p>
      </div>
      <div className="space-y-0.5">
        {h === null ? null : <p className={`${typography.chatMeta} text-text-light`} data-ff="shown.headings.basis">{h.basis}</p>}
        <p data-ff="shown.olumi.basis">{shown.olumi.basis}</p>
      </div>
    </section>
  )
}

/**
 * Their figure beside Olumi's (`session.figure_first.given`), under core's headings: each figure's own words (its range on hover), the two
 * placed on one axis (theirs above, Olumi's below in Olumi's blue, Olumi's most likely as a mark), Olumi's basis, what core's record shows
 * they had met before, what was adopted since (only when something was) and core's note. Nothing else is written: no distance, no overlap,
 * no merged figure.
 */
export function FigureFirstSideBySide({ given, headings }: { given: FigureFirstGiven; headings: FigureFirstHeadings }) {
  const axis = figureAxisOf(given)
  const point = 'value' in given.theirs
  const bar = (s: { from: number; to: number }) => ({ left: `${s.from}%`, width: `${s.to - s.from}%` })
  return (
    <details open className={`${typography.viewPanelBody} rounded-lg border border-panel-border bg-panel p-3`} data-testid="view-figure-first-given">
      <summary className={`${typography.panelHeader} cursor-pointer`}><span data-ff="given.label">{given.label}</span></summary>
      <div className="mt-2 space-y-3">
        <ul className="m-0 list-none space-y-1 p-0">
          <li className="flex items-baseline gap-2" data-ff-figure="theirs">
            <span className="h-2 w-2 flex-none rounded-full bg-text-body" aria-hidden="true" />
            <span className={`${typography.chatMeta} text-text-light`} data-ff="headings.theirs">{headings.theirs}</span>
            <span title={given.theirs.title} data-ff="given.theirs.text">{given.theirs.text}</span>
          </li>
          <li className="flex items-baseline gap-2" data-ff-figure="olumi">
            <span className="h-2 w-2 flex-none rounded-full bg-info" aria-hidden="true" />
            <span className={`${typography.chatMeta} text-text-light`} data-ff="headings.olumi">{headings.olumi}</span>
            <span title={given.olumi.title} data-ff="given.olumi.text">{given.olumi.text}</span>
          </li>
        </ul>
        {/* One axis for both (geometry only; the words above say the figures). */}
        <div className="relative h-9 rounded-md bg-panel-hover" aria-hidden="true" data-testid="view-figure-first-axis">
          {point
            ? <span className="absolute top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-text-body" style={{ left: `${axis.theirs.from}%` }} data-axis="theirs" data-from={axis.theirs.from} data-to={axis.theirs.to} />
            : <span className="absolute top-2 h-2 min-w-[2px] rounded-full bg-text-body" style={bar(axis.theirs)} data-axis="theirs" data-from={axis.theirs.from} data-to={axis.theirs.to} />}
          <span className="absolute bottom-2 h-2 min-w-[2px] rounded-full bg-info" style={bar(axis.olumi)} data-axis="olumi" data-from={axis.olumi.from} data-to={axis.olumi.to} />
          {axis.likely === null ? null : <span className="absolute bottom-1.5 h-3 w-0.5 -translate-x-1/2 rounded bg-text-body" style={{ left: `${axis.likely}%` }} data-axis="likely" data-from={axis.likely} />}
        </div>
        <div className="space-y-0.5">
          <p className={`${typography.chatMeta} text-text-light`} data-ff="headings.basis">{headings.basis}</p>
          <p data-ff="given.olumi.basis">{given.olumi.basis}</p>
        </div>
        <div className="space-y-0.5">
          <p className={`${typography.chatMeta} text-text-light`} data-ff="headings.seen">{headings.seen}</p>
          <p data-ff="given.seen_before.text">{given.seen_before.text}</p>
        </div>
        {given.adopted === null ? null : (
          <div className="space-y-0.5">
            <p className={`${typography.chatMeta} text-text-light`} data-ff="headings.adopted">{headings.adopted}</p>
            <p data-ff="given.adopted.text">{given.adopted.text}</p>
          </div>
        )}
        <p className={`${typography.chatMeta} text-text-light`} data-ff="given.note">{given.note}</p>
      </div>
    </details>
  )
}

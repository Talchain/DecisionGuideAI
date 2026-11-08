/**
 * THE "IF IT FAILED" LENS ON THE CORE LANE: the legacy lens's key card (its corner, its look, its label and icon) behind "Write mine first".
 * The person writes their own reasons it could fail first, so Olumi's do not steer them; once a turn of theirs opens with those words
 * (read from core's View, so it holds after a reload) Olumi's stories show, each in core's number and words with Olumi's own mark, and
 * the cards it rests on, which stand in front on the canvas while the rest recede (`usePreMortemOf`). Every story word is core's
 * (`cards[].failed`); the UI adds only the words around them.
 *
 * R19: core now gates this per member, typed (`session.pre_mortem`): while `state` is 'closed' Olumi's stories are withheld by core, and the key draws
 * core's entry (its question, a box for their own reasons, "Show me Olumi's now", its note); sending writes them (`POST …/pre-mortem`, 1 to 5 reasons,
 * one per line) or logs the choice (`…/pre-mortem/show`), and the View read again opens the stories. A View with no gate state keeps the earlier press
 * (words in the message box, nothing sent), bound to the member by id.
 */
import { ArrowUp, X } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { OVERLAY_BAND_BOTTOM, OVERLAY_BAND_HEIGHT, OVERLAY_BAND_LEFT_PAD } from '../canvas/components/CanvasOverlayBand'
import { LENS_ICON } from '../canvas/artefacts/lenses'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import { revealOlumiSurface } from '../canvas/conversation/revealOlumi'
import { askMethod, giveReasons, showOlumisNow, useViewChat } from './ViewChat'
import { useFailureStories, useMineWritten, usePreMortemGate, useViewLens, WRITE_MINE_DRAFT } from './lens'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'
import { useViewStore } from './store'
import type { ViewPreMortem } from './client'

const KEY_GAP = 8
export const PREMORTEM_COPY = {
  first: 'Write your own reasons it could fail first. Olumi’s stories show after yours, so they do not steer them.',
  waiting: 'Your reasons are in the message box. Send them and Olumi’s stories show here.',
  label: 'Write mine first',
  restsOn: 'Rests on',
} as const
const MOVE = 'pre_mortem'

/** What the message box should hold after the press, given what it holds now. Never drops a character of `now`. */
export function writeMineDraft(now: string): string {
  if (now.length === 0) return WRITE_MINE_DRAFT
  return now.startsWith(WRITE_MINE_DRAFT.trimEnd()) ? now : WRITE_MINE_DRAFT + now
}

/** The press: the opening of the person's own sentence goes in the message box (never over what they typed, never sent). */
export function writeMine(): void {
  const now = useViewChat.getState().text, next = writeMineDraft(now)
  if (next !== now) useViewChat.setState({ text: next })
  revealOlumiSurface()
}

export function ViewPreMortemKey(): JSX.Element | null {
  const on = useViewLens((s) => s.lens === 'premortem')
  const model = useViewStore((s) => s.view?.model ?? null)
  const label = useViewStore((s) => s.view?.lens_words.label.premortem ?? null) // core's (N3)
  const offered = useViewStore((s) => s.view?.session?.methods.some((m) => m.id === MOVE) ?? false)
  const mine = useMineWritten(), stories = useFailureStories()
  const typed = useViewChat((s) => s.text.trimStart().startsWith(WRITE_MINE_DRAFT.trimEnd()))
  const gate = useViewStore((s) => s.view?.session?.pre_mortem ?? null)
  const entry = gate !== null && gate.state === 'closed' ? gate : null
  if (!on || model === null || label === null) return null
  const Icon = LENS_ICON.premortem
  return (
    <section aria-label={label} data-testid="view-premortem-key" data-mine={mine ? '' : undefined}
      className="pointer-events-auto absolute z-[1150] flex flex-col rounded-[20px] border border-panel-border bg-panel shadow-2"
      style={{ left: OVERLAY_BAND_LEFT_PAD, bottom: OVERLAY_BAND_BOTTOM + OVERLAY_BAND_HEIGHT + KEY_GAP, width: 'min(420px, calc(100vw - 480px))', maxHeight: 'min(52vh, 460px)' }}>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`} data-view={entry === null ? undefined : 'session.pre_mortem.heading'}>{entry === null ? label : entry.heading}</h2>
        <button type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} title={LENS_KEY_COPY.close} data-testid="view-premortem-key-close"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 pb-4">
        {entry !== null ? <PreMortemEntry gate={entry} /> : !mine ? (
          <>
            <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-premortem-first">{typed ? PREMORTEM_COPY.waiting : PREMORTEM_COPY.first}</p>
            <button type="button" onClick={writeMine} data-testid="view-premortem-write-mine"
              // Ink, not blue: the press is the person's own act (blue means Olumi only).
              className={`${typography.viewPanelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-3 text-text-header hover:bg-panel-hover ${ACTION_FOCUS}`}>
              {PREMORTEM_COPY.label}
            </button>
          </>
        ) : stories.length === 0 ? (
          <>
            <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-premortem-empty">{LENS_KEY_COPY.premortemEmpty}</p>
            {offered
              ? <button type="button" onClick={() => void askMethod(MOVE)} data-testid="view-premortem-ask"
                  className={`${typography.viewPanelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-info/40 px-3 text-info hover:bg-panel-hover ${ACTION_FOCUS}`}>{LENS_KEY_COPY.premortemAsk}</button>
              : <p className={`${typography.viewPanelBody} text-text-light`}>{LENS_KEY_COPY.premortemNeedsRun}</p>}
          </>
        ) : (
          <ol className="space-y-3" data-testid="view-premortem-stories">
            {stories.map((st) => (
              <li key={st.n} data-story={st.n} className="space-y-0.5">
                <p className={`${typography.viewPanelBody} text-text-body`}>
                  <span className="text-info" title={st.olumi.title} aria-label={st.olumi.title}>{st.olumi.glyph}{st.n} </span>
                  <span data-testid="view-premortem-story-text">{st.text}</span>
                </p>
                {st.control === null ? null : <p className={`${typography.chatMeta} text-info`} data-testid="view-premortem-control">{st.control}</p>}
                <p className={`${typography.chatMeta} text-text-light`} data-testid="view-premortem-rests">{PREMORTEM_COPY.restsOn}: {st.cards.map((c) => c.heading).join(', ')}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** Core's entry while the gate is closed: its note when a reply is being withheld, its question, their box, send, "Show me Olumi's now" and its closing note. */
function PreMortemEntry({ gate }: { gate: ViewPreMortem }): JSX.Element {
  const { text, said } = usePreMortemGate()
  const busy = useViewChat((s) => s.busy)
  const empty = text.trim() === ''
  return (
    <div className="space-y-2" data-testid="view-premortem-entry">
      {gate.held ? <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-premortem-gate" data-view="session.pre_mortem.gate">{gate.gate}</p> : null}
      <p id="view-pm-question" className={`${typography.viewPanelBody} text-text-body`} data-view="session.pre_mortem.question">{gate.question}</p>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!busy && !empty) void giveReasons() }}>
        <textarea aria-labelledby="view-pm-question" rows={3} value={text} disabled={busy} data-testid="view-premortem-reasons"
          className={`${typography.viewPanelBody} block w-full resize-none rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:opacity-40`}
          onChange={(e) => usePreMortemGate.setState({ text: e.target.value, said: null })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy && !empty) { e.preventDefault(); void giveReasons() } }} />
        <button type="submit" disabled={busy || empty} aria-label="Send" title="Send" data-testid="view-premortem-send"
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-info text-text-on-color hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-30">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
      {said === null ? null : <p role="alert" className="text-danger" data-testid="view-premortem-said">{said}</p>}
      <button type="button" disabled={busy} onClick={() => void showOlumisNow()} className={VIEW_CHIP_CLASS} data-testid="view-premortem-show" data-view="session.pre_mortem.show">{gate.show}</button>
      <p className={`${typography.chatMeta} text-text-light`} data-view="session.pre_mortem.after">{gate.after}</p>
    </div>
  )
}

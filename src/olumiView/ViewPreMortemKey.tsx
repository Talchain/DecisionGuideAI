/**
 * THE "IF IT FAILED" LENS ON THE CORE LANE: the story tray behind "Write mine first".
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
import { Hover, HoverButton } from './look/Hover'
import { OkIcon } from './look/icons'
import { TOOLBAR_ICON, TOOLBAR_LABEL, TOOLBAR_TITLE, TOOLBAR_TRAY } from './look/toolbar'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import { revealOlumiSurface } from '../canvas/conversation/revealOlumi'
import { askMethod, giveReasons, showOlumisNow, useViewChat } from './ViewChat'
import { useFailureStories, useMineWritten, usePreMortemGate, useViewLens, WRITE_MINE_DRAFT } from './lens'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'
import { useViewStore } from './store'
import type { ViewPreMortem } from './client'

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
  return (
    <section aria-label={label} data-testid="view-premortem-key" data-mine={mine ? '' : undefined}
      className={`${TOOLBAR_TRAY} w-[26rem] max-w-full`}>
      <header className="flex items-center gap-2">
        <OkIcon id="lens-premortem" size={14} decorative inherit className="flex-none text-text-light" />
        <h2 className={`${TOOLBAR_TITLE} min-w-0 flex-1`} data-view={entry === null ? undefined : 'session.pre_mortem.heading'}>{entry === null ? label : entry.heading}</h2>
        <HoverButton type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} words={LENS_KEY_COPY.close} data-testid="view-premortem-key-close"
          className={TOOLBAR_ICON}>
          <OkIcon id="cancel-close" size={14} decorative inherit />
        </HoverButton>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {entry !== null ? <PreMortemEntry gate={entry} /> : !mine ? (
          <>
            <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-premortem-first">{typed ? PREMORTEM_COPY.waiting : PREMORTEM_COPY.first}</p>
            <button type="button" onClick={writeMine} data-testid="view-premortem-write-mine"
              className={TOOLBAR_LABEL}>
              {PREMORTEM_COPY.label}
            </button>
          </>
        ) : stories.length === 0 ? (
          <>
            <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-premortem-empty">{LENS_KEY_COPY.premortemEmpty}</p>
            {offered
              ? <button type="button" onClick={() => void askMethod(MOVE)} data-testid="view-premortem-ask"
                  className={TOOLBAR_LABEL}>{LENS_KEY_COPY.premortemAsk}</button>
              : <p className={`${typography.viewPanelBody} text-text-light`}>{LENS_KEY_COPY.premortemNeedsRun}</p>}
          </>
        ) : (
          <ol className="space-y-3" data-testid="view-premortem-stories">
            {stories.map((st) => (
              <li key={st.n} data-story={st.n} className="space-y-3">
                <p className={`${typography.viewPanelBody} text-text-body`}>
                  <Hover role="img" className="text-info" words={st.olumi.title} aria-label={st.olumi.title}>{st.olumi.glyph}{st.n} </Hover>
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
          className={`${typography.viewPanelBody} block w-full resize-none rounded-sm border border-field bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed`}
          onChange={(e) => usePreMortemGate.setState({ text: e.target.value, said: null })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy && !empty) { e.preventDefault(); void giveReasons() } }} />
        <HoverButton type="submit" disabled={busy || empty} aria-label="Send" words={busy ? 'Sending your reasons' : empty ? 'Write your reasons first' : 'Send'} data-testid="view-premortem-send"
          className={`${controls.chipIcon} inline-flex flex-none items-center justify-center ${controls.actColours} focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
          <OkIcon id="send" size={14} decorative inherit />
        </HoverButton>
      </form>
      {said === null ? null : <p role="alert" className="text-danger" data-testid="view-premortem-said">{said}</p>}
      <button type="button" disabled={busy} onClick={() => void showOlumisNow()} className={VIEW_CHIP_CLASS} data-testid="view-premortem-show" data-view="session.pre_mortem.show">{gate.show}</button>
      <p className={`${typography.chatMeta} text-text-light`} data-view="session.pre_mortem.after">{gate.after}</p>
    </div>
  )
}

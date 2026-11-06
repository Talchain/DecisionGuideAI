/**
 * THE "IF IT FAILED" LENS ON THE CORE LANE: the legacy lens's key card (its corner, its look, its label and icon) behind "Write mine first".
 * The person writes their own reasons it could fail first, so Olumi's do not steer them; once a turn of theirs opens with those words
 * (read from core's View, so it holds after a reload) Olumi's stories show, each in core's number and words with Olumi's own mark, and
 * the cards it rests on, which stand in front on the canvas while the rest recede (`usePreMortemOf`). Every story word is core's
 * (`cards[].failed`); the UI adds only the words around them. View only: the press puts words in the message box and sends nothing.
 */
import { X } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { OVERLAY_BAND_BOTTOM, OVERLAY_BAND_HEIGHT, OVERLAY_BAND_LEFT_PAD } from '../canvas/components/CanvasOverlayBand'
import { LENS_COPY, LENS_ICON } from '../canvas/artefacts/lenses'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import { revealOlumiSurface } from '../canvas/conversation/revealOlumi'
import { askMethod, useViewChat } from './ViewChat'
import { useFailureStories, useMineWritten, useViewLens, WRITE_MINE_DRAFT } from './lens'
import { useViewStore } from './store'

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
  const offered = useViewStore((s) => s.view?.session?.methods.some((m) => m.id === MOVE) ?? false)
  const mine = useMineWritten(), stories = useFailureStories()
  const typed = useViewChat((s) => s.text.trimStart().startsWith(WRITE_MINE_DRAFT.trimEnd()))
  if (!on || model === null) return null
  const Icon = LENS_ICON.premortem
  return (
    <section aria-label={LENS_COPY.label.premortem} data-testid="view-premortem-key" data-mine={mine ? '' : undefined}
      className="pointer-events-auto absolute z-[1150] flex flex-col rounded-[20px] border border-panel-border bg-panel shadow-2"
      style={{ left: OVERLAY_BAND_LEFT_PAD, bottom: OVERLAY_BAND_BOTTOM + OVERLAY_BAND_HEIGHT + KEY_GAP, width: 'min(420px, calc(100vw - 480px))', maxHeight: 'min(52vh, 460px)' }}>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`}>{LENS_COPY.label.premortem}</h2>
        <button type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} title={LENS_KEY_COPY.close} data-testid="view-premortem-key-close"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 pb-4">
        {!mine ? (
          <>
            <p className={`${typography.panelBody} text-text-body`} data-testid="view-premortem-first">{typed ? PREMORTEM_COPY.waiting : PREMORTEM_COPY.first}</p>
            <button type="button" onClick={writeMine} data-testid="view-premortem-write-mine"
              // Ink, not blue: the press is the person's own act (blue means Olumi only).
              className={`${typography.panelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-3 text-text-header hover:bg-panel-hover ${ACTION_FOCUS}`}>
              {PREMORTEM_COPY.label}
            </button>
          </>
        ) : stories.length === 0 ? (
          <>
            <p className={`${typography.panelBody} text-text-body`} data-testid="view-premortem-empty">{LENS_KEY_COPY.premortemEmpty}</p>
            {offered
              ? <button type="button" onClick={() => void askMethod(MOVE)} data-testid="view-premortem-ask"
                  className={`${typography.panelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-info/40 px-3 text-info hover:bg-panel-hover ${ACTION_FOCUS}`}>{LENS_KEY_COPY.premortemAsk}</button>
              : <p className={`${typography.panelBody} text-text-light`}>{LENS_KEY_COPY.premortemNeedsRun}</p>}
          </>
        ) : (
          <ol className="space-y-3" data-testid="view-premortem-stories">
            {stories.map((st) => (
              <li key={st.n} data-story={st.n} className="space-y-0.5">
                <p className={`${typography.panelBody} text-text-body`}>
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

/**
 * WHILE A BRIEF IS DRAFTING, THE BOARD SAYS SO, IN CORE'S WORDS (plan v3: the drafting state checked in a real browser; AI jobs, core API
 * v1.26, 8 Nov). Core accepts a brief at once and drafts it in the server; the View's `draft` carries the job's state. The empty board shows
 * `draft.words` verbatim (the stage while it runs, "Reading the brief" → "Building the model" → "Running the analysis and guidance"; the
 * plain reason when it failed or was lost), announced as a status, with the seconds since the brief was ACCEPTED (core's `started`, so a
 * reload or another device counts from the same moment; a line that never moves reads as stuck, PL 4 Nov). Nothing streams, nothing is
 * estimated, and no word here is the page's own but the Try again control. A failed or lost draft offers Try again: a new attempt on the
 * saved brief (a new op); so does a stopped one, whose words core says ('You stopped this draft…'). While it drafts, its author sees core's
 * Stop (`draft.stop`, label and hover verbatim; core API v1.34): it stops the job and the View is read again. The poller reads the View about every 1.5 s while it drafts (poll.ts).
 *
 * BEFORE ANY MODEL, THE BOARD OFFERS TO BUILD ONE, IN CORE'S WORDS (UI lead finding and DL GO, 17 Nov 23:42:40Z; Codex's journey named it
 * too): a scenario started in words left the canvas completely empty while the panel held the whole answer, and core's offer to build a
 * model sat only inside the "more" menu. Where core sends that offer (`build_model`, ViewChat.buildOfferOf) and nothing is drafting, the
 * empty board draws it: core's label as its one press (the same write as the menu's row, ViewChat.buildModel) and core's own line for it
 * under the press. No sentence here is the page's. The press starts a draft, and the drafting state above takes the board.
 */
import { HoverButton } from './look/Hover'
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { Button } from '../components/ui/Button'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'
import { ThinkingIndicator } from '../canvas/conversation/zones/ThinkingIndicator'
import { boardKindsOf } from './boardKindsOf'
import { useBesideZoom } from './BelowCue'
import { buildModel, buildOfferOf, stopDraft, tryAgain, useViewChat } from './ViewChat'
import { OkIcon } from './look/icons'
import { useViewStore } from './store'
import { retryFirstDraw, useFirstDraw } from './canvas'
import type { View } from './client'
import { EARLY_FAILED, earlyOf } from './early'
import { EarlyAnswer } from './EarlyAnswer'

type Draft = NonNullable<View['draft']>

/** The board shows a first draft that is running, or one that failed, was lost or was stopped before any model or proposal exists. */
export const boardDraftOf = (view: View | null): Draft | null => {
  const d = view?.draft ?? null
  if (d === null || view === null || view.version !== null || view.proposal !== null || typeof d.words !== 'string') return null
  return d.status === 'drafting' || d.status === 'failed' || d.status === 'lost' || d.status === 'stopped' ? d : null
}

/** Core's offer to build a model, where the board has nothing else to say: no model, no proposal and no draft, on the latest (never a past version). */
export const boardOfferOf = (view: View | null): { label: string; title: string } | null =>
  view === null || view.version !== null || view.proposal !== null || view.draft != null || (view.model?.cards.length ?? 0) > 0 ? null : buildOfferOf(view)

/** The board's width beside the dock: the dock's measured inset, kept current on resize. */
function useDockInset(): number {
  const [right, setRight] = useState(0)
  useLayoutEffect(() => { const measure = () => setRight(measureDockInset()); measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])
  return right
}

/** `secondary`: kept ideas lead the central workspace (no model yet), so the board's card shrinks to a small control at the foot, never over the idea cards. */
export function DraftingBoard({ secondary = false }: { secondary?: boolean } = {}): JSX.Element | null {
  const draft = useViewStore((s) => (s.at === null ? boardDraftOf(s.view) : null))
  // Two plain strings, so the selector hands back the same value while core's offer is unchanged.
  const label = useViewStore((s) => (s.at === null ? boardOfferOf(s.view)?.label ?? null : null))
  const title = useViewStore((s) => (s.at === null ? boardOfferOf(s.view)?.title ?? null : null))
  return draft !== null ? <Drafting draft={draft} secondary={secondary} /> : label === null ? null : <BuildOffer offer={{ label, title: title ?? '' }} secondary={secondary} />
}

/** The canvas's own words while a model's first layout runs, or if it threw (chrome, never words about the model). */
export const LAYING_WORDS = { laying: 'Drawing the model…', failed: 'The model could not be drawn.', again: 'Try again' } as const

/** A model whose cards are not on the canvas yet: the board says it is drawing them (021: never a blank canvas under the lens bar). */
export function LayingBoard(): JSX.Element | null {
  const state = useFirstDraw((s) => s.state), right = useDockInset()
  if (state === 'idle') return null
  return (
    <div className={WRAP} style={{ '--board-dock-inset': `${right}px` } as CSSProperties} data-testid="view-laying-board" data-state={state}>
      <div role="status" aria-live="polite" className="pointer-events-auto grid justify-items-center gap-2 rounded-lg border border-panel-border bg-panel px-6 py-5 text-center shadow-sm">
        <p className={`${typography.panelHeader} flex items-center justify-center gap-2 text-text-header`}>
          {state === 'laying' ? <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" /> : null}
          {state === 'laying' ? LAYING_WORDS.laying : LAYING_WORDS.failed}
        </p>
        {state === 'failed' ? <button type="button" data-testid="view-laying-again" onClick={retryFirstDraw}
          className="min-h-[44px] rounded-md border border-panel-border px-4 text-text-header hover:bg-panel-hover">{LAYING_WORDS.again}</button> : null}
      </div>
    </div>
  )
}

const WRAP = 'pointer-events-none fixed inset-y-0 left-0 right-[var(--board-dock-inset)] z-[5] flex items-center justify-center px-6'
/** Secondary: beside the zoom row and above the foot cues' row (BelowCue stands at 40 px, 36 tall), never under the viewport controls. */
const WRAP_SECONDARY = 'pointer-events-none fixed bottom-[88px] left-[var(--board-prompt-left)] right-[var(--board-dock-inset)] z-[5] flex items-end justify-start'

function BuildOffer({ offer, secondary }: { offer: { label: string; title: string }; secondary: boolean }): JSX.Element {
  const busy = useViewChat((s) => s.busy), right = useDockInset(), left = useBesideZoom()
  return (
    <div className={secondary ? WRAP_SECONDARY : WRAP} style={{ '--board-prompt-left': secondary ? `${left}px` : undefined, '--board-dock-inset': `${right}px` } as CSSProperties} data-testid="view-build-board" data-secondary={secondary ? '' : undefined}>
      <div className={secondary ? 'pointer-events-auto grid max-w-[320px] justify-items-start gap-1 rounded-lg border border-panel-border bg-panel px-3 py-2 text-left' : 'pointer-events-auto grid max-w-[420px] justify-items-center gap-2 rounded-lg border border-panel-border bg-panel px-6 py-5 text-center shadow-sm'}>
        <Button size="sm" disabled={busy} data-view="build_model.label" data-testid="view-build-board-go" onClick={() => void buildModel()}>{offer.label}</Button>
        {offer.title === '' ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-view="build_model.title" data-testid="view-build-board-title">{offer.title}</p>}
      </div>
    </div>
  )
}

function Drafting({ draft, secondary }: { draft: Draft; secondary: boolean }): JSX.Element {
  const view = useViewStore((s) => s.view)
  const brief = view?.brief ?? null
  const running = draft.status === 'drafting'
  const busy = useViewChat((s) => s.busy)
  const [now, setNow] = useState(() => Date.now())
  const right = useDockInset(), left = useBesideZoom()
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running])
  const early = earlyOf(draft)
  const from = draft.started === undefined ? Number.NaN : Date.parse(draft.started)
  const s = Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 1000)) : null
  return (
    <div className={secondary ? WRAP_SECONDARY : WRAP} style={{ '--board-prompt-left': secondary ? `${left}px` : undefined, '--board-dock-inset': `${right}px` } as CSSProperties} data-testid="view-drafting-board" data-draft={draft.status} data-secondary={secondary ? '' : undefined}>
      <div role="status" aria-live="polite" className={`pointer-events-auto space-y-2 rounded-lg border border-panel-border bg-panel px-6 py-5 text-center shadow-sm ${secondary ? 'max-h-[40vh] max-w-[360px] overflow-y-auto' : early === null ? 'max-w-[420px]' : 'max-h-[80vh] max-w-[560px] overflow-y-auto'}`}>
        <p className={`${typography.panelHeader} flex items-center justify-center gap-2 text-text-header`}>
          {running ? <span aria-hidden="true" data-testid="view-drafting-loader"><ThinkingIndicator kinds={boardKindsOf(view)} /></span> : null}
          <span data-view="draft.words" data-testid="view-drafting-words">{draft.words}</span>
        </p>
        {early === null ? null : <EarlyAnswer text={early} testid="view-drafting-early" />}
        {early === null || running ? null : <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-drafting-early-failed">{EARLY_FAILED}</p>}
        {running
          ? (s === null && draft.stop == null ? null : (
            <div className="flex items-center justify-center gap-1">
              {s === null ? null : <p className={`${typography.viewPanelMeta} text-text-light tabular-nums`} aria-hidden="true" data-testid="view-drafting-seconds">{s} s</p>}
              {draft.stop == null ? null : (
                <HoverButton type="button" disabled={busy} words={draft.stop.title} aria-label={draft.stop.label} data-view="draft.stop.label" data-testid="view-drafting-stop" onClick={() => void stopDraft()}
                  className={VIEW_CHIP_CLASS}>
                  <OkIcon id="stop" size={14} decorative />{draft.stop.label}
                </HoverButton>
              )}
            </div>
          ))
          : <button type="button" disabled={busy} data-testid="view-drafting-again" onClick={() => void tryAgain()}
              className="min-h-[44px] rounded-md border border-panel-border px-4 text-text-header hover:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed">Try again</button>}
        {typeof brief !== 'string' || brief.trim() === '' ? null : <details className="text-left" data-testid="view-draft-brief"><summary className={`${typography.viewPanelMeta} cursor-pointer text-text-body`}>Your brief</summary><p className="max-h-[28vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{brief}</p></details>}
      </div>
    </div>
  )
}

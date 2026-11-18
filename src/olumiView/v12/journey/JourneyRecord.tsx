/**
 * The scenario's record on the olumi-core lane (`journey.ts` says what each line is and where it comes from), at the top of the history
 * panel the top bar's clock opens, above core's version list. Top: the cards that changed at the version shown, each one press to the card.
 * Then one rail, newest first, a dot per record (Olumi's in blue), one line each with core's time; each line is one press to the thing it
 * names: a commitment, outcome or disagreement opens the Team tab, a piece of evidence opens in it, a kept idea is put in front on the
 * canvas. At rest the newest few; the rest behind one press. No boxes, no paragraphs. Every press closes the panel (`onDone`), so the
 * person sees what it opened.
 */
import { useMemo, useState } from 'react'
import { typography } from '../../../styles/typography'
import { useUIStore } from '../../../stores/uiStore'
import { useViewStore } from '../../store'
import type { View } from '../../types'
import { AT_REST, JOURNEY_WORDS, journeyOf, type JourneyEntry, type JourneyTarget } from './journey'

const BODY = `${typography.viewPanelBody} text-text-body m-0`
const META = `${typography.viewPanelMeta} text-text-light m-0`
const HEAD = `${typography.viewPanelHeading} text-text-header m-0`
const ROW = 'flex w-full min-w-0 items-baseline gap-2 rounded-sm text-left hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40'
const CHIP = `${typography.viewPanelMeta} max-w-full truncate rounded-full border px-2 hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40`

/** When a record happened, as the version history writes a time (`olumiCore/versions.tsx` `when`). */
export const journeyWhen = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** One press on a line: the thing it names. The canvas focus and the reveal store are loaded on the press (see below). */
export async function go(target: JourneyTarget): Promise<void> {
  if (target.kind === 'card') { (await import('../../../canvas/utils/focusHelpers')).focusNodeById(target.id); return }
  if (target.kind === 'olumi') { useUIStore.getState().forceActivateOutputTab('olumi'); return }
  // A piece of evidence opens in the Team tab as its chip opens it (`RevealMarks.openEvidence`); nothing opens there while an earlier
  // version is drawn. The reveal store and the canvas focus are imported on the press, never at load: a static import of the reveal
  // store's graph (it reads `olumiView/layout.ts`) put layout's CARD_WIDTH in the dock's load order before it was set ("Cannot access …
  // before initialization", picture run 1), and this module is loaded by the top bar's history panel, early in the page.
  if (target.kind === 'evidence') {
    if (useViewStore.getState().at !== null) return
    const { useReveal } = await import('../../reveal')
    useReveal.getState().selectEvidence(target.id)
  }
  useUIStore.getState().forceActivateOutputTab('team')
}

function Entry({ e, press }: { e: JourneyEntry; press: (t: JourneyTarget) => void }): JSX.Element {
  return (
    <li className="relative pl-3" data-testid={`journey-entry-${e.key}`} data-kind={e.kind}>
      <span aria-hidden="true" className={`absolute -left-[3px] top-[6px] h-1.5 w-1.5 rounded-full ${e.kind === 'kept' ? 'bg-info' : 'bg-text-light'}`} />
      <button type="button" className={ROW} onClick={() => press(e.target)} data-testid={`journey-go-${e.key}`}>
        <span className={`${BODY} min-w-0 flex-1 truncate`}>{e.line}</span>
        <span className={`${META} shrink-0 whitespace-nowrap`}>{journeyWhen(e.at)}</span>
      </button>
      {e.detail !== null && e.detail !== '' && <p className={`${META} truncate`} title={e.detail} data-testid={`journey-detail-${e.key}`}>{e.detail}</p>}
    </li>
  )
}

export function JourneyRecord({ view, onDone }: { view: View; onDone?: () => void }): JSX.Element | null {
  const j = useMemo(() => journeyOf(view), [view])
  const [all, setAll] = useState(false)
  const press = (t: JourneyTarget) => { void go(t); onDone?.() }
  if (j.changed === null && j.entries.length === 0 && j.views === null && !j.pending) return null
  const shown = all ? j.entries : j.entries.slice(0, AT_REST)
  return (
    <section className="grid gap-3 pb-4" aria-label={JOURNEY_WORDS.heading} data-testid="journey-record">
      <p className={HEAD}>{JOURNEY_WORDS.heading}</p>
      {j.pending && (
        <button type="button" className={`${META} ${ROW} text-info`} onClick={() => press({ kind: 'olumi' })} data-testid="journey-pending">{JOURNEY_WORDS.pending}</button>
      )}
      {j.changed !== null && (
        <div className="flex flex-wrap items-center gap-1" data-testid="journey-changed">
          <span className={META}>{JOURNEY_WORDS.changed(j.changed.n)}</span>
          {j.changed.cards.map((c) => (
            <button key={c.id} type="button" onClick={() => press({ kind: 'card', id: c.id })} data-testid={`journey-card-${c.id}`} data-olumi={c.olumi ? 'true' : undefined}
              className={`${CHIP} ${c.olumi ? 'border-info/40 text-info' : 'border-panel-border text-text-body'}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {j.entries.length > 0 && (
        <ol className="m-0 ml-1 grid list-none gap-2 border-l border-panel-border p-0" data-testid="journey-rail">
          {shown.map((e) => <Entry key={e.key} e={e} press={press} />)}
        </ol>
      )}
      {j.entries.length > AT_REST && (
        <button type="button" className={`${META} justify-self-start underline underline-offset-2 hover:text-text-header`} onClick={() => setAll((x) => !x)} data-testid="journey-all">
          {all ? JOURNEY_WORDS.showFewer : JOURNEY_WORDS.showAll(j.entries.length)}
        </button>
      )}
      {j.views !== null && (
        <button type="button" className={`${META} ${ROW} hover:text-text-header`} onClick={() => press({ kind: 'team' })} data-testid="journey-views">{j.views.line}</button>
      )}
      <p className={`${HEAD} pt-2`} data-testid="journey-versions-heading">{JOURNEY_WORDS.versions}</p>
    </section>
  )
}

/** The history panel's mount on the lane: the View held, or nothing while none has been read. */
export function JourneyRecordBlock({ onDone }: { onDone?: () => void }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  return view === null ? null : <JourneyRecord view={view} onDone={onDone} />
}

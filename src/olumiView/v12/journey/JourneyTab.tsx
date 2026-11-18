/**
 * The Journey tab's body on the olumi-core lane (`journey.ts` says what each line is and where it comes from). Top: the version the canvas
 * is of and who approved it. Then one rail, newest first, a dot per record, one line each with core's time; each line is one press to
 * the thing it names: a version is drawn on the canvas, a changed card is put in front, a commitment, outcome or disagreement opens the
 * Team tab, a piece of evidence opens in it. At rest the newest few; the rest behind one press. No boxes, no paragraphs.
 */
import { useEffect, useMemo, useState } from 'react'
import { typography } from '../../../styles/typography'
import { Button } from '../../../components/ui/Button'
import { useUIStore } from '../../../stores/uiStore'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { call } from '../../../olumiCore/team/api'
import { useViewStore } from '../../store'
import type { View } from '../../types'
import { AT_REST, JOURNEY_WORDS, journeyOf, type JourneyEntry, type JourneyTarget, type StoredVersion } from './journey'

const BODY = `${typography.viewPanelBody} text-text-body m-0`
const META = `${typography.viewPanelMeta} text-text-light m-0`
const HEAD = `${typography.viewPanelHeading} text-text-header m-0`
const ROW = 'flex w-full min-w-0 items-baseline gap-2 rounded-sm text-left hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40'

/** When a record happened, as the version history writes a time (`olumiCore/versions.tsx` `when`). */
export const journeyWhen = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** One press on a line: the thing it names. Async only for evidence, whose store is loaded on the press (see below). */
export async function go(target: JourneyTarget): Promise<void> {
  if (target.kind === 'version') { void useViewStore.getState().look(target.latest ? null : target.n); return }
  if (target.kind === 'card') { focusNodeById(target.id); return }
  if (target.kind === 'olumi') { useUIStore.getState().forceActivateOutputTab('olumi'); return }
  // A piece of evidence opens in the Team tab as its chip opens it (`RevealMarks.openEvidence`); nothing opens there while an earlier
  // version is drawn. The reveal store is imported on the press, never at load: a static import here (it reads `olumiView/layout.ts`)
  // put layout's CARD_WIDTH in the dock's load order before it was set ("Cannot access … before initialization", picture run 1).
  if (target.kind === 'evidence') {
    if (useViewStore.getState().at !== null) return
    const { useReveal } = await import('../../reveal')
    useReveal.getState().selectEvidence(target.id)
  }
  useUIStore.getState().forceActivateOutputTab('team')
}

/** Core's stored versions for this scenario, read again whenever the View's version moves. Null until answered, or when the read fails. */
function useStoredVersions(sid: string | null, n: number | null): readonly StoredVersion[] | null {
  const [versions, setVersions] = useState<readonly StoredVersion[] | null>(null)
  useEffect(() => {
    if (sid === null || n === null) { setVersions(null); return }
    let live = true
    call<{ versions: StoredVersion[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
      .then((r) => { if (live) setVersions(r.versions) })
      .catch(() => { if (live) setVersions(null) })
    return () => { live = false }
  }, [sid, n])
  return versions
}

function Entry({ e, drawn }: { e: JourneyEntry; drawn: number | null }): JSX.Element {
  const onCanvas = e.target.kind === 'version' && e.target.n === drawn
  return (
    <li className="relative pl-3" data-testid={`journey-entry-${e.key}`} data-kind={e.kind}>
      <span aria-hidden="true" className={`absolute -left-[3px] top-[6px] h-1.5 w-1.5 rounded-full ${onCanvas ? 'bg-success' : e.kind === 'kept' ? 'bg-info' : 'bg-text-light'}`} />
      <button type="button" className={ROW} onClick={() => void go(e.target)} data-testid={`journey-go-${e.key}`}>
        <span className={`${onCanvas ? HEAD : BODY} min-w-0 flex-1 truncate`}>{e.line}</span>
        <span className={`${META} shrink-0 whitespace-nowrap`}>{onCanvas ? JOURNEY_WORDS.latest : journeyWhen(e.at)}</span>
      </button>
      {e.detail !== null && e.detail !== '' && <p className={`${META} truncate`} title={e.detail} data-testid={`journey-detail-${e.key}`}>{e.detail}</p>}
      {e.changed.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1" data-testid={`journey-changed-${e.key}`}>
          <span className={META}>{JOURNEY_WORDS.changed}</span>
          {e.changed.map((c) => (
            <button key={c.id} type="button" onClick={() => focusNodeById(c.id)} data-testid={`journey-card-${c.id}`} data-olumi={c.olumi ? 'true' : undefined}
              className={`${typography.viewPanelMeta} max-w-full truncate rounded-full border px-2 hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 ${c.olumi ? 'border-info/40 text-info' : 'border-panel-border text-text-body'}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

export function JourneyTab({ view, sid, at }: { view: View; sid: string | null; at: number | null }): JSX.Element {
  const versions = useStoredVersions(sid, view.version?.n ?? null)
  const j = useMemo(() => journeyOf(view, versions), [view, versions])
  const [all, setAll] = useState(false)
  if (j.where === null) return <p className={BODY} data-testid="journey-none">{JOURNEY_WORDS.none}</p>
  const latest = j.entries.find((e) => e.target.kind === 'version' && e.target.latest)
  const drawn = at ?? (latest?.target.kind === 'version' ? latest.target.n : j.where.n)
  const shown = all ? j.entries : j.entries.slice(0, AT_REST)
  return (
    <section className="grid gap-3" aria-label={JOURNEY_WORDS.heading} data-testid="journey-lane">
      <div className="grid gap-1" data-testid="journey-where">
        <p className={HEAD}>{JOURNEY_WORDS.where(j.where.n, j.where.by)}</p>
        {j.where.at !== null && <p className={META}>{journeyWhen(j.where.at)}</p>}
        {j.pending && at === null && (
          <button type="button" className={`${META} ${ROW} text-info`} onClick={() => void go({ kind: 'olumi' })} data-testid="journey-pending">{JOURNEY_WORDS.pending}</button>
        )}
        {at !== null && (
          <div className="flex flex-wrap items-center gap-2" data-testid="journey-earlier">
            <p className={META}>{JOURNEY_WORDS.earlier(at)}</p>
            <Button size="sm" variant="secondary" data-testid="journey-back" onClick={() => void useViewStore.getState().look(null)}>{JOURNEY_WORDS.back}</Button>
          </div>
        )}
      </div>
      <ol className="m-0 ml-1 grid list-none gap-2 border-l border-panel-border p-0" data-testid="journey-rail">
        {shown.map((e) => <Entry key={e.key} e={e} drawn={drawn} />)}
      </ol>
      {j.entries.length > AT_REST && (
        <button type="button" className={`${META} justify-self-start underline underline-offset-2 hover:text-text-header`} onClick={() => setAll((x) => !x)} data-testid="journey-all">
          {all ? JOURNEY_WORDS.showFewer : JOURNEY_WORDS.showAll(j.entries.length)}
        </button>
      )}
      {j.counts.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" data-testid="journey-counts">
          {j.counts.map((c) => (
            <li key={c.key} data-testid={`journey-count-${c.key}`}>
              <button type="button" className={`${META} ${ROW} hover:text-text-header`} onClick={() => void go(c.target)}>{c.line}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The dock's mount on the lane: the View held, or nothing while none has been read. */
export function JourneyTabBlock(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const at = useViewStore((s) => s.at)
  return view === null ? null : <JourneyTab view={view} sid={sid} at={at} />
}

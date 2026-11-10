import { Fragment, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { useViewStore } from '../olumiView/store'
import { call, TeamApiError } from './team/api'
import { BODY, CARD, ERR, H, META } from './team/ui'
import { typography } from '../styles/typography'
import { CompareWithScenario } from './scenarioCompare'
import { markOf, ShiftTrack, TrackKey } from './compareTrack'
import { CompareSections } from './compareSections'

/**
 * TWO APPROVED VERSIONS, AS CORE COMPARES THEM (olumi-core API.md v1.7, "Comparing two versions"): core's read-only
 * `GET /api/scenarios/:s/compare` (no Run, no AI call). Who proposed and approved each version, the change lines between the two models
 * and how each saved result moved, every word and mark core's; nothing is computed here. One module for the dock's Compare tab, the
 * version history panel and the Team tab.
 */
/** `chance` (core wip/compare, 7 Nov): core's own number behind the value (0 to 1), which places the shift track's mark. */
type Side = { value: string; title: string; olumi: { glyph: string; title: string } | null; chance?: number | null
  /** Core's headline and the card's short companion line (core wip/compare ff3622bb); an older core: the value alone. */
  headline?: string; companion?: { text: string; title: string } | null }
const headOf = (s: Side) => (typeof s.headline === 'string' && s.headline.trim() !== '' ? s.headline : s.value)
/** `label` and `move_text` (core wip/compare, 7 Nov): core's own words for what the result is about and how it moved. */
export type Move = { kind: 'chance' | 'limit' | 'most_likely'; option: string | null; optionLabel: string | null; aim: string; condition: string | null
  before: Side | null; after: Side | null; move: 'up' | 'down' | 'changed' | 'unchanged' | 'new' | 'gone'; label?: string; move_text?: string }
/** `who` (core wip/compare, 7 Nov): core's own words for who proposed and approved the version. */
export type Compared = { versions: { n: number; at: string; proposedBy: string | null; briefBy: string | null; approvedBy: string; who?: string }[]
  changes: { text: string; detail: string; mark: { glyph: string; title: string } | null }[]; results: Move[] }

/**
 * Core's own words for a move, for what a result is about and for who proposed and approved a version (`move_text`, `label`, `who`: core
 * wip/compare, 7 Nov, from its page's review.ts). Drawn verbatim. Only a core that predates those fields gets the page's same words built here
 * (the fallback below, the old path), so an older serving core still reads.
 */
const MOVE_BEFORE_CORE_WORDS: Record<Move['move'], string> = { up: 'up', down: 'down', changed: 'changed', unchanged: 'unchanged', new: 'new', gone: 'no longer worked out' }
const moveWords = (r: Move) => r.move_text ?? MOVE_BEFORE_CORE_WORDS[r.move]
export const what = (r: Move) => r.label ?? (r.kind === 'most_likely' ? `Most likely to achieve ‘${r.aim}’${r.condition ?? ''}` : `‘${r.optionLabel ?? r.option ?? ''}’ ${r.kind === 'limit' ? 'within' : 'on'} ‘${r.aim}’`)
export const whoOf = (v: Compared['versions'][number]) => v.who ?? `proposed by ${v.proposedBy ?? 'unknown'}${v.briefBy ? `, from ${v.briefBy}'s brief` : ''} · approved by ${v.approvedBy}`

export function SideText({ s }: { s: Side | null }) {
  if (s === null) return <span className="text-text-light">none</span>
  const own = headOf(s) !== s.value && s.companion ? s.companion : null
  return <><span title={s.title}>{headOf(s)}</span>{s.olumi ? <> <span title={s.olumi.title} aria-label={s.olumi.title}>{s.olumi.glyph}</span></> : null}{own ? <> <span className="text-text-light" title={own.title} data-compare-companion="">({own.text})</span></> : null}</>
}

/** One change line as core's change card writes it: its text, how it moved, and Olumi's mark with core's hover. */
export function ChangeItem({ l }: { l: Compared['changes'][number] }): JSX.Element {
  return <li className={BODY}>{l.text}{l.detail ? <> <span className="text-text-light whitespace-pre-line">{l.detail}</span></> : null}{l.mark ? <> <span title={l.mark.title} aria-label={l.mark.title}>{l.mark.glyph}</span></> : null}</li>
}

/** The comparison as core read it, in three short lists. `id` prefixes each list's test id, one per surface; `who: false` leaves out the
 *  first list where the surface names the version's people itself (the version history's record). */
export function ComparedLists({ c, id = 'team-compare', who = true, boxed = false }: { c: Compared; id?: string; who?: boolean; boxed?: boolean }): JSX.Element {
  // The dock's Compare tab (`boxed`): the previous product's Compare layout over core's comparison (A4, compareSections.tsx). The Team tab's and the
  // version history's inline lists below are unchanged.
  if (boxed) return <CompareSections c={c} />
  // The two marks are core's `before` and `after`, which core always reads from the lower version to the higher whatever order it was asked
  // in (core service.ts compare: [lo, hi]; pinned by its service.test 'compare(…, 3, 1) equals compare(…, 1, 3)'). Its `versions` list runs
  // from the one to the other in that same order, so the key is named from that list's ends, in core's order, never sorted here.
  const ends = [c.versions[0], c.versions[c.versions.length - 1]]
  const key = { first: ends[0] ? `Version ${ends[0].n}` : '', second: ends[1] ? `Version ${ends[1].n}` : '' }
  const list = (items: JSX.Element[], empty: string, part: string) => (items.length
    ? <ul className="m-0 grid list-none gap-1.5 p-0" data-testid={`${id}-${part}`}>{items}</ul>
    : <p className={META} data-testid={`${id}-${part}-none`}>{empty}</p>)
  // `boxed` (the dock's Compare tab, a whole panel of its own): each list in the panel's card under its heading (the dock's design language,
  // Paul's 6 Nov side-by-side). Inline (the Team tab's and the version history's, already inside their own sections): a heading line. The
  // words are the same either way.
  const part = (name: string, heading: string, body: JSX.Element) => (boxed
    ? <section className={CARD} data-compare-part={name} aria-label={heading}><h4 className={H}>{heading}</h4>{body}</section>
    : <Fragment key={name}><p className={`${BODY} text-text-header`}>{heading}</p>{body}</Fragment>)
  return (
    <div className="grid gap-2" data-testid={`${id}-out`}>
      {who && part('versions', 'Who proposed and approved',
        list(c.versions.map((v) => <li key={v.n} className={BODY}><span className="text-text-header">Version {v.n}:</span> {whoOf(v)}</li>), 'None', 'versions'))}
      {part('changes', 'What changed', list(c.changes.map((l, i) => <ChangeItem key={i} l={l} />), 'No change to the model', 'changes'))}
      {part('results', 'How the results moved', list(c.results.map((r, i) => (
        // What the result is about on its own line, then before → after and how it moved: one result, two short lines.
        <li key={i} className={`${BODY} grid`}><span className="text-text-header">{what(r)}:</span>{' '}<span><SideText s={r.before} /> → <SideText s={r.after} /> <span className="text-text-light">({moveWords(r)})</span></span>
          {/* The earlier DGAI's shift track: the earlier version hollow, the later filled, where core gives each its number. */}
          {r.kind !== 'most_likely' ? <ShiftTrack first={r.before ? markOf(r.before.chance, headOf(r.before)) : null} second={r.after ? markOf(r.after.chance, headOf(r.after)) : null} names={key} /> : null}
        </li>
      )), 'No results in either version', 'results'))}
      {c.results.some((r) => r.kind !== 'most_likely' && (markOf(r.before?.chance, '') || markOf(r.after?.chance, '')))
        ? <TrackKey first={key.first} second={key.second} /> : null}
    </div>
  )
}

/** The version pickers' compact field (the dock's measure: never the full-width answer field, which stacked two tall boxes). */
const PICK = `${typography.viewPanelBody} min-h-[28px] rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`

/**
 * Pick two of the scenario's `latest` versions and read core's comparison. `auto`: read the previous version against the latest at once
 * (the Compare tab, "previous against this"); otherwise only on Compare (the Team tab and the version history).
 */
export function CoreCompare({ sid, latest, id, auto = false, boxed = false }: { sid: string; latest: number; id: string; auto?: boolean; boxed?: boolean }): JSX.Element {
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [shown, setShown] = useState<Compared | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const f = from ?? latest - 1, t = to ?? latest
  const versions = Array.from({ length: latest }, (_, i) => i + 1)
  // Reads are numbered: an answer a newer read has overtaken (a slow pair after the auto-refresh's) is dropped whole, its busy and error
  // with it (R1 review 3).
  const seq = useRef(0)
  const go = async (a: number, b: number) => {
    const mine = ++seq.current
    if (a === b) { setBusy(false); setShown(null); setError('Pick two different versions.'); return }
    setBusy(true); setError(null)
    // Asked earlier first, as the pickers' labels say (UI audit item 1); core answers lower-to-higher either way.
    const [lo, hi] = a < b ? [a, b] : [b, a]
    try {
      const r = await call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${lo}&to=${hi}`)
      if (mine === seq.current) setShown(r)
    } catch (e) {
      if (mine === seq.current) { setShown(null); setError(e instanceof TeamApiError ? e.message : 'That did not go through.') }
    } finally { if (mine === seq.current) setBusy(false) }
  }
  // A new version (another member's approval) moves the default pair to the new latest, read again.
  useEffect(() => { if (auto) { setFrom(null); setTo(null); void go(latest - 1, latest) } }, [auto, sid, latest]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-2" data-testid={`${id}-picker`}>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Earlier version" data-testid={`${id}-from`} className={PICK} value={f} disabled={busy} onChange={(e) => setFrom(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <span className={BODY}>with</span>
        <select aria-label="Later version" data-testid={`${id}-to`} className={PICK} value={t} disabled={busy} onChange={(e) => setTo(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <Button size="sm" variant="secondary" data-testid={`${id}-go`} disabled={busy} onClick={() => void go(f, t)}>Compare</Button>
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${id}-error`}>{error}</p>}
      <div aria-live="polite">{shown ? <ComparedLists c={shown} id={id} boxed={boxed} /> : null}</div>
    </div>
  )
}

/**
 * The scenario's latest approved version: the View's own while it is the latest, else (an earlier version drawn from the history) the last
 * of core's stored versions (`GET /versions`), never the version drawn (R1 review 2). Undefined while that read is on its way.
 */
export function useLatestApproved(): number | null | undefined {
  const sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const own = useViewStore((s) => s.view?.version?.n ?? null)
  const [listed, setListed] = useState<{ key: string; n: number | null } | null>(null)
  const key = `${sid}:${at}`
  useEffect(() => {
    if (!sid || at === null) return
    let live = true
    call<{ versions: { n: number }[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
      .then((r) => { if (live) setListed({ key, n: r.versions.at(-1)?.n ?? null }) })
      .catch(() => { if (live) setListed({ key, n: null }) })
    return () => { live = false }
  }, [sid, at, key])
  if (at === null) return own
  return listed?.key === key ? listed.n : undefined
}

/**
 * The dock's Compare tab on the olumi-core lane: the previous approved version against the latest, as core compares them, and, beneath it,
 * "Compare with another scenario" (core's `GET /api/compare`, scenarioCompare.tsx). The second half needs only an open scenario, not two versions.
 */
export function CoreCompareTab(): JSX.Element {
  const sid = useViewStore((s) => s.sid)
  const latest = useLatestApproved()
  if (sid && latest === undefined) return <div data-testid="core-compare-tab" className="mx-auto grid w-full max-w-[440px] gap-3 px-3 py-3 pb-6"><p className={META} data-testid="core-compare-loading">Reading the versions…</p></div>
  return (
    // The Compare row pads itself (`padding: 'self'` in the shell contract): the shell's own measure, as the Team tab gets it.
    <div data-testid="core-compare-tab" className="mx-auto grid w-full max-w-[440px] gap-3 px-3 py-3 pb-6">
      {!sid || latest === null || latest === undefined
        ? <p className={BODY} data-testid="core-compare-none">Start a model in the chat first. Compare reads the versions you approve.</p>
        : latest < 2
          ? <p className={BODY} data-testid="core-compare-one">Compare needs two approved versions. Approve a change to the model to make the second.</p>
          : <CoreCompare sid={sid} latest={latest} id="core-compare" auto boxed />}
      {sid ? <CompareWithScenario sid={sid} /> : null}
    </div>
  )
}

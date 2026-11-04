import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { useViewStore } from '../olumiView/store'
import { call, TeamApiError } from './team/api'
import { BODY, ERR, FIELD, META } from './team/ui'

/**
 * TWO APPROVED VERSIONS, AS CORE COMPARES THEM (olumi-core API.md v1.7, "Comparing two versions"): core's read-only
 * `GET /api/scenarios/:s/compare` (no Run, no AI call). Who proposed and approved each version, the change lines between the two models
 * and how each saved result moved, every word and mark core's; nothing is computed here. One module for the dock's Compare tab, the
 * version history panel and the Team tab.
 */
type Side = { value: string; title: string; olumi: { glyph: string; title: string } | null }
export type Move = { kind: 'chance' | 'limit' | 'most_likely'; option: string | null; optionLabel: string | null; aim: string; condition: string | null
  before: Side | null; after: Side | null; move: 'up' | 'down' | 'changed' | 'unchanged' | 'new' | 'gone' }
export type Compared = { versions: { n: number; at: string; proposedBy: string | null; briefBy: string | null; approvedBy: string }[]
  changes: { text: string; detail: string; mark: { glyph: string; title: string } | null }[]; results: Move[] }

/** Core's page's words for a move (olumi-core src/page/review.ts MOVE), and for what a result is about. */
const MOVE: Record<Move['move'], string> = { up: 'up', down: 'down', changed: 'changed', unchanged: 'unchanged', new: 'new', gone: 'no longer worked out' }
export const what = (r: Move) => (r.kind === 'most_likely' ? `Most likely to achieve ‘${r.aim}’${r.condition ?? ''}` : `‘${r.optionLabel ?? r.option ?? ''}’ ${r.kind === 'limit' ? 'within' : 'on'} ‘${r.aim}’`)

/** Who proposed and approved one version, in /record's words (olumi-core record-page.ts). */
export const whoOf = (v: Compared['versions'][number]) => `proposed by ${v.proposedBy ?? 'unknown'}${v.briefBy ? `, from ${v.briefBy}'s brief` : ''} · approved by ${v.approvedBy}`

export function SideText({ s }: { s: Side | null }) {
  if (s === null) return <span className="text-text-light">none</span>
  return <><span title={s.title}>{s.value}</span>{s.olumi ? <> <span title={s.olumi.title} aria-label={s.olumi.title}>{s.olumi.glyph}</span></> : null}</>
}

/** One change line as core's change card writes it: its text, how it moved, and Olumi's mark with core's hover. */
export function ChangeItem({ l }: { l: Compared['changes'][number] }): JSX.Element {
  return <li className={BODY}>{l.text}{l.detail ? <> <span className="text-text-light whitespace-pre-line">{l.detail}</span></> : null}{l.mark ? <> <span title={l.mark.title} aria-label={l.mark.title}>{l.mark.glyph}</span></> : null}</li>
}

/** The comparison as core read it, in three short lists. `id` prefixes each list's test id, one per surface; `who: false` leaves out the
 *  first list where the surface names the version's people itself (the version history's record). */
export function ComparedLists({ c, id = 'team-compare', who = true }: { c: Compared; id?: string; who?: boolean }): JSX.Element {
  const list = (items: JSX.Element[], empty: string, part: string) => (items.length
    ? <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${id}-${part}`}>{items}</ul>
    : <p className={META} data-testid={`${id}-${part}-none`}>{empty}</p>)
  return (
    <div className="grid gap-2" data-testid={`${id}-out`}>
      {who && <>
        <p className={`${BODY} text-text-header`}>Who proposed and approved</p>
        {list(c.versions.map((v) => <li key={v.n} className={BODY}>Version {v.n}: {whoOf(v)}</li>), 'None', 'versions')}
      </>}
      <p className={`${BODY} text-text-header`}>What changed</p>
      {list(c.changes.map((l, i) => <ChangeItem key={i} l={l} />), 'No change to the model', 'changes')}
      <p className={`${BODY} text-text-header`}>How the results moved</p>
      {list(c.results.map((r, i) => <li key={i} className={BODY}>{what(r)}: <SideText s={r.before} /> → <SideText s={r.after} /> <span className="text-text-light">({MOVE[r.move]})</span></li>), 'No results in either version', 'results')}
    </div>
  )
}

/**
 * Pick two of the scenario's `latest` versions and read core's comparison. `auto`: read the previous version against the latest at once
 * (the Compare tab, "previous against this"); otherwise only on Compare (the Team tab and the version history).
 */
export function CoreCompare({ sid, latest, id, auto = false }: { sid: string; latest: number; id: string; auto?: boolean }): JSX.Element {
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
    try {
      const r = await call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${a}&to=${b}`)
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
        <select aria-label="Earlier version" data-testid={`${id}-from`} className={`${FIELD} w-auto`} value={f} disabled={busy} onChange={(e) => setFrom(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <span className={BODY}>with</span>
        <select aria-label="Later version" data-testid={`${id}-to`} className={`${FIELD} w-auto`} value={t} disabled={busy} onChange={(e) => setTo(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <Button size="sm" variant="secondary" data-testid={`${id}-go`} disabled={busy} onClick={() => void go(f, t)}>Compare</Button>
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${id}-error`}>{error}</p>}
      <div aria-live="polite">{shown ? <ComparedLists c={shown} id={id} /> : null}</div>
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

/** The dock's Compare tab on the olumi-core lane: the previous approved version against the latest, as core compares them. */
export function CoreCompareTab(): JSX.Element {
  const sid = useViewStore((s) => s.sid)
  const latest = useLatestApproved()
  if (sid && latest === undefined) return <div data-testid="core-compare-tab" className="grid gap-3 px-3 py-3 pb-6"><p className={META} data-testid="core-compare-loading">Reading the versions…</p></div>
  return (
    // The Compare row pads itself (`padding: 'self'` in the shell contract): the shell's own measure, as the Team tab gets it.
    <div data-testid="core-compare-tab" className="grid gap-3 px-3 py-3 pb-6">
      {!sid || latest === null || latest === undefined
        ? <p className={BODY} data-testid="core-compare-none">Start a model in the chat first. Compare reads the versions you approve.</p>
        : latest < 2
          ? <p className={BODY} data-testid="core-compare-one">Compare needs two approved versions. Approve a change to the model to make the second.</p>
          : <CoreCompare sid={sid} latest={latest} id="core-compare" auto />}
    </div>
  )
}

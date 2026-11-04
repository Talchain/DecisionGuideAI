import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'
import { BODY, ERR, FIELD, H, META } from './ui'

/** The wire shape of core's `GET /api/scenarios/:s/compare` (olumi-core API.md v1.7, "Comparing two versions"). */
type Side = { value: string; title: string; olumi: { glyph: string; title: string } | null }
type Move = { kind: 'chance' | 'limit' | 'most_likely'; option: string | null; optionLabel: string | null; aim: string; condition: string | null
  before: Side | null; after: Side | null; move: 'up' | 'down' | 'changed' | 'unchanged' | 'new' | 'gone' }
export type Compared = { versions: { n: number; at: string; proposedBy: string | null; briefBy: string | null; approvedBy: string }[]
  changes: { text: string; detail: string; mark: { glyph: string; title: string } | null }[]; results: Move[] }

/** Core's page's words for a move (olumi-core src/page/review.ts MOVE), and for what a result is about. */
const MOVE: Record<Move['move'], string> = { up: 'up', down: 'down', changed: 'changed', unchanged: 'unchanged', new: 'new', gone: 'no longer worked out' }
const what = (r: Move) => (r.kind === 'most_likely' ? `Most likely to achieve ‘${r.aim}’${r.condition ?? ''}` : `‘${r.optionLabel ?? r.option ?? ''}’ ${r.kind === 'limit' ? 'within' : 'on'} ‘${r.aim}’`)

function SideText({ s }: { s: Side | null }) {
  if (s === null) return <span className="text-text-light">none</span>
  return <><span title={s.title}>{s.value}</span>{s.olumi ? <> <span title={s.olumi.title} aria-label={s.olumi.title}>{s.olumi.glyph}</span></> : null}</>
}

/** The comparison as core read it, in three short lists, every word core's. */
export function ComparedLists({ c }: { c: Compared }): JSX.Element {
  const list = (items: JSX.Element[], empty: string, id: string) => (items.length
    ? <ul className="m-0 grid list-none gap-1 p-0" data-testid={`team-compare-${id}`}>{items}</ul>
    : <p className={META} data-testid={`team-compare-${id}-none`}>{empty}</p>)
  return (
    <div className="grid gap-2" data-testid="team-compare-out">
      <p className={`${BODY} text-text-header`}>Who proposed and approved</p>
      {list(c.versions.map((v) => <li key={v.n} className={BODY}>Version {v.n}: proposed by {v.proposedBy ?? 'unknown'}{v.briefBy ? `, from ${v.briefBy}'s brief` : ''} · approved by {v.approvedBy}</li>), 'None', 'versions')}
      <p className={`${BODY} text-text-header`}>What changed</p>
      {list(c.changes.map((l, i) => <li key={i} className={BODY}>{l.text}{l.detail ? <> <span className="text-text-light whitespace-pre-line">{l.detail}</span></> : null}{l.mark ? <> <span title={l.mark.title} aria-label={l.mark.title}>{l.mark.glyph}</span></> : null}</li>), 'No change to the model', 'changes')}
      <p className={`${BODY} text-text-header`}>How the results moved</p>
      {list(c.results.map((r, i) => <li key={i} className={BODY}>{what(r)}: <SideText s={r.before} /> → <SideText s={r.after} /> <span className="text-text-light">({MOVE[r.move]})</span></li>), 'No results in either version', 'results')}
    </div>
  )
}

/**
 * THE TEAM'S RECORD AND HOW THE MODEL MOVED (PL review, 4 Nov: both already on core). Compare any two approved versions through core's
 * read-only compare route (no Run, no AI call), and open core's printable reasoning record. Nothing is computed here.
 */
export function ComparePanel({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  const latest = view.version?.n ?? null
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [shown, setShown] = useState<Compared | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (latest === null) return null
  const f = from ?? latest - 1, t = to ?? latest
  const versions = Array.from({ length: latest }, (_, i) => i + 1)
  const go = async () => {
    if (f === t) { setShown(null); setError('Pick two different versions.'); return }
    setBusy(true); setError(null)
    try { setShown(await call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${f}&to=${t}`)) } catch (e) {
      setShown(null); setError(e instanceof TeamApiError ? e.message : 'That did not go through.')
    } finally { setBusy(false) }
  }
  return (
    <section data-testid="team-review" aria-label="Record and versions" className="grid gap-2">
      <h3 className={H}>Record and versions</h3>
      <p className={META}>
        <a href={`/s/${encodeURIComponent(sid)}/record`} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2" data-testid="team-record-link">Printable record</a>
      </p>
      {latest < 2 ? null : (
        <details data-testid="team-compare">
          <summary className={BODY}>Compare versions</summary>
          <div className="mt-2 grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Earlier version" data-testid="team-compare-from" className={`${FIELD} w-auto`} value={f} disabled={busy} onChange={(e) => setFrom(Number(e.target.value))}>
                {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
              </select>
              <span className={BODY}>with</span>
              <select aria-label="Later version" data-testid="team-compare-to" className={`${FIELD} w-auto`} value={t} disabled={busy} onChange={(e) => setTo(Number(e.target.value))}>
                {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
              </select>
              <Button size="sm" variant="secondary" data-testid="team-compare-go" disabled={busy} onClick={() => void go()}>Compare</Button>
            </div>
            {error && <p role="alert" className={ERR} data-testid="team-compare-error">{error}</p>}
            <div aria-live="polite">{shown ? <ComparedLists c={shown} /> : null}</div>
          </div>
        </details>
      )}
    </section>
  )
}

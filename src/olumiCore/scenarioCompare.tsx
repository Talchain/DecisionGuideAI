import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { call, TeamApiError } from './team/api'
import { BODY, CARD, ERR, H, META } from './team/ui'
import { typography } from '../styles/typography'

/**
 * TWO OF THE PERSON'S SCENARIOS, SIDE BY SIDE (olumi-core API.md v1.15, `GET /api/compare?a=&b=`, `olumi.compare/1`): each scenario's latest
 * saved Run, a read of rows already saved (no Run, no AI call). Not version comparison (`compare.tsx`, the other half of this tab).
 *
 * Every label, measure, target, value, limitation and note is a ready-made string of core's and is drawn verbatim: nothing is formatted,
 * paired, ranked or composed here. The two sides are drawn side by side and never ordered or called better. An aim's `status` is an enum:
 * `comparable`, `different_target`, `not_comparable`, `only_a`, `only_b`; a status this page does not know is drawn as the aim's label,
 * its limitation if core gives one and its unpaired options, never as a pairing. A cell core marks as resting on Olumi's proposals carries
 * core's mark and its `lead` words. A limitation core says once on the aim, a figure or a side is not said again in the notes list.
 */
type Mark = { glyph: string; title: string }
type Cell = { value: string; title: string; olumi: Mark | null; lead: string | null; condition: string | null }
type Side = { id: string; title: string; name: string; note: string | null }
type AimSide = { label: string; measure: string; target: string | null }
type OptionSide = { cells: Cell[] }
type OptionRow = { label: string; only_in: 'a' | 'b' | null; only_in_text: string | null; a: OptionSide | null; b: OptionSide | null }
export type AimStatus = 'comparable' | 'different_target' | 'not_comparable' | 'only_a' | 'only_b'
type AimRow = { label: string; kind: 'aim' | 'limit'; status: AimStatus | string; limitation: string | null; only_in_text: string | null; a: AimSide | null; b: AimSide | null; options: OptionRow[] }
type FigureRow = { label: string; status: 'same' | 'differs' | 'only_a' | 'only_b' | string; a: { text: string; olumi: Mark | null } | null; b: { text: string; olumi: Mark | null } | null; only_in_text: string | null; limitation: string | null }
export type ScenarioComparison = { schema: string; a: Side; b: Side; aims: AimRow[]; differences: { options: { label: string; status: string; only_in_text: string | null }[]; figures: FigureRow[] }; limits: string[] }

const arr = <T,>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : [])
const words = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

function MarkSpan({ m }: { m: Mark | null }): JSX.Element | null {
  return m === null ? null : <><span title={m.title} aria-label={m.title}>{m.glyph}</span>{' '}</>
}

function Cells({ side }: { side: OptionSide | null }): JSX.Element {
  return (
    <div className="grid content-start gap-1 break-words" data-compare-cells="">
      {arr(side?.cells).map((c, i) => (
        <p key={i} className={`${BODY} grid gap-0.5`} title={c.title} data-compare-cell="">
          <span><MarkSpan m={c.olumi} /><span data-compare-value="">{c.value}</span></span>
          {c.olumi !== null && words(c.lead) ? <span className={META} data-compare-lead="">{c.lead}</span> : null}
          {words(c.condition) ? <span className={META} data-compare-condition="">{c.condition}</span> : null}
        </p>
      ))}
    </div>
  )
}

function AimSideWords({ s, target }: { s: AimSide | null; target: boolean }): JSX.Element {
  return (
    <div className="grid content-start gap-0.5 break-words" data-compare-aim-side="">
      {s === null ? null : <p className={META} data-compare-measure="">{s.measure}</p>}
      {s !== null && target && words(s.target) ? <p className={META} data-compare-target="">{s.target}</p> : null}
    </div>
  )
}

function Aim({ aim }: { aim: AimRow }): JSX.Element {
  const targets = aim.status === 'different_target'
  const paired = aim.status === 'comparable' || targets
  return (
    <section className={CARD} data-compare-aim={aim.status} aria-label={aim.label}>
      <h4 className={H}>{aim.label}</h4>
      {words(aim.only_in_text) ? <p className={META} data-compare-only-in="">{aim.only_in_text}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <AimSideWords s={aim.a} target={targets} />
        <AimSideWords s={aim.b} target={targets} />
      </div>
      {words(aim.limitation) ? <p className={`${BODY} break-words`} data-compare-limitation="">{aim.limitation}</p> : null}
      {arr(aim.options).map((o, i) => (
        <div key={`${o.label}-${i}`} className="grid gap-1" data-compare-option={paired && o.only_in === null ? 'paired' : 'alone'}>
          <p className={`${BODY} text-text-header break-words`}>{o.label}</p>
          {words(o.only_in_text) ? <p className={META} data-compare-only-in="">{o.only_in_text}</p> : null}
          <div className="grid grid-cols-2 gap-3"><Cells side={o.a} /><Cells side={o.b} /></div>
        </div>
      ))}
    </section>
  )
}

function Figures({ rows }: { rows: FigureRow[] }): JSX.Element | null {
  const shown = rows.filter((f) => f.status !== 'same')
  return shown.length === 0 ? null : (
    <>
      {shown.map((f, i) => (
        <div key={`${f.label}-${i}`} className="grid gap-1" data-compare-figure={f.status}>
          <p className={`${BODY} text-text-header break-words`}>{f.label}</p>
          {words(f.only_in_text) ? <p className={META} data-compare-only-in="">{f.only_in_text}</p> : null}
          <div className="grid grid-cols-2 gap-3 break-words">
            <p className={BODY}>{f.a === null ? null : <><MarkSpan m={f.a.olumi} />{f.a.text}</>}</p>
            <p className={BODY}>{f.b === null ? null : <><MarkSpan m={f.b.olumi} />{f.b.text}</>}</p>
          </div>
          {words(f.limitation) ? <p className={`${BODY} break-words`} data-compare-limitation="">{f.limitation}</p> : null}
        </div>
      ))}
    </>
  )
}

/** The comparison as core read it: the two names as column heads (with a side's note when it has no saved model or results), then each aim. */
export function ScenarioComparisonView({ c }: { c: ScenarioComparison }): JSX.Element {
  const aims = arr(c.aims), figures = arr(c.differences?.figures)
  // An option only one scenario has is said where its aim lists it; the Differences list adds only those no aim lists.
  const listed = new Set(aims.flatMap((a) => arr(a.options).map((o) => o.label)))
  const options = arr(c.differences?.options).filter((o) => o.status !== 'both' && !listed.has(o.label))
  // Every limitation core says on an aim, a figure or a side is drawn there; the notes list carries only what none of those did.
  const said = new Set<string>([c.a?.note, c.b?.note, ...aims.map((a) => a.limitation), ...figures.map((f) => f.limitation)].filter(words))
  const notes = arr(c.limits).filter((l) => !said.has(l))
  const showFigures = figures.some((f) => f.status !== 'same')
  return (
    <div className="grid gap-2" data-testid="scenario-compare-out">
      <div className="sticky top-0 z-10 grid grid-cols-2 gap-3 bg-panel py-1" data-testid="scenario-compare-heads">
        {[c.a, c.b].map((s, i) => (
          <div key={i} className="grid content-start gap-0.5 break-words" data-compare-side={i === 0 ? 'a' : 'b'}>
            <p className={`${H}`} data-compare-name="">{s?.name}</p>
            {words(s?.note) ? <p className={META} data-compare-note="">{s!.note}</p> : null}
          </div>
        ))}
      </div>
      {aims.map((a, i) => <Aim key={`${a.label}-${i}`} aim={a} />)}
      {options.length === 0 && !showFigures ? null : (
        <section className={CARD} data-testid="scenario-compare-differences" aria-label="Differences">
          <h4 className={H}>Differences</h4>
          {options.map((o, i) => <p key={`${o.label}-${i}`} className={`${BODY} break-words`} data-compare-diff-option={o.status}><span className="text-text-header">{o.label}</span>{words(o.only_in_text) ? <span className={META}>{`  ${o.only_in_text}`}</span> : null}</p>)}
          <Figures rows={figures} />
        </section>
      )}
      {notes.length === 0 ? null : (
        <section className={CARD} data-testid="scenario-compare-notes" aria-label="Notes">
          <h4 className={H}>Notes</h4>
          <ul className="m-0 grid list-none gap-1 p-0">{notes.map((l, i) => <li key={i} className={`${BODY} break-words`}>{l}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

const PICK = `${typography.panelBody} min-h-[28px] min-w-0 max-w-full rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`

/** The person's other scenarios (`GET /api/me` `scenarios[]`), read once; null while reading, [] when there is none. */
function useOtherScenarios(sid: string): { id: string; title: string }[] | null | 'error' {
  const [list, setList] = useState<{ id: string; title: string }[] | null | 'error'>(null)
  useEffect(() => {
    let live = true
    call<{ scenarios?: { id?: unknown; title?: unknown }[] }>('GET', '/api/me')
      .then((r) => { if (live) setList(arr(r?.scenarios).flatMap((s) => (typeof s?.id === 'string' && typeof s.title === 'string' && s.id !== sid ? [{ id: s.id, title: s.title }] : []))) })
      .catch(() => { if (live) setList('error') })
    return () => { live = false }
  }, [sid])
  return list
}

/** "Compare with another scenario": pick one of the person's other scenarios and read core's side-by-side of the two latest saved Runs. */
export function CompareWithScenario({ sid }: { sid: string }): JSX.Element {
  const others = useOtherScenarios(sid)
  const [picked, setPicked] = useState<string | null>(null)
  const [shown, setShown] = useState<ScenarioComparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const list = Array.isArray(others) ? others : []
  const pick = picked ?? list[0]?.id ?? ''
  const go = async () => {
    if (pick === '') return
    const mine = ++seq.current
    setBusy(true); setError(null)
    try {
      const r = await call<ScenarioComparison>('GET', `/api/compare?a=${encodeURIComponent(sid)}&b=${encodeURIComponent(pick)}`)
      if (mine === seq.current) setShown(r)
    } catch (e) {
      if (mine === seq.current) { setShown(null); setError(e instanceof TeamApiError ? e.message : 'That did not go through.') }
    } finally { if (mine === seq.current) setBusy(false) }
  }
  return (
    <section className="grid gap-2" data-testid="scenario-compare" aria-label="Compare with another scenario">
      <h3 className={H}>Compare with another scenario</h3>
      {others === null ? <p className={META} data-testid="scenario-compare-loading">Reading your scenarios…</p>
        : others === 'error' ? <p className={ERR} data-testid="scenario-compare-list-error">Your scenarios could not be read just now.</p>
        : list.length === 0 ? <p className={BODY} data-testid="scenario-compare-none">You have no other scenario to compare with yet.</p>
        : (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Scenario to compare with" data-testid="scenario-compare-pick" className={PICK} value={pick} disabled={busy} onChange={(e) => { setPicked(e.target.value); setShown(null); setError(null) }}>
              {list.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <Button size="sm" variant="secondary" data-testid="scenario-compare-go" disabled={busy} onClick={() => void go()}>Compare</Button>
          </div>
        )}
      {error && <p role="alert" className={ERR} data-testid="scenario-compare-error">{error}</p>}
      <div aria-live="polite">{shown ? <ScenarioComparisonView c={shown} /> : null}</div>
    </section>
  )
}


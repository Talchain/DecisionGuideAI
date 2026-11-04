import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View, ViewCard } from '../../olumiView/client'
import { optionCards } from '../../olumiView/layout'
import { teamApi, TeamApiError } from './api'
import { runWrite, useWriteLocked, useWriteSending, MAY_HAVE_SAVED } from './writes'
import { BODY, ERR, FIELD, H, META } from './ui'

type Weight = 'more' | 'same' | 'less'
type Weighed = NonNullable<View['weights']>
type Dot = Weighed['aims'][number]['dots'][number]

/** The weight columns, left to right, in core's page's words (src/page/tradeoff.ts COLUMNS). */
const COLUMNS: readonly [Weight, string][] = [['less', 'matters less'], ['same', 'the same'], ['more', 'matters more']]
/** What a member weighs an aim with, in core's words (src/page/tradeoff.ts CHOICES). */
const CHOICES: readonly [Weight | '', string][] = [['', 'not weighed'], ['more', 'matters more'], ['same', 'matters the same'], ['less', 'matters less']]
/** Core's page's summary of the panel (src/page/tradeoff.ts), said once. */
export const TRADEOFF_INTRO = 'Each aim’s chances under each option, and how much each aim matters to each person. Your weights stay private until everyone has given theirs and they are revealed.'

/** One cell: the option card's own row for this aim, as the View draws it (API.md L3: "A grid draws each cell from the option card's own row for that aim"). */
function Cell({ option, aim }: { option: ViewCard; aim: string }) {
  const r = option.rows.find((x) => x.aim_id === aim)
  if (!r) return <td data-option={option.id} />
  const words = r.kind === 'chance' ? `${r.approx}${r.value}` : r.kind === 'limit' ? r.value : (r.text ?? r.title)
  const olumi = r.kind === 'none' ? null : r.olumi
  return (
    <td data-option={option.id} title={r.title} className="px-2 py-1 align-top">
      {olumi ? <><span title={olumi.title} aria-label={olumi.title}>{olumi.glyph}</span> </> : null}{words}
    </td>
  )
}

/** A person's dot: their initial in a ring, dashed while it is still private to them; their name and weight on hover. */
function PersonDot({ d }: { d: Dot }) {
  const label = `${d.mine ? 'You' : d.by}: ${d.text}${d.revealed ? '' : ', private until revealed'}`
  return (
    <span title={label} aria-label={label} data-by={d.by_id} data-revealed={d.revealed}
      className={`m-px inline-grid h-[18px] min-w-[18px] place-items-center rounded-full border text-[10px] ${d.revealed ? 'border-text-body' : 'border-dashed border-text-light'}`}
    >{([...d.by.trim()][0] ?? '?').toUpperCase()}</span>
  )
}

/**
 * THE TEAM'S TRADE-OFFS (core L3): the approved model's options × its aims, each cell the option card's own row for that aim, and beside
 * each aim one dot per person under how much it matters to them, private until everyone's are revealed together. Where revealed weights
 * differ, core's dissent sentence says so, name by name. Nothing is combined, counted or put in order: no score, total, rank or winner.
 * Drawn once a second person has joined.
 */
export function TradeoffPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const model = view.model
  const aims = (model?.cards ?? []).filter((c) => c.family === 'goal' || c.family === 'limit')
  const w = view.weights
  const mineNow = new Map((w?.aims ?? []).flatMap((a) => a.dots.filter((d) => d.mine).map((d) => [a.aim_id, d.weight] as const)))
  const [chosen, setChosen] = useState<Record<string, Weight | ''>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useWriteLocked(`${sid}:weights`), revealLocked = useWriteLocked(`${sid}:weights-reveal`)
  const weighing = useWriteSending(`${sid}:weights`), revealing = useWriteSending(`${sid}:weights-reveal`)
  const sending = weighing || revealing
  if (view.members.length < 2 || view.version === null || model === null || aims.length === 0) return null
  const options = optionCards(model)
  const byAim = new Map((w?.aims ?? []).map((a) => [a.aim_id, a] as const))
  const pick = (id: string): Weight | '' => chosen[id] ?? mineNow.get(id) ?? ''
  const weights = Object.fromEntries(aims.flatMap((a) => { const k = pick(a.id); return k ? [[a.id, k] as const] : [] }))

  const run = async (key: string, write: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: false }, null, write); setChosen({}); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  const held = busy || sending

  return (
    <section data-testid="team-tradeoff" aria-label="Trade-offs" className="grid gap-2">
      <h3 className={H}>Trade-offs</h3>
      <p className={META}>{TRADEOFF_INTRO}</p>
      <div className="overflow-x-auto">
        <table className={`${BODY} border-collapse`} data-testid="team-tradeoff-grid">
          <thead>
            <tr>
              <th scope="col" />
              {options.map((o) => <th key={o.id} scope="col" className="px-2 py-1 text-left">{o.heading}</th>)}
              {COLUMNS.map(([k, t]) => <th key={k} scope="col" className={`${META} px-2 py-1`}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {aims.map((a) => {
              const row = byAim.get(a.id), dots = row?.dots ?? []
              return [
                <tr key={a.id} data-aim={a.id}>
                  <th scope="row" className="px-2 py-1 text-left">{a.heading}</th>
                  {options.map((o) => <Cell key={o.id} option={o} aim={a.id} />)}
                  {COLUMNS.map(([k]) => <td key={k} data-weight-of={k} className="px-2 py-1 text-center">{dots.filter((d) => d.weight === k).map((d) => <PersonDot key={d.by_id} d={d} />)}</td>)}
                </tr>,
                row?.dissent ? (
                  <tr key={`${a.id}:dissent`} data-dissent={a.id}>
                    <td colSpan={options.length + 4} className="px-2 py-1"><span title="Kept as each person said it, never combined">⚑</span> {row.dissent}</td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-1" data-testid="team-weights-form">
        {aims.map((a) => (
          <label key={a.id} className={`${BODY} flex flex-wrap items-center gap-2`}>
            <span>{a.heading}</span>
            <select className={`${FIELD} w-auto`} data-testid={`team-weight-${a.id}`} aria-label={`How much ‘${a.heading}’ matters to you`} value={pick(a.id)} disabled={held}
              onChange={(e) => setChosen((c) => ({ ...c, [a.id]: e.target.value as Weight | '' }))}>
              {CHOICES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
        ))}
        {locked || revealLocked ? <p role="alert" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" className={ERR} data-testid="team-weights-error">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" data-testid="team-weights-save" disabled={held || locked || Object.keys(weights).length === 0} onClick={() => void run(`${sid}:weights`, () => teamApi.weigh(sid, weights))}>Save my weights</Button>
          <Button size="sm" variant="ghost" data-testid="team-weights-skip" disabled={held || locked} title="Recorded as a skip: it counts toward the reveal and weighs nothing" onClick={() => void run(`${sid}:weights`, () => teamApi.skipWeights(sid))}>Skip</Button>
          {w?.can_reveal ? <Button size="sm" variant="secondary" data-testid="team-weights-reveal" disabled={held || revealLocked} onClick={() => void run(`${sid}:weights-reveal`, () => teamApi.revealWeights(sid))}>Reveal everyone’s weights</Button> : null}
          {w?.waiting ? <span className={META} data-testid="team-weights-waiting">{w.waiting}</span> : null}
        </div>
      </div>
    </section>
  )
}

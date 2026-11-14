import { useEffect, useRef, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { ringCards } from '../../olumiView/ring'
import { useWhatIf, type WhatIfAnswer } from '../../olumiView/whatif'
import { useViewLens } from '../../olumiView/lens'
import { call, TeamApiError } from './api'
import { putDraft } from './drafts'
import { differencesKey, readDifferences, stepDifference, useDifferences, type Difference, type Differences } from './differences'
import { runWrite } from './writes'
import { AVATAR, BODY, CARD, ERR, H, META } from './ui'

/**
 * WHERE YOUR EXPLANATIONS DIFFER (the two-person journey, DL 7 Nov). After the reveal: each figure two of you gave different figures for,
 * side by side; each option's chance of meeting the aim with each person's figure (core's two runs of the same draws); core's sentence for
 * whether the difference changes which option is most likely or only moves the chances; what would tell the figures apart; and what the
 * team chose: keep it as a disagreement, agree to find out, or commit to a next step (the Commitments form below, opened for it).
 *
 * Every word and value is core's (`GET …/differences`); nothing is computed or worded here. No side is marked right, nothing is averaged,
 * and people are listed in core's order. The card the difference is about is lit on the canvas while the pointer is on it (the chat's own
 * ring, `ringCards`), and put in front on press (`focusNodeById`): the canvas's own props, nothing of its layout changed.
 */
export function DifferencesPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  // Read again whenever the View's version or its revealed views change (each poll that brings a reveal brings this too).
  const key = differencesKey(sid, view)
  const data = useDifferences((s) => (s.sid === sid ? s.data : null))
  const error = useDifferences((s) => (s.sid === sid ? s.error : null))
  useEffect(() => { void readDifferences(sid, key) }, [sid, key])
  const lit = useRef(false)
  useEffect(() => () => { if (lit.current) ringCards([]) }, [])
  const ring = (ids: readonly string[]) => { lit.current = ids.length > 0; ringCards(ids) }

  if (data === null || data.gated || view.version === null) return null
  return (
    <section data-testid="team-differences" aria-label={data.heading} className="grid gap-2">
      <h3 className={H} data-testid="team-differences-heading">{data.heading}</h3>
      {error && <p role="alert" className={ERR} data-testid="team-differences-error">{error}</p>}
      {data.differences.length === 0
        ? <p className={META} data-testid="team-differences-empty">{data.empty}</p>
        : data.differences.map((d, i) => <DifferenceCard key={`${d.record}|${d.goal}`} sid={sid} view={view} data={data} d={d} ring={ring} onWrote={async () => { await readDifferences(sid, key); return onWrote() }}
            sidesSaid={d.kind === 'link' && data.differences.findIndex((x) => x.kind === 'link' && x.record === d.record) < i} />)}
    </section>
  )
}

/** A side's own words (core v1.30 `words`: a stance said after the reveal), or null; read here until differences.ts types the field. */
const wordsOf = (s: Difference['sides'][number]): string | null => { const w = (s as { words?: unknown }).words; return typeof w === 'string' && w !== '' ? w : null }

/** `sidesSaid`: core sends a link once per aim; its explanations (both sides' words) are drawn on its first card only (DL 9 Nov: one link,
 *  its two explanations together, said once), and each later card keeps what differs by aim. */
function DifferenceCard({ sid, view, data, d, ring, onWrote, sidesSaid = false }: { sid: string; view: View; data: Differences; d: Difference; ring: (ids: readonly string[]) => void; onWrote: () => Promise<boolean>; sidesSaid?: boolean }): JSX.Element {
  const h = data.headings
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const at = `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}`
  const step = async (s: 'dissent' | 'research') => {
    setBusy(true); setError(null)
    // Core keeps one row per member, figure, version and step, so a re-send after a lost answer is the same row (its key), never a second.
    try { await runWrite(`${sid}:difference:${d.record}:${s}`, { op: true }, { record: d.record, step: s }, () => stepDifference(sid, d.record, s)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  // Commit opens the Commitments form below, the team's own words to write there; nothing is filled in for them but the owner.
  const commit = () => {
    putDraft<Record<string, unknown>>(`${sid}:commitment`, (prev) => ({ action: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '', ...(prev ?? {}), owner: (prev?.['owner'] as string | undefined) || view.you_id, open: true }))
    requestAnimationFrame(() => document.querySelector('[data-testid="team-commitment-form"], [data-testid="team-commitments"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  // Preview one person's figure on the canvas (core's what-if on a copy, POST …/whatif: nothing saved, no AI call), under the What if lens,
  // by the same store the lens draws; their figure is taken from the View's own copy of their revealed view, never re-typed here.
  const figureOf = (view_: number) => view.collab.shared.find((x) => x.id === view_)?.figures.find((f) => f.quantity === d.record) ?? null
  const preview = async (view_: number) => {
    const f = figureOf(view_), base = view.version?.id
    if (f === null || base === undefined) return
    setBusy(true); setError(null)
    try {
      const value = 'value' in f ? { kind: 'point', value: f.value } : { kind: 'interval', low: f.low, high: f.high }
      const a = await call<WhatIfAnswer>('POST', `/api/scenarios/${encodeURIComponent(sid)}/whatif`, { base, variants: [{ edits: [{ quantity: d.record, value }] }] })
      const variant = a.variants[0]
      useWhatIf.setState({ shown: variant === undefined ? null : { sid, base, quantity: d.record, typed: f.text, variant } })
      useViewLens.setState({ lens: 'what_if' })
      focusNodeById(d.record)
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }
  const mine = new Set(d.steps.filter((s) => s.by_id === view.you_id).map((s) => s.step))
  // The cards it is about (a figure: its card; a link: both ends; a factor the model does not have: none).
  const cards = d.cards ?? [d.record]
  return (
    <article className={CARD} data-testid={at} data-difference-status={d.status} data-difference-kind={d.kind ?? 'figure'} onMouseEnter={() => ring(cards)} onMouseLeave={() => ring([])}>
      {cards.length > 0 ? (
        <button type="button" className={`${BODY} flex items-start gap-1.5 text-left text-text-header`} data-testid={`${at}-focus`}
          title="Show it on the canvas" onClick={() => focusNodeById(cards[0]!)} onFocus={() => ring(cards)} onBlur={() => ring([])}>
          <Crosshair aria-hidden="true" className="mt-[3px] h-3.5 w-3.5 flex-none text-text-light" />
          <span><span data-testid={`${at}-label`}>{d.label}</span>{d.goal_label ? <span className="text-text-light"> · {d.goal_label}</span> : null}</span>
        </button>
      ) : <p className={`${BODY} break-words text-text-header`}><span data-testid={`${at}-label`}>{d.label}</span></p>}

      {d.steps.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-steps`}>
          <p className={META}>{h.steps}</p>
          <ul className="m-0 grid list-none gap-1 p-0">
            {d.steps.map((s) => <li key={s.id} className={`${BODY} break-words`} data-step={s.step} data-step-by={s.by_id}>{s.text}</li>)}
          </ul>
        </div>
      )}


      {sidesSaid ? null : <div className="grid gap-1" data-testid={`${at}-sides`}>
        <p className={META}>{d.sides_heading ?? h.sides}</p>
        <ul className="m-0 grid list-none gap-1 p-0">
          {d.sides.map((s) => (
            <li key={s.holder_id} className={`${BODY} flex items-start gap-1.5 break-words`} data-difference-side={s.holder_id} title={s.title}>
              <span aria-hidden="true" className={AVATAR}>{s.holder.slice(0, 1).toUpperCase()}</span>
              <span className="grid gap-0.5"><span data-difference-figure=""><span className="text-text-header">{s.holder}</span>: {s.figure}</span>
                {/* A stance said after the reveal carries the member's own words (core's `words`), drawn as given under their line. */}
                {wordsOf(s) !== null && <span className="break-words text-text-light" data-difference-words={s.holder_id}>{wordsOf(s)}</span>}
                {(d.kind ?? 'figure') === 'figure' && figureOf(s.view) !== null && view.version !== null && (
                  <button type="button" data-testid={`${at}-preview-${s.holder_id}`} disabled={busy} onClick={() => void preview(s.view)}
                    title="Shows the chances with this figure on the canvas, under What if. Nothing is saved."
                    className="w-fit text-left text-text-light underline underline-offset-2 hover:text-text-body disabled:opacity-50">Preview on the canvas</button>
                )}</span>
            </li>
          ))}
        </ul>
      </div>}

      <p className={`${BODY} break-words ${d.status === 'changes' ? 'font-medium text-text-header' : ''}`} data-testid={`${at}-status`}>{d.status_text}</p>

      {d.options.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-options`}>
          <p className={META}>{h.options}</p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={`${META} py-0.5 pr-2 text-left font-normal`}><span className="sr-only">Option</span></th>
                {d.sides.map((s) => <th key={s.holder_id} scope="col" className={`${META} py-0.5 pr-2 text-left font-normal text-text-header`}>{s.holder}</th>)}
                <th scope="col" className={`${META} py-0.5 text-left font-normal`}>{h.model}</th>
              </tr>
            </thead>
            <tbody>
              {d.options.map((o) => (
                <tr key={o.option} data-difference-option={o.option} className="border-t border-panel-border">
                  <th scope="row" className={`${BODY} py-1 pr-2 text-left font-normal text-text-header`}>
                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => focusNodeById(o.option)} onMouseEnter={() => ring([o.option])} onMouseLeave={() => ring(cards)}>{o.label}</button>
                  </th>
                  {d.sides.map((s) => {
                    // That holder's own result: their chance, or what their version withholds, with core's reason on hover. Never another column's number.
                    const c = o.chances.find((x) => x.holder_id === s.holder_id)
                    return <td key={s.holder_id} className={`${BODY} py-1 pr-2 ${c?.withheld ? 'text-text-light' : 'tabular-nums'}`} data-difference-chance={s.holder_id}
                      data-difference-withheld={c?.withheld ? '' : undefined} title={c?.withheld?.reason}>{c?.text ?? ''}</td>
                  })}
                  <td className={`${META} py-1 tabular-nums`} data-difference-model="">{o.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.settle.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-settle`}>
          <p className={META}>{h.settle}</p>
          <ul className="m-0 grid list-disc gap-1 pl-4">
            {d.settle.map((s, i) => <li key={i} className={`${BODY} break-words`} data-settle={s.kind}>{s.text}</li>)}
          </ul>
        </div>
      )}

      {d.status !== 'pending' && (
        <div className="flex flex-wrap gap-2" data-testid={`${at}-actions`}>
          <Button size="sm" variant="secondary" data-testid={`${at}-dissent`} disabled={busy || mine.has('dissent')} aria-pressed={mine.has('dissent')} onClick={() => void step('dissent')}>{h.dissent}</Button>
          <Button size="sm" variant="secondary" data-testid={`${at}-research`} disabled={busy || mine.has('research')} aria-pressed={mine.has('research')} onClick={() => void step('research')}>{h.research}</Button>
          <Button size="sm" data-testid={`${at}-commit`} disabled={busy} onClick={commit}>{h.commit}</Button>
        </div>
      )}
      {error && <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p>}
    </article>
  )
}

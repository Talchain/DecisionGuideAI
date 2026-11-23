/**
 * V12 outcome strips: a calculated card's options on ONE true 0-based axis (p10-p90 strip, median tick), the aim's deadline in gold where this
 * card is the aim's quantity, a row for every option core could not calculate (with core's reason), and the pending state. Nothing is shaded as
 * a probability: the strip is a range of values, never a chance. Words are core's (figure.title, withheld text); only notation labels are chrome.
 */
import type { CSSProperties } from 'react'
import '../../look/olumiLook.css'
import type { View, ViewCard, ViewModel } from '../../client'
import { Hover } from '../../look/Hover'
import { withheldValues } from '../contract'
import { aimOf, axisOf, fmt, letterOf, modelOf, pctOf, unitOf, type Letters } from './axis'

type Band = { option: string; p10: number; p50: number | null; p90: number }
const bandsOf = (card: ViewCard): Band[] =>
  (card.values ?? []).flatMap((v) => (Number.isFinite(v.p10) && Number.isFinite(v.p90) && (v as { withheld?: unknown }).withheld !== true
    ? [{ option: v.option, p10: v.p10, p50: v.p50 !== null && Number.isFinite(v.p50) ? v.p50 : null, p90: v.p90 }] : []))

export function OutcomeStrips({ card, view, letters }: { card: ViewCard; view: { model?: ViewModel | null } | ViewModel | View; letters: Letters }) {
  const model = modelOf(view as { model?: ViewModel | null })
  if (model === null) return null
  const waits = card.figure?.state === 'waits'
  const bands = bandsOf(card), withheld = withheldValues(card)
  if (waits) {
    const words = card.figure?.title || card.figure?.text || ''
    return <Hover as="div" data-testid="outcome-pending" data-card={card.id} words={words} className="ok-scale ok-scale-pending">pending{words ? `: ${words}` : ''}</Hover>
  }
  if (bands.length === 0 && withheld.length === 0) return null
  const aim = aimOf(model), unit = unitOf(card, aim)
  const deadline = aim !== null && aim.quantity === card.id && (unit === null || aim.unit === unit) ? aim : null
  const axis = axisOf(Math.min(...bands.map((b) => b.p10), 0), Math.max(...bands.map((b) => b.p90), deadline?.value ?? -Infinity, 0))
  const u = unit === null ? '' : ` ${unit}`
  return (
    <div data-testid="outcome-strips" data-card={card.id} className="ok-scale ok-scale-outcomes">
      <div className="relative flex flex-col gap-1">
        {bands.map((b) => (
          <div key={b.option} data-testid={`strip-${b.option}`} className="ok-scale-track">
            <span className="ok-scale-letter" data-testid={`strip-letter-${b.option}`}>{letterOf(letters, b.option)}</span>
            <span data-testid={`strip-range-${b.option}`} data-p10={b.p10} data-p90={b.p90} className="ok-scale-outcome-band" style={{ '--scale-x': `${pctOf(axis, b.p10)}%`, '--scale-width': `${Math.max(1, pctOf(axis, b.p90) - pctOf(axis, b.p10))}%` } as CSSProperties} />
            {b.p50 !== null && <span data-testid={`strip-median-${b.option}`} data-p50={b.p50} className="ok-scale-median" style={{ '--scale-x': `${pctOf(axis, b.p50)}%` } as CSSProperties} />}
          </div>
        ))}
        {withheld.map((w) => (
          <div key={w.option} data-testid={`strip-withheld-${w.option}`} className="ok-scale-track ok-scale-withheld">
            <span className="ok-scale-letter">{letterOf(letters, w.option)}</span>
            {/^not calculated/i.test(w.text) ? w.text : `not calculated: ${w.text}`}
          </div>
        ))}
        {deadline !== null && (
          <span data-testid="outcome-deadline" data-at={deadline.value} className="ok-scale-deadline ok-scale-outcome-deadline" style={{ '--scale-x': `${pctOf(axis, deadline.value)}%` } as CSSProperties}>
            <span className="ok-scale-deadline-label">{fmt(deadline.value)}{u} deadline</span>
          </span>
        )}
      </div>
      <div data-testid="outcome-axis" className="ok-scale-axis">
        {axis.ticks.map((t) => <span key={t} data-testid="outcome-tick" className="ok-scale-tick" style={{ '--scale-x': `${pctOf(axis, t)}%` } as CSSProperties}>{fmt(t)}</span>)}
        {unit !== null && <span data-testid="outcome-unit" className="absolute right-0 top-px bg-panel">{unit}</span>}
      </div>
      <Hover as="div" data-testid="outcome-legend" words={card.figure?.title || undefined} className="mt-0.5">middle 80% · median</Hover>
    </div>
  )
}

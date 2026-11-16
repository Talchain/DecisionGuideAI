/**
 * V12 outcome strips: a calculated card's options on ONE true 0-based axis (p10-p90 strip, median tick), the aim's deadline in gold where this
 * card is the aim's quantity, a row for every option core could not calculate (with core's reason), and the pending state. Nothing is shaded as
 * a probability: the strip is a range of values, never a chance. Words are core's (figure.title, withheld text); only notation labels are chrome.
 */
import type { CSSProperties } from 'react'
import type { View, ViewCard, ViewModel } from '../../client'
import { withheldValues } from '../contract'
import { aimOf, axisOf, fmt, letterOf, modelOf, pctOf, unitOf, type Letters } from './axis'

const INK = 'var(--o-ink, #213238)', GOLD = 'var(--o-goal, #e9bc50)', LIGHT = 'var(--o-light, #687879)', TRACK = 'var(--o-track, #eee6d8)'
const row: CSSProperties = { position: 'relative', height: 16, background: TRACK, borderRadius: 3 }
const LW = 22

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
    return <div data-testid="outcome-pending" data-card={card.id} title={words} style={{ border: `1px dashed ${LIGHT}`, borderRadius: 4, padding: '4px 6px', fontSize: 11.5, color: LIGHT }}>pending{words ? `: ${words}` : ''}</div>
  }
  if (bands.length === 0 && withheld.length === 0) return null
  const aim = aimOf(model), unit = unitOf(card, aim)
  const deadline = aim !== null && aim.quantity === card.id && (unit === null || aim.unit === unit) ? aim : null
  const axis = axisOf(Math.min(...bands.map((b) => b.p10), 0), Math.max(...bands.map((b) => b.p90), deadline?.value ?? -Infinity, 0))
  const u = unit === null ? '' : ` ${unit}`
  return (
    <div data-testid="outcome-strips" data-card={card.id} style={{ position: 'relative', margin: '6px 0 2px', paddingLeft: LW, fontSize: 11, color: LIGHT }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bands.map((b) => (
          <div key={b.option} data-testid={`strip-${b.option}`} style={row}>
            <span style={{ position: 'absolute', left: -LW, width: LW - 4, textAlign: 'right', color: INK, fontWeight: 600 }} data-testid={`strip-letter-${b.option}`}>{letterOf(letters, b.option)}</span>
            <span data-testid={`strip-range-${b.option}`} data-p10={b.p10} data-p90={b.p90} style={{ position: 'absolute', top: 3, height: 10, borderRadius: 2, background: INK, opacity: 0.35, left: `${pctOf(axis, b.p10)}%`, width: `${Math.max(1, pctOf(axis, b.p90) - pctOf(axis, b.p10))}%` }} />
            {b.p50 !== null && <span data-testid={`strip-median-${b.option}`} data-p50={b.p50} style={{ position: 'absolute', top: 1, width: 2, height: 14, background: INK, left: `calc(${pctOf(axis, b.p50)}% - 1px)` }} />}
          </div>
        ))}
        {withheld.map((w) => (
          <div key={w.option} data-testid={`strip-withheld-${w.option}`} style={{ ...row, background: 'transparent', border: `1px dashed ${LIGHT}`, display: 'flex', alignItems: 'center', paddingLeft: 6, height: 16 }}>
            <span style={{ position: 'absolute', left: -LW - 1, width: LW - 4, textAlign: 'right', color: INK, fontWeight: 600 }}>{letterOf(letters, w.option)}</span>
            {/^not calculated/i.test(w.text) ? w.text : `not calculated: ${w.text}`}
          </div>
        ))}
        {deadline !== null && (
          <span data-testid="outcome-deadline" data-at={deadline.value} style={{ position: 'absolute', top: -4, bottom: -4, width: 0, borderLeft: `2px solid ${GOLD}`, left: `${pctOf(axis, deadline.value)}%` }}>
            <span style={{ position: 'absolute', top: -13, left: 3, whiteSpace: 'nowrap', color: INK, fontSize: 10.5 }}>{fmt(deadline.value)}{u} deadline</span>
          </span>
        )}
      </div>
      <div data-testid="outcome-axis" style={{ position: 'relative', height: 14, marginTop: 2, borderTop: `1px solid ${LIGHT}` }}>
        {axis.ticks.map((t) => <span key={t} data-testid="outcome-tick" style={{ position: 'absolute', top: 1, left: `${pctOf(axis, t)}%`, transform: 'translateX(-50%)' }}>{fmt(t)}</span>)}
        {unit !== null && <span data-testid="outcome-unit" style={{ position: 'absolute', right: 0, top: 1, background: 'var(--o-panel, #fefefe)' }}>{unit}</span>}
      </div>
      <div data-testid="outcome-legend" title={card.figure?.title || undefined} style={{ marginTop: 2 }}>middle 80% · median</div>
    </div>
  )
}

/**
 * V12 conditional range on an option: its chance if the driving figure is low versus high, from the numbers core sends on the card
 * (`card.driver.low/high`, else the chance row's `driver`; both 0..1). Core sends words only: nothing is drawn. Both ends sit on one 0-100% track;
 * the span between them is a link between two chances, not a probability band, so it is a plain line and is never shaded.
 */
import type { View, ViewCard, ViewModel } from '../../client'
import { Hover } from '../../look/Hover'
import { LABEL_PX } from './axis'
import { sampledChanceWords } from './chanceWords'

const INK = 'var(--text-header)', LIGHT = 'var(--text-light)', TRACK = 'var(--border-default)', OPT = 'var(--option)'

export function driverChances(card: ViewCard): { low: number; high: number } | null {
  const row = card.rows.find((r) => r.kind === 'chance' && r.driver != null) as { driver?: { low: number; high: number } | null } | undefined
  const d = card.driver != null && card.driver.low != null && card.driver.high != null ? { low: card.driver.low, high: card.driver.high } : row?.driver ?? null
  return d !== null && Number.isFinite(d.low) && Number.isFinite(d.high) && d.low >= 0 && d.low <= 1 && d.high >= 0 && d.high <= 1 ? { low: d.low, high: d.high } : null
}

export function ConditionalBar({ card }: { card: ViewCard; view?: { model?: ViewModel | null } | ViewModel | View }) {
  const d = driverChances(card)
  if (d === null) return null
  const lo = Math.min(d.low, d.high) * 100, hi = Math.max(d.low, d.high) * 100
  const dot = (p: number, id: string) => <span data-testid={id} data-p={p} style={{ position: 'absolute', top: 3, width: 10, height: 10, borderRadius: '50%', background: OPT, left: `calc(${p * 100}% - 5px)` }} />
  return (
    <Hover as="div" data-testid="conditional-bar" data-card={card.id} words={card.driver?.title || undefined} style={{ margin: '4px 0', fontSize: LABEL_PX, color: LIGHT }}>
      <div style={{ position: 'relative', height: 16, background: TRACK, borderRadius: 3 }}>
        <span style={{ position: 'absolute', top: 7, height: 2, background: `color-mix(in srgb, ${INK} 40%, transparent)`, left: `${lo}%`, width: `${hi - lo}%` }} />
        {dot(d.low, 'conditional-low')}{dot(d.high, 'conditional-high')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span data-testid="conditional-low-label">low {sampledChanceWords(d.low)}</span>
        <span data-testid="conditional-high-label">high {sampledChanceWords(d.high)}</span>
      </div>
    </Hover>
  )
}

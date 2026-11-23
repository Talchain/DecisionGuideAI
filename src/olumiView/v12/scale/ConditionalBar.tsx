/**
 * V12 conditional range on an option: its chance if the driving figure is low versus high, from the numbers core sends on the card
 * (`card.driver.low/high`, else the chance row's `driver`; both 0..1). Core sends words only: nothing is drawn. Both ends sit on one 0-100% track;
 * the span between them is a link between two chances, not a probability band, so it is a plain line and is never shaded.
 */
import type { CSSProperties } from 'react'
import '../../look/olumiLook.css'
import type { View, ViewCard, ViewModel } from '../../client'
import { Hover } from '../../look/Hover'
import { sampledChanceWords } from './chanceWords'

export function driverChances(card: ViewCard): { low: number; high: number } | null {
  const row = card.rows.find((r) => r.kind === 'chance' && r.driver != null) as { driver?: { low: number; high: number } | null } | undefined
  const d = card.driver != null && card.driver.low != null && card.driver.high != null ? { low: card.driver.low, high: card.driver.high } : row?.driver ?? null
  return d !== null && Number.isFinite(d.low) && Number.isFinite(d.high) && d.low >= 0 && d.low <= 1 && d.high >= 0 && d.high <= 1 ? { low: d.low, high: d.high } : null
}

export function ConditionalBar({ card }: { card: ViewCard; view?: { model?: ViewModel | null } | ViewModel | View }) {
  const d = driverChances(card)
  if (d === null) return null
  const lo = Math.min(d.low, d.high) * 100, hi = Math.max(d.low, d.high) * 100
  const dot = (p: number, id: string) => <span data-testid={id} data-p={p} className="ok-scale-dot ok-scale-conditional-dot" style={{ '--scale-x': `${p * 100}%` } as CSSProperties} />
  return (
    <Hover as="div" data-testid="conditional-bar" data-card={card.id} words={card.driver?.title || undefined} className="ok-scale ok-scale-range">
      <div className="ok-scale-track">
        <span className="ok-scale-conditional-span" style={{ '--scale-x': `${lo}%`, '--scale-width': `${hi - lo}%` } as CSSProperties} />
        {dot(d.low, 'conditional-low')}{dot(d.high, 'conditional-high')}
      </div>
      <div className="flex justify-between">
        <span data-testid="conditional-low-label">low {sampledChanceWords(d.low)}</span>
        <span data-testid="conditional-high-label">high {sampledChanceWords(d.high)}</span>
      </div>
    </Hover>
  )
}

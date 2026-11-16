/**
 * V12 input range: a figure's low-high band on its own true scale, with end labels and unit. An Olumi estimate is a blue dotted band; a person's
 * figure a solid dark bar. A gold deadline tick only where the range is in the aim's unit AND core's `input` link runs from this card to the aim's
 * quantity. A what-if marker at `tried`. No range from core: nothing is drawn.
 */
import type { View, ViewCard, ViewModel } from '../../client'
import { figureRange, linkRole } from '../contract'
import { aimOf, axisOf, fmt, modelOf, pctOf } from './axis'

const INK = 'var(--text-header)', BLUE = 'var(--info)', GOLD = 'var(--goal)', LIGHT = 'var(--text-light)', TRACK = 'var(--border-default)'

export function RangeBar({ card, view, tried }: { card: ViewCard; view: { model?: ViewModel | null } | ViewModel | View; tried?: number | null }) {
  const range = figureRange(card)
  if (range === null) return null
  const model = modelOf(view as { model?: ViewModel | null })
  const aim = model === null ? null : aimOf(model)
  const feeds = model !== null && aim !== null && model.links.some((l) => linkRole(l) === 'input' && l.from === card.id && l.to === aim.quantity)
  const deadline = aim !== null && feeds && aim.unit === range.unit ? aim.value : null
  const t = typeof tried === 'number' && Number.isFinite(tried) ? tried : null
  const olumi = (card as { author?: { by?: unknown } | null }).author?.by === 'olumi'
  const vals = [range.low, range.high, ...(range.likely === null ? [] : [range.likely]), ...(t === null ? [] : [t]), ...(deadline === null ? [] : [deadline])]
  const axis = axisOf(Math.min(...vals), Math.max(...vals), 1)
  const a = pctOf(axis, range.low), b = pctOf(axis, range.high)
  const band = { position: 'absolute', top: 4, height: 8, left: `${a}%`, width: `${Math.max(1, b - a)}%`, borderRadius: 2 } as const
  return (
    <div data-testid="range-bar" data-card={card.id} data-by={olumi ? 'olumi' : 'person'} style={{ margin: '4px 0', fontSize: 12, color: LIGHT }}>
      <div style={{ position: 'relative', height: 16, background: TRACK, borderRadius: 3 }}>
        <span data-testid="range-band" data-style={olumi ? 'dotted' : 'solid'}
          style={olumi ? { ...band, border: `2px dotted ${BLUE}`, background: 'transparent' } : { ...band, background: INK }} />
        {range.likely !== null && <span data-testid="range-likely" style={{ position: 'absolute', top: 3, width: 10, height: 10, borderRadius: '50%', background: olumi ? BLUE : INK, border: '2px solid var(--bg-panel)', left: `calc(${pctOf(axis, range.likely)}% - 5px)` }} />}
        {deadline !== null && <span data-testid="range-deadline" style={{ position: 'absolute', top: 0, bottom: 0, borderLeft: `2px solid ${GOLD}`, left: `${pctOf(axis, deadline)}%` }} />}
        {t !== null && <span data-testid="range-tried" data-at={t} style={{ position: 'absolute', top: -2, bottom: -2, borderLeft: `2px dashed ${INK}`, left: `${pctOf(axis, t)}%` }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap' }}>
        <span data-testid="range-min">{fmt(axis.min)} {range.unit}</span>
        <span data-testid="range-max">{fmt(axis.max)} {range.unit}</span>
      </div>
    </div>
  )
}

/**
 * V12 input range: a figure's low-high band on its own true scale, with end labels and unit. An Olumi estimate is a blue dotted band; a person's
 * figure a solid dark bar. A gold deadline tick only where the range is in the aim's unit AND core's `input` link runs from this card to the aim's
 * quantity. A what-if marker at `tried`. No range from core: nothing is drawn.
 */
import type { CSSProperties } from 'react'
import '../../look/olumiLook.css'
import type { View, ViewCard, ViewModel } from '../../client'
import { figureRange, linkRole } from '../contract'
import { aimOf, axisOf, fmt, modelOf, pctOf } from './axis'

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
  // v10 review item 4: a single value (low equals high) with no deadline or tried mark is a track with one dot and two labels that say nothing more than the card's words: draw nothing.
  if (range.low === range.high && deadline === null && t === null) return null
  const a = pctOf(axis, range.low), b = pctOf(axis, range.high)
  // The person's band is lighter and thinner (v10 review item 4); Olumi's dotted band keeps its own geometry (a 2 px dotted border needs the 8 px).
  return (
    <div data-testid="range-bar" data-card={card.id} data-by={olumi ? 'olumi' : 'person'} className="ok-scale ok-scale-range">
      <div className="ok-scale-track">
        <span data-testid="range-band" data-style={olumi ? 'dotted' : 'solid'}
          className="ok-scale-range-band" style={{ '--scale-x': `${a}%`, '--scale-width': `${Math.max(1, b - a)}%` } as CSSProperties} />
        {range.likely !== null && <span data-testid="range-likely" className="ok-scale-dot ok-scale-likely" style={{ '--scale-x': `${pctOf(axis, range.likely)}%` } as CSSProperties} />}
        {deadline !== null && <span data-testid="range-deadline" className="ok-scale-deadline" style={{ '--scale-x': `${pctOf(axis, deadline)}%` } as CSSProperties} />}
        {t !== null && <span data-testid="range-tried" data-at={t} className="ok-scale-tried" style={{ '--scale-x': `${pctOf(axis, t)}%` } as CSSProperties} />}
      </div>
      <div className="flex justify-between gap-2 whitespace-nowrap">
        {/* The unit once, at the high end (DL look at 1500x904 at 1.33: on a narrow card the two labels touched); the low end says it to a reader. */}
        <span data-testid="range-min" aria-label={`${fmt(axis.min)} ${range.unit}`}>{fmt(axis.min)}</span>
        <span data-testid="range-max">{fmt(axis.max)} {range.unit}</span>
      </div>
    </div>
  )
}

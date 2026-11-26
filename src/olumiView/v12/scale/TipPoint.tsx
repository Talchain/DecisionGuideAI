import type { CSSProperties } from 'react'
import '../../look/olumiLook.css'
import type { ViewCard } from '../../client'
import type { TippingLine } from '../../tipping'
import { typography } from '../../../styles/typography'
import { figureRange } from '../contract'
import { digitsToShow, fmtAt, pctOf, spanAxisOf } from './axis'

export function TipPoint({ tipping, card }: { tipping: TippingLine; card: ViewCard | null }) {
  const { at, low, high, side, figure } = tipping
  if (![at, low, high].every(Number.isFinite) || !(low < high)) return null

  const range = card === null ? null : figureRange(card)
  const values = [at, low, high]
  if (range !== null) {
    values.push(range.low, range.high)
    if (range.likely !== null) values.push(range.likely)
  }
  const axis = spanAxisOf(Math.min(...values), Math.max(...values))
  // The tip one digit finer than the ends and never fewer than two significant figures, so a small threshold never prints as 0; none if that needs > 6 digits.
  const tipDigits = axis === null ? null : digitsToShow(at, Math.min(6, axis.digits + 1))
  if (axis === null || tipDigits === null) return null
  const marker = pctOf(axis, at)
  // The outline covers only what Core tested (low to high), on the side that tips: never the axis margin, which Core did not test.
  const regionStart = side === 'above' ? marker : pctOf(axis, Math.min(low, at))
  const regionEnd = side === 'above' ? pctOf(axis, Math.max(high, at)) : marker
  const olumi = card?.author?.by === 'olumi' || figure?.whose === 'olumi'
  // The ends at the axis's precision; the tip point at tipDigits.
  const label = (value: number, digits = axis.digits) => range?.unit ? `${fmtAt(value, digits)} ${range.unit}` : fmtAt(value, digits)

  return (
    <div aria-hidden="true" data-testid="tip-point" data-by={olumi ? 'olumi' : 'person'}
      className={`ok-scale ok-scale-tip ${typography.viewPanelMeta} text-text-light`}>
      <div className="ok-scale-track ok-scale-tip-track">
        <span data-testid="tip-region" className="ok-scale-tip-region"
          style={{ '--scale-x': `${regionStart}%`, '--scale-width': `${regionEnd - regionStart}%` } as CSSProperties} />
        {range !== null && (
          <span data-testid="range-band" data-style={olumi ? 'dotted' : 'solid'} className="ok-scale-range-band"
            style={{ '--scale-x': `${pctOf(axis, range.low)}%`, '--scale-width': `${pctOf(axis, range.high) - pctOf(axis, range.low)}%` } as CSSProperties} />
        )}
        {range?.likely != null && <span data-testid="range-likely" className="ok-scale-dot ok-scale-likely"
          style={{ '--scale-x': `${pctOf(axis, range.likely)}%` } as CSSProperties} />}
        <span data-testid="tip-marker" className="ok-scale-tip-marker" style={{ '--scale-x': `${marker}%` } as CSSProperties} />
      </div>
      <div className="ok-scale-tip-value">
        <span style={{ '--scale-x': `${marker}%` } as CSSProperties}>{label(at, tipDigits)}</span>
      </div>
      <div className="ok-scale-tip-ends">
        <span>{label(axis.min)}</span>
        <span>{label(axis.max)}</span>
      </div>
    </div>
  )
}

import type { CSSProperties } from 'react'
import '../../look/olumiLook.css'
import { pctOf } from './axis'

type Span = { low: number; high: number }
type Band = Span & { style: 'olumi' | 'person'; id?: string }
type Tick = { at: number; kind: 'likely' | 'tried' | 'deadline' }

type FigureTrackProps = {
  min: number
  max: number
  bands?: Band[]
  ticks?: Tick[]
  tip?: number | null
  untested?: Span[]
  'data-card'?: string
}

const TICK_CLASS: Record<Tick['kind'], string> = {
  likely: 'ok-scale-dot ok-scale-likely',
  tried: 'ok-scale-tried',
  deadline: 'ok-scale-deadline',
}

export function FigureTrack({ min, max, bands = [], ticks = [], tip, untested = [], 'data-card': card }: FigureTrackProps) {
  if (!Number.isFinite(max - min) || max <= min) return null

  const axis = { min, max }
  const position = (at: number) => ({ '--scale-x': `${pctOf(axis, at)}%` }) as CSSProperties
  const span = ({ low, high }: Span, minimum = 0) => ({
    ...position(low),
    '--scale-width': `${Math.max(minimum, pctOf(axis, high) - pctOf(axis, low))}%`,
  }) as CSSProperties
  const by = bands.length === 1 ? bands[0]?.style : undefined

  return (
    <div data-form="CH-range" data-testid="range-bar" data-card={card} data-by={by} className="ok-scale ok-scale-range">
      <div className={untested.length === 0 ? 'ok-scale-track' : 'ok-scale-track ok-scale-tip-track'}>
        {untested.map((gap, i) => (
          <span key={i} data-testid="range-untested" className="ok-scale-outcome-band ok-scale-withheld" style={span(gap)} />
        ))}
        {bands.map((band, i) => (
          <span key={band.id ?? i} className="ok-scale" data-by={band.style}>
            <span data-testid="range-band" data-style={band.style === 'olumi' ? 'dotted' : 'solid'}
              className="ok-scale-range-band" style={span(band, 1)} />
          </span>
        ))}
        {ticks.map(({ at, kind }, i) => (
          <span key={`${kind}:${i}`} data-testid={`range-${kind}`} data-at={kind === 'tried' ? at : undefined}
            className={TICK_CLASS[kind]} style={position(at)} />
        ))}
        {tip == null ? null : <span data-testid="tip-marker" className="ok-scale-tip-marker" style={position(tip)} />}
      </div>
    </div>
  )
}

export default FigureTrack

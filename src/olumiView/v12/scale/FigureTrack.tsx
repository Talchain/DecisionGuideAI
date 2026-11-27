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
  const position = (at: number) => pctOf(axis, at)
  const width = ({ low, high }: Span) => position(high) - position(low)
  const by = bands.length === 1 ? bands[0]?.style : undefined

  return (
    <div data-form="CH-range" data-testid="range-bar" data-card={card} data-by={by} className="ok-scale ok-scale-range">
      <div className={untested.length === 0 ? 'ok-scale-track' : 'ok-scale-track ok-scale-tip-track'}>
        {untested.map((gap, i) => (
          <span key={i} data-testid="range-untested" className="ok-scale-untested" style={{ '--scale-x': `${position(gap.low)}%`, '--scale-width': `${Math.max(0, width(gap))}%` } as CSSProperties} />
        ))}
        {bands.map((band, i) => (
          <span key={band.id ?? i} className="ok-scale" data-by={band.style}>
            <span data-testid="range-band" data-style={band.style === 'olumi' ? 'dotted' : 'solid'}
              className="ok-scale-range-band" style={{ '--scale-x': `${position(band.low)}%`, '--scale-width': `${Math.max(1, width(band))}%` } as CSSProperties} />
          </span>
        ))}
        {ticks.map(({ at, kind }, i) => (
          <span key={`${kind}:${i}`} data-testid={`range-${kind}`} data-at={kind === 'tried' ? at : undefined}
            className={TICK_CLASS[kind]} style={{ '--scale-x': `${position(at)}%` } as CSSProperties} />
        ))}
        {tip == null ? null : <span data-testid="tip-marker" className="ok-scale-tip-marker ok-scale-figure-tip" style={{ '--scale-x': `${position(tip)}%` } as CSSProperties} />}
      </div>
    </div>
  )
}

export default FigureTrack

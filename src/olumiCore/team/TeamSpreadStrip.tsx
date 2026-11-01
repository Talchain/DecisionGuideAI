import { Fragment } from 'react'
import { META, BODY, CARD, H } from './ui'
import type { Position, SpreadFor } from './model'

/**
 * WHERE YOU DIFFER, DRAWN: each person's own figure on one line, the way `collab/SpreadStrip` places a team's answers (a linear map
 * onto the answers' extent, the model's own figure drawn apart), but laid out in HTML so it stays fluid and its type stays the dock's
 * from 268px up (SpreadStrip's SVG keeps a 520px floor). Takes intervals: a range is drawn by its TWO ENDS and never reduced to a made-up
 * middle.
 *
 * What it is not allowed to be (SpreadStrip's rules, kept): no mean, no midpoint, no consensus band, no ranking. People are listed in
 * the order core gave their views, not by value. The component writes no sentence about the difference: all wording about what
 * differs comes from Olumi's reply to the team's words, and this draws only figures people gave and the model's own.
 */
export function projectPercent(value: number, low: number, high: number): number {
  const span = high - low
  if (!Number.isFinite(span) || span <= 0) return 50
  return Math.min(100, Math.max(0, ((value - low) / span) * 100))
}

/** A figure as it was given, with its unit; no rounding beyond float noise. */
export const figureText = (v: number, unit: string | null): string => `${Number(v.toPrecision(12))}${unit ? ` ${unit}` : ''}`

const ends = (p: Position | SpreadFor['model']): number[] => (p === null ? [] : p.kind === 'point' ? [p.value!] : [p.low!, p.high!])

function Mark({ p, lo, hi, dashed }: { p: Position | NonNullable<SpreadFor['model']>; lo: number; hi: number; dashed?: boolean }): JSX.Element {
  const border = dashed ? 'border-dashed border-info bg-transparent' : 'border-text-header bg-text-header'
  if (p.kind === 'point') {
    return <span aria-hidden="true" className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${border}`} style={{ left: `${projectPercent(p.value!, lo, hi)}%` }} />
  }
  const a = projectPercent(p.low!, lo, hi)
  const b = projectPercent(p.high!, lo, hi)
  // The two ends are drawn as ticks; the bar between them says "somewhere within", it is not a middle.
  return (
    <>
      <span aria-hidden="true" className={`absolute top-1/2 h-0.5 -translate-y-1/2 ${dashed ? 'border-t-2 border-dashed border-info' : 'bg-text-header'}`} style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%` }} />
      {[a, b].map((x, i) => <span key={i} aria-hidden="true" className={`absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 ${dashed ? 'bg-info' : 'bg-text-header'}`} style={{ left: `${x}%` }} />)}
    </>
  )
}

const valueText = (p: Position | NonNullable<SpreadFor['model']>, unit: string | null): string =>
  p.kind === 'point' ? figureText(p.value!, unit) : `${figureText(p.low!, null)} to ${figureText(p.high!, unit)}`

export function TeamSpreadStrip({ spread }: { spread: SpreadFor }): JSX.Element | null {
  const all = [...spread.positions.flatMap(ends), ...ends(spread.model)].filter((n) => Number.isFinite(n))
  if (spread.positions.length === 0 || all.length === 0) return null
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const described = [...spread.positions.map((p) => `${p.holder} ${valueText(p, spread.unit)}.`), spread.model ? `The model holds ${valueText(spread.model, spread.unit)}.` : ''].filter(Boolean).join(' ')
  return (
    <figure data-testid={`team-spread-${spread.quantity}`} className={`${CARD} m-0`}>
      <figcaption className={H}>{spread.label}</figcaption>
      <div role="img" aria-label={described} className="grid grid-cols-[minmax(52px,26%)_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5">
        {spread.positions.map((p, i) => (
          <Fragment key={`${p.holder}-${i}`}>
            <span className={`${BODY} truncate text-text-header`} data-testid={`team-spread-name-${spread.quantity}-${i}`}>{p.holder}</span>
            <div className="grid gap-0.5" data-testid={`team-spread-row-${spread.quantity}-${i}`} data-kind={p.kind}>
              <div className="relative mx-1.5 h-4 rounded-full bg-canvas">
                <Mark p={p} lo={lo} hi={hi} />
              </div>
              <span className={`${META} tabular-nums`}>{valueText(p, spread.unit)}</span>
            </div>
          </Fragment>
        ))}
        {spread.model && (
          <>
            <span className={`${BODY} truncate text-info`}>Model</span>
            <div className="grid gap-0.5" data-testid={`team-spread-model-${spread.quantity}`} data-kind={spread.model.kind}>
              <div className="relative mx-1.5 h-4 rounded-full bg-canvas">
                <Mark p={spread.model} lo={lo} hi={hi} dashed />
              </div>
              <span className={`${META} tabular-nums`}>{valueText(spread.model, spread.unit)}</span>
            </div>
          </>
        )}
      </div>
    </figure>
  )
}

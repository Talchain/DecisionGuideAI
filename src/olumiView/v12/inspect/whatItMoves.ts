/**
 * "What it moves" for one figure, from numbers the View already holds: each option whose chance moves most with this figure (core's `driver.figure`)
 * carries the chance if the figure comes out low and if high (`driver.low`, `driver.high`), and its own chance row is "now". Nothing is computed.
 * "Now" is drawn only when the option has exactly one chance row (several aims would make the pairing a guess); without the numbers the option keeps core's driver words.
 */
import type { ViewCard, ViewModel } from '../../client'
import { driversOf } from '../../layout'

export interface MovesRow { id: string; option: string; now: number | null; high: number | null; low: number | null; words: string }

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

export function movesOf(model: ViewModel, figure: string): MovesRow[] {
  return (driversOf(model).get(figure) ?? []).map((o: ViewCard) => {
    const d = o.driver!
    const chances = o.rows.flatMap((r) => (r.kind === 'chance' && isNum(r.chance) ? [r.chance] : []))
    const numbers = isNum(d.low) && isNum(d.high)
    return { id: o.id, option: o.heading, now: chances.length === 1 ? chances[0]! : null, high: numbers ? d.high : null, low: numbers ? d.low : null, words: d.text }
  })
}

/** A chance as the board words it: whole per cent, and "under 1%" rather than a false zero. */
export const pctWords = (p: number): string => (p < 0.01 ? 'under 1%' : `${Math.round(p * 100)}%`)

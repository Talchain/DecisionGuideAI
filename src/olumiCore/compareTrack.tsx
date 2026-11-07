/**
 * THE COMPARE TAB'S SHIFT TRACK on the olumi-core lane (UI session for Paul, 7 Nov: reinstate the crafted compare interface onto core's words).
 * The earlier DGAI's own figure (`canvas/compare-tab/PairChanceSlope.tsx`, Paul 20 Oct): one 0–100% hairline track per option, hollow for the
 * first side and filled for the second, the stretch between them option-tinted, quarter lines behind and one axis under them. It is reused
 * as it is (`PairChanceTrack`), so both lanes draw a pair the same way.
 *
 * It places marks only. Where each mark sits is core's own number (`chance`, the engine's fact behind the words, 0 to 1). The words beside
 * it are core's. Nothing is ranked or named as ahead. A side with no number draws no mark (never a mark at 0%).
 */
import { PairChanceTrack } from '../canvas/compare-tab/PairChanceSlope'
import type { PairChanceSide } from '../canvas/runView/runView'
import { typography } from '../styles/typography'

/** A mark for core's number, with core's words as its spoken text; none where core gives no number. */
export function markOf(chance: number | null | undefined, words: string): PairChanceSide | null {
  return typeof chance === 'number' && Number.isFinite(chance) && chance >= 0 && chance <= 1 ? { kind: 'point', words, scaleAt: chance * 100 } : null
}

/**
 * One option's two marks: hollow for the first side, filled for the second. Nothing when neither side has a number. `names`: the two sides
 * as the page names them, so the track says, to anyone who cannot see it, which side each figure is (UI audit of e646e3a8, item 4).
 */
export function ShiftTrack({ first, second, names }: { first: PairChanceSide | null; second: PairChanceSide | null; names: { first: string; second: string } }): JSX.Element | null {
  if (first === null && second === null) return null
  const at = (s: PairChanceSide | null) => (s?.kind === 'point' ? String(Math.round(s.scaleAt)) : '')
  const label = `${names.first}: ${first?.words ?? 'no figure'}; ${names.second}: ${second?.words ?? 'no figure'}`
  return <div className="mt-1.5 mb-0.5" role="img" aria-label={label} data-compare-track="" data-first={at(first)} data-second={at(second)}><PairChanceTrack earlier={first} now={second} grid /></div>
}

const QUARTERS = [0, 25, 50, 75, 100] as const

/** The axis under the tracks and the key to the two marks, named by the two sides as core names them. */
export function TrackKey({ first, second }: { first: string; second: string }): JSX.Element {
  return (
    <div className="grid gap-1.5" data-compare-track-key="" aria-hidden="true">
      <div className={`${typography.panelMeta} text-text-light relative h-4`}>
        {QUARTERS.map((t, i) => (
          <span key={t} className={`absolute top-0 ${i === 0 ? '' : i === QUARTERS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${t}%` }}>{t}%</span>
        ))}
      </div>
      <p className={`${typography.panelMeta} text-text-light m-0 flex flex-wrap items-center gap-x-3 gap-y-1`}>
        {/* The names wrap, never cut (UI audit item 4); each track carries the same names for assistive tech itself. */}
        <span className="inline-flex min-w-0 items-start gap-1"><span className="mt-1 inline-block h-2 w-2 flex-none rounded-full border-2 border-option/70 bg-panel" /><span className="break-words" title={first} data-compare-key="first">{first}</span></span>
        <span className="inline-flex min-w-0 items-start gap-1"><span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-option" /><span className="break-words" title={second} data-compare-key="second">{second}</span></span>
      </p>
    </div>
  )
}

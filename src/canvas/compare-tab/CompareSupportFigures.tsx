/**
 * Compare's glance: each matched option's support in the previous and the latest run, drawn as two markers on one
 * track (V3 visual prototype, Compare tab design review 4–5 Oct 2026).
 *
 * ⭐ PLAIN WORDS FIRST (DL #85 5979874014). No figure is printed here: the two markers are the visual indicator and the
 * verdict line is the words. The exact shares stay behind Result details, through the shared science gate.
 *
 * ⛔ THIS DRAWS NOTHING THE PRODUCER DID NOT LICENSE.
 *   · The positions are the producer's own `prior` / `current` shares on a fixed 0–1 track. No delta is computed.
 *   · `not_noise_qualified` (`mayShowMagnitude: false`) draws NO figure at all: a marker position would show the size
 *     the words withhold. Direction words only.
 *   · The connector is categorical: solid for `signal`, dashed for `within_noise`. It is never a band, an interval or
 *     a colour judgement; earlier and latest are positions, not worse and better.
 *   · Order is the shared display rule (`sortOptionsForDisplay`): by the latest share unless the run withholds
 *     designations, in which case the producer's own order stands. Compare adds no ranking rule of its own.
 */
import { useState } from 'react'
import { typography } from '../../styles/typography'
import { action } from '../../components/results/analysisNew/panelSurfaces'
import { FIGURE_RADIUS, FIGURE_TRACK_HEIGHT, FIGURE_TRACK_TONE, markerLeft } from '../../components/results/analysisNew/PanelFigure'
import { movementVerdictText, WHATS_CHANGED_TESTID } from '../../components/results/analysisNew/sections/WhatsChanged'
import type { RunDeltaMovement } from '../../components/results/analysisNew/runDeltaView'
import { sortOptionsForDisplay } from '../../components/results/utils/optionDisplayOrder'

/** Options shown before "Show N more" — enough for most decisions, short enough to keep the changes in view. */
export const OPTIONS_SHOWN_FIRST = 3
export const COMPARE_SUPPORT_TESTID = 'compare-support'

/** An option's link to its node on the canvas, or `null` when the canvas has no node for it now. */
export type OptionCanvasLink = (optionId: string) => { focus: () => void; on: () => void; off: () => void } | null

/** The producer's movements in the ONE display order every options surface uses. */
export function orderMovements(movements: readonly RunDeltaMovement[], designationsWithheld: boolean): RunDeltaMovement[] {
  const rows = movements.map((m) => ({ m, winProbability: m.current, expected: null, notAnalysed: false }))
  return sortOptionsForDisplay(rows, { designationsWithheld }).map((r) => r.m)
}

const MARKER = 'absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full'

/** Two positions on one track. Only ever mounted for a movement whose magnitude the producer licenses. */
function SupportPairFigure({ m }: { m: RunDeltaMovement }): JSX.Element {
  const left = Math.min(m.prior, m.current)
  const width = Math.abs(m.current - m.prior)
  const dashed = m.noiseVerdict !== 'signal'
  return (
    <div className="relative h-[15px] mt-1.5" aria-hidden="true" data-testid={`${COMPARE_SUPPORT_TESTID}-figure`}
      data-connector={dashed ? 'dashed' : 'solid'}>
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FIGURE_TRACK_TONE}`} />
      {width > 0 ? (
        <div className={`absolute top-1/2 -translate-y-1/2 border-t-2 ${dashed ? 'border-dashed border-text-light' : 'border-solid border-info/60'}`}
          style={{ left: `${left * 100}%`, width: `${width * 100}%` }} />
      ) : null}
      <span className={`${MARKER} bg-panel border-2 border-text-light`} style={{ left: markerLeft(m.prior) }} data-marker="previous" />
      <span className={`${MARKER} bg-info border-2 border-panel ring-1 ring-info/50`} style={{ left: markerLeft(m.current) }} data-marker="latest" />
    </div>
  )
}

function Legend(): JSX.Element {
  return (
    <div className={`${typography.panelMeta} text-text-light flex items-center gap-3 mt-1`} aria-hidden="true">
      <span className="inline-flex items-center gap-1"><span className="inline-block w-[9px] h-[9px] rounded-full bg-panel border-2 border-text-light" />Previous run</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block w-[9px] h-[9px] rounded-full bg-info" />Latest run</span>
    </div>
  )
}

function OptionRow({ m, link }: { m: RunDeltaMovement; link: ReturnType<OptionCanvasLink> }): JSX.Element {
  const name = m.label ?? 'An option this run does not name'
  return (
    <li className="py-1.5" data-testid={`${COMPARE_SUPPORT_TESTID}-option`} data-option-id={m.optionId} data-verdict={m.noiseVerdict}
      data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
      {link ? (
        <button type="button" className={`${typography.panelBody} text-text text-left rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          aria-label={`Show on the canvas: ${name}`} onClick={link.focus} onMouseEnter={link.on} onMouseLeave={link.off} onFocus={link.on} onBlur={link.off}>
          {name}
        </button>
      ) : <span className={`${typography.panelBody} text-text`}>{name}</span>}
      {m.mayShowMagnitude ? <SupportPairFigure m={m} /> : null}
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>{movementVerdictText(m)}</p>
    </li>
  )
}

/** The matched options' movements, ordered, first three open, the rest one click away — never silently dropped. */
export function CompareSupportFigures({ movements, designationsWithheld, optionLink }: {
  movements: readonly RunDeltaMovement[]
  designationsWithheld: boolean
  optionLink: OptionCanvasLink
}): JSX.Element | null {
  const [all, setAll] = useState(false)
  if (movements.length === 0) return null
  const ordered = orderMovements(movements, designationsWithheld)
  const shown = all ? ordered : ordered.slice(0, OPTIONS_SHOWN_FIRST)
  const hidden = ordered.slice(OPTIONS_SHOWN_FIRST)
  const hiddenSignals = hidden.filter((m) => m.noiseVerdict === 'signal').length
  const anyFigure = shown.some((m) => m.mayShowMagnitude)
  return (
    <div className="mt-3" data-testid={COMPARE_SUPPORT_TESTID}>
      <p className={`${typography.panelMeta} text-text-light m-0`}>Support across simulated runs</p>
      {anyFigure ? <Legend /> : null}
      <ul className="list-none p-0 mt-1 mb-0" data-testid={`${WHATS_CHANGED_TESTID}-movements`}>
        {shown.map((m) => <OptionRow key={m.optionId} m={m} link={optionLink(m.optionId)} />)}
      </ul>
      {hidden.length > 0 ? (
        <button type="button" className={`${typography.panelMeta} ${action('inline')} mt-1 text-left justify-start`} aria-expanded={all} onClick={() => setAll((v) => !v)}
          data-testid={`${COMPARE_SUPPORT_TESTID}-more`}>
          {all
            ? 'Show fewer options'
            : `Show ${hidden.length} more ${hidden.length === 1 ? 'option' : 'options'}${hiddenSignals > 0 ? ` (${hiddenSignals} moved beyond ordinary run-to-run variation)` : ''}`}
        </button>
      ) : null}
    </div>
  )
}

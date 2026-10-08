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
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS, action, icon } from '../../components/results/analysisNew/panelSurfaces'
import { NodeMark } from '../../components/results/analysisNew/nodeMarks'
import { PanelIconButton } from '../../components/results/analysisNew/PanelIconButton'
import { FIGURE_MARKER_W, FIGURE_RADIUS, FIGURE_TRACK_HEIGHT, FIGURE_TRACK_TONE, markerLeft } from '../../components/results/analysisNew/PanelFigure'
import { movementVerdictText, WHATS_CHANGED_TESTID } from '../../components/results/analysisNew/sections/WhatsChanged'
import type { RunDeltaMovement } from '../../components/results/analysisNew/runDeltaView'
import { sortOptionsForDisplay } from '../../components/results/utils/optionDisplayOrder'
import type { LatestShare } from './latestOnlyShares'

/** Options shown before "Show N more" — enough for most decisions, short enough to keep the changes in view. */
export const OPTIONS_SHOWN_FIRST = 3
export const COMPARE_SUPPORT_TESTID = 'compare-support'

/**
 * How to read the figures (v3 handoff §3): what a marker is, in the glossary's own words for a run share
 * (`METRIC_LEGEND_ROWS`, verb "supported", DL #87 6004906342), and what it is not. Both runs share one scale.
 */
export const COMPARE_SUPPORT_HELP =
  'Each marker is the share of runs that supported the option under this model’s assumptions, on one 0 to 100% scale for both runs. It is not the option’s chance of meeting your goal.'

/** The two ends of the shared track (v3 artefact axis). Positions only: never a value, never better or worse. */
export const COMPARE_SUPPORT_AXIS = ['Less often', 'More often'] as const

/** Which run's markers the legend emphasises; both stay drawn (v3 handoff §3, optional emphasis). */
type Series = 'earlier' | 'latest' | null

/** An option's link to its node on the canvas, or `null` when the canvas has no node for it now. */
export type OptionCanvasLink = (optionId: string) => { focus: () => void; on: () => void; off: () => void } | null

/** The producer's movements in the ONE display order every options surface uses. */
export function orderMovements(movements: readonly RunDeltaMovement[], designationsWithheld: boolean): RunDeltaMovement[] {
  const rows = movements.map((m) => ({ m, winProbability: m.current, expected: null, notAnalysed: false }))
  return sortOptionsForDisplay(rows, { designationsWithheld }).map((r) => r.m)
}

const MARKER = 'absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full'

/**
 * The connector runs centre to centre of the two CLAMPED markers, so near 0% or 100% it still meets both dots. Both
 * ends come from `markerLeft()` (the marker's left edge) plus half a marker, never from the raw share.
 */
export function connectorSpan(prior: number, current: number): { left: string; width: string } {
  const from = markerLeft(Math.min(prior, current))
  const to = markerLeft(Math.max(prior, current))
  return { left: `calc(${from} + ${FIGURE_MARKER_W / 2}px)`, width: `calc(${to} - ${from})` }
}

/** Two positions on one track. Only ever mounted for a movement whose magnitude the producer licenses. */
function SupportPairFigure({ m, series = null }: { m: RunDeltaMovement; series?: Series }): JSX.Element {
  const moved = m.current !== m.prior
  const dashed = m.noiseVerdict !== 'signal'
  // Emphasis dims the OTHER run's marker; it never hides it, so the pair always stays a pair.
  const dim = (which: 'earlier' | 'latest') => (series !== null && series !== which ? ' opacity-40' : '')
  return (
    <div className="relative h-[15px] mt-1.5" aria-hidden="true" data-testid={`${COMPARE_SUPPORT_TESTID}-figure`}
      data-connector={dashed ? 'dashed' : 'solid'} data-emphasis={series ?? undefined}>
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FIGURE_TRACK_TONE}`} />
      {moved ? (
        <div className={`absolute top-1/2 -translate-y-1/2 border-t-2 ${dashed ? 'border-dashed border-text-light' : 'border-solid border-info/60'}`}
          style={connectorSpan(m.prior, m.current)} data-testid={`${COMPARE_SUPPORT_TESTID}-connector`} />
      ) : null}
      <span className={`${MARKER} bg-panel border-2 border-text-light${dim('earlier')}`} style={{ left: markerLeft(m.prior) }} data-marker="previous" />
      <span className={`${MARKER} bg-info border-2 border-panel ring-1 ring-info/50${dim('latest')}`} style={{ left: markerLeft(m.current) }} data-marker="latest" />
    </div>
  )
}

/** The legend names both runs; pressing one emphasises its markers (press again to clear). Both always stay drawn. */
function Legend({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }): JSX.Element {
  const item = (which: 'earlier' | 'latest', name: string, dot: string) => (
    <button
      type="button"
      className={`${typography.panelMeta} ${action('inline')} no-underline hover:underline inline-flex items-center gap-1 ${series === which ? 'text-text-header' : 'text-text-light'}`}
      aria-pressed={series === which}
      title={`Emphasise the ${which} positions; both stay shown`}
      onClick={() => onSeries(series === which ? null : which)}
      data-testid={`${COMPARE_SUPPORT_TESTID}-legend-${which}`}
    >
      <span className={`inline-block w-[9px] h-[9px] rounded-full ${dot}`} aria-hidden="true" />{name}
    </button>
  )
  return (
    <div className="flex items-center gap-3 mt-1">
      {item('earlier', 'Earlier', 'bg-panel border-2 border-text-light')}
      {item('latest', 'Latest', 'bg-info')}
    </div>
  )
}

/** A movement drawn without a figure (`not_noise_qualified`): its direction as an arrow beside the words, no track. */
const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, level: ArrowRight } as const

/** Reasoning's option name (OptionsComparison): the option's own mark, then its name; the name is the canvas link. */
const OPTION_NAME = `${typography.panelBody} text-text-body break-words text-left`

/** An option's mark and name; the name is its canvas link when the canvas has the option now. Shared by both option lists. */
export function OptionNameLink({ name, link }: { name: string; link: ReturnType<OptionCanvasLink> }): JSX.Element {
  const label = <><NodeMark kind="option" className={`${icon('inline')} mr-1 inline-block align-[-1px]`} />{name}</>
  return link ? (
    <button type="button" className={`${OPTION_NAME} inline-flex items-center min-h-[24px] rounded-md -ml-1 px-1 py-0.5 cursor-pointer transition-colors hover:text-info ${ACTION_FOCUS}`}
      aria-label={`Show on the canvas: ${name}`} onClick={link.focus} onMouseEnter={link.on} onMouseLeave={link.off} onFocus={link.on} onBlur={link.off}>
      {label}
    </button>
  ) : <span className={`${OPTION_NAME} block`}>{label}</span>
}

function OptionRow({ m, link, series }: { m: RunDeltaMovement; link: ReturnType<OptionCanvasLink>; series: Series }): JSX.Element {
  const name = m.label ?? 'An option this run does not name'
  return (
    <li className="py-1.5" data-testid={`${COMPARE_SUPPORT_TESTID}-option`} data-option-id={m.optionId} data-verdict={m.noiseVerdict}
      data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
      <OptionNameLink name={name} link={link} />
      {m.mayShowMagnitude ? <SupportPairFigure m={m} series={series} /> : null}
      {m.mayShowMagnitude ? (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>{movementVerdictText(m)}</p>
      ) : (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0 flex items-start gap-1.5`} data-direction={m.direction}>
          {(() => { const Arrow = DIRECTION_ICON[m.direction]; return <Arrow className={`${icon('inline')} flex-shrink-0 mt-0.5`} aria-hidden="true" data-testid={`${COMPARE_SUPPORT_TESTID}-direction`} /> })()}
          <span>{movementVerdictText(m)}</span>
        </p>
      )}
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
  const [help, setHelp] = useState(false)
  const [series, setSeries] = useState<Series>(null)
  if (movements.length === 0) return null
  const ordered = orderMovements(movements, designationsWithheld)
  const shown = all ? ordered : ordered.slice(0, OPTIONS_SHOWN_FIRST)
  const hidden = ordered.slice(OPTIONS_SHOWN_FIRST)
  const hiddenSignals = hidden.filter((m) => m.noiseVerdict === 'signal').length
  const anyFigure = shown.some((m) => m.mayShowMagnitude)
  return (
    <div className="mt-3" data-testid={COMPARE_SUPPORT_TESTID}>
      <div className="flex items-center gap-1">
        <p className={`${typography.panelMeta} text-text-light m-0`}>Support across simulated runs</p>
        <PanelIconButton Icon={Info} inline label="How to read this comparison" expanded={help} onClick={() => setHelp((v) => !v)} testId={`${COMPARE_SUPPORT_TESTID}-help-toggle`} />
      </div>
      {help ? <p className={`${typography.panelMeta} text-text-body mt-1 mb-0`} data-testid={`${COMPARE_SUPPORT_TESTID}-help`}>{COMPARE_SUPPORT_HELP}</p> : null}
      {anyFigure ? <Legend series={series} onSeries={setSeries} /> : null}
      <ul className="list-none p-0 mt-1 mb-0" data-testid={`${WHATS_CHANGED_TESTID}-movements`}>
        {shown.map((m) => <OptionRow key={m.optionId} m={m} link={optionLink(m.optionId)} series={series} />)}
      </ul>
      {anyFigure ? (
        <div className={`${typography.panelMeta} text-text-light flex justify-between mt-0.5`} aria-hidden="true" data-testid={`${COMPARE_SUPPORT_TESTID}-axis`}>
          <span>{COMPARE_SUPPORT_AXIS[0]}</span><span>{COMPARE_SUPPORT_AXIS[1]}</span>
        </div>
      ) : null}
      {hidden.length > 0 ? (
        <button type="button" className={`${typography.panelMeta} ${action('inline')} mt-1 text-left justify-start`} aria-expanded={all} onClick={() => setAll((v) => !v)}
          data-testid={`${COMPARE_SUPPORT_TESTID}-more`}>
          {all
            ? 'Show less'
            : `Show ${hidden.length} more ${hidden.length === 1 ? 'option' : 'options'}${hiddenSignals > 0 ? ` (${hiddenSignals} moved beyond ordinary run-to-run variation)` : ''}`}
        </button>
      ) : null}
    </div>
  )
}

/**
 * The first sized pair (`prior_withheld`, DL 58e392 ruling 2): the earlier Run held its shares back, so each option
 * gets its LATEST marker only, on the same track, from the latest Run's own shares (`latestOnlyShares`). Science
 * github-93's words (8 Oct): no cause for the earlier side, because `prior_withheld` covers any recorded withhold.
 * No movement, no verdict, no connector: there is nothing to compare a position with.
 */
export const COMPARE_LATEST_ONLY_TEXT = 'The earlier run held these figures back, so only the latest run’s are drawn.'
export const COMPARE_EARLIER_NOT_SHOWN = 'Earlier: not shown'
export const COMPARE_LATEST_ONLY_TESTID = 'compare-latest-only'

export function CompareLatestOnlyFigures({ shares, designationsWithheld, optionLink }: {
  shares: readonly LatestShare[]
  designationsWithheld: boolean
  optionLink: OptionCanvasLink
}): JSX.Element | null {
  const [all, setAll] = useState(false)
  const [help, setHelp] = useState(false)
  if (shares.length === 0) return null
  const ordered = sortOptionsForDisplay(shares.map((m) => ({ m, winProbability: m.current, expected: null, notAnalysed: false })), { designationsWithheld }).map((r) => r.m)
  const shown = all ? ordered : ordered.slice(0, OPTIONS_SHOWN_FIRST)
  const hidden = ordered.length - shown.length
  return (
    <div className="mt-3" data-testid={COMPARE_LATEST_ONLY_TESTID} data-wire-fields="run_delta.win_probabilities_unavailable option_probabilities[].win_probability">
      <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${COMPARE_LATEST_ONLY_TESTID}-note`}>{COMPARE_LATEST_ONLY_TEXT}</p>
      <div className="flex items-center gap-1 mt-2">
        <p className={`${typography.panelMeta} text-text-light m-0`}>Support across simulated runs</p>
        <PanelIconButton Icon={Info} inline label="How to read this comparison" expanded={help} onClick={() => setHelp((v) => !v)} testId={`${COMPARE_LATEST_ONLY_TESTID}-help-toggle`} />
      </div>
      {help ? <p className={`${typography.panelMeta} text-text-body mt-1 mb-0`}>{COMPARE_SUPPORT_HELP}</p> : null}
      <div className={`${typography.panelMeta} flex items-center gap-3 mt-1`} data-testid={`${COMPARE_LATEST_ONLY_TESTID}-legend`}>
        <span className="inline-flex items-center gap-1 text-text-light">
          <span className="inline-block w-[9px] h-[9px] rounded-full border-2 border-dashed border-text-light" aria-hidden="true" />{COMPARE_EARLIER_NOT_SHOWN}
        </span>
        <span className="inline-flex items-center gap-1 text-text-header">
          <span className="inline-block w-[9px] h-[9px] rounded-full bg-info" aria-hidden="true" />Latest
        </span>
      </div>
      <ul className="list-none p-0 mt-1 mb-0">
        {shown.map((m) => {
          const name = m.label ?? 'An option this run does not name'
          return (
            <li key={m.optionId} className="py-1.5" data-testid={`${COMPARE_LATEST_ONLY_TESTID}-option`} data-option-id={m.optionId}>
              <OptionNameLink name={name} link={optionLink(m.optionId)} />
              <div className="relative h-[15px] mt-1.5" aria-hidden="true" data-testid={`${COMPARE_LATEST_ONLY_TESTID}-figure`}>
                <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FIGURE_TRACK_TONE}`} />
                <span className={`${MARKER} bg-info border-2 border-panel ring-1 ring-info/50`} style={{ left: markerLeft(m.current) }} data-marker="latest" data-current={m.current} />
              </div>
            </li>
          )
        })}
      </ul>
      <div className={`${typography.panelMeta} text-text-light flex justify-between mt-0.5`} aria-hidden="true">
        <span>{COMPARE_SUPPORT_AXIS[0]}</span><span>{COMPARE_SUPPORT_AXIS[1]}</span>
      </div>
      {hidden > 0 || all ? (
        <button type="button" className={`${typography.panelMeta} ${action('inline')} mt-1 text-left justify-start`} aria-expanded={all} onClick={() => setAll((v) => !v)}
          data-testid={`${COMPARE_LATEST_ONLY_TESTID}-more`}>
          {all ? 'Show less' : `Show ${hidden} more ${hidden === 1 ? 'option' : 'options'}`}
        </button>
      ) : null}
    </div>
  )
}

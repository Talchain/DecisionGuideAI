import { typography } from '../../../../styles/typography'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { GOAL_FIT_BASIS_CAVEAT_COPY, goalFitBaseCaveatCopy } from '../../utils/goalFitBasisCaveatCopy'
import { formatThreshold } from '../../RangeVisualization'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { MODEL_SCORE_COPY } from '../modelScore'
import { goalChanceDriverLines, goalChanceRangeLine, goalChanceTargetWords } from '../../analysis-hero/goalChanceCopy'
import { goalChanceHeroSays } from '../../utils/goalChanceLicence'
import { optionChanceCell, runViewOf } from '../../../../canvas/runView/runView'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionsComparisonSection } from '../analysisNewTypes'
import { SectionShell } from './SectionShell'

export interface DecisionMatrixProps {
  data: ResultsSectionDataReturn
  comparison: OptionsComparisonSection
  optionOrder: readonly string[]
  run: { hash?: string; runId?: string; computedAt?: string; graphHash?: string; completedAt?: number }
  isStale: boolean
}

const STALE_LINE = 'This Run is stale. Run the analysis again to view the decision matrix.'

function rangeDriverLine(line: string | null) {
  // Only the separate driver clause belongs here; the chance clause is resolved by RunView.
  const boundary = ' chance of meeting your goal, in this model. '
  const index = line?.indexOf(boundary) ?? -1
  return line === null || index === -1 ? null : line.slice(index + boundary.length)
}

/** Read-only projection of the held Run; disclosure state belongs to SectionShell. */
export function DecisionMatrix(props: DecisionMatrixProps) {
  const { run } = props
  const identity = JSON.stringify([run.hash, run.runId, run.computedAt, run.graphHash, run.completedAt])
  return <DecisionMatrixRun key={identity} {...props} />
}

function DecisionMatrixRun({ data, comparison, optionOrder, run, isStale }: DecisionMatrixProps) {
  if (isStale) {
    return <p className={`${typography.panelBody} text-text-body`} data-testid="decision-matrix" role="status">Decision matrix: {STALE_LINE}</p>
  }

  const rec = data.recommendation
  const runLicence = data.goalChanceLicence ?? null
  const heroSays = goalChanceHeroSays(rec.goalThreshold, rec.allOptions, runLicence)
  const licence = heroSays ? runLicence : null
  const labelOf = (id: string) => {
    const option = rec.allOptions.find((o) => o.id === id)
    return option ? stripEncodingNotation(option.label) : null
  }
  const driverLines: Readonly<Record<string, string>> = licence?.form === 'all_likely_to_miss' ? {} : goalChanceDriverLines(
    licence, data.goalChanceDriverNames, licence?.form === 'similar' ? licence.similarOptionIds : [],
  )
  // Follow the caller's model option order, never the results hook's win-share ranking.
  const order = new Map(optionOrder.map((id, index) => [id, index]))
  const options = [...rec.allOptions].sort((a, b) =>
    (order.get(a.id) ?? optionOrder.length) - (order.get(b.id) ?? optionOrder.length))
  const range = data.goalChanceRange ?? null // readGoalChanceRange, already read from this Run by the hook
  const rangeLabelOf = data.goalChanceDriverNames?.labelOf ?? labelOf
  // Legacy projections can carry the already-read licence/range without a view. Preserve their old empty fallback.
  const view = data.runView ?? { ...runViewOf(null), goalChance: runLicence, goalChanceRange: range }
  // Both clauses were read verbatim by readGoalChanceHorizonLine; the licence has the hero's precedence.
  const horizonLine = licence?.horizonLine ?? range?.horizonLine ?? null
  const rows = options.map((option) => {
    const id = option.id
    const existingRow = comparison.rows.find((r) => r.id === id)
    const withheld = rec.goalFiguresWithheldMessage ?? null
    const rangeEntry = range?.rangeByOption[id]
    const rangeLine = rangeEntry === undefined ? null : goalChanceRangeLine(rangeEntry, rangeLabelOf(id), rangeLabelOf, range?.target)
    // ⭐ RunView PR 1: ONE source for the chance (CEE's licence, via the Run's view). The report's own figure is never
    // shown; a Run with goal figures but no licence says RUN_AGAIN_FOR_CHANCE (DL ruling 1, 8 Oct).
    const viewChance = data.runView?.chanceOf(id)
    const readout = rangeEntry !== undefined || option.notAnalysed === true ? null
      : viewChance?.kind === 'figure' ? viewChance.words : null
    const chance = optionChanceCell(view, id, {
      goalChanceHeroSays: heroSays,
      goalFiguresWithheldMessage: withheld,
      goalCertaintyUnearned: option.goalCertaintyUnearned,
      notAnalysed: option.notAnalysed,
      labelOf,
      rangeLabelOf,
    }).text ?? 'Not shown.'
    const outcomeRange = existingRow?.kind === 'analysed' ? existingRow.outcomeRange : null
    const format = (value: number) => formatThreshold(value, rec.outcomeUnit, rec.outcomeUnitSymbol, rec.isNormalised)
    // The audit's formatter: samples without an anchored level stay explicitly model scores.
    const rangeFigure = rec.isNormalised === true || !goalBandIsInUserUnits() ? MODEL_SCORE_COPY.readout : format
    const outcome = outcomeRange !== null
      ? `${rangeFigure(outcomeRange.p10)} to ${rangeFigure(outcomeRange.p90)}`
      : null
    const centre = outcomeRange?.p50 ?? null
    const centreReadout = centre === null ? null : rangeFigure(centre)
    return {
      id, label: stripEncodingNotation(option.label), chance,
      driver: rangeEntry !== undefined
        ? rangeDriverLine(rangeLine)
        : withheld !== null ? null : option.goalCertaintyUnearned == null ? driverLines[id] ?? null : null,
      outcome,
      centreReadout,
      caveat: withheld !== null || rangeEntry !== undefined || readout === null ? null : option.goalFitIsModelledBasis === true ? GOAL_FIT_BASIS_CAVEAT_COPY : null,
      baseCaveat: withheld !== null || rangeEntry !== undefined || readout === null ? null : goalFitBaseCaveatCopy(option.goalFitBaseCaveat),
    }
  })
  const hasOutcome = rows.some((r) => r.outcome !== null || r.centreReadout !== null)
  // Same human-readable time format as ComparePairSections' RunTime; no new stamp format.
  const runTime = run.computedAt && Number.isFinite(Date.parse(run.computedAt))
    ? new Date(run.computedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const target = licence === null ? null : goalChanceTargetWords(licence)
  const header = `${typography.panelBody} text-text-light [font-weight:inherit] text-left px-1 py-2 first:pl-0 last:pr-0`
  const cell = `${typography.panelBody} align-top border-t border-panel-border px-1 py-2 first:pl-0 last:pr-0`

  return (
    <SectionShell title="Decision matrix" count={null} variant="disclose" testId="decision-matrix">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-stamp"
        data-graph-hash={run.graphHash} data-computed-at={run.computedAt} data-run-id={run.runId}>
        From the Run{runTime ? ` at ${runTime}` : ' (time not recorded)'}
      </p>
      {target !== null && <p className={`${typography.panelMeta} text-text-light`}>Goal: {target}</p>}
      <div className="max-w-full overflow-auto">
        <table className={`${typography.panelBody} text-text-body my-2 w-full border-collapse tabular-nums`}>
          <caption className="sr-only">Decision matrix</caption>
          <thead><tr>
            <th scope="col" className={header}>Option</th>
            <th scope="col" className={header}>Chance of meeting your goal, in this model</th>
            <th scope="col" className={header}>Its chance rests most on</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-testid={`decision-matrix-row-${row.id}`}>
            <th scope="row" className={`${cell} [font-weight:inherit] text-left`}>{row.label}</th>
            <td className={cell} data-testid={`decision-matrix-chance-${row.id}`}>
              <span>{row.chance}</span>
              {row.caveat && <p className={`${typography.panelMeta} text-text-light`}>{row.caveat}</p>}
              {row.baseCaveat && <p className={`${typography.panelMeta} text-text-light`}>{row.baseCaveat}</p>}
            </td>
            <td className={cell} data-testid={`decision-matrix-driver-${row.id}`}>{row.driver}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {horizonLine !== null && <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-horizon">{horizonLine}</p>}
      {hasOutcome && <SectionShell title="Modelled outcomes" count={null} variant="disclose" testId="decision-matrix-outcomes">
        {rows.map((row) => <div key={row.id} className={`${typography.panelBody} text-text-body py-2`}>
          <p data-testid={`decision-matrix-outcome-${row.id}`}>{row.label}: {row.centreReadout ?? 'Not shown.'}</p>
          {row.outcome !== null && <p>Modelled outcome range: {row.outcome}</p>}
        </div>)}
      </SectionShell>}
    </SectionShell>
  )
}

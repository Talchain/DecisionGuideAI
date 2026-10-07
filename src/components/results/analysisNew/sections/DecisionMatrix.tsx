import { typography } from '../../../../styles/typography'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { formatGoalProbability } from '../../utils/displayFloors'
import { GOAL_FIT_BASIS_CAVEAT_COPY, goalFitBaseCaveatCopy } from '../../utils/goalFitBasisCaveatCopy'
import { formatThreshold } from '../../RangeVisualization'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { MODEL_SCORE_COPY } from '../modelScore'
import { goalChanceDriverLines, goalChanceOptionLines, goalChanceRangeLine, goalChanceTargetWords } from '../../analysis-hero/goalChanceCopy'
import { goalProbabilityWords } from '../../utils/goalAnchorCopy'
import { goalChanceHeroSays } from '../../utils/goalChanceLicence'
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

function splitRangeLine(line: string | null) {
  // S3's goalChanceRangeLine ends its chance sentence here; slice both clauses verbatim.
  const boundary = ' chance of meeting your goal, in this model. '
  const index = line?.indexOf(boundary) ?? -1
  if (line === null || index === -1) return { chance: line, driver: null }
  const end = index + boundary.length
  return { chance: line.slice(0, end - 1), driver: line.slice(end) }
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
  const licence = goalChanceHeroSays(rec.goalThreshold, rec.allOptions, runLicence) ? runLicence : null
  const labelOf = (id: string) => {
    const option = rec.allOptions.find((o) => o.id === id)
    return option ? stripEncodingNotation(option.label) : null
  }
  const chanceLines = licence === null ? null : goalChanceOptionLines(licence, labelOf)
  const driverLines: Readonly<Record<string, string>> = licence?.form === 'all_likely_to_miss' ? {} : goalChanceDriverLines(
    licence, data.goalChanceDriverNames, licence?.form === 'similar' ? licence.similarOptionIds : [],
  )
  // Follow the caller's model option order, never the results hook's win-share ranking.
  const order = new Map(optionOrder.map((id, index) => [id, index]))
  const options = [...rec.allOptions].sort((a, b) =>
    (order.get(a.id) ?? optionOrder.length) - (order.get(b.id) ?? optionOrder.length))
  const range = data.goalChanceRange ?? null // readGoalChanceRange, already read from this Run by the hook
  const rangeLabelOf = data.goalChanceDriverNames?.labelOf ?? labelOf
  // Both clauses were read verbatim by readGoalChanceHorizonLine; the licence has the hero's precedence.
  const horizonLine = licence?.horizonLine ?? range?.horizonLine ?? null
  const rows = options.map((option) => {
    const id = option.id
    const existingRow = comparison.rows.find((r) => r.id === id)
    const chanceIndex = licence?.optionIds.indexOf(id) ?? -1
    const licensed = licence !== null && chanceLines !== null && licence.optionIds.includes(id)
    const withheld = rec.goalFiguresWithheldMessage ?? null
    const rangeEntry = range?.rangeByOption[id]
    const rangeLine = rangeEntry === undefined ? null : goalChanceRangeLine(rangeEntry, rangeLabelOf(id), rangeLabelOf)
    const rangeClauses = splitRangeLine(rangeLine)
    const readout = rangeEntry !== undefined ? null : licensed
      ? licence.withheldOptionIds.includes(id) ? null : goalProbabilityWords(`${licence.pctByOption[id]}%`)
      : rec.goalThreshold != null && option.goalProbability != null && option.notAnalysed !== true
        ? goalProbabilityWords(formatGoalProbability(option.goalProbability, option.nValidSamples))
        : null
    // A range first: S3's reader (readGoalChanceRange) already bars it on a Run-wide withhold by CODE, and the
    // withheld SENTENCE also fires on the range's own causes (PLACEHOLDER_PATH, TARGET_NOT_TESTABLE), so keying on it
    // would hide every real range (Science, 7 Oct). Then the Run-level withhold, then the option's point or line.
    // Unresolved range labels never fall back to a raw point estimate.
    const chance = (rangeEntry !== undefined ? rangeClauses.chance : withheld ?? option.goalCertaintyUnearned?.say ?? (licensed ? chanceLines[chanceIndex] : readout)) ?? 'Not shown.'
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
        ? rangeClauses.driver
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
            <th scope="col" className={header}>Rests most on</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-testid={`decision-matrix-row-${row.id}`}>
            <th scope="row" className={`${cell} [font-weight:inherit] text-left`}>{row.label}</th>
            <td className={cell} data-testid={`decision-matrix-chance-${row.id}`}>
              <span>{row.chance}</span>
              {row.caveat && <p className={`${typography.panelMeta} text-text-light`}>{row.caveat}</p>}
              {row.baseCaveat && <p className={`${typography.panelMeta} text-text-light`}>{row.baseCaveat}</p>}
            </td>
            <td className={cell} data-testid={`decision-matrix-driver-${row.id}`}>{row.driver ?? 'None shown'}</td>
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

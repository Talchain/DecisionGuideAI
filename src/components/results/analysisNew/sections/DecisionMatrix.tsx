import { TechnicalDisclosure } from '../../../../canvas/ui/inspector-v2/shared/TechnicalDisclosure'
import { typography } from '../../../../styles/typography'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { formatThreshold } from '../../RangeVisualization'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { MODEL_SCORE_COPY } from '../modelScore'
import { goalChanceHeroSays } from '../../utils/goalChanceLicence'
import { optionChanceCellFromResults } from '../../optionChanceCellFromResults'
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
  // Follow the caller's model option order, never the results hook's win-share ranking.
  const order = new Map(optionOrder.map((id, index) => [id, index]))
  const options = [...rec.allOptions].sort((a, b) =>
    (order.get(a.id) ?? optionOrder.length) - (order.get(b.id) ?? optionOrder.length))
  // Both clauses were read verbatim by readGoalChanceHorizonLine; the licence has the hero's precedence.
  const horizonLine = licence?.horizonLine ?? data.goalChanceRange?.horizonLine ?? null
  const rows = options.map((option) => {
    const id = option.id
    const existingRow = comparison.rows.find((r) => r.id === id)
    // The chance cell is CEE's served cell, verbatim (RunView's one resolver); the matrix composes no chance words.
    const chanceCell = optionChanceCellFromResults(data, id)
    const outcomeRange = existingRow?.kind === 'analysed' ? existingRow.outcomeRange : null
    const format = (value: number) => formatThreshold(value, rec.outcomeUnit, rec.outcomeUnitSymbol, rec.isNormalised)
    // The audit's formatter: samples without an anchored level stay explicitly model scores.
    const rangeFigure = rec.isNormalised === true || !goalBandIsInUserUnits() ? MODEL_SCORE_COPY.readout : format
    const outcome = outcomeRange !== null
      ? `${rangeFigure(outcomeRange.p10)} to ${rangeFigure(outcomeRange.p90)}`
      : null
    const centre = outcomeRange?.p50 ?? null
    return {
      id, label: stripEncodingNotation(option.label), chance: chanceCell.text,
      why: chanceCell.kind !== 'none' ? chanceCell.why : undefined,
      outcome,
      centreReadout: centre === null ? null : rangeFigure(centre),
    }
  })
  // No served cell for an option: the Run's own served withheld line, said once under the table, never per cell.
  const withheldLine = rows.some((r) => r.chance === null) ? rec.goalFiguresWithheldMessage ?? null : null
  const hasOutcome = rows.some((r) => r.outcome !== null || r.centreReadout !== null)
  // Same human-readable time format as ComparePairSections' RunTime; no new stamp format.
  const runTime = run.computedAt && Number.isFinite(Date.parse(run.computedAt))
    ? new Date(run.computedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const header = `${typography.panelBody} text-text-light [font-weight:inherit] text-left px-1 py-2 first:pl-0 last:pr-0`
  const cell = `${typography.panelBody} align-top border-t border-panel-border px-1 py-2 first:pl-0 last:pr-0`

  return (
    <SectionShell title="Decision matrix" count={null} variant="disclose" testId="decision-matrix">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-stamp"
        data-graph-hash={run.graphHash} data-computed-at={run.computedAt} data-run-id={run.runId}>
        From the Run{runTime ? ` at ${runTime}` : ' (time not recorded)'}
      </p>
      <div className="max-w-full overflow-auto">
        <table className={`${typography.panelBody} text-text-body my-2 w-full border-collapse tabular-nums`}>
          <caption className="sr-only">Decision matrix</caption>
          <thead><tr>
            <th scope="col" className={header}>Option</th>
            <th scope="col" className={header}>Chance of meeting your goal, in this model</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-testid={`decision-matrix-row-${row.id}`}>
            <th scope="row" className={`${cell} [font-weight:inherit] text-left`}>{row.label}</th>
            <td className={cell} data-testid={`decision-matrix-chance-${row.id}`}>
              {row.chance !== null && <span>{row.chance}</span>}
              {row.why && <TechnicalDisclosure visible label="Why?" openLabel="Hide why" compact>
                <span>{row.why}</span>
              </TechnicalDisclosure>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {withheldLine !== null && <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-withheld">{withheldLine}</p>}
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

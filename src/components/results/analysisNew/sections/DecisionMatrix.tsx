import { useState } from 'react'
import { typography } from '../../../../styles/typography'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { formatGoalProbability } from '../../utils/displayFloors'
import { GOAL_FIT_BASIS_CAVEAT_COPY, goalFitBaseCaveatCopy } from '../../utils/goalFitBasisCaveatCopy'
import { formatThreshold } from '../../RangeVisualization'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { formatModelScore, MODEL_SCORE_COPY } from '../modelScore'
import { goalChanceDriverLines, about as goalChanceFigure, goalChanceOptionLines, goalChanceTargetWords } from '../../analysis-hero/goalChanceCopy'
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

const SCORE_LABEL = "Your weighting (not Olumi's view)"
const STALE_LINE = 'This Run is stale. Run the analysis again to view the decision matrix.'

/** Only an ordinary displayed percentage is a scalar. Bounds such as <1% stay unscored. */
function displayedNumber(text: string): number | null {
  const match = /^(?:about )?(\d+(?:\.\d+)?)%$/.exec(text.trim())
  return match === null ? null : Number(match[1])
}

type WeightedColumn = 'chance' | 'outcome'

// Locale separators must be understood before a displayed model score can be weighted.
function displayedModelNumber(text: string): number | null {
  const parts = new Intl.NumberFormat().formatToParts(12345.6)
  const group = parts.find((p) => p.type === 'group')?.value
  const decimal = parts.find((p) => p.type === 'decimal')?.value
  const ungrouped = group === undefined ? text : text.split(group).join('')
  const normalised = decimal === undefined ? ungrouped : ungrouped.replace(decimal, '.')
  return /^-?\d+(?:\.\d+)?$/.test(normalised) ? Number(normalised) : null
}

/** No subscriptions, actions, or persistence: only the held Run and local input state. */
export function DecisionMatrix(props: DecisionMatrixProps) {
  const { run } = props
  const identity = JSON.stringify([run.hash, run.runId, run.computedAt, run.graphHash, run.completedAt])
  return <DecisionMatrixRun key={identity} {...props} />
}

function DecisionMatrixRun({ data, comparison, optionOrder, run, isStale }: DecisionMatrixProps) {
  const [weights, setWeights] = useState<Record<WeightedColumn, string>>({ chance: '', outcome: '' })
  if (isStale) {
    return <p className={`${typography.panelBody} text-text-body`} data-testid="decision-matrix" role="status">Decision matrix: {STALE_LINE}</p>
  }

  const rec = data.recommendation
  const licence = data.goalChanceLicence ?? null
  const labelOf = (id: string) => {
    const option = rec.allOptions.find((o) => o.id === id)
    return option ? stripEncodingNotation(option.label) : null
  }
  const chanceLines = licence === null ? null : goalChanceOptionLines(licence, labelOf)
  const driverLines = goalChanceDriverLines(licence, data.goalChanceDriverNames)
  const ids = [...new Set([...(licence?.optionIds ?? optionOrder), ...rec.allOptions.map((o) => o.id)])]
  const rows = ids.flatMap((id) => {
    const option = rec.allOptions.find((o) => o.id === id)
    if (!option) return []
    const existingRow = comparison.rows.find((r) => r.id === id)
    const chanceIndex = licence?.optionIds.indexOf(id) ?? -1
    const licensed = licence !== null && chanceLines !== null && licence.optionIds.includes(id)
    const withheld = rec.goalFiguresWithheldMessage ?? option.goalCertaintyUnearned?.say ?? null
    const readout = licensed
      ? licence.withheldOptionIds.includes(id) ? null : goalChanceFigure(licence.pctByOption[id])
      : rec.goalThreshold != null && option.goalProbability != null && option.notAnalysed !== true
        ? formatGoalProbability(option.goalProbability, option.nValidSamples)
        : null
    const chance = withheld ?? (licensed ? chanceLines[chanceIndex] : readout) ?? 'Not shown.'
    // A run-level withhold always outranks a figure, including an inconsistent licence.
    const numeric = withheld === null && readout !== null ? displayedNumber(readout) : null
    const range = existingRow?.kind === 'analysed' ? existingRow.outcomeRange : null
    const format = (value: number) => formatThreshold(value, rec.outcomeUnit, rec.outcomeUnitSymbol, rec.isNormalised)
    // The audit's formatter: samples without an anchored level stay explicitly model scores.
    const rangeFigure = rec.isNormalised === true || !goalBandIsInUserUnits() ? MODEL_SCORE_COPY.readout : format
    const outcome = range !== null
      ? `${rangeFigure(range.p10)} to ${rangeFigure(range.p90)}`
      : null
    const centre = range?.p50 ?? null
    const centreReadout = centre === null ? null : rangeFigure(centre)
    const centreNumber = centre === null || goalBandIsInUserUnits()
      ? null : displayedModelNumber(formatModelScore(centre))
    return [{
      id, label: existingRow?.label ?? stripEncodingNotation(option.label), chance, numeric,
      driver: withheld === null ? driverLines[id] ?? null : null,
      outcome,
      centreReadout,
      numbers: { chance: numeric, outcome: centreNumber },
      story: existingRow?.kind === 'analysed' ? existingRow.why : null,
      caveat: withheld !== null || readout === null ? null : option.goalFitIsModelledBasis === true ? GOAL_FIT_BASIS_CAVEAT_COPY : null,
      baseCaveat: withheld !== null || readout === null ? null : goalFitBaseCaveatCopy(option.goalFitBaseCaveat),
    }]
  })
  const weightedColumns = (Object.keys(weights) as WeightedColumn[]).filter((id) => weights[id].trim() !== '')
  const validWeights = weightedColumns.every((id) => Number.isFinite(Number(weights[id])) && Number(weights[id]) >= 0)
  const scoreOf = (row: typeof rows[number]) => weightedColumns.reduce((sum, id) => sum + row.numbers[id]! * Number(weights[id]), 0)
  const showScore = weightedColumns.length > 0 && validWeights && rows.length > 0
    && rows.every((r) => weightedColumns.every((id) => r.numbers[id] !== null) && Number.isFinite(scoreOf(r)))
  const hasDriver = rows.some((r) => r.driver !== null)
  const hasOutcome = rows.some((r) => r.outcome !== null)
  const hasCentre = rows.some((r) => r.centreReadout !== null)
  const hasStory = rows.some((r) => r.story)
  const target = licence === null ? null : goalChanceTargetWords(licence)
  const header = `${typography.panelMeta} text-text-light [font-weight:inherit] text-left px-1 py-2 first:pl-0 last:pr-0`
  const cell = 'align-top border-t border-panel-border px-1 py-2 first:pl-0 last:pr-0'

  return (
    <SectionShell title="Decision matrix" count={null} variant="disclose" testId="decision-matrix">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-stamp">
        From the Run{run.computedAt ? ` at ${run.computedAt}` : ' (time not recorded)'} · this model's version{run.graphHash ? ` (${run.graphHash})` : ' (version not recorded)'}
      </p>
      {target !== null && <p className={`${typography.panelMeta} text-text-light`}>Goal: {target}</p>}
      {(['chance', ...(hasCentre ? ['outcome'] : [])] as WeightedColumn[]).map((id) => <label key={id} className={`${typography.panelMeta} text-text-body block py-2`}>
        {id === 'chance' ? 'Chance weight (optional)' : 'Modelled outcome weight (optional)'}
        <input type="number" min="0" step="any" value={weights[id]} onChange={(e) => setWeights((prev) => ({ ...prev, [id]: e.target.value }))}
          className="ml-2 w-20 rounded border border-panel-border bg-panel px-2 py-1 text-text-body" />
      </label>)}
      {weightedColumns.length > 0 && !showScore && <p className={`${typography.panelMeta} text-text-light`}>A score needs valid weights and a displayed number for every option in each weighted column.</p>}
      {showScore && <p className={`${typography.panelMeta} text-text-light`}>Score = sum of displayed numbers × your column weights. Chance uses percentage points; the modelled outcome has no unit.</p>}
      <div className="max-w-full overflow-auto">
        <table className={`${typography.panelMeta} text-text-body my-2 w-full border-collapse tabular-nums`}>
          <caption className="sr-only">Decision matrix</caption>
          <thead><tr>
            <th scope="col" className={header}>Option</th>
            <th scope="col" className={header}>Chance of meeting the goal</th>
            {hasDriver && <th scope="col" className={header}>It rests most on</th>}
            {hasCentre && <th scope="col" className={header}>Modelled outcome</th>}
            {hasOutcome && <th scope="col" className={header}>Modelled outcome range</th>}
            {hasStory && <th scope="col" className={header}>From the Run</th>}
            {showScore && <th scope="col" className={header}>{SCORE_LABEL}</th>}
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-testid={`decision-matrix-row-${row.id}`}>
            <th scope="row" className={`${cell} [font-weight:inherit] text-left`}>{row.label}</th>
            <td className={cell} data-testid={`decision-matrix-chance-${row.id}`}>
              <span>{row.chance}</span>
              {row.caveat && <p className="text-text-light">{row.caveat}</p>}
              {row.baseCaveat && <p className="text-text-light">{row.baseCaveat}</p>}
            </td>
            {hasDriver && <td className={cell} data-testid={`decision-matrix-driver-${row.id}`}>{row.driver ?? '—'}</td>}
            {hasCentre && <td className={cell} data-testid={`decision-matrix-outcome-${row.id}`}>{row.centreReadout ?? 'Not shown.'}</td>}
            {hasOutcome && <td className={cell}>{row.outcome ?? 'Not shown.'}</td>}
            {hasStory && <td className={cell}>{row.story ?? '—'}</td>}
            {showScore && <td className={cell} data-testid={`decision-matrix-score-${row.id}`}>{Number(scoreOf(row).toFixed(2))}</td>}
          </tr>)}</tbody>
        </table>
      </div>
    </SectionShell>
  )
}

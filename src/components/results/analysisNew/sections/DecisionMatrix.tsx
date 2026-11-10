import { TechnicalDisclosure } from '../../../../canvas/ui/inspector-v2/shared/TechnicalDisclosure'
import { typography } from '../../../../styles/typography'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { formatThreshold } from '../../RangeVisualization'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { MODEL_SCORE_COPY } from '../modelScore'
import { optionChanceCellFromResults } from '../../optionChanceCellFromResults'
import { GoalReadingLine } from '../../GoalReadingLine'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionsComparisonSection } from '../analysisNewTypes'
import { SectionShell } from './SectionShell'
import type { ReactNode } from 'react'

export interface DecisionMatrixProps {
  data: ResultsSectionDataReturn
  comparison: OptionsComparisonSection
  optionOrder: readonly string[]
  run: { hash?: string; runId?: string; computedAt?: string; graphHash?: string; completedAt?: number }
  isStale: boolean
}

const STALE_LINE = 'This Run is stale. Run the analysis again to see the options side by side.'

/** Read-only projection of the held Run; disclosure state belongs to SectionShell. */
export function DecisionMatrix(props: DecisionMatrixProps) {
  const { run } = props
  const identity = JSON.stringify([run.hash, run.runId, run.computedAt, run.graphHash, run.completedAt])
  return <DecisionMatrixRun key={identity} {...props} />
}

/**
 * What the matrix draws, whichever product feeds it. The previous product builds it from CEE's Run (`DecisionMatrixRun` below);
 * the olumi-core lane builds it from core's View (`olumiView/legacy/coreViewToLegacy.ts`). Every string is the producer's own words:
 * the table formats, rounds and composes nothing.
 */
export interface MatrixColumn { id: string | null; label: string | null; at?: string }
export interface MatrixCell { text: string | null; why: string | null; at?: string }
export interface MatrixRow { id: string; label: string; cells: MatrixCell[]; outcome: string | null; centreReadout: string | null; outcomeTitle?: string; outcomeAt?: string; labelAt?: string }
/** The table's own labels: the only words in it that are not the producer's. */
export const MATRIX_LABELS = { title: 'Options side by side', why: 'Why?', hideWhy: 'Hide why', outcomes: 'Modelled outcomes', noOutcome: 'No modelled outcome for this option.', range: 'Modelled outcome range: ', sep: ': ' } as const
export interface DecisionMatrixRows {
  /** Which run or version the cells come from; null when the producer names none. */
  stamp: { text: string; at?: string; graphHash?: string; computedAt?: string; runId?: string } | null
  /** One per aim. A single column draws no header row, as the previous product did. */
  columns: MatrixColumn[]
  rows: MatrixRow[]
  /** Said once under the table, never per cell. */
  withheld: { text: string; at?: string }[]
  /** Drawn under the table while any cell shows a chance. */
  readingLine?: ReactNode
}

function DecisionMatrixRun({ data, comparison, optionOrder, run, isStale }: DecisionMatrixProps) {
  if (isStale) {
    return <p className={`${typography.panelBody} text-text-body`} data-testid="decision-matrix" role="status">Options side by side: {STALE_LINE}</p>
  }

  const rec = data.recommendation
  // Follow the caller's model option order, never the results hook's win-share ranking.
  const order = new Map(optionOrder.map((id, index) => [id, index]))
  const options = [...rec.allOptions].sort((a, b) =>
    (order.get(a.id) ?? optionOrder.length) - (order.get(b.id) ?? optionOrder.length))
  const rows: MatrixRow[] = options.map((option) => {
    const id = option.id
    const existingRow = comparison.rows.find((r) => r.id === id)
    // The chance cell is CEE's served cell, verbatim (RunView's one resolver); the matrix composes no chance words, not even
    // a column label (CEE's face names the option and the goal itself).
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
      id, label: stripEncodingNotation(option.label),
      cells: [{ text: chanceCell.text, why: chanceCell.kind !== 'none' ? chanceCell.why ?? null : null }],
      outcome,
      centreReadout: centre === null ? null : rangeFigure(centre),
    }
  })
  // No served cell for an option: the Run's own served withheld line, said once under the table, never per cell.
  const withheldLine = rows.some((r) => r.cells[0]!.text === null) ? rec.goalFiguresWithheldMessage ?? null : null
  // Same human-readable time format as ComparePairSections' RunTime; no new stamp format.
  const runTime = run.computedAt && Number.isFinite(Date.parse(run.computedAt))
    ? new Date(run.computedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  return <DecisionMatrixTable
    stamp={{ text: `From the Run${runTime ? ` at ${runTime}` : ' (time not recorded)'}`, graphHash: run.graphHash, computedAt: run.computedAt, runId: run.runId }}
    columns={[{ id: null, label: null }]}
    rows={rows}
    withheld={withheldLine === null ? [] : [{ text: withheldLine }]}
    // CEE #3059: beside the chances only while one is shown; the reading they rest on is Olumi's, said and correctable.
    readingLine={<GoalReadingLine reading={data.goalChanceLicence?.goalReading} testId="decision-matrix-goal-reading" />}
  />
}

/** The matrix as drawn: the previous product's markup, test ids and words, fed by either producer. */
export function DecisionMatrixTable({ stamp, columns, rows, withheld, readingLine = null }: DecisionMatrixRows) {
  const hasOutcome = rows.some((r) => r.outcome !== null || r.centreReadout !== null)
  const cell = `${typography.panelBody} align-top px-1 py-2 first:pl-0 last:pr-0`
  const header = columns.length > 1

  return (
    <SectionShell title="Options side by side" count={null} variant="disclose" testId="decision-matrix">
      {stamp !== null && <p className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-stamp"
        data-graph-hash={stamp.graphHash} data-computed-at={stamp.computedAt} data-run-id={stamp.runId} data-view={stamp.at}>
        {stamp.text}
      </p>}
      <div className="max-w-full overflow-auto">
        <table className={`${typography.panelBody} text-text-body my-2 w-full border-collapse tabular-nums`}>
          <caption className="sr-only">{MATRIX_LABELS.title}</caption>
          {header && <thead><tr>
            <td className={cell} />
            {columns.map((c, i) => <th key={c.id ?? `none-${i}`} scope="col" className={`${cell} ${typography.panelMeta} [font-weight:inherit] text-left text-text-light`}
              data-testid={`decision-matrix-aim-${c.id ?? 'none'}`} data-view={c.at}>{c.label}</th>)}
          </tr></thead>}
          <tbody>{rows.map((row) => <tr key={row.id} data-testid={`decision-matrix-row-${row.id}`}>
            <th scope="row" className={`${cell} [font-weight:inherit] text-left`} data-view={row.labelAt}>{row.label}</th>
            {row.cells.map((c, i) => <td key={i} className={cell}
              data-testid={header ? `decision-matrix-chance-${row.id}-${columns[i]!.id ?? 'none'}` : `decision-matrix-chance-${row.id}`} data-view={c.at}>
              {c.text !== null && <span>{c.text}</span>}
              {c.why && <TechnicalDisclosure visible label="Why?" openLabel="Hide why" compact>
                <span>{c.why}</span>
              </TechnicalDisclosure>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {withheld.map((w, i) => <p key={i} className={`${typography.panelMeta} text-text-light`} data-testid="decision-matrix-withheld" data-view={w.at}>{w.text}</p>)}
      {rows.some((r) => r.cells.some((c) => c.text !== null)) && readingLine}
      {hasOutcome && <SectionShell title="Modelled outcomes" count={null} variant="disclose" testId="decision-matrix-outcomes">
        {rows.map((row) => <div key={row.id} className={`${typography.panelBody} text-text-body py-2`}>
          <p data-testid={`decision-matrix-outcome-${row.id}`} title={row.outcomeTitle}><span data-view={row.labelAt}>{row.label}</span>{MATRIX_LABELS.sep}<span data-view={row.outcomeAt}>{row.centreReadout ?? MATRIX_LABELS.noOutcome}</span></p>
          {row.outcome !== null && <p>{MATRIX_LABELS.range}{row.outcome}</p>}
        </div>)}
      </SectionShell>}
    </SectionShell>
  )
}

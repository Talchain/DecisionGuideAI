import type { RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { INPUT_ROWS_SHOWN_FIRST, type RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  emptyInputsText,
  inputRowText,
  noiseQualifier,
  noPairsText,
} from '../../components/results/analysisNew/sections/WhatsChanged'

export interface RunChangeArtefactLine {
  readonly key: string
  readonly text: string
  readonly qualifier: string | null
  readonly wireFields: readonly string[]
}

export interface RunChangeArtefact {
  readonly priorRunId: string
  readonly currentRunId: string
  readonly edits: readonly RunChangeArtefactLine[]
  readonly moreEdits: boolean
  readonly results: readonly RunChangeArtefactLine[]
  readonly moreResults: boolean
  readonly basis: RunChangeArtefactLine
  readonly limit: RunChangeArtefactLine | null
}

export interface RunChangeArtefactFacts {
  /** Already identity-gated by Compare's shared `useDisplayedRunDeltaView` reader. */
  readonly view: RunDeltaView | null
  readonly priorRun: RunDeltaEndpoint | null | undefined
  readonly currentRun: RunDeltaEndpoint | null | undefined
  /** Supplied by `selectRunAffirmedCurrent`, never derived here. */
  readonly runIsCurrent: boolean
  /** Supplied by Compare's existing `selectWinSharesWithheld` licence gate. */
  readonly winSharesWithheld: boolean
}

const probability = (value: number): string => `${Math.round(value * 100)}%`
const inputFields = [
  'run_delta.input_changes[].entity_kind',
  'run_delta.input_changes[].entity_id',
  'run_delta.input_changes[].option_id',
  'run_delta.input_changes[].link',
  'run_delta.input_changes[].field',
  'run_delta.input_changes[].label_before',
  'run_delta.input_changes[].label_after',
  'run_delta.input_changes[].before',
  'run_delta.input_changes[].after',
  'run_delta.input_changes[].change',
  'run_delta.input_coverage',
] as const
const basisFields = ['run_delta.attribution_case', 'run_delta.input_coverage'] as const

/**
 * A compact rendering of the licensed pair, in producer order. No comparison,
 * ranking or named cause is calculated here. In particular, current-run
 * sensitivity is not evidence of what caused a change between two Runs.
 */
export function buildRunChangeArtefact({
  view,
  priorRun,
  currentRun,
  runIsCurrent,
  winSharesWithheld,
}: RunChangeArtefactFacts): RunChangeArtefact | null {
  if (view === null || !priorRun?.run_id || !currentRun?.run_id || !runIsCurrent || winSharesWithheld) return null

  const inputRows = view.inputs?.rows ?? []
  const edits: RunChangeArtefactLine[] = inputRows.slice(0, INPUT_ROWS_SHOWN_FIRST).map(row => ({
    key: row.key,
    text: inputRowText(row),
    qualifier: null,
    wireFields: inputFields,
  }))
  const inputNote = emptyInputsText(view.inputs)
  // Partial coverage is a limit even when the producer supplied some rows.
  const coverageNote = inputNote ?? (view.inputs?.coverage === 'partial' ? emptyInputsText({ coverage: 'partial', rows: [] }) : null)
  if (coverageNote !== null) {
    edits.push({ key: 'coverage', text: coverageNote, qualifier: null, wireFields: ['run_delta.input_coverage'] })
  }

  const results: RunChangeArtefactLine[] = []
  const leader = view.leader
  if (leader.changed && leader.mayName && leader.priorLabel && leader.currentLabel) {
    results.push({
      key: 'leader',
      text: `Highest-scoring option: ${leader.priorLabel} → ${leader.currentLabel}.`,
      qualifier: noiseQualifier(leader.noiseVerdict),
      wireFields: [
        'run_delta.leader.changed',
        'run_delta.leader.prior_leading_option_id',
        'run_delta.leader.current_leading_option_id',
        'run_delta.leader.noise_verdict',
      ],
    })
  }
  for (const movement of view.movements.slice(0, INPUT_ROWS_SHOWN_FIRST)) {
    const name = movement.label ?? 'An option this run does not name'
    const qualifier = noiseQualifier(movement.noiseVerdict)
    // The wire states no direction. When magnitude is unlicensed, say only
    // the producer's noise limit, without comparing the two numbers.
    const magnitudeIsLicensed = movement.mayShowMagnitude
    results.push({
      key: `probability:${movement.optionId}`,
      text: magnitudeIsLicensed
        ? `${name}: supported by ${probability(movement.prior)} → ${probability(movement.current)} of runs.`
        : `${name}: ${qualifier}`,
      qualifier: magnitudeIsLicensed ? qualifier : null,
      wireFields: [
        'run_delta.win_probabilities[].option_id',
        ...(magnitudeIsLicensed ? ['run_delta.win_probabilities[].prior', 'run_delta.win_probabilities[].current'] : []),
        'run_delta.win_probabilities[].noise_verdict',
      ],
    })
  }
  if (view.movementsUnavailable) {
    results.push({
      key: 'no-pairs',
      text: noPairsText(view),
      qualifier: null,
      wireFields: ['run_delta.win_probabilities', 'run_delta.win_probabilities_unavailable'],
    })
  }

  return {
    priorRunId: priorRun.run_id,
    currentRunId: currentRun.run_id,
    edits,
    moreEdits: inputRows.length > INPUT_ROWS_SHOWN_FIRST,
    results,
    moreResults: view.movements.length > INPUT_ROWS_SHOWN_FIRST,
    basis: { key: 'basis', text: view.comparability, qualifier: null, wireFields: basisFields },
    limit: view.attributionLimit === null
      ? null
      : { key: 'limit', text: view.attributionLimit, qualifier: null, wireFields: basisFields },
  }
}

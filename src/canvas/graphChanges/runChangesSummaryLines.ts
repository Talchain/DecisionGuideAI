/**
 * ⭐ M2: THE CONSEQUENCE OF A RERUN, IN FOUR LINES (PTL #85 5933452605 / 5933474575, investor-P0; lease CANVAS
 * 5933472900). The words for the canvas's compact summary (`components/RunChangesSummary`):
 *   1. **Changed:** the inputs that differed between the two Runs (the producer's rows, before → after);
 *   2. **Moved:** the options whose share moved BEYOND run-to-run noise, or the honest reason none is stated;
 *   3. **Why:** the producer's own comparability sentence, verbatim;
 *   4. **Still uncertain:** its attribution limit, when it states one.
 *
 * ⛔ NO NEW TRUTH. Everything here comes from the ONE reader's view (`RunDeltaView`, the object the Compare tab and the
 * canvas marks read) and the share gate, in the Compare section's own words (`inputRowText`, `movementText`,
 * `noiseQualifier`, `WHATS_CHANGED_NO_PAIRS`). It computes no diff, names no cause the producer did not send, and states
 * an option's share only where `winShareGate` allows one. Pure, so a spec binds every branch by identity.
 */
import { INPUT_ROWS_SHOWN_FIRST, type RunDeltaInputRow, type RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  inputRowText,
  movementText,
  noiseQualifier,
  WHATS_CHANGED_NO_PAIRS,
} from '../../components/results/analysisNew/sections/WhatsChanged'

export const RUN_CHANGES_SUMMARY_COPY = {
  title: 'Since the last run',
  changed: 'Changed',
  moved: 'Moved',
  why: 'Why',
  uncertain: 'Still uncertain',
  noInputs: 'The inputs were not recorded for this pair.',
  openCompare: 'Open in Compare',
  showWhy: 'Why?',
  hideWhy: 'Hide',
  close: 'Close the run summary',
  more: (n: number) => `+${n} more in Compare`,
} as const

export interface RunChangesSummaryLines {
  /** The first input rows (at most `INPUT_ROWS_SHOWN_FIRST`), each with the row it says, for focus. */
  readonly changed: ReadonlyArray<{ readonly row: RunDeltaInputRow; readonly text: string }>
  readonly changedMore: number
  /** Options that moved beyond noise, in the reader's order (at most `INPUT_ROWS_SHOWN_FIRST`). */
  readonly moved: readonly string[]
  readonly movedMore: number
  /**
   * Said in place of moved rows when none may be stated: the withheld-share reason, no matched pairs, or the noise
   * qualifier when nothing moved beyond it. `null` with `moved` empty = the pair holds no option at all.
   */
  readonly movedNote: string | null
  readonly why: string
  readonly uncertain: string | null
}

/** True when there is anything to say: an input row, an option movement, or the producer's "no pairs". */
export function runChangesSummaryHasContent(view: RunDeltaView): boolean {
  return (view.inputs?.rows.length ?? 0) > 0 || view.movements.length > 0 || view.movementsUnavailable
}

export function runChangesSummaryLines(
  view: RunDeltaView,
  winSharesWithheld: boolean,
  winShareWithheldReason: string | null,
): RunChangesSummaryLines {
  const rows = view.inputs?.rows ?? []
  const signal = view.movements.filter((m) => m.noiseVerdict === 'signal')
  let movedNote: string | null = null
  let movedAll: string[] = []
  // ⛔ ORDER IS THE CONTRACT: a withheld share outranks everything (no option's share is stated, not even "beyond
  // noise"); then the producer's "no pairs"; then signal; else the ONE noise sentence for the whole set.
  if (winSharesWithheld) movedNote = winShareWithheldReason
  else if (view.movementsUnavailable) movedNote = WHATS_CHANGED_NO_PAIRS
  else if (signal.length > 0) movedAll = signal.map(movementText)
  else if (view.movements.length > 0) {
    movedNote = noiseQualifier(
      view.movements.every((m) => m.noiseVerdict === 'within_noise') ? 'within_noise' : 'not_noise_qualified',
    )
  }
  return {
    changed: rows.slice(0, INPUT_ROWS_SHOWN_FIRST).map((row) => ({ row, text: inputRowText(row) })),
    changedMore: Math.max(0, rows.length - INPUT_ROWS_SHOWN_FIRST),
    moved: movedAll.slice(0, INPUT_ROWS_SHOWN_FIRST),
    movedMore: Math.max(0, movedAll.length - INPUT_ROWS_SHOWN_FIRST),
    movedNote,
    why: view.comparability,
    uncertain: view.attributionLimit,
  }
}

/**
 * ⭐⭐ THE ONE DEFINITION OF "IS THERE AN ANALYSED OPTION SET TO RECORD A
 * DECISION AGAINST?" — extracted so that the two surfaces which ask it cannot
 * answer it differently.
 *
 * ⚠⚠ WHY THIS FILE EXISTS AT ALL. It was extracted in repair of a measured
 * defect. `DecisionRecordModal` computed this predicate inline and fails
 * CLOSED on it: with no completed analysis, or with zero option nodes, the
 * capture form renders DISABLED behind "Run an analysis first. There are no
 * analysed options to record a decision against yet."  The `DecisionRecorded`
 * section, meanwhile, offered the door on `!isPreRun` alone — and `isPreRun`
 * is `!hasCompletedFirstRun`, which is MONOTONIC (`canvas/store.ts:542`,
 * "True after at least one successful or restored run in this session"; the
 * flag is set in `resultsComplete` and is never unset by `resultsStart`).
 *
 * So after one successful run the two predicates diverge permanently, and the
 * divergence is REACHABLE, not theoretical: `resultsStart` sets
 * `status: 'preparing'` while DELIBERATELY preserving the previous report
 * ("Preserve previous results during re-run so UI doesn't flash empty",
 * `canvas/store.ts:4660-4672`). During any rerun — and on `'error'` and
 * `'cancelled'` — the panel stays mounted with the prior report, the door
 * rendered, and the modal behind it opened fully disabled saying "Run an
 * analysis first." **to a user who has just run one.**
 *
 * That falsified `DecisionRecorded`'s own contract, "this door is never
 * decorative". Two questions under one name (CLAUDE.md trap 21): "has this
 * session ever produced a run?" is not "is there an analysed option set on
 * screen right now?".
 *
 * ⚠ AND IT IS DERIVED RATHER THAN MIRRORED, DELIBERATELY. The obvious repair
 * — restate `resultsStatus === 'complete' && optionNodes.length > 0` at the
 * section — would put the same predicate in two files for someone to keep in
 * sync by hand, which is this estate's dominant defect (CLAUDE.md trap 12).
 * Both consumers call in here instead, so a change to what counts as an
 * analysed option moves both surfaces at once or neither.
 */

/**
 * The structural shape both call sites already have. Deliberately NOT the
 * canvas `Node` type: this module answers a question about option-ness and
 * must not acquire the canvas store's type surface to do it.
 */
export interface OptionCandidateNode {
  id: string
  type?: string
  data?: unknown
}

export interface AnalysedOption {
  id: string
  label: string
  /** Stable number from optionNumbering, only when EVERY option has one. */
  number: number | null
}

/**
 * ⭐ THE GATE ITSELF, and the only place the two conditions live.
 *
 * `resultsStatus !== 'complete'` is checked FIRST and is the limb that makes
 * this differ from `!isPreRun`: option nodes outlive a run, the completed
 * status does not.
 */
export function selectAnalysedOptionNodes(
  nodes: ReadonlyArray<OptionCandidateNode> | undefined,
  resultsStatus: string | undefined,
): OptionCandidateNode[] {
  if (resultsStatus !== 'complete') return []
  if (!nodes) return []
  return nodes.filter(
    (n) =>
      n.type === 'option' ||
      (n.data as Record<string, unknown> | undefined)?.kind === 'option',
  )
}

/**
 * ⭐ THE SECTION'S GATE. Named for the question it answers — "may a capture be
 * offered?" — rather than for the run's history, so it cannot be mistaken for
 * `isPreRun` again.
 *
 * It takes no `numbering`, because numbering decides how an option is LABELLED
 * and never whether one EXISTS. Both facts are still derived from the single
 * `selectAnalysedOptionNodes` above, so the two cannot drift.
 */
export function hasAnalysedOptions(
  nodes: ReadonlyArray<OptionCandidateNode> | undefined,
  resultsStatus: string | undefined,
): boolean {
  return selectAnalysedOptionNodes(nodes, resultsStatus).length > 0
}

/**
 * The labelled, ordered set the capture modal populates its select from.
 *
 * ⚠ NUMBERING IS ALL-OR-NOTHING, mirroring `ResultsBody` and the record
 * itself: a partially-numbered set renders NO numbers, because a fabricated
 * "Option 1" over a set the canvas does not number would make the record name
 * an option the product does not.
 */
export function selectAnalysedOptions(
  nodes: ReadonlyArray<OptionCandidateNode> | undefined,
  resultsStatus: string | undefined,
  numbering: Record<string, number> | undefined,
): AnalysedOption[] {
  const optionNodes = selectAnalysedOptionNodes(nodes, resultsStatus)
  if (optionNodes.length === 0) return []
  const map = numbering ?? {}
  const allNumbered = optionNodes.every((n) => map[n.id] != null)
  const mapped = optionNodes.map((n) => {
    const label = (n.data as Record<string, unknown> | undefined)?.label
    return {
      id: n.id,
      label: typeof label === 'string' && label.trim() !== '' ? label : n.id,
      number: allNumbered ? map[n.id] : null,
    }
  })
  return allNumbered
    ? [...mapped].sort((a, b) => (a.number as number) - (b.number as number))
    : mapped
}

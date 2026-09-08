/**
 * The analysed option set the decision-record modal captures against — and the
 * ONE expression that decides whether capture is possible at all.
 *
 * ⭐⭐ WHY THIS MODULE EXISTS: A DOOR AND ITS ROOM MUST SHARE ONE PRECONDITION.
 * `DecisionRecorded` was gated on `!isPreRun` alone, while the modal behind it
 * required `results.status === 'complete'` AND at least one option node. Those
 * are different questions, and `isPreRun` is `!hasCompletedFirstRun` — a
 * MONOTONIC latch. So after a failed, cancelled or in-flight rerun
 * (`resultsError` sets `status: 'error'` and DELIBERATELY retains the prior
 * report — `store.ts :: resultsError`), the latch stayed true, the door
 * rendered, and the modal opened fully disabled saying "Run an analysis
 * first." — to a user who had run one. A false sentence, produced by a gate
 * mismatch (CLAUDE.md trap 21: two questions under one name).
 *
 * ⚠ THE FIX IS ONE EXPRESSION, NOT TWO THAT AGREE. A second predicate in the
 * panel that "matches" the modal's is a hand-maintained mirror and will drift
 * (CLAUDE.md trap 12). Both callers import THIS function, so a change to what
 * counts as a capturable option set cannot move under one of them —
 * `theActIsNotGatedOnSuccess.spec.tsx` pins that identity by driving the
 * store, not by trusting this comment.
 *
 * ⚠ WHAT THIS IS NOT. It is NOT a quality gate. Nothing about robustness,
 * evidence, staleness or completeness belongs here — a fragile result is when
 * writing down your reasoning matters most, which is the whole point of the
 * act being decoupled from `ModelHeldUp`. The only question asked is: is there
 * an analysed option set to record a decision AGAINST?
 */

/** One analysed option, as the capture form renders it. */
export interface AnalysedOption {
  id: string
  label: string
  /** Stable number from optionNumbering, only when EVERY option has one. */
  number: number | null
}

export interface AnalysedOptionInputs {
  nodes: readonly unknown[]
  /** `canvasStore.results.status`. */
  resultsStatus: string | null | undefined
  /** `canvasStore.optionNumbering`. */
  numbering: Record<string, number>
}

/**
 * The analysed options, or an empty array.
 *
 * ⚠ `optionNumbering` IS ALL-OR-NOTHING, mirroring `ResultsBody`. A partially
 * numbered set renders NO numbers rather than fabricating the missing ones —
 * a made-up "Option 1" would make the record name an option the canvas does
 * not.
 */
export function deriveAnalysedOptions({
  nodes,
  resultsStatus,
  numbering,
}: AnalysedOptionInputs): AnalysedOption[] {
  if (resultsStatus !== 'complete') return []
  const optionNodes = (nodes as Array<Record<string, unknown>>).filter(
    (n) =>
      n?.type === 'option' ||
      (n?.data as Record<string, unknown> | undefined)?.kind === 'option',
  )
  if (optionNodes.length === 0) return []
  const allNumbered = optionNodes.every((n) => numbering[n.id as string] != null)
  const mapped = optionNodes.map((n) => {
    const label = (n.data as Record<string, unknown> | undefined)?.label
    return {
      id: n.id as string,
      label: typeof label === 'string' && label.trim() !== '' ? label : (n.id as string),
      number: allNumbered ? numbering[n.id as string] : null,
    }
  })
  return allNumbered
    ? [...mapped].sort((a, b) => (a.number as number) - (b.number as number))
    : mapped
}

/**
 * Whether a decision can be recorded right now — the modal's own precondition,
 * exported so the door can ask the same question the room answers.
 */
export function canCaptureDecision(inputs: AnalysedOptionInputs): boolean {
  return deriveAnalysedOptions(inputs).length > 0
}

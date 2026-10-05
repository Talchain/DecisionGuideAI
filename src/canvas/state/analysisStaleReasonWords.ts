/**
 * RT-10 B′ — CEE's own sentence for WHY the stated `complete_stale` verdict holds although the MODEL DID NOT CHANGE
 * (a hash-equal stale: the Run's goal snapshot disagrees with the model; CEE #2596). Surfaces that would say
 * "Model changed" say this instead: when the user changed nothing, "Model changed" is false.
 *
 * ⛔ BOUND TO ITS VERDICT BY IDENTITY. The words are recorded WITH the exact `AnalysisStateV1` object the same leg then
 * writes (`setAnalysisStateV1`), and read back only while the store still holds THAT object and it is `complete_stale`.
 * Any later verdict (another object, or null) makes them unreadable, so they can never outlive or precede their
 * verdict. Kept out of the canvas store on purpose: no new store field, nothing persisted, no store mock to extend.
 * No store import either (`applyV5State` takes its store as a parameter): the hook is `useAnalysisStaleReasonWords.ts`.
 */
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

let recorded: { readonly verdict: AnalysisStateV1; readonly words: string } | null = null

/** Call IMMEDIATELY BEFORE writing `verdict` to the store, on every leg that writes one. */
export function recordAnalysisStaleReasonWords(verdict: AnalysisStateV1 | null, words: string | null | undefined): void {
  recorded = verdict !== null && typeof words === 'string' && words !== '' && verdict.run_state.kind === 'complete_stale'
    ? { verdict, words }
    : null
}

/** The recorded words when `verdict` is the very object they were recorded with; else null. */
export function analysisStaleReasonWordsFor(verdict: AnalysisStateV1 | null | undefined): string | null {
  return recorded !== null && verdict != null && verdict === recorded.verdict ? recorded.words : null
}

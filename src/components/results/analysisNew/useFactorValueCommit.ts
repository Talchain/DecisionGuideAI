/**
 * Commit a typed factor value through the one write authority, and say WHICH
 * OF THE THREE THINGS HAPPENED.
 *
 * ⭐⭐ WHY THIS IS A HOOK AND NOT A SECOND COPY. Two surfaces now offer the same
 * edit — the model strip's factor detail and the driver influence chart. The
 * estate's signature defect is two same-named twins that drift (CLAUDE.md
 * trap 12, and the two `generateGraphHash` functions that cost a whole
 * diagnosis). The parse rule, the three-outcome mapping and the
 * stays-open-on-refusal rule are the parts that are dangerous to re-derive, so
 * they live here once and both callers import them.
 *
 * ⚠ THE OUTCOME IS NEVER FLATTENED TO "SAVED". `proposeFactorValue` answers
 * `dispatched | local_only | not_encodable` precisely so a caller cannot claim
 * a server acceptance it did not observe. This hook returns the same three
 * tokens rather than a boolean, so a caller CANNOT collapse them by accident —
 * a boolean return would have made the collapse the path of least resistance.
 */
import { useModelEditAuthority } from '../../../canvas/hooks/useModelEditAuthority'

/**
 * What happened to the typed value.
 *
 * `not_encodable` covers BOTH "the text was not a finite number" and "the
 * authority refused it" — from the reader's side these are one state (nothing
 * was written anywhere), and the editor must stay open for both.
 */
export type ValueCommitOutcome = 'dispatched' | 'local_only' | 'not_encodable'

export interface FactorValueCommit {
  /**
   * Parse `draft`, dispatch it, and report the outcome. Never throws.
   *
   * ⚠ THE CALLER MUST NOT CLOSE ITS EDITOR ON `not_encodable` — nothing was
   * written anywhere, so closing would look like a success.
   */
  commit: (draft: string) => ValueCommitOutcome
}

/**
 * @param nodeId the factor being edited, or `null` when no edit is active —
 * the authority's own documented contract. With `null` every proposal answers
 * `not_encodable`, which is the honest answer.
 */
export function useFactorValueCommit(nodeId: string | null): FactorValueCommit {
  // ⚠ CALLED UNCONDITIONALLY. Parameterising by the id rather than gating the
  // hook is what keeps the call unconditional in every caller.
  const authority = useModelEditAuthority(nodeId)
  return {
    commit: (draft: string) => {
      const typed = draft.trim()
      const parsed = Number(typed)
      // ⚠ `Number('')` IS 0, NOT NaN. The empty test is not redundant with the
      // finiteness test and removing it would dispatch a zero for a blank field.
      if (typed === '' || !Number.isFinite(parsed)) return 'not_encodable'
      return authority.proposeFactorValue(parsed)
    },
  }
}

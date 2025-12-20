/**
 * useISLSynthesis - DEPRECATED
 *
 * This hook previously fetched prose narratives from the /bff/cee/isl-synthesis endpoint.
 * That endpoint has been removed. Synthesis narratives are now provided inline via
 * ceeReview.blocks in the PLoT response and rendered in the Decision Review panel.
 *
 * This hook is retained for backward compatibility but returns null/no-op state.
 * Dependents should migrate to consuming ceeReview.blocks directly.
 *
 * @deprecated Use ceeReview.blocks from PLoT response instead
 */

export interface SynthesisNarratives {
  decision: string
  uncertainty: string
  recommendation: string
}

interface UseISLSynthesisResult {
  /** Always null - use ceeReview.blocks instead */
  synthesis: null
  /** Always false - no loading occurs */
  loading: false
  /** Always null - no errors possible */
  error: null
  /** No-op function for backward compatibility */
  refetch: () => Promise<void>
}

/**
 * @deprecated Synthesis narratives now come from ceeReview.blocks in the Decision Review panel.
 */
export function useISLSynthesis(): UseISLSynthesisResult {
  return {
    synthesis: null,
    loading: false,
    error: null,
    refetch: async () => {
      // No-op: endpoint removed, use ceeReview.blocks instead
    },
  }
}

export default useISLSynthesis

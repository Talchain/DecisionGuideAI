import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../store'
import { analysisStaleReasonWordsFor } from '../state/analysisStaleReasonWords'

/** RT-10 B′: CEE's reason words for the verdict the store holds NOW (`analysisStaleReasonWords`), or null. */
export function useAnalysisStaleReasonWords(): string | null {
  const verdict = useCanvasStore((s) => (s as { analysisStateV1?: AnalysisStateV1 | null }).analysisStateV1)
  return analysisStaleReasonWordsFor(verdict)
}

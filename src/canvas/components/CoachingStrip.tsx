/**
 * CoachingStrip — horizontal coaching bar at canvas bottom.
 * Visible in Decision view only. Shows contextual guidance and action chips.
 * Chips trigger sendMessage via the guidanceStore._sendMessage bridge.
 */
import { memo, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'
import { hasObservedData } from '../utils/observedStateHelpers'
import { Sparkles } from 'lucide-react'

function useSendMessage() {
  return useCallback((text: string) => {
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(text)
  }, [])
}

export const CoachingStrip = memo(() => {
  const viewMode = useCanvasStore(s => s.viewMode)
  const resultsStatus = useCanvasStore(s => s.results.status)
  const report = useCanvasStore(s => s.results.report)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const sendMessage = useSendMessage()

  // Pre-analysis: count evidence gaps (factors with no observed data)
  const preAnalysisData = useMemo(() => {
    if (resultsStatus === 'complete') return null
    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    const gaps = factorNodes.filter(n => !hasObservedData(n.data))
    // Find the top factor without value (first gap)
    const topGap = gaps[0]
    const topGapLabel = (topGap?.data?.label as string | undefined) ?? null
    return { gapCount: gaps.length, topGapLabel }
  }, [resultsStatus, nodes])

  // Post-analysis: winner info, top risk, top EVPI factor
  const postAnalysisData = useMemo(() => {
    if (resultsStatus !== 'complete' || !report) return null
    const rep = report as any

    // Winner
    const robustness = rep.robustness
    const recommendedId = robustness?.recommended_option_id ?? robustness?.recommendedOptionId
    const winnerNode = recommendedId ? nodes.find(n => n.id === recommendedId) : null
    const winnerLabel = (winnerNode?.data?.label as string | undefined) ?? null
    const optionProbs = rep.option_probabilities ?? {}
    const winProb = recommendedId ? optionProbs[recommendedId]?.win_probability as number | undefined : null

    // Top risk
    const riskNodes = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk')
    const goalNode = nodes.find(n => n.type === 'goal' || n.data?.type === 'goal')
    let topRiskLabel: string | null = null
    if (riskNodes.length > 0 && goalNode) {
      // Find risk with highest bridge edge weight
      let maxWeight = -1
      for (const rn of riskNodes) {
        const edge = edges.find(e => e.source === rn.id && e.target === goalNode.id)
        const w = (edge?.data as any)?.weight as number | undefined
        if (w != null && w > maxWeight) {
          maxWeight = w
          topRiskLabel = (rn.data?.label as string | undefined) ?? null
        }
      }
    }

    // Top EVPI factor
    const sensitivity = rep.factor_sensitivity ?? rep.factorSensitivity
    let topEvpiFactor: string | null = null
    if (Array.isArray(sensitivity) && sensitivity.length > 0) {
      const topFactor = sensitivity[0]
      const factorId = topFactor.factor_id ?? topFactor.factorId
      const factorNode = factorId ? nodes.find(n => n.id === factorId) : null
      topEvpiFactor = (factorNode?.data?.label as string | undefined) ?? null
    }

    return {
      winnerLabel,
      winProb: winProb != null ? Math.round(winProb * 100) : null,
      topRiskLabel,
      topEvpiFactor,
    }
  }, [resultsStatus, report, nodes, edges])

  // Only visible in Decision view
  if (viewMode !== 'decision') return null
  // Need data to show
  if (!preAnalysisData && !postAnalysisData) return null

  return (
    <div
      className="bg-panel rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm border border-panel-border"
      data-testid="coaching-strip"
    >
      <Sparkles size={16} className="text-info shrink-0" aria-hidden="true" />

      {/* Pre-analysis content */}
      {preAnalysisData && (
        <>
          <span className={`${typography.nodeLabel} text-text-body`}>
            {preAnalysisData.gapCount > 0
              ? `${preAnalysisData.gapCount} evidence gap${preAnalysisData.gapCount !== 1 ? 's' : ''} in your model${preAnalysisData.topGapLabel ? `. The biggest unknown is ${preAnalysisData.topGapLabel}.` : '.'}`
              : 'Your model is ready for analysis.'
            }
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {preAnalysisData.gapCount > 0 && (
              <button
                type="button"
                className={`${typography.nodeLabel} bg-transparent border border-info/30 text-text-body rounded-full px-2.5 py-1 cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
                onClick={() => sendMessage('What are the evidence gaps in my model and how should I address them?')}
              >
                Fill evidence gaps
              </button>
            )}
            <button
              type="button"
              className={`${typography.nodeLabel} bg-primary text-text-on-color rounded-full px-2.5 py-1 cursor-pointer hover:opacity-90 transition-opacity nodrag nopan`}
              onClick={() => sendMessage('Run the analysis')}
            >
              Run analysis
            </button>
          </div>
        </>
      )}

      {/* Post-analysis content */}
      {postAnalysisData && (
        <>
          <span className={`${typography.nodeLabel} text-text-body`}>
            {postAnalysisData.winnerLabel && postAnalysisData.winProb != null
              ? `${postAnalysisData.winnerLabel} wins ${postAnalysisData.winProb}% of scenarios.`
              : 'Analysis complete.'
            }
            {postAnalysisData.topRiskLabel ? ` Biggest risk: ${postAnalysisData.topRiskLabel}.` : ''}
            {postAnalysisData.topEvpiFactor ? ` Investigate ${postAnalysisData.topEvpiFactor} to improve confidence.` : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {postAnalysisData.topEvpiFactor && (
              <button
                type="button"
                className={`${typography.nodeLabel} bg-transparent border border-info/30 text-text-body rounded-full px-2.5 py-1 cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
                onClick={() => sendMessage(`How can I investigate ${postAnalysisData.topEvpiFactor}?`)}
              >
                Investigate {postAnalysisData.topEvpiFactor}
              </button>
            )}
            <button
              type="button"
              className={`${typography.nodeLabel} bg-transparent border border-info/30 text-text-body rounded-full px-2.5 py-1 cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
              onClick={() => sendMessage('Challenge the analysis result. What could be wrong?')}
            >
              Challenge this result
            </button>
          </div>
        </>
      )}
    </div>
  )
})

CoachingStrip.displayName = 'CoachingStrip'

import React, { Suspense } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { cfg, isSandboxEnabled, isDecisionGraphEnabled } from '@/lib/config'
import { track } from '@/lib/analytics'
import ErrorBoundary from './ErrorBoundary'

const RealCanvasLazy = React.lazy(() => import('./Canvas').then(m => ({ default: m.Canvas })))
const SandboxMockLazy = React.lazy(() => import('@/sandbox/ui/ScenarioSandboxMock').then(m => ({ default: m.ScenarioSandboxMock })))
const DecisionGraphLazy = React.lazy(() => import('./DecisionGraphView').then(m => ({ default: m.DecisionGraphView })))

export const SandboxRoute: React.FC = () => {
  const { decisionId } = useParams<{ decisionId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [useMockOverride, setUseMockOverride] = React.useState(false)
  const [retryKey, setRetryKey] = React.useState(0)
  const [expandedDecisionId, setExpandedDecisionId] = React.useState<string | null>(() => searchParams.get('expanded'))

  // Feature gate: Scenario Sandbox must be enabled
  if (!isSandboxEnabled()) {
    return <div className="p-8 text-center text-sm text-gray-700">Scenario Sandbox is not enabled.</div>
  }

  if (!decisionId) {
    return <div className="p-8 text-sm text-red-600">Missing decisionId in route.</div>
  }

  const wantMock = !cfg.featureWhiteboard || useMockOverride

  const loading = (
    <div role="status" aria-live="polite" data-testid="sandbox-loading" className="p-4 text-sm text-gray-600">Loading…</div>
  )

  const onRetry = () => setRetryKey(k => k + 1)
  const onUseMock = () => setUseMockOverride(true)

  // Deep-link sync: reflect expanded state in the URL
  React.useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (expandedDecisionId) next.set('expanded', expandedDecisionId)
    else next.delete('expanded')
    setSearchParams(next, { replace: true })
  }, [expandedDecisionId])

  // Handlers to open/close the Decision Graph (flag-gated)
  const onExpandDecision = (id: string) => {
    if (!isDecisionGraphEnabled()) return
    setExpandedDecisionId(id)
    track('graph_open', { decisionId: id })
  }
  const onCollapseGraph = () => {
    if (expandedDecisionId) track('graph_collapse', { decisionId: expandedDecisionId })
    setExpandedDecisionId(null)
  }

  return (
    <div className="w-full h-[75vh] bg-white border rounded shadow-sm overflow-hidden p-3">
      <ErrorBoundary key={`boundary-${retryKey}`} onRetry={onRetry} onUseMock={onUseMock}>
        <Suspense fallback={loading}>
          {isDecisionGraphEnabled() && expandedDecisionId ? (
            <div data-testid="sandbox-graph">
              <DecisionGraphLazy decisionId={expandedDecisionId} onClose={onCollapseGraph} />
            </div>
          ) : wantMock ? (
            <div data-testid="sandbox-mock">
              <SandboxMockLazy decisionId={decisionId} onExpandDecision={onExpandDecision} onCollapseDecision={() => onCollapseGraph()} />
            </div>
          ) : (
            <div data-testid="sandbox-real" className="h-full">
              <RealCanvasLazy decisionId={decisionId} />
            </div>
          )}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

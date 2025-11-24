import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useEngineLimits } from '../hooks/useEngineLimits'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import type { GraphHealth } from '../validation/types'

function buildHealthStrings(graphHealth: GraphHealth | null) {
  if (!graphHealth) {
    return {
      label: 'Health: Unknown',
      detail: 'No recent health check. Run diagnostics to analyse this graph.',
    }
  }

  const totalIssues = graphHealth.issues.length
  const issuesPart = totalIssues > 0 ? ` • ${totalIssues} issues` : ''

  if (graphHealth.status === 'healthy') {
    return {
      label: 'Health: Good',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'warnings') {
    return {
      label: 'Health: Warnings',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'errors') {
    return {
      label: 'Health: Errors',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  return {
    label: 'Health: Unknown',
    detail: 'No recent health check. Run diagnostics to analyse this graph.',
  }
}

export function ContextBar() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const graphHealth = useCanvasStore(s => s.graphHealth)
  const { limits, loading, error } = useEngineLimits()

  const nodesCount = nodes.length
  const edgesCount = edges.length

  const limitsView = useMemo(() => {
    if (loading) {
      return {
        label: 'Loading limits',
        message: 'Fetching current engine limits for this graph.',
      }
    }

    const limitsStatus = deriveLimitsStatus(limits, nodesCount, edgesCount)

    if (!limits || !limitsStatus || error) {
      return {
        label: 'Limits unavailable',
        message:
          'Limits could not be loaded. You can still edit the graph, but run behaviour may be constrained.',
      }
    }

    return {
      label: limitsStatus.zoneLabel,
      message: limitsStatus.message,
    }
  }, [loading, limits, nodesCount, edgesCount, error])

  const healthView = useMemo(() => buildHealthStrings(graphHealth ?? null), [graphHealth])

  return (
    <div
      data-testid="context-bar"
      className="rounded-lg bg-paper-50 backdrop-blur-sm border border-sand-200 shadow-panel px-4 py-2 flex flex-col gap-1"
      aria-label="Graph context"
    >
      <div className="flex items-center justify-between text-xs text-ink-900">
        <span className="font-medium text-ink-900/80">Graph</span>
        <span className="tabular-nums text-ink-900">
          {nodesCount} nodes • {edgesCount} edges
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-1 text-[11px] text-ink-900/80">
        <div className="flex-1 min-w-[10rem]">
          <div className="font-medium text-ink-900">Limits</div>
          <div className="text-ink-900" aria-live="polite">
            {limitsView.label}
          </div>
          <div className="text-ink-900/70" aria-live="polite">
            {limitsView.message}
          </div>
        </div>

        <div className="flex-1 min-w-[10rem]">
          <div className="font-medium text-ink-900">Health</div>
          <div className="text-ink-900" aria-live="polite">
            {healthView.label}
          </div>
          <div className="text-ink-900/70" aria-live="polite">
            {healthView.detail}
          </div>
        </div>
      </div>
    </div>
  )
}

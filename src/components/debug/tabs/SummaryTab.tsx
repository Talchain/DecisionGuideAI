/**
 * SummaryTab Component
 *
 * At-a-glance health check for Debug Panel V2.
 * Shows KPIs, service chain, and quick stats.
 */

import { useMemo, CSSProperties } from 'react'
import { KpiCard, ServiceChain, type ChainNode, type KpiStatus } from '../components'
import type { DebugData } from '../hooks/useDebugData'

export interface SummaryTabProps {
  /** Debug data from useDebugData hook */
  data: DebugData
  /** Navigate to Data Flow tab */
  onNavigateToDataFlow?: () => void
  /** Navigate to Pipeline tab */
  onNavigateToPipeline?: () => void
  /** Navigate to Raw tab */
  onNavigateToRaw?: () => void
}

function formatNodeCounts(connectivity: DebugData['pipeline']['connectivity']): string {
  if (!connectivity) return '—'
  const parts: string[] = []
  if (connectivity.decision_count > 0) parts.push(`${connectivity.decision_count} decision`)
  if (connectivity.option_count > 0) parts.push(`${connectivity.option_count} options`)
  if (connectivity.factor_count > 0) parts.push(`${connectivity.factor_count} factors`)
  if (connectivity.goal_count > 0) parts.push(`${connectivity.goal_count} goal`)
  return parts.join(', ') || 'No nodes'
}

function deriveAnalysisStatus(data: DebugData): { status: KpiStatus; label: string } {
  if (data.overall.status === 'error') return { status: 'error', label: 'Error' }
  if (data.overall.status === 'pending') return { status: 'warn', label: 'Pending' }
  if (!data.hasData) return { status: 'neutral', label: 'No Data' }
  return { status: 'ok', label: 'Complete' }
}

function deriveRobustnessStatus(gates: DebugData['gates']): { status: KpiStatus; label: string } {
  const robustnessGate = gates.find((g) => g.name === 'robustness')
  if (!robustnessGate) return { status: 'neutral', label: 'N/A' }
  if (robustnessGate.status === 'pass') return { status: 'ok', label: 'Pass' }
  if (robustnessGate.status === 'warn') return { status: 'warn', label: 'Warn' }
  return { status: 'error', label: 'Fail' }
}

function countIssues(gates: DebugData['gates']): number {
  return gates.filter((g) => g.status === 'fail' || g.status === 'warn').length
}

export function SummaryTab({
  data,
  onNavigateToDataFlow,
  onNavigateToPipeline,
  onNavigateToRaw,
}: SummaryTabProps) {
  // Build service chain nodes
  const chainNodes = useMemo((): ChainNode[] => {
    const nodes: ChainNode[] = []

    // UI node (always present)
    nodes.push({
      name: 'UI',
      duration_ms: null,
      status: 'success',
    })

    // CEE
    if (data.services.cee) {
      nodes.push({
        name: 'CEE',
        duration_ms: data.services.cee.duration_ms,
        status: data.services.cee.success ? 'success' : data.services.cee.error ? 'error' : 'pending',
        statusCode: data.services.cee.status,
        onClick: onNavigateToDataFlow,
      })
    }

    // PLoT
    if (data.services.plot) {
      nodes.push({
        name: 'PLoT',
        duration_ms: data.services.plot.duration_ms,
        status: data.services.plot.success ? 'success' : data.services.plot.error ? 'error' : 'pending',
        statusCode: data.services.plot.status,
        onClick: onNavigateToDataFlow,
      })
    }

    // ISL
    if (data.services.isl) {
      nodes.push({
        name: 'ISL',
        duration_ms: data.services.isl.duration_ms,
        status: data.services.isl.success ? 'success' : data.services.isl.error ? 'error' : 'unavailable',
        statusCode: data.services.isl.status,
        onClick: onNavigateToDataFlow,
      })
    } else if (data.services.plot) {
      // Show ISL as unavailable if PLoT was called but ISL data not found
      nodes.push({
        name: 'ISL',
        duration_ms: null,
        status: 'unavailable',
        onClick: onNavigateToDataFlow,
      })
    }

    return nodes
  }, [data.services, onNavigateToDataFlow])

  // KPI values
  const analysisKpi = deriveAnalysisStatus(data)
  const robustnessKpi = deriveRobustnessStatus(data.gates)
  const issueCount = countIssues(data.gates)

  // Token usage
  const tokenUsage = data.pipeline.llm_metadata?.token_usage
  const tokenDisplay = tokenUsage
    ? `${tokenUsage.prompt_tokens ?? 0} in / ${tokenUsage.completion_tokens ?? 0} out`
    : '—'

  const sectionStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
    marginBottom: 12,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Row 1: KPI Cards */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Health Overview</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          <KpiCard
            label="Graph Stats"
            value={formatNodeCounts(data.pipeline.connectivity)}
            status="neutral"
            onClick={onNavigateToPipeline}
            tooltip="Click to view pipeline details"
          />
          <KpiCard
            label="Analysis"
            value={analysisKpi.label}
            status={analysisKpi.status}
            onClick={onNavigateToDataFlow}
            tooltip="Click to view data flow"
          />
          <KpiCard
            label="Robustness"
            value={robustnessKpi.label}
            status={robustnessKpi.status}
            onClick={onNavigateToRaw}
            tooltip="Click to view raw data"
          />
          <KpiCard
            label="Issues"
            value={issueCount > 0 ? String(issueCount) : 'None'}
            status={issueCount > 0 ? 'warn' : 'ok'}
            onClick={onNavigateToDataFlow}
            tooltip={issueCount > 0 ? 'Click to investigate' : 'All gates passing'}
          />
        </div>
      </div>

      {/* Row 2: Service Chain */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Service Chain</div>
        <ServiceChain nodes={chainNodes} />
      </div>

      {/* Row 3: Quick Stats */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Quick Stats</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '8px 24px',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Model</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
              {data.pipeline.llm_metadata?.model ?? '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Temperature</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
              {data.pipeline.llm_metadata?.temperature ?? '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Tokens</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{tokenDisplay}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Total Duration</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
              {data.overall.total_duration_ms
                ? `${(data.overall.total_duration_ms / 1000).toFixed(2)}s`
                : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Request ID</span>
            <span
              style={{
                fontFamily: 'monospace',
                color: '#0f172a',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={data.overall.request_id ?? undefined}
            >
              {data.overall.request_id ? data.overall.request_id.slice(0, 8) + '...' : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Edges</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
              {data.pipeline.connectivity?.edge_count ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* No data placeholder */}
      {!data.hasData && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: '#64748b',
            fontSize: 12,
          }}
        >
          No debug data available. Run an analysis to see results.
        </div>
      )}
    </div>
  )
}

export default SummaryTab

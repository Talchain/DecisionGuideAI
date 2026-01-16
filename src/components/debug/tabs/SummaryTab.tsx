/**
 * SummaryTab Component
 *
 * At-a-glance health check for Debug Panel V2.
 * Shows KPIs, service chain, and quick stats.
 */

import { useMemo, CSSProperties } from 'react'
import { KpiCard, ServiceChain, type ChainNode, type KpiStatus } from '../components'
import type { DebugData } from '../hooks/useDebugData'
import { formatDuration, formatNodeCountsAbbreviated } from '../utils'

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
  // Build service chain nodes with downstream failure handling
  const chainNodes = useMemo((): ChainNode[] => {
    const nodes: ChainNode[] = []
    let previousFailed = false

    // UI node (always present)
    nodes.push({
      name: 'UI',
      duration_ms: null,
      status: 'success',
    })

    // CEE
    if (data.services.cee) {
      const failed = !data.services.cee.success
      nodes.push({
        name: 'CEE',
        duration_ms: data.services.cee.duration_ms,
        status: previousFailed ? 'skipped' : failed ? 'error' : 'success',
        statusCode: previousFailed ? null : data.services.cee.status,
        onClick: onNavigateToDataFlow,
      })
      if (failed) previousFailed = true
    }

    // PLoT
    if (data.services.plot || previousFailed) {
      const plotData = data.services.plot
      nodes.push({
        name: 'PLoT',
        duration_ms: previousFailed ? null : plotData?.duration_ms ?? null,
        status: previousFailed ? 'skipped' : plotData?.success ? 'success' : plotData?.error ? 'error' : 'pending',
        statusCode: previousFailed ? null : plotData?.status,
        onClick: onNavigateToDataFlow,
      })
      if (plotData && !plotData.success) previousFailed = true
    }

    // ISL
    if (data.services.isl || data.services.plot || previousFailed) {
      const islData = data.services.isl
      nodes.push({
        name: 'ISL',
        duration_ms: previousFailed ? null : islData?.duration_ms ?? null,
        status: previousFailed ? 'skipped' : islData?.success ? 'success' : islData?.error ? 'error' : 'unavailable',
        statusCode: previousFailed ? null : islData?.status,
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
    ? `${tokenUsage.prompt_tokens ?? 0} → ${tokenUsage.completion_tokens ?? 0}`
    : '—'

  const sectionStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 12,
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
    marginBottom: 12,
  }

  // Check if temperature has a value (not null/undefined/NaN)
  const temperature = data.pipeline.llm_metadata?.temperature
  const showTemperature = temperature != null && !Number.isNaN(temperature)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Error Banner */}
      {data.error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                color: '#dc2626',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {data.error.code}
            </span>
            <span style={{ color: '#991b1b', fontSize: 13 }}>{data.error.message}</span>
            <span style={{ color: '#f87171', fontSize: 12 }}>({data.error.status})</span>
          </div>
          <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
            Duration: {formatDuration(data.error.duration_ms)}
            {data.error.retryable && ' • Retryable'}
          </div>
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Health Overview</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
          className="sm:grid-cols-4"
        >
          <KpiCard
            label="Graph Stats"
            value={formatNodeCountsAbbreviated(data.pipeline.connectivity)}
            status="neutral"
            onClick={onNavigateToPipeline}
            tooltip={formatNodeCounts(data.pipeline.connectivity)}
            compact
          />
          <KpiCard
            label="Analysis"
            value={analysisKpi.label}
            status={analysisKpi.status}
            onClick={onNavigateToDataFlow}
            tooltip="Click to view data flow"
            compact
          />
          <KpiCard
            label="Robustness"
            value={robustnessKpi.label}
            status={robustnessKpi.status}
            onClick={onNavigateToRaw}
            tooltip="Click to view raw data"
            compact
          />
          <KpiCard
            label="Issues"
            value={issueCount > 0 ? String(issueCount) : 'None'}
            status={issueCount > 0 ? 'warn' : 'ok'}
            onClick={onNavigateToDataFlow}
            tooltip={issueCount > 0 ? 'Click to investigate' : 'All gates passing'}
            compact
          />
        </div>
      </div>

      {/* Row 2: Service Chain */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Service Chain</div>
        <ServiceChain nodes={chainNodes} />
      </div>

      {/* Row 3: Quick Stats - Dense Row */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Quick Stats</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 24px',
            fontSize: 13,
            color: '#475569',
          }}
        >
          <span>
            <strong style={{ color: '#1e293b' }}>Model:</strong>{' '}
            {data.pipeline.llm_metadata?.model ?? '—'}
          </span>
          <span>
            <strong style={{ color: '#1e293b' }}>Tokens:</strong> {tokenDisplay}
          </span>
          <span>
            <strong style={{ color: '#1e293b' }}>Duration:</strong>{' '}
            {formatDuration(data.overall.total_duration_ms)}
          </span>
          <span>
            <strong style={{ color: '#1e293b' }}>Edges:</strong>{' '}
            {data.pipeline.connectivity?.edge_count ?? '—'}
          </span>
          {showTemperature && (
            <span>
              <strong style={{ color: '#1e293b' }}>Temp:</strong> {temperature}
            </span>
          )}
          {data.overall.request_id && (
            <span
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              title={data.overall.request_id}
            >
              {data.overall.request_id.slice(0, 8)}...
            </span>
          )}
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

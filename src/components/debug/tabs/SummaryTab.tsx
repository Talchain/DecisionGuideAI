/**
 * SummaryTab Component
 *
 * At-a-glance health check for Debug Panel V2.
 * Shows KPIs, service chain, quick stats, and graph validation.
 */

import { useState, useMemo, CSSProperties } from 'react'
import { KpiCard, ServiceChain, type ChainNode, type KpiStatus } from '../components'
import type { DebugData, ValidationIssue } from '../hooks/useDebugData'
import { formatDuration } from '../utils'
import { getErrorInfo } from '../constants/errorCodes'

type SeverityFilter = 'all' | 'error' | 'warning' | 'info'

// Severity icon and color mapping
const SEVERITY_CONFIG = {
  error: { icon: '●', bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  warning: { icon: '⚠', bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
  info: { icon: 'ℹ', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
} as const

// Human-readable explanations for validation codes
const VALIDATION_EXPLANATIONS: Record<string, string> = {
  COEFFICIENT_REPAIRED: 'Edge strength was auto-adjusted to valid range',
  NORMALIZATION_WARNING: 'Option node filtered before analysis (expected behaviour)',
  GRAPH_DISCONNECTED: "Some nodes aren't connected to the goal — they won't affect results",
  STRENGTH_OUT_OF_RANGE: 'Edge strength outside [-1, +1] detected',
  BIDIRECTIONAL_EDGE: 'Two-way causal link found — review direction',
  UNIFORM_STRENGTHS: 'All edges have identical strength — may indicate prompt issue',
  MISSING_GOAL: 'No goal node found in the graph',
  ORPHAN_NODE: 'Node has no connections',
  CYCLE_DETECTED: 'Circular dependency found in the graph',
  INVALID_EDGE: 'Edge connects incompatible node types',
}

/**
 * Individual validation issue card
 */
function ValidationIssueCard({ issue }: { issue: ValidationIssue }) {
  const config = SEVERITY_CONFIG[issue.severity]
  // Get human-readable explanation for the code, fallback to message
  const explanation = VALIDATION_EXPLANATIONS[issue.code]

  return (
    <div
      style={{
        padding: '8px 12px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ color: config.text, flexShrink: 0 }}>{config.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                color: config.text,
                fontSize: 11,
              }}
            >
              {issue.code}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 4px',
                borderRadius: 3,
                background: issue.source === 'isl' ? '#e0e7ff' : '#f3e8ff',
                color: issue.source === 'isl' ? '#4338ca' : '#7c3aed',
              }}
            >
              {issue.source.toUpperCase()}
            </span>
          </div>
          {/* Plain-English explanation of the code */}
          {explanation && (
            <div style={{ color: '#475569', lineHeight: 1.4, marginBottom: 4 }}>
              {explanation}
            </div>
          )}
          <div style={{ color: '#374151', lineHeight: 1.4 }}>{issue.message}</div>
          {issue.suggestion && (
            <div style={{ color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
              💡 {issue.suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

  // Validation filter state
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  // Auto-expand validation section if there are errors
  const [validationExpanded, setValidationExpanded] = useState(() =>
    data.validation.summary.errors > 0
  )

  // Filtered validation issues
  const filteredIssues = useMemo(() => {
    if (severityFilter === 'all') return data.validation.issues
    return data.validation.issues.filter(issue => issue.severity === severityFilter)
  }, [data.validation.issues, severityFilter])

  // KPI values
  const analysisKpi = deriveAnalysisStatus(data)
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

  // Format temperature: show value if available, "N/A" if missing
  const temperature = data.pipeline.llm_metadata?.temperature
  const temperatureDisplay = temperature != null && !Number.isNaN(temperature)
    ? temperature
    : 'N/A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Error Banner */}
      {data.error && (() => {
        const errorInfo = getErrorInfo(data.error.code)
        return (
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
            {errorInfo && (
              <div style={{ fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #fecaca' }}>
                <div style={{ color: '#b91c1c' }}>{errorInfo.description}</div>
                <div style={{ color: '#dc2626', marginTop: 2 }}>
                  <strong>Action:</strong> {errorInfo.action}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Row 1: KPI Cards */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Health Overview</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
          className="sm:grid-cols-5"
        >
          <KpiCard
            label="Graph Stats"
            value={formatNodeCounts(data.pipeline.connectivity)}
            status="neutral"
            onClick={onNavigateToPipeline}
            tooltip="Click to view pipeline details"
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
            label="Winner"
            value={data.winningOption
              ? `${data.winningOption.label || data.winningOption.id || 'Unknown'} (${Number.isFinite(data.winningOption.win_probability) ? data.winningOption.win_probability.toFixed(0) : '—'}%)`
              : 'N/A'}
            status={data.winningOption
              ? (data.winningOption.is_close_race ? 'warn' : 'ok')
              : 'neutral'}
            tooltip={data.winningOption
              ? (data.winningOption.is_close_race && data.winningOption.runner_up
                ? `Close race vs ${data.winningOption.runner_up.label || data.winningOption.runner_up.id || 'Unknown'} (${Number.isFinite(data.winningOption.runner_up.win_probability) ? data.winningOption.runner_up.win_probability.toFixed(0) : '—'}%)`
                : 'Clear winner')
              : 'Run analysis to see winner'}
            compact
          />
          <KpiCard
            label="Robustness"
            value={data.robustness.context_label}
            status={
              data.robustness.status === 'pass' ? 'ok' :
              data.robustness.status === 'warn' ? 'warn' :
              data.robustness.status === 'fail' ? 'error' : 'neutral'
            }
            onClick={onNavigateToRaw}
            tooltip={data.robustness.description}
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

      {/* Row 2: Winning Option (if available) */}
      {data.winningOption && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Recommendation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
              Winner: {data.winningOption.label}
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {data.winningOption.win_probability.toFixed(0)}% confidence
              {data.winningOption.is_close_race && data.winningOption.runner_up && (
                <span style={{ color: '#64748b' }}>
                  {' '}vs {data.winningOption.runner_up.label} at {data.winningOption.runner_up.win_probability.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Service Chain */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Service Chain</div>
        <ServiceChain nodes={chainNodes} />
      </div>

      {/* Row 3: Graph Validation */}
      {data.hasData && (
        <div style={sectionStyle}>
          {/* Header with title, severity counts, and filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setValidationExpanded(!validationExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 12,
                  color: '#64748b',
                }}
                aria-label={validationExpanded ? 'Collapse validation' : 'Expand validation'}
              >
                {validationExpanded ? '▼' : '▶'}
              </button>
              <span style={sectionTitleStyle as CSSProperties & { marginBottom: 0 }}>
                Graph Validation
              </span>
              {/* Severity counts badge */}
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                {data.validation.summary.errors > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontWeight: 600,
                  }}>
                    ● {data.validation.summary.errors} Error{data.validation.summary.errors !== 1 ? 's' : ''}
                  </span>
                )}
                {data.validation.summary.warnings > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#fffbeb',
                    color: '#d97706',
                    fontWeight: 600,
                  }}>
                    ⚠ {data.validation.summary.warnings} Warning{data.validation.summary.warnings !== 1 ? 's' : ''}
                  </span>
                )}
                {data.validation.summary.info > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: 600,
                  }}>
                    ℹ {data.validation.summary.info} Info
                  </span>
                )}
                {data.validation.issues.length === 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#f0fdf4',
                    color: '#16a34a',
                    fontWeight: 600,
                  }}>
                    ✓ No Issues
                  </span>
                )}
              </div>
            </div>
            {/* Severity filter dropdown */}
            {data.validation.issues.length > 0 && validationExpanded && (
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All</option>
                <option value="error">Errors Only</option>
                <option value="warning">Warnings Only</option>
                <option value="info">Info Only</option>
              </select>
            )}
          </div>

          {/* Issues list */}
          {validationExpanded && filteredIssues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredIssues.map((issue) => (
                <ValidationIssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {/* Empty state when filtered */}
          {validationExpanded && filteredIssues.length === 0 && data.validation.issues.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
              No {severityFilter} issues found
            </div>
          )}
        </div>
      )}

      {/* Row 4: Quick Stats - Dense Row */}
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
          <span>
            <strong style={{ color: '#1e293b' }}>Temp:</strong> {temperatureDisplay}
          </span>
          {data.overall.request_id && (
            <span
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              title={data.overall.request_id}
            >
              {data.overall.request_id.slice(0, 8)}...
            </span>
          )}
        </div>

        {/* Builds Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 16px',
            fontSize: 12,
            color: '#64748b',
            marginTop: 8,
            fontFamily: 'monospace',
          }}
        >
          <span>
            <strong style={{ color: '#475569', fontFamily: 'inherit' }}>Builds:</strong>
          </span>
          <span>UI {data.builds.ui ?? '—'}</span>
          <span>•</span>
          <span>PLoT {data.builds.plot ?? '—'}</span>
          <span>•</span>
          <span>CEE {data.builds.cee ?? '—'}</span>
          <span>•</span>
          <span>ISL {data.builds.isl ?? '—'}</span>
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

/**
 * CEE Pipeline Tab Component
 *
 * Displays detailed pipeline trace data from CEE draft-graph responses.
 * Includes stage timeline, connectivity visualisation, and LLM call details.
 *
 * @example
 * ```tsx
 * <CeePipelineTab trace={pipelineTrace} isLoading={isDrafting} />
 * ```
 */

import { useState, useMemo } from 'react'
import type {
  CeePipelineTrace,
  CeePipelineStage,
  CeePipelineStageStatus,
  CeePipelineStatus,
  CeeConnectivityDiagnostic,
  CeeLlmCall,
  CeeLlmQualityCorrection,
} from '../adapters/cee/types'

// =============================================================================
// Status Colors and Icons
// =============================================================================

const STATUS_COLORS: Record<CeePipelineStageStatus, { bg: string; text: string; border: string }> = {
  success: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  failed: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  skipped: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  repaired: { bg: '#fef3c7', text: '#92400e', border: '#fde047' },
}

const PIPELINE_STATUS_COLORS: Record<CeePipelineStatus, { bg: string; text: string }> = {
  success: { bg: '#dcfce7', text: '#166534' },
  success_with_repairs: { bg: '#fef3c7', text: '#92400e' },
  failed: { bg: '#fee2e2', text: '#991b1b' },
}

const STATUS_ICONS: Record<CeePipelineStageStatus, string> = {
  success: '✅',
  failed: '❌',
  skipped: '⏭️',
  repaired: '🔧',
}

const STAGE_LABELS: Record<string, string> = {
  llm_draft: 'LLM Draft',
  node_validation: 'Node Validation',
  connectivity_check: 'Connectivity Check',
  goal_repair: 'Goal Repair',
  edge_repair: 'Edge Repair',
  final_validation: 'Final Validation',
}

// =============================================================================
// Format Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTokens(count?: number): string {
  if (!count) return '—'
  return count.toLocaleString()
}

// =============================================================================
// Collapsible JSON Viewer
// =============================================================================

interface JsonViewerProps {
  title: string
  data: unknown
  defaultExpanded?: boolean
}

function JsonViewer({ title, data, defaultExpanded = false }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!data) return null

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#334155',
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#94a3b8' }}>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: 8,
            background: '#f8fafc',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: 200,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// =============================================================================
// Copy to Clipboard Utility
// =============================================================================

/**
 * Copy text to clipboard with fallback for older browsers
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback using document.execCommand
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const result = document.execCommand('copy')
    document.body.removeChild(textarea)
    return result
  } catch {
    return false
  }
}

// =============================================================================
// Pipeline Summary Header
// =============================================================================

interface PipelineSummaryProps {
  trace: CeePipelineTrace
  onCopy?: () => void
}

function PipelineSummary({ trace, onCopy }: PipelineSummaryProps) {
  // Defensive: handle unexpected status values with fallback colors
  const statusColors = PIPELINE_STATUS_COLORS[trace.status] ?? { bg: '#fee2e2', text: '#991b1b' }
  const statusLabel = (trace.status ?? 'unknown').replace(/_/g, ' ')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      pipelineTrace: trace,
    }
    const success = await copyToClipboard(JSON.stringify(exportData, null, 2))
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      onCopy?.()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      {/* Status badge */}
      <div
        style={{
          padding: '4px 8px',
          background: statusColors.bg,
          color: statusColors.text,
          borderRadius: 4,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {statusLabel}
      </div>

      {/* Duration */}
      <div style={{ color: '#64748b' }}>
        <span style={{ fontWeight: 600 }}>{formatDuration(trace.total_duration_ms)}</span>
        <span style={{ marginLeft: 4 }}>total</span>
      </div>

      {/* LLM calls */}
      <div style={{ color: '#64748b' }}>
        <span style={{ fontWeight: 600 }}>{trace.llm_call_count ?? 1}</span>
        <span style={{ marginLeft: 4 }}>LLM call{(trace.llm_call_count ?? 1) !== 1 ? 's' : ''}</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Copy button with aria-live feedback */}
      <button
        onClick={handleCopy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: copied ? '#dcfce7' : '#f1f5f9',
          color: copied ? '#166534' : '#64748b',
          border: '1px solid',
          borderColor: copied ? '#86efac' : '#e2e8f0',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: 'monospace',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title="Copy pipeline trace to clipboard"
        aria-label={copied ? 'Copied to clipboard' : 'Copy pipeline trace'}
      >
        {copied ? '✓ Copied' : '📋 Copy'}
      </button>
      {/* Screen reader announcement */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {copied ? 'Pipeline trace copied to clipboard' : ''}
      </span>
    </div>
  )
}

// =============================================================================
// Pipeline Stage Timeline
// =============================================================================

interface PipelineTimelineProps {
  stages: CeePipelineStage[]
  expandedStages: Set<string>
  onToggleStage: (name: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

function PipelineTimeline({ stages, expandedStages, onToggleStage, onExpandAll, onCollapseAll }: PipelineTimelineProps) {
  const allExpanded = stages.length > 0 && stages.every((s) => expandedStages.has(s.name))
  const noneExpanded = expandedStages.size === 0

  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#334155',
          padding: '8px 0 4px 0',
        }}
      >
        <span>Pipeline Stages</span>
        <button
          onClick={allExpanded ? onCollapseAll : onExpandAll}
          style={{
            padding: '2px 6px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            cursor: 'pointer',
            color: '#64748b',
          }}
          title={allExpanded ? 'Collapse all stages' : 'Expand all stages'}
        >
          {allExpanded ? '▼ Collapse All' : '▶ Expand All'}
        </button>
      </div>
      {stages.map((stage, index) => {
        const colors = STATUS_COLORS[stage.status]
        const isExpanded = expandedStages.has(stage.name)
        const icon = STATUS_ICONS[stage.status]
        const label = STAGE_LABELS[stage.name] || stage.name

        return (
          <button
            key={stage.name}
            onClick={() => onToggleStage(stage.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 8px',
              background: isExpanded ? colors.bg : 'transparent',
              border: isExpanded ? `1px solid ${colors.border}` : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'monospace',
              textAlign: 'left',
              marginBottom: 2,
            }}
          >
            {/* Connector line */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 16,
              }}
            >
              {index > 0 && (
                <div
                  style={{
                    width: 2,
                    height: 8,
                    background: '#cbd5e1',
                    marginBottom: 2,
                  }}
                />
              )}
              <span style={{ fontSize: 12 }}>{icon}</span>
              {index < stages.length - 1 && (
                <div
                  style={{
                    width: 2,
                    height: 8,
                    background: '#cbd5e1',
                    marginTop: 2,
                  }}
                />
              )}
            </div>

            {/* Stage info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: colors.text, fontWeight: 500 }}>{label}</div>
              <div style={{ color: '#94a3b8', fontSize: 9 }}>{formatDuration(stage.duration_ms)}</div>
            </div>

            {/* Expand indicator */}
            <span style={{ color: '#94a3b8', fontSize: 10 }}>
              {isExpanded ? '▼' : '▶'}
            </span>

            {/* Status */}
            <span
              style={{
                padding: '2px 4px',
                background: colors.bg,
                color: colors.text,
                borderRadius: 2,
                fontSize: 8,
                textTransform: 'uppercase',
              }}
            >
              {stage.status}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// Connectivity Graph Visualisation
// =============================================================================

interface ConnectivityGraphProps {
  connectivity: CeeConnectivityDiagnostic
}

function ConnectivityGraph({ connectivity }: ConnectivityGraphProps) {
  const { passed, decision_ids, reachable_options, reachable_goals, unreachable_nodes, edges_added } = connectivity

  // Build ASCII representation
  const graphLines: string[] = []

  // Show decision → option → goal flow
  if (decision_ids.length > 0) {
    const decisionStr = decision_ids.length > 1 ? `[${decision_ids.length} decisions]` : decision_ids[0]
    graphLines.push(`decision: ${decisionStr}`)
  }

  if (reachable_options.length > 0) {
    const optionStr = reachable_options.length > 3
      ? `[${reachable_options.length} options]`
      : reachable_options.join(', ')
    graphLines.push(`    ↓`)
    graphLines.push(`options: ${optionStr}`)
  }

  if (reachable_goals.length > 0) {
    graphLines.push(`    ↓`)
    graphLines.push(`  goals: ${reachable_goals.join(', ')}`)
  }

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#334155',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Connectivity Graph
        <span style={{ fontSize: 12 }}>{passed ? '✅' : '❌'}</span>
      </div>

      {/* ASCII graph box */}
      <div
        style={{
          padding: 8,
          background: '#f8fafc',
          borderRadius: 4,
          border: '1px solid #e2e8f0',
          fontFamily: 'monospace',
          fontSize: 9,
          lineHeight: 1.4,
          whiteSpace: 'pre',
        }}
      >
        {graphLines.length > 0 ? graphLines.join('\n') : 'No connectivity data'}
      </div>

      {/* Unreachable nodes */}
      {unreachable_nodes.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            background: '#fee2e2',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#991b1b',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Disconnected:</div>
          {unreachable_nodes.map((node) => (
            <div key={node}>✗ {node}</div>
          ))}
        </div>
      )}

      {/* Added edges (repairs) */}
      {edges_added && edges_added.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            background: '#dcfce7',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#166534',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Edges added:</div>
          {edges_added.map((edge, i) => (
            <div key={i}>+ {edge.from} → {edge.to}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Stage Details Panel
// =============================================================================

interface StageDetailsProps {
  stage: CeePipelineStage | null
  trace: CeePipelineTrace
}

function StageDetails({ stage, trace }: StageDetailsProps) {
  if (!stage) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 10,
          fontFamily: 'monospace',
          padding: 16,
        }}
      >
        Select a stage to view details
      </div>
    )
  }

  const label = STAGE_LABELS[stage.name] || stage.name
  const colors = STATUS_COLORS[stage.status]

  return (
    <div style={{ flex: 1, padding: '0 0 0 12px' }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#334155',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {label}
        <span
          style={{
            padding: '2px 6px',
            background: colors.bg,
            color: colors.text,
            borderRadius: 4,
            fontSize: 9,
            textTransform: 'uppercase',
          }}
        >
          {stage.status}
        </span>
      </div>

      {/* Stage timing */}
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', marginBottom: 12 }}>
        Duration: <span style={{ color: '#334155' }}>{formatDuration(stage.duration_ms)}</span>
      </div>

      {/* Connectivity check special handling */}
      {stage.name === 'connectivity_check' && trace.connectivity && (
        <ConnectivityGraph connectivity={trace.connectivity} />
      )}

      {/* Edge repair details */}
      {stage.name === 'edge_repair' && trace.connectivity?.edges_added && trace.connectivity.edges_added.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
            Edges Added
          </div>
          <div
            style={{
              padding: 8,
              background: '#dcfce7',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#166534',
            }}
          >
            {trace.connectivity.edges_added.map((edge, i) => (
              <div key={i}>+ {edge.from} → {edge.to}</div>
            ))}
          </div>
        </div>
      )}

      {/* LLM draft details */}
      {stage.name === 'llm_draft' && trace.llm_calls && trace.llm_calls.length > 0 && (
        <LlmCallDetails call={trace.llm_calls[0]} />
      )}

      {/* Generic details */}
      {stage.details && Object.keys(stage.details).length > 0 && (
        <JsonViewer title="Stage Details" data={stage.details} />
      )}
    </div>
  )
}

// =============================================================================
// LLM Call Details
// =============================================================================

interface LlmCallDetailsProps {
  call: CeeLlmCall
}

function LlmCallDetails({ call }: LlmCallDetailsProps) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
        LLM Call Details
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 1fr',
          gap: '4px 8px',
          fontSize: 9,
          fontFamily: 'monospace',
          color: '#64748b',
          marginBottom: 8,
        }}
      >
        <span>Model:</span>
        <span style={{ color: '#0ea5e9' }}>{call.model}</span>
        <span>Duration:</span>
        <span style={{ color: '#334155' }}>{formatDuration(call.duration_ms)}</span>
        <span>Prompt tokens:</span>
        <span style={{ color: '#334155' }}>{formatTokens(call.prompt_tokens)}</span>
        <span>Output tokens:</span>
        <span style={{ color: '#334155' }}>{formatTokens(call.completion_tokens)}</span>
      </div>

      {/* LLM request/response viewers */}
      {call.request && <JsonViewer title="LLM Request" data={call.request} />}
      {call.response && <JsonViewer title="LLM Response" data={call.response} />}
    </div>
  )
}

// =============================================================================
// LLM Corrections Panel
// =============================================================================

interface LlmCorrectionsPanelProps {
  corrections: CeeLlmQualityCorrection[]
  title: string
}

/** Safely format coefficient value - handles undefined/null from malformed CEE responses */
const formatCoeff = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(2) : '—'

function LlmCorrectionsPanel({ corrections, title }: LlmCorrectionsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  if (corrections.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#92400e',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            background: '#fef3c7',
            borderRadius: 4,
            fontSize: 9,
          }}>
            ⚠️ {corrections.length} {corrections.length === 1 ? 'Correction' : 'Corrections'}
          </span>
          {title}
        </span>
        <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {expanded && (
        <div style={{ padding: 8, background: '#fffbeb', borderRadius: 4, marginBottom: 8 }}>
          {corrections.map((c, idx) => (
            <div
              key={c.edge_id || idx}
              style={{
                padding: 8,
                marginBottom: idx < corrections.length - 1 ? 8 : 0,
                background: 'white',
                borderRadius: 4,
                border: '1px solid #fde68a',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  gap: '4px 8px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: '#64748b',
                }}
              >
                <span>Edge:</span>
                <span style={{ color: '#0ea5e9' }}>{c.from_node} → {c.to_node}</span>
                <span>Original:</span>
                <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>
                  {formatCoeff(c.original_coefficient)}
                </span>
                <span>Corrected:</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>
                  {formatCoeff(c.corrected_coefficient)}
                </span>
                {c.reason && (
                  <>
                    <span>Reason:</span>
                    <span style={{ color: '#334155' }}>{c.reason}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main CeePipelineTab Component
// =============================================================================

export interface CeePipelineTabProps {
  trace: CeePipelineTrace | null
  isLoading?: boolean
  error?: string | null
}

export function CeePipelineTab({ trace, isLoading = false, error = null }: CeePipelineTabProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())

  // Toggle individual stage
  const handleToggleStage = (name: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // Expand all stages
  const handleExpandAll = () => {
    if (!trace) return
    setExpandedStages(new Set(trace.stages.map((s) => s.name)))
  }

  // Collapse all stages
  const handleCollapseAll = () => {
    setExpandedStages(new Set())
  }

  // Get expanded stages for rendering
  const expandedStageList = useMemo(() => {
    if (!trace) return []
    return trace.stages.filter((s) => expandedStages.has(s.name))
  }, [trace, expandedStages])

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#64748b',
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid #e2e8f0',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 8,
          }}
        />
        Drafting...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Error state WITHOUT trace - show error message
  if (error && !trace) {
    return (
      <div
        style={{
          padding: 12,
          background: '#fee2e2',
          borderRadius: 4,
          margin: 8,
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#991b1b',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>CEE Error</div>
        <div>{error}</div>
        <div style={{ marginTop: 8, color: '#64748b', fontSize: 9 }}>
          No pipeline trace available in error response.
        </div>
      </div>
    )
  }

  // Empty state (no error, no trace)
  if (!trace) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#94a3b8',
          fontSize: 11,
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
        <div>No CEE pipeline data.</div>
        <div style={{ marginTop: 4 }}>Run a draft to see pipeline details.</div>
      </div>
    )
  }

  return (
    <div style={{ fontSize: 10, fontFamily: 'monospace' }}>
      {/* Error banner when showing trace from error response */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fee2e2',
            borderBottom: '1px solid #fca5a5',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12 }}>⚠️</span>
          <span>Pipeline trace from failed request: {error}</span>
        </div>
      )}

      {/* Summary header */}
      <PipelineSummary trace={trace} />

      {/* Two-column layout: timeline + details */}
      <div
        style={{
          display: 'flex',
          padding: 12,
          gap: 12,
          minHeight: 200,
        }}
      >
        {/* Left: Timeline */}
        <PipelineTimeline
          stages={trace.stages}
          expandedStages={expandedStages}
          onToggleStage={handleToggleStage}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
        />

        {/* Right: Details for expanded stages */}
        <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: 12, overflowY: 'auto' }}>
          {expandedStageList.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center', padding: 16 }}>
              Click a stage to see details
            </div>
          ) : (
            expandedStageList.map((stage, idx) => (
              <div key={stage.name} style={{ marginBottom: idx < expandedStageList.length - 1 ? 16 : 0 }}>
                <StageDetails stage={stage} trace={trace} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer: Expandable sections */}
      <div style={{ padding: '0 12px 12px 12px' }}>
        {/* LLM Quality Corrections */}
        {trace.llm_quality?.corrections && trace.llm_quality.corrections.length > 0 && (
          <LlmCorrectionsPanel corrections={trace.llm_quality.corrections} title="LLM Corrections" />
        )}
        {trace.llm_quality?.risk_coefficient_corrections && trace.llm_quality.risk_coefficient_corrections.length > 0 && (
          <LlmCorrectionsPanel corrections={trace.llm_quality.risk_coefficient_corrections} title="Risk Coefficient Corrections" />
        )}

        {/* All LLM calls */}
        {trace.llm_calls && trace.llm_calls.length > 1 && (
          <JsonViewer title={`All LLM Calls (${trace.llm_calls.length})`} data={trace.llm_calls} />
        )}

        {/* Final graph */}
        {trace.final_graph && (
          <JsonViewer
            title={`Final Graph (${trace.final_graph.node_count} nodes, ${trace.final_graph.edge_count} edges)`}
            data={trace.final_graph}
          />
        )}
      </div>
    </div>
  )
}

export default CeePipelineTab

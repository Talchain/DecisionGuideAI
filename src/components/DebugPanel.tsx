/**
 * Debug Panel Component
 *
 * Collapsible diagnostic panel for staging environments.
 * Displays service versions, request traces, gate statuses, and export functionality.
 *
 * Tabs:
 * - Overview: All existing debug panel content
 * - CEE Pipeline: Pipeline trace visualisation for CEE draft-graph responses
 *
 * Activation:
 * - URL parameter: ?diag=1
 * - Console: window.__OLUMI_DEBUG = true
 * - Only visible in staging (VITE_APP_ENV === 'staging')
 *
 * @example
 * ```tsx
 * // Add to app root
 * <DebugPanel />
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  getRecentTraces,
  clearTraces,
  type RequestTrace,
  type DownstreamCall,
} from '../lib/debug-state'
import { useGateStore, ALL_GATES, type GateName, type GateStatus } from '../lib/gate-state'
import { getClientBuild, getVersionInfo } from '../lib/version-cache'
import { exportMergedDebugBundle } from '../lib/diagnostic-bundle'
import { getAllServiceHealthArray, type ServiceHealthInfo, type HealthStatus } from '../lib/service-health'
import { useCanvasStore } from '../canvas/store'
import { ContractInspector } from './ContractInspector'
import { CeePipelineTab } from './CeePipelineTab'
import { copyTextToClipboard } from '../utils/clipboard'
import { truncateToSize } from '../utils/text'
import { HeadlineSignals, detectSchema } from './debug/HeadlineSignals'
import { TimelineTab } from './debug/TimelineTab'
import { RawDataTab } from './debug/RawDataTab'
import { PayloadLabTab } from './debug/PayloadLabTab'
import { getDebugFlags } from './debug/useDebugFlags'
import type { FieldAdaptation, TimelineStage, RequestEntry, ISLTestResponse } from './debug/types'
import { LlmIoTab } from './debug/LlmIoTab'
import { TransformsTab } from './debug/TransformsTab'
import { usePayloadTraceStore } from '../lib/payload-trace-store'
import { detectService } from '../lib/contract-validators'
import { getStatusDisplay, formatStatus, getEnhancedStatusDisplay, formatStatusWithLabel } from './debug/formatters'

// =============================================================================
// Debug Panel Tabs
// =============================================================================

type DebugPanelTab =
  | 'overview'
  | 'timeline'
  | 'llm-io'
  | 'transforms'
  | 'raw-data'
  | 'payload-lab'
  | 'cee-pipeline'

interface TabConfig {
  id: DebugPanelTab
  label: string
  unsafeOnly?: boolean
}

const DEBUG_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'llm-io', label: 'LLM I/O' },
  { id: 'transforms', label: 'Transforms' },
  { id: 'raw-data', label: 'Raw Data' },
  { id: 'payload-lab', label: 'Payload Lab' },
  { id: 'cee-pipeline', label: 'CEE Pipeline' },
]

function truncateText(value: unknown, maxLen: number): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen)}…`
}

// =============================================================================
// CEE Pipeline Data Source
// =============================================================================

// Pipeline trace now comes from the canvas store (populated by DraftChat)
// Previously used mock data has been removed - the pipeline tab shows
// "No CEE pipeline data" when no draft has been run.

declare global {
  interface Window {
    __OLUMI_DEBUG?: boolean
  }
}

/**
 * Check if debug panel should be visible
 */
function shouldShowDebugPanel(): boolean {
  // Only in staging or development environment
  const env = import.meta.env.VITE_APP_ENV || 'development'
  const allowedEnvs = ['staging', 'development']
  if (!allowedEnvs.includes(env)) return false

  // Check URL parameter - handle both regular and HashRouter URLs
  // For HashRouter: http://localhost:5173/#/canvas?diag=1
  // For regular: http://localhost:5173/?diag=1
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('diag') === '1') return true

  // Check hash for HashRouter query params (e.g., #/canvas?diag=1)
  const hashParts = window.location.hash.split('?')
  if (hashParts.length > 1) {
    const hashParams = new URLSearchParams(hashParts[1])
    if (hashParams.get('diag') === '1') return true
  }

  // Check global flag (console: window.__OLUMI_DEBUG = true)
  if (window.__OLUMI_DEBUG === true) return true

  return false
}

/**
 * Gate status indicator colors
 */
const STATUS_COLORS: Record<GateStatus, { bg: string; text: string; border: string }> = {
  pass: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  warn: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  fail: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}

/**
 * WARN gate guidance messages - actionable next steps
 */
const WARN_GATE_GUIDANCE: Record<GateName, string> = {
  graph_readiness: 'Add more context to brief: concrete options, key factors, success metrics',
  validation: 'Check for missing edges or disconnected nodes in the graph',
  run: 'Verify factor values are set; some may need observed_state data',
  robustness: 'Factor uncertainties incomplete — add baseline/std or provenance with values',
}

/**
 * Health status indicator colors
 */
const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
  unknown: '#94a3b8',
}

/**
 * Request status indicator colors.
 * Status 0 = network error (red), null/undefined = pending (gray).
 */
function getRequestStatusColor(status?: number, hasError = false, isComplete = true): string {
  const display = getStatusDisplay(status ?? null, hasError, isComplete)
  // Map Tailwind classes to hex colors for inline styles
  const colorMap: Record<string, string> = {
    'text-green-600': '#22c55e',
    'text-amber-600': '#f59e0b',
    'text-red-600': '#ef4444',
    'text-stone-500': '#78716c',
    'text-stone-600': '#57534e',
  }
  return colorMap[display.color] || '#94a3b8'
}

/**
 * Format elapsed time for display
 */
function formatElapsed(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Gate status chip component
 */
function GateStatusChip({ gate, record }: { gate: GateName; record: { status: GateStatus; message?: string } }) {
  const colors = STATUS_COLORS[record.status]
  const isWarn = record.status === 'warn'
  const guidance = isWarn ? WARN_GATE_GUIDANCE[gate] : undefined
  const tooltip = guidance ? `${record.message || gate}: ${guidance}` : (record.message || `Gate: ${gate}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 4,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          fontSize: 11,
        }}
        title={tooltip}
      >
        <span style={{ fontWeight: 600, color: colors.text }}>{gate}</span>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.text,
          }}
        />
        <span style={{ color: colors.text, textTransform: 'uppercase' }}>{record.status}</span>
      </div>
      {/* WARN guidance inline */}
      {isWarn && guidance && (
        <div
          style={{
            fontSize: 9,
            color: '#854d0e',
            paddingLeft: 8,
            maxWidth: 180,
            lineHeight: 1.3,
          }}
        >
          {guidance}
        </div>
      )}
    </div>
  )
}

/**
 * Request trace row component with downstream calls
 */
function TraceRow({ trace }: { trace: RequestTrace }) {
  const statusColor = getRequestStatusColor(trace.status, !!trace.error, trace.completed ?? false)
  const enhancedStatus = getEnhancedStatusDisplay(trace.status, !!trace.error, trace.completed ?? false)
  const method = trace.method.toUpperCase()
  const endpoint = trace.endpoint.replace('/bff/', '/')
  const hasDownstream = trace.downstream && trace.downstream.length > 0

  return (
    <div style={{ borderBottom: '1px solid #e2e8f0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 80px 60px',
          gap: 8,
          padding: '4px 8px',
          fontSize: 10,
          fontFamily: 'monospace',
          alignItems: 'center',
        }}
      >
        {/* Method */}
        <span
          style={{
            background: method === 'GET' ? '#dbeafe' : '#fce7f3',
            color: method === 'GET' ? '#1d4ed8' : '#be185d',
            padding: '2px 4px',
            borderRadius: 2,
            textAlign: 'center',
            fontSize: 9,
          }}
        >
          {method}
        </span>

        {/* Endpoint */}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#334155',
          }}
          title={trace.endpoint}
        >
          {endpoint}
        </span>

        {/* Status with error explanation tooltip */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: enhancedStatus.hint ? 'help' : 'default',
          }}
          title={enhancedStatus.hint ?? undefined}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
            }}
          />
          <span style={{ color: statusColor }}>{formatStatusWithLabel(trace.status, !!trace.error, trace.completed ?? false)}</span>
        </span>

        {/* Elapsed */}
        <span style={{ color: '#64748b', textAlign: 'right' }}>{formatElapsed(trace.elapsedMs)}</span>
      </div>

      {/* Downstream calls (if any) */}
      {hasDownstream && (
        <div style={{ paddingBottom: 4, paddingRight: 8 }}>
          <DownstreamCallList calls={trace.downstream} />
        </div>
      )}
    </div>
  )
}

/**
 * Service health row component
 */
function ServiceRow({ service }: { service: ServiceHealthInfo }) {
  const statusColor = HEALTH_STATUS_COLORS[service.status]
  const version = service.version || '—'
  const commit = service.commit ? `(${service.commit.slice(0, 7)})` : ''
  const showReason = service.status !== 'healthy' && service.error

  return (
    <div
      style={{
        padding: '2px 0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 70px',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, color: '#334155', textTransform: 'uppercase' }}>
          {service.name}
        </span>
        <span style={{ color: '#64748b' }}>
          {version} {commit}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
            }}
          />
          <span style={{ color: statusColor, fontSize: 9 }}>{service.status}</span>
        </span>
      </div>
      {/* Show reason for non-healthy status */}
      {showReason && (
        <div
          style={{
            marginLeft: 50,
            marginTop: 2,
            fontSize: 9,
            color: '#94a3b8',
            fontStyle: 'italic',
          }}
        >
          {service.error}
        </div>
      )}
    </div>
  )
}

/**
 * Canvas Edges section - shows what edges look like AFTER DraftChat processing
 * Compare with CEE Response section to debug data loss in transformation
 */
function CanvasEdgesSection() {
  const edges = useCanvasStore((s) => s.edges)
  const firstEdge = edges[0]

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{ fontWeight: 600, marginBottom: 6, color: '#334155', cursor: 'help' }}
        title="Edge structure in canvas store AFTER DraftChat processing. Compare with CEE Response above to debug field mapping."
      >
        Canvas Edges
        <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
      </div>
      {edges.length > 0 && firstEdge?.data ? (
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '2px 8px', color: '#64748b' }}>
          <span>Count:</span>
          <span style={{ color: '#0ea5e9' }}>{edges.length}</span>
          <span>Data Keys:</span>
          <span style={{ color: '#22c55e', wordBreak: 'break-word' }}>
            {Object.keys(firstEdge.data).join(', ')}
          </span>
          <span>Coefficients:</span>
          <span style={{ wordBreak: 'break-word' }}>
            {/* Show first 3 edges' weight+direction */}
            {edges.slice(0, 3).map((e, i) => (
              <span key={e.id} style={{ marginRight: 8 }}>
                {e.data?.direction === 'negative' ? '-' : '+'}
                {((e.data?.weight ?? 0.5) as number).toFixed(2)}
                {i < Math.min(edges.length - 1, 2) ? ',' : ''}
              </span>
            ))}
            {edges.length > 3 && <span style={{ color: '#94a3b8' }}>... +{edges.length - 3} more</span>}
          </span>
          <span>Sample Edge:</span>
          <details style={{ color: '#64748b' }}>
            <summary style={{ cursor: 'pointer', color: '#3b82f6' }}>View data</summary>
            <pre style={{
              fontSize: 9,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: '#f8fafc',
              padding: 4,
              borderRadius: 4,
              marginTop: 4,
              maxHeight: 150,
              overflow: 'auto'
            }}>
              {JSON.stringify({
                id: firstEdge.id,
                source: firstEdge.source,
                target: firstEdge.target,
                ...firstEdge.data
              }, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div style={{ color: '#94a3b8' }}>No canvas edges (create edges on canvas)</div>
      )}
    </div>
  )
}

/**
 * Request ID display with copy button
 */
function RequestIdDisplay({ requestId }: { requestId?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!requestId) return
    navigator.clipboard.writeText(requestId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [requestId])

  if (!requestId) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      <span style={{ color: '#64748b' }}>Request ID:</span>
      <span
        style={{
          color: '#334155',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
        title={requestId}
      >
        {requestId}
      </span>
      <button
        onClick={handleCopy}
        style={{
          padding: '2px 6px',
          background: copied ? '#dcfce7' : '#f1f5f9',
          color: copied ? '#166534' : '#64748b',
          border: '1px solid',
          borderColor: copied ? '#86efac' : '#e2e8f0',
          borderRadius: 4,
          fontSize: 10,
          cursor: 'pointer',
          minWidth: 50,
          transition: 'all 0.15s ease',
        }}
        aria-label="Copy request ID to clipboard"
        title="Copy to clipboard"
      >
        {copied ? '✓ Copied' : '📋 Copy'}
      </button>
    </div>
  )
}

/**
 * Downstream call list component
 */
function DownstreamCallList({ calls }: { calls?: DownstreamCall[] }) {
  if (!calls || calls.length === 0) return null

  return (
    <div style={{ marginLeft: 16, marginTop: 2 }}>
      {calls.map((call, i) => {
        const statusColor = getRequestStatusColor(call.status)
        const enhancedStatus = getEnhancedStatusDisplay(call.status, false, true)
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#64748b',
              padding: '1px 0',
            }}
          >
            <span style={{ color: '#94a3b8' }}>└─</span>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#475569' }}>
              {call.service}
            </span>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: statusColor,
              }}
            />
            <span
              style={{ color: statusColor, cursor: enhancedStatus.hint ? 'help' : 'default' }}
              title={enhancedStatus.hint ?? undefined}
            >
              {formatStatusWithLabel(call.status, false, true)}
            </span>
            <span>{call.elapsedMs}ms</span>
            <span style={{ color: '#94a3b8', fontSize: 8 }}>
              [{call.payloadHash?.slice(0, 6) || '?'} → {call.responseHash?.slice(0, 6) || '?'}]
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Verification hop interface
 */
interface VerificationHop {
  from: string
  to: string
  hashSent: string
  hashReceived?: string
  verified: boolean
}

/**
 * Build verification hops from a trace
 */
function buildVerificationHops(trace: RequestTrace): VerificationHop[] {
  const hops: VerificationHop[] = []

  // Determine first service from endpoint
  const firstService = trace.endpoint.includes('plot')
    ? 'plot'
    : trace.endpoint.includes('engine')
      ? 'plot'
      : trace.endpoint.includes('cee')
        ? 'cee'
        : trace.endpoint.includes('isl')
          ? 'isl'
          : 'bff'

  // UI → first service hop
  hops.push({
    from: 'ui',
    to: firstService,
    hashSent: trace.payloadHash,
    hashReceived: trace.traceReceived?.payloadHash,
    verified: trace.traceReceived ? trace.traceReceived.payloadHash === trace.payloadHash : true,
  })

  // Add downstream hops
  trace.downstream?.forEach((call) => {
    hops.push({
      from: firstService,
      to: call.service,
      hashSent: call.payloadHash,
      hashReceived: call.responseHash,
      verified: true, // If we have the data, it arrived
    })
  })

  return hops
}

/**
 * Compute integration status from traces
 */
function computeIntegrationStatus(traces: RequestTrace[]): { ok: boolean; issues: string[] } {
  const issues: string[] = []

  for (const trace of traces.slice(0, 5)) {
    // Check if downstream calls succeeded
    trace.downstream?.forEach((call) => {
      if (call.status >= 400) {
        issues.push(`${call.service} returned ${call.status}`)
      }
    })

    // Check trace verification
    if (trace.traceReceived && trace.traceReceived.payloadHash !== trace.payloadHash) {
      issues.push(`Hash mismatch: sent ${trace.payloadHash?.slice(0, 6)}, received ${trace.traceReceived.payloadHash?.slice(0, 6)}`)
    }
  }

  return { ok: issues.length === 0, issues }
}

/**
 * Trace verification section component
 */
function TraceVerification({ traces }: { traces: RequestTrace[] }) {
  const latestTrace = traces[0]
  if (!latestTrace || (!latestTrace.downstream?.length && !latestTrace.traceReceived)) {
    return null
  }

  const hops = buildVerificationHops(latestTrace)
  const allVerified = hops.every((h) => h.verified)

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 6,
          color: '#334155',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Trace Verification
        <span style={{ fontSize: 12 }}>{allVerified ? '✅' : '⚠️'}</span>
      </div>
      {hops.map((hop, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 0',
            color: '#64748b',
          }}
        >
          <span style={{ color: '#475569' }}>
            {hop.from} → {hop.to}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 9 }}>
            [{hop.hashSent?.slice(0, 6) || '?'}]
          </span>
          <span style={{ fontSize: 12 }}>{hop.verified ? '✅' : '❌'}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Sensitivity Analysis section component
 * Shows data from PLoT enrichment (Factor Sensitivity Phase 1)
 */
function SensitivityAnalysisSection() {
  const enrichment = useCanvasStore((s) => s.results.enrichment)

  // Check if we have any sensitivity data
  const sensitivity = enrichment?.sensitivity_analysis
  const hasData = sensitivity && (
    (Array.isArray(sensitivity.edges) && sensitivity.edges.length > 0) ||
    (Array.isArray(sensitivity.factors) && sensitivity.factors.length > 0)
  )

  if (!hasData) return null

  const edgeCount = sensitivity?.edges?.length ?? 0
  const factorCount = sensitivity?.factors?.length ?? 0
  const factorStatus = enrichment?.metadata?.factor_sensitivity_status ?? 'unknown'
  const islEndpoints = enrichment?.metadata?.isl_endpoints_called ?? []

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{ fontWeight: 600, marginBottom: 6, color: '#334155', cursor: 'help' }}
        title="Sensitivity analysis from PLoT enrichment (calls ISL internally with detail_level='deep')"
      >
        Sensitivity Analysis
        <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '2px 8px', color: '#64748b' }}>
        <span>Source:</span>
        <span style={{ color: '#0ea5e9' }}>PLoT /v1/run (deep)</span>
        <span>Edge sensitivity:</span>
        <span
          style={{ color: edgeCount > 0 ? '#22c55e' : '#94a3b8', cursor: edgeCount === 0 ? 'help' : 'default' }}
          title={edgeCount === 0 ? 'ISL requires edges with belief_exists < 1 or strength_std > 0' : undefined}
        >
          {edgeCount > 0 ? `${edgeCount} edges` : 'none'}
        </span>
        <span>Factor sensitivity:</span>
        <span style={{ color: factorCount > 0 ? '#22c55e' : '#94a3b8' }}>
          {factorCount > 0 ? `${factorCount} factors` : 'none'}
        </span>
        <span>Factor status:</span>
        <span
          style={{
            color:
              factorStatus === 'available'
                ? '#22c55e'
                : factorStatus === 'skipped'
                  ? '#f59e0b'
                  : factorStatus === 'unavailable'
                    ? '#ef4444'
                    : '#94a3b8',
          }}
        >
          {factorStatus}
        </span>
        {islEndpoints.length > 0 && (
          <>
            <span>ISL endpoints:</span>
            <span style={{ color: '#64748b' }}>{islEndpoints.join(', ')}</span>
          </>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Helper Functions for New Tabs
// =============================================================================

/**
 * Build timeline stages from request traces and CEE pipeline trace
 */
function buildTimelineStages(
  traces: RequestTrace[],
  ceePipelineTrace: any
): TimelineStage[] {
  const stages: TimelineStage[] = []

  // Add stages from request traces
  for (const trace of traces.slice(0, 10)) {
    const isError = trace.status && trace.status >= 400
    const isSuccess = trace.status && trace.status >= 200 && trace.status < 400
    const status: TimelineStage['status'] = isError
      ? 'error'
      : isSuccess
        ? 'success'
        : 'running'

    stages.push({
      id: trace.requestId || `trace-${trace.timestamp}`,
      label: trace.endpoint.replace('/bff/', ''),
      status,
      duration: trace.elapsedMs,
      details: {
        summary: `${trace.method} ${formatStatus(trace.status, !!trace.error, trace.completed ?? false)}`,
        method: trace.method,
        status: trace.status,
      },
    })
  }

  // Add CEE pipeline stage if available
  if (ceePipelineTrace) {
    const llmChildren: TimelineStage[] = Array.isArray(ceePipelineTrace.llm_calls)
      ? ceePipelineTrace.llm_calls.map((call: any, idx: number) => ({
          id: `llm-${call?.id ?? idx}`,
          label: `LLM Call ${idx + 1}`,
          status: 'success',
          duration: typeof call?.duration_ms === 'number' ? call.duration_ms : undefined,
          isUnsafe: true,
          details: {
            summary: `${call?.model ?? 'unknown model'} (${typeof call?.duration_ms === 'number' ? `${call.duration_ms}ms` : 'duration unknown'})`,
            model: call?.model,
            duration_ms: call?.duration_ms,
            prompt_preview: truncateText(call?.request, 800),
            response_preview: truncateText(call?.response, 800),
            prompt_tokens: call?.prompt_tokens,
            completion_tokens: call?.completion_tokens,
          },
        }))
      : []

    stages.unshift({
      id: 'cee-pipeline',
      label: 'CEE Processing',
      status:
        ceePipelineTrace.status === 'success' || ceePipelineTrace.status === 'success_with_repairs'
          ? 'success'
          : ceePipelineTrace.status === 'failed'
            ? 'error'
            : 'running',
      duration: ceePipelineTrace.total_duration_ms,
      details: {
        summary: `${ceePipelineTrace.status} - ${ceePipelineTrace.llm_call_count ?? 0} LLM calls`,
        llm_calls: ceePipelineTrace.llm_call_count,
        nodes: ceePipelineTrace.final_graph?.node_count,
        edges: ceePipelineTrace.final_graph?.edge_count,
      },
      children: llmChildren.length > 0 ? llmChildren : undefined,
    })
  }

  return stages
}

/**
 * Build request entries from traces for RawDataTab
 */
function buildRequestEntries(traces: RequestTrace[]): RequestEntry[] {
  return traces.slice(0, 20).map((trace) => ({
    id: trace.requestId || `trace-${trace.timestamp}`,
    timestamp: new Date(trace.timestamp),
    method: trace.method,
    url: trace.endpoint,
    headers: {},
    status: trace.status,
    duration: trace.elapsedMs,
  }))
}

function deriveServicesFromTraces(traces: RequestTrace[]): Record<string, { status: HealthStatus; version?: string }> {
  const result: Record<string, { status: HealthStatus; version?: string }> = {}
  const candidates = ['bff', 'cee', 'isl', 'plot']

  for (const svc of candidates) {
    const svcTraces =
      svc === 'bff'
        ? traces
        : traces.filter((t) => {
            // First check x-olumi-service header value
            const headerService = (t.service ?? '').toLowerCase()
            if (headerService === svc) return true
            // Fall back to endpoint-based detection when header is missing
            if (!headerService) {
              const detectedService = detectService(t.endpoint).toLowerCase()
              return detectedService === svc
            }
            return false
          })

    if (svcTraces.length === 0) {
      result[svc] = { status: 'unknown' }
      continue
    }

    const any5xx = svcTraces.some((t) => typeof t.status === 'number' && t.status >= 500)
    const any4xx = svcTraces.some((t) => typeof t.status === 'number' && t.status >= 400 && t.status < 500)
    const any2xx = svcTraces.some((t) => typeof t.status === 'number' && t.status >= 200 && t.status < 400)

    const status: HealthStatus = any5xx ? 'down' : any4xx ? 'degraded' : any2xx ? 'healthy' : 'unknown'
    const version = svcTraces.find((t) => typeof t.serviceBuild === 'string')?.serviceBuild

    result[svc] = { status, version }
  }

  return result
}

/**
 * Derive service status from traced payloads (more reliable than request traces).
 * tracedPayloads have explicit `service` field set by the payload trace store.
 */
function deriveServicesFromPayloads(
  payloads: Array<{ service: string; status?: number; error?: string; completed?: boolean; timestamp: Date }>
): Record<string, { status: HealthStatus }> {
  const result: Record<string, { status: HealthStatus }> = {}
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

  // Group payloads by service (case-insensitive)
  const byService: Record<string, typeof payloads> = {}
  for (const p of payloads) {
    if (!p.completed) continue
    if (new Date(p.timestamp).getTime() < fiveMinutesAgo) continue

    const svc = p.service.toLowerCase()
    if (!byService[svc]) byService[svc] = []
    byService[svc].push(p)
  }

  // Derive status for each service
  for (const [svc, svcPayloads] of Object.entries(byService)) {
    if (svcPayloads.length === 0) {
      result[svc] = { status: 'unknown' }
      continue
    }

    const hasNetworkError = svcPayloads.some((p) => p.status === 0 || (!p.status && p.error))
    const has5xx = svcPayloads.some((p) => p.status && p.status >= 500)
    const has4xx = svcPayloads.some((p) => p.status && p.status >= 400 && p.status < 500)
    const has2xx = svcPayloads.some((p) => p.status && p.status >= 200 && p.status < 300)

    // Priority: network error = unreachable, 5xx = down, 2xx with errors = degraded, 2xx only = healthy
    let status: HealthStatus
    if (hasNetworkError && !has2xx) {
      status = 'down' // unreachable
    } else if (has5xx && !has2xx) {
      status = 'down'
    } else if (has5xx || has4xx) {
      status = 'degraded' // Service responding but with errors
    } else if (has2xx) {
      status = 'healthy'
    } else {
      status = 'unknown'
    }

    result[svc] = { status }
  }

  return result
}

function buildFieldAdaptations(params: {
  ceePipelineTrace: unknown
  nodeCount: number
  edgeCount: number
  hasAnalysisReady: boolean
}): FieldAdaptation[] {
  const adaptations: FieldAdaptation[] = []
  const trace = params.ceePipelineTrace as any

  if (trace && trace.final_graph == null && (params.nodeCount > 0 || params.edgeCount > 0)) {
    adaptations.push({
      path: 'pipeline.final_graph',
      rawValue: undefined,
      adaptedValue: { node_count: params.nodeCount, edge_count: params.edgeCount },
      reason: 'final_graph missing in pipeline trace; using current canvas graph counts',
    })
  }

  if (params.hasAnalysisReady) {
    adaptations.push({
      path: 'analysis_ready',
      rawValue: undefined,
      adaptedValue: 'present (stored in canvas)',
      reason: 'analysis_ready derived from CEE v3 draft and stored in canvas state',
    })
  }

  return adaptations
}

// Debug panel resizing constraints
const MIN_PANEL_WIDTH = 360
const MIN_PANEL_HEIGHT = 260
const STORAGE_KEY_WIDTH = 'olumi:debugPanelWidth'
const STORAGE_KEY_HEIGHT = 'olumi:debugPanelHeight'
const STORAGE_KEY_POSITION = 'olumi:debugPanelPosition'
const COLLAPSED_WIDTH_ESTIMATE = 180

function getInitialPanelWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed, MIN_PANEL_WIDTH)
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 520
}

function getInitialPanelHeight(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HEIGHT)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed, MIN_PANEL_HEIGHT)
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 480
}

function getInitialPanelPosition(): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_POSITION)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number'
      ) {
        return { x: parsed.x, y: parsed.y }
      }
    }
  } catch {
    // Ignore storage errors
  }
  const defaultY =
    typeof window !== 'undefined'
      ? Math.max(16, window.innerHeight - MIN_PANEL_HEIGHT - 32)
      : 16
  return { x: 16, y: defaultY }
}

/**
 * Debug Panel main component
 */
export function DebugPanel() {
  const [visible, setVisible] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [expanded, setExpanded] = useState(false) // Maximized state
  const [activeTab, setActiveTab] = useState<DebugPanelTab>('overview')
  
  // PoC: All debug features accessible with ?diag=1 (no additional gating)
  const { showDebugConsole } = useMemo(() => getDebugFlags(), [])
  const [traces, setTraces] = useState<RequestTrace[]>([])
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [services, setServices] = useState<ServiceHealthInfo[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const servicesFetched = useRef(false)
  const [userPanelWidth, setUserPanelWidth] = useState(getInitialPanelWidth)
  const [userPanelHeight, setUserPanelHeight] = useState(getInitialPanelHeight)
  const [isResizingWidth, setIsResizingWidth] = useState(false)
  const [isResizingHeight, setIsResizingHeight] = useState(false)
  const [isResizingCorner, setIsResizingCorner] = useState(false)
  const [panelPosition, setPanelPosition] = useState(getInitialPanelPosition)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)
  const resizeStartPanelY = useRef(0)
  const verticalResizeEdge = useRef<'top' | 'bottom'>('bottom')
  const dragStartPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartPanelPos = useRef<{ x: number; y: number }>(panelPosition)
  const panelPositionRef = useRef(panelPosition)

  // CEE Pipeline state - consumed from canvas store (populated by DraftChat)
  const ceePipelineTrace = useCanvasStore((s) => s.ceePipelineTrace)

  // CEE V3: analysis_ready is stored separately from pipeline trace
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)

  // Canvas graph (best source of truth for current counts)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)

  // Payload trace store (raw request/response bodies)
  const tracedPayloads = usePayloadTraceStore((s) => s.payloads)
  const selectedPayloadId = usePayloadTraceStore((s) => s.selectedId)
  const clearPayloads = usePayloadTraceStore((s) => s.clearPayloads)

  const selectedPayload = useMemo(() => {
    if (!selectedPayloadId) return null
    return tracedPayloads.find((p) => p.id === selectedPayloadId) ?? null
  }, [selectedPayloadId, tracedPayloads])

  const activeResponseBody: unknown = useMemo(() => {
    // Prefer explicitly selected payload (Contract Inspector)
    if (selectedPayload?.response?.body !== undefined) return selectedPayload.response.body

    // Otherwise, try to find the latest CEE payload that has a response
    const latestCee = tracedPayloads.find((p) => p.service === 'CEE' && p.response?.body !== undefined)
    if (latestCee?.response?.body !== undefined) return latestCee.response.body

    return undefined
  }, [selectedPayload, tracedPayloads])

  const activePipelineForTabs: unknown = useMemo(() => {
    // Prefer pipeline trace embedded in the active response body, if present.
    const body = activeResponseBody as any
    return body?.pipeline_trace ?? body?.trace?.pipeline ?? ceePipelineTrace ?? undefined
  }, [activeResponseBody, ceePipelineTrace])

  // Raw error data for debugging malformed responses
  const rawErrorData = useCanvasStore((s) => s.runMeta.rawErrorData)

  // Captured upstream errors for debug panel
  const errorDetails = useCanvasStore((s) => s.runMeta.errorDetails)

  const gates = useGateStore((s) => s.gates)

  // Navigation helper: navigate to overview tab and scroll to Contract Inspector
  const navigateToContractInspector = useCallback((payloadId?: string) => {
    // Select the payload if provided
    if (payloadId) {
      usePayloadTraceStore.getState().selectPayload(payloadId)
    }
    // Switch to overview tab
    setActiveTab('overview')
    // Scroll to Contract Inspector after tab renders
    setTimeout(() => {
      const el = document.getElementById('debug-contract-inspector')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add brief highlight effect
        el.style.transition = 'background-color 0.3s'
        el.style.backgroundColor = '#fef3c7'
        setTimeout(() => {
          el.style.backgroundColor = ''
        }, 2000)
      }
    }, 100)
  }, [])

  // Navigation helper: scroll to Failure History section
  const navigateToFailureHistory = useCallback(() => {
    setActiveTab('overview')
    setTimeout(() => {
      const el = document.getElementById('debug-failure-history')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.transition = 'background-color 0.3s'
        el.style.backgroundColor = '#fef3c7'
        setTimeout(() => {
          el.style.backgroundColor = ''
        }, 2000)
      }
    }, 100)
  }, [])

  // Check visibility on mount and URL changes
  useEffect(() => {
    const checkVisibility = () => setVisible(shouldShowDebugPanel())
    checkVisibility()

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', checkVisibility)
    return () => window.removeEventListener('popstate', checkVisibility)
  }, [])

  // Refresh traces periodically when expanded
  useEffect(() => {
    if (!visible || collapsed) return

    const refresh = () => setTraces(getRecentTraces())
    refresh()

    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [visible, collapsed])

  // Fetch service health on panel expand (once per session)
  useEffect(() => {
    if (!visible || collapsed || servicesFetched.current) return

    const fetchServices = async () => {
      setServicesLoading(true)
      try {
        const healthData = await getAllServiceHealthArray()
        // In development, service-health intentionally returns 'unknown'.
        // Use recent traces as a lightweight fallback so the panel stays informative.
        const derived = deriveServicesFromTraces(getRecentTraces())
        const merged = healthData.map((svc) => {
          const derivedFor = derived[svc.name]
          if (svc.status !== 'unknown') return svc
          if (!derivedFor || derivedFor.status === 'unknown') return svc
          return {
            ...svc,
            status: derivedFor.status,
            version: svc.version ?? derivedFor.version,
            error: undefined,
          }
        })
        setServices(merged)
        servicesFetched.current = true
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[DebugPanel] Failed to fetch service health:', err)
        }
        // Set empty array on failure - UI will show "unavailable"
        setServices([])
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [visible, collapsed])

  // In development, service-health intentionally returns "unknown".
  // Continuously derive status from request history (traced payloads have explicit service field).
  // Use a ref to avoid infinite loop from services dependency
  const servicesRef = useRef(services)
  useEffect(() => {
    servicesRef.current = services
  }, [services])

  // Derive service status from traced payloads (more reliable than request traces)
  useEffect(() => {
    if (collapsed) return
    if (servicesRef.current.length === 0) return
    if (tracedPayloads.length === 0 && traces.length === 0) return

    // First try tracedPayloads (has explicit service field)
    const derived = deriveServicesFromPayloads(tracedPayloads)
    // Fall back to request traces for any missing services
    const derivedFromTraces = deriveServicesFromTraces(traces)

    // Only update if there are actual changes
    setServices((prev) => {
      let hasChanges = false
      const updated = prev.map((svc) => {
        // Prefer payload-derived status, fall back to trace-derived
        const payloadStatus = derived[svc.name.toLowerCase()]
        const traceStatus = derivedFromTraces[svc.name]
        const derivedFor = payloadStatus?.status !== 'unknown' ? payloadStatus : traceStatus

        if (!derivedFor || derivedFor.status === 'unknown') return svc
        if (svc.status === derivedFor.status) return svc // No change
        hasChanges = true
        return {
          ...svc,
          status: derivedFor.status,
          version: svc.version ?? derivedFor.version,
          error: undefined,
        }
      })
      return hasChanges ? updated : prev
    })
  }, [collapsed, traces, tracedPayloads])

  // Handle export - merged diagnostic + contract-trace + anomalies
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      await exportMergedDebugBundle({
        ceePipelineTrace,
        errorDetails,
      })
    } finally {
      setExporting(false)
    }
  }, [ceePipelineTrace, errorDetails])

  // Handle copy summary - generates markdown summary and copies to clipboard
  const handleCopySummary = useCallback(async () => {
    setCopying(true)
    try {
      // Get current version info (call inside callback to get fresh values)
      const currentVersionInfo = getVersionInfo()
      const currentClientBuild = getClientBuild()
      const environment = String(import.meta.env.VITE_APP_ENV || 'development')

      // Build markdown summary
      const lines: string[] = []
      lines.push('# Debug Summary')
      lines.push(`Generated: ${new Date().toISOString()}`)
      lines.push('')

      // Environment & Client version
      lines.push('## Environment')
      lines.push(`- Environment: ${environment}`)
      lines.push(`- Build: ${currentClientBuild}`)
      lines.push(`- Branch: ${currentVersionInfo?.branch ?? 'unknown'}`)
      lines.push(`- Built: ${currentVersionInfo?.timestamp ?? 'unknown'}`)
      lines.push('')

      // Request ID (prominent for support)
      if (traces.length > 0 && traces[0]?.requestId) {
        lines.push('## Request ID')
        lines.push(`\`${traces[0].requestId}\``)
        lines.push('')
      }

      // Recent errors (helpful for support triage)
      if (errorDetails && errorDetails.length > 0) {
        lines.push('## Recent Errors')
        for (const detail of errorDetails.slice(-3).reverse()) {
          const parts: string[] = []
          parts.push(detail.service)
          if (detail.httpStatus) parts.push(String(detail.httpStatus))
          if (detail.errorCode) parts.push(detail.errorCode)
          const header = parts.join(' ')
          const req = detail.requestId ? ` (requestId: ${detail.requestId})` : ''
          lines.push(`- **${header}**: ${detail.message}${req}`)
        }
        lines.push('')
      }

      // Gate statuses
      lines.push('## Stage Gates')
      for (const gate of ALL_GATES) {
        const record = gates[gate]
        const emoji = record.status === 'pass' ? '✅' : record.status === 'warn' ? '⚠️' : '❌'
        lines.push(`- ${emoji} **${gate}**: ${record.status}${record.message ? ` — ${record.message}` : ''}`)
      }
      lines.push('')

      // Service health
      if (services.length > 0) {
        lines.push('## Services')
        for (const svc of services) {
          const emoji = svc.status === 'healthy' ? '✅' : svc.status === 'degraded' ? '⚠️' : '❌'
          lines.push(`- ${emoji} **${svc.name}**: ${svc.status} (${svc.version ?? 'unknown'})`)
        }
        lines.push('')
      }

      // Request table
      if (traces.length > 0) {
        lines.push('## Recent Requests')
        lines.push('| Endpoint | Status | Duration |')
        lines.push('|----------|--------|----------|')
        for (const trace of traces.slice(0, 10)) {
          const endpoint = trace.endpoint.replace('/bff/', '/')
          const status = formatStatus(trace.status, !!trace.error, trace.completed ?? false)
          const duration = trace.elapsedMs ? `${trace.elapsedMs}ms` : '—'
          lines.push(`| ${endpoint} | ${status} | ${duration} |`)
        }
        lines.push('')
      }

      // CEE Pipeline summary
      if (ceePipelineTrace) {
        const fallbackNodeCount = canvasNodes.length
        const fallbackEdgeCount = canvasEdges.length
        lines.push('## CEE Pipeline')
        lines.push(`- Status: ${ceePipelineTrace.status ?? 'unknown'}`)
        lines.push(`- Duration: ${ceePipelineTrace.total_duration_ms ?? 0}ms`)
        lines.push(`- LLM Calls: ${ceePipelineTrace.llm_call_count ?? 0}`)
        lines.push(`- Nodes: ${ceePipelineTrace.final_graph?.node_count ?? fallbackNodeCount ?? 0}`)
        lines.push(`- Edges: ${ceePipelineTrace.final_graph?.edge_count ?? fallbackEdgeCount ?? 0}`)
        lines.push('')
      }

      let markdown = lines.join('\n')

      // Truncate if content exceeds 50KB
      const MAX_SIZE = 50 * 1024
      markdown = truncateToSize(markdown, MAX_SIZE, '\n\n... (truncated at 50KB)')

      const success = await copyTextToClipboard(markdown)

      if (!success && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[DebugPanel] Copy to clipboard failed')
      }
    } finally {
      setCopying(false)
    }
  }, [gates, services, traces, ceePipelineTrace, errorDetails])

  // Handle clearing request history
  const handleClearHistory = useCallback(() => {
    setClearConfirmOpen(false)
    clearTraces()
    clearPayloads()
    // P2 Fix: Reset selected payload to avoid stale Contract Inspector state
    usePayloadTraceStore.getState().selectPayload(null)
    setTraces([])
  }, [clearPayloads])

  // Handle panel resize
  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingWidth(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = userPanelWidth
  }, [userPanelWidth])

  const handleVerticalResizeStart = useCallback(
    (edge: 'top' | 'bottom') => (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizingHeight(true)
      verticalResizeEdge.current = edge
      resizeStartY.current = e.clientY
      resizeStartHeight.current = userPanelHeight
      resizeStartPanelY.current = panelPosition.y
    },
    [panelPosition.y, userPanelHeight]
  )

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPanel(true)
    dragStartPoint.current = { x: e.clientX, y: e.clientY }
    dragStartPanelPos.current = panelPosition
  }, [panelPosition])

  // Corner resize handler (bottom-right corner)
  const handleCornerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingCorner(true)
    resizeStartX.current = e.clientX
    resizeStartY.current = e.clientY
    resizeStartWidth.current = userPanelWidth
    resizeStartHeight.current = userPanelHeight
  }, [userPanelWidth, userPanelHeight])

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
      const widthForClamp = collapsed
        ? COLLAPSED_WIDTH_ESTIMATE
        : Math.max(userPanelWidth, MIN_PANEL_WIDTH)
      const maxHeightAvailable =
        typeof window !== 'undefined' ? Math.max(MIN_PANEL_HEIGHT, window.innerHeight - 32) : userPanelHeight
      const resolvedHeight = Math.min(userPanelHeight, maxHeightAvailable ?? userPanelHeight)
      const heightForClamp = collapsed
        ? 80
        : Math.max(resolvedHeight, MIN_PANEL_HEIGHT)
      const minX = 8
      const minY = 8
      const maxX = Math.max(minX, viewportWidth - widthForClamp - 8)
      const maxY = Math.max(minY, viewportHeight - heightForClamp - 8)
      return {
        x: Math.min(Math.max(x, minX), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      }
    },
    [collapsed, userPanelHeight, userPanelWidth]
  )

  const persistPanelPosition = useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(pos))
    } catch {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    panelPositionRef.current = panelPosition
  }, [panelPosition])

  useEffect(() => {
    if (!isResizingWidth) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : resizeStartWidth.current + delta
      const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth)
      const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + delta))
      setUserPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingWidth(false)
      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(userPanelWidth))
      } catch {
        // Ignore localStorage errors
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingWidth, userPanelWidth])

  useEffect(() => {
    if (!isResizingHeight) return

    const handleMouseMove = (e: MouseEvent) => {
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : resizeStartHeight.current
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewportHeight)

      if (verticalResizeEdge.current === 'bottom') {
        const delta = e.clientY - resizeStartY.current
        const desiredHeight = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current + delta))
        setUserPanelHeight(desiredHeight)
        return
      }

      // Top edge resize: adjust height and y position together
      const delta = e.clientY - resizeStartY.current
      const desiredHeight = Math.min(
        maxHeight,
        Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current - delta)
      )

      const viewport = typeof window !== 'undefined' ? window.innerHeight : resizeStartHeight.current
      const minY = 8
      const maxY = Math.max(minY, viewport - desiredHeight - 8)
      const proposedY = resizeStartPanelY.current + delta
      const clampedY = Math.min(Math.max(proposedY, minY), maxY)

      setPanelPosition((prev) => (prev.y === clampedY ? prev : { ...prev, y: clampedY }))
      setUserPanelHeight(desiredHeight)
    }

    const handleMouseUp = () => {
      setIsResizingHeight(false)
      try {
        localStorage.setItem(STORAGE_KEY_HEIGHT, String(userPanelHeight))
      } catch {
        // Ignore storage errors
      }
      if (verticalResizeEdge.current === 'top') {
        persistPanelPosition(panelPositionRef.current)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingHeight, userPanelHeight])

  useEffect(() => {
    if (!isDraggingPanel) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPoint.current.x
      const deltaY = e.clientY - dragStartPoint.current.y
      const next = clampPosition(
        dragStartPanelPos.current.x + deltaX,
        dragStartPanelPos.current.y + deltaY
      )
      setPanelPosition(next)
    }

    const handleMouseUp = () => {
      setIsDraggingPanel(false)
      persistPanelPosition(panelPosition)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [clampPosition, isDraggingPanel, panelPosition, persistPanelPosition])

  // Corner resize effect (handles both width and height simultaneously)
  useEffect(() => {
    if (!isResizingCorner) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current
      const deltaY = e.clientY - resizeStartY.current

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : resizeStartWidth.current + deltaX
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : resizeStartHeight.current + deltaY

      const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth)
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewportHeight)

      const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + deltaX))
      const newHeight = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current + deltaY))

      setUserPanelWidth(newWidth)
      setUserPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizingCorner(false)
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(userPanelWidth))
        localStorage.setItem(STORAGE_KEY_HEIGHT, String(userPanelHeight))
      } catch {
        // Ignore storage errors
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingCorner, userPanelWidth, userPanelHeight])

  useEffect(() => {
    const handleResize = () => {
      setPanelPosition(prev => clampPosition(prev.x, prev.y))
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [clampPosition])

  useEffect(() => {
    setPanelPosition(prev => clampPosition(prev.x, prev.y))
  }, [clampPosition])

  const ceePipelineError: string | null = useMemo(() => {
    if (!errorDetails || errorDetails.length === 0) return null
    for (let i = errorDetails.length - 1; i >= 0; i--) {
      const d = errorDetails[i]
      if (d.service !== 'CEE') continue
      if (d.endpoint && !d.endpoint.includes('draft-graph')) continue
      const label = d.errorCode ?? (d.httpStatus ? String(d.httpStatus) : 'CEE_ERROR')
      return `${label}: ${d.message}`
    }
    return null
  }, [errorDetails])

  if (!visible) return null

  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  // Panel dimensions based on state
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : undefined
  const panelHeightValue =
    collapsed || !userPanelHeight
      ? null
      : Math.min(userPanelHeight, viewportHeight ?? userPanelHeight)
  const panelHeightPx = panelHeightValue ? `${panelHeightValue}px` : undefined
  const panelWidth = collapsed ? 120 : expanded ? Math.max(600, userPanelWidth) : userPanelWidth
  const panelWidthPx = collapsed ? undefined : `${panelWidth}px`
  const tracesPanelMaxHeight = panelHeightValue
    ? Math.max(panelHeightValue - 420, 200)
    : expanded
      ? 400
      : 200

  return (
    <div
      style={{
        position: 'fixed',
        ...(collapsed
          ? { bottom: 24, left: 24 }
          : { top: panelPosition.y, left: panelPosition.x }),
        zIndex: 99998,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: collapsed ? undefined : panelWidthPx,
        width: collapsed ? 'auto' : panelWidthPx,
        height: collapsed ? undefined : panelHeightPx,
        maxHeight: collapsed ? undefined : panelHeightPx,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Collapsed state */}
      {collapsed ? (
        <button
          onClick={() => {
            setCollapsed(false)
            const clamped = clampPosition(panelPosition.x, panelPosition.y)
            setPanelPosition(clamped)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#1e293b',
            color: '#f8fafc',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          title="Open Debug Panel"
        >
          <span>Test Suite</span>
        </button>
      ) : (
        /* Expanded state */
        <div
          style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            width: panelWidthPx,
            minHeight: `${MIN_PANEL_HEIGHT}px`,
            height: panelHeightPx,
            maxHeight: panelHeightPx ?? '70vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top height resize handle */}
          <div
            onMouseDown={handleVerticalResizeStart('top')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              cursor: 'ns-resize',
              background: isResizingHeight ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              zIndex: 12,
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isResizingHeight) (e.target as HTMLElement).style.background = 'rgba(59, 130, 246, 0.2)'
            }}
            onMouseLeave={(e) => {
              if (!isResizingHeight) (e.target as HTMLElement).style.background = 'transparent'
            }}
            title="Drag to adjust height from top"
          />
          {/* Bottom height resize handle */}
          <div
            onMouseDown={handleVerticalResizeStart('bottom')}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 6,
              cursor: 'ns-resize',
              background: isResizingHeight ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              zIndex: 11,
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isResizingHeight) (e.target as HTMLElement).style.background = 'rgba(59, 130, 246, 0.2)'
            }}
            onMouseLeave={(e) => {
              if (!isResizingHeight) (e.target as HTMLElement).style.background = 'transparent'
            }}
            title="Drag to adjust height"
          />
          {/* Resize handle (right edge) */}
          <div
            onMouseDown={handleHorizontalResizeStart}
            style={{
              position: 'absolute',
              top: 6,
              right: 0,
              width: 6,
              height: 'calc(100% - 12px)',
              cursor: 'ew-resize',
              background: isResizingWidth ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              zIndex: 10,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isResizingWidth) (e.target as HTMLElement).style.background = 'rgba(59, 130, 246, 0.2)'
            }}
            onMouseLeave={(e) => {
              if (!isResizingWidth) (e.target as HTMLElement).style.background = 'transparent'
            }}
            title="Drag to adjust width"
          />
          {/* Corner resize handle (bottom-right) */}
          <div
            onMouseDown={handleCornerResizeStart}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              cursor: 'nwse-resize',
              background: isResizingCorner ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              zIndex: 15,
              borderBottomRightRadius: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isResizingCorner) (e.target as HTMLElement).style.background = 'rgba(59, 130, 246, 0.2)'
            }}
            onMouseLeave={(e) => {
              if (!isResizingCorner) (e.target as HTMLElement).style.background = 'transparent'
            }}
            title="Drag corner to resize"
          >
            {/* Visual grip indicator */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                opacity: 0.4,
                pointerEvents: 'none',
              }}
            >
              <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          {/* Header */}
          <div
            onMouseDown={handlePanelDragStart}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: '#1e293b',
              color: '#f8fafc',
              cursor: collapsed ? 'default' : isDraggingPanel ? 'grabbing' : 'grab',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Debug Panel</span>
              {/* Integration status indicator */}
              {(() => {
                const integrationStatus = computeIntegrationStatus(traces)
                return (
                  <span
                    style={{
                      fontSize: 10,
                      color: integrationStatus.ok ? '#86efac' : '#fde047',
                    }}
                    title={integrationStatus.issues.length > 0 ? integrationStatus.issues.join('\n') : 'All integrations OK'}
                  >
                    {integrationStatus.ok ? '✅' : '⚠️'}
                  </span>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleCopySummary}
                disabled={copying}
                style={{
                  padding: '4px 8px',
                  background: copying ? '#22c55e' : '#64748b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: copying ? 'default' : 'pointer',
                }}
                title="Copy markdown summary to clipboard"
              >
                {copying ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  padding: '4px 8px',
                  background: exporting ? '#475569' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: exporting ? 'wait' : 'pointer',
                }}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  padding: '2px 6px',
                  background: expanded ? '#475569' : 'transparent',
                  color: expanded ? '#fff' : '#94a3b8',
                  border: 'none',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                title={expanded ? 'Minimize panel' : 'Expand panel'}
              >
                {expanded ? '⊖' : '⊕'}
              </button>
              <button
                onClick={() => setCollapsed(true)}
                style={{
                  padding: '2px 6px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                title="Collapse"
              >
                ×
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {DEBUG_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#1e40af' : '#64748b',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
          {/* CEE Pipeline Tab */}
          {activeTab === 'cee-pipeline' && (
            <CeePipelineTab
              trace={ceePipelineTrace}
              error={ceePipelineError}
            />
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <>
              {(() => {
                const hasAR = ceeAnalysisReady != null

                // Prefer store-derived schema signal (pipeline trace is not the draft response)
                const schemaSignal = hasAR
                  ? { requested: 'v3', detected: 'v3', reason: 'analysis_ready stored in canvas', isMatch: true }
                  : (ceePipelineTrace ? detectSchema(ceePipelineTrace) : undefined)

                return (
              <HeadlineSignals
                route={traces[0]?.endpoint ? `UI → ${traces[0].endpoint}` : undefined}
                schema={schemaSignal}
                response={activeResponseBody}
                trace={activePipelineForTabs}
                pipelineStatus={ceePipelineTrace ? {
                  status: ceePipelineTrace.status ?? 'unavailable',
                  duration: ceePipelineTrace.total_duration_ms,
                } : undefined}
                topIssue={errorDetails?.[0] ? {
                  message: errorDetails[0].message,
                  severity: errorDetails[0].httpStatus && errorDetails[0].httpStatus >= 500 ? 'error' : 'warning',
                } : null}
                requestId={traces[0]?.requestId}
                canvasNodeCount={canvasNodes.length}
                canvasEdgeCount={canvasEdges.length}
              />
                )
              })()}
              <TimelineTab
                stages={buildTimelineStages(traces, ceePipelineTrace)}
                showUnsafe={showDebugConsole}
              />
            </>
          )}

          {/* LLM I/O Tab */}
          {activeTab === 'llm-io' && (
            <LlmIoTab trace={activePipelineForTabs} />
          )}

          {/* Transforms Tab */}
          {activeTab === 'transforms' && (
            <TransformsTab trace={activePipelineForTabs} />
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw-data' && (
            (() => {
              const nodeCount = canvasNodes.length
              const edgeCount = canvasEdges.length
              const hasAR = ceeAnalysisReady != null
              const schemaSignal = hasAR
                ? { requested: 'v3', detected: 'v3', reason: 'analysis_ready stored in canvas', isMatch: true }
                : (ceePipelineTrace ? detectSchema(ceePipelineTrace) : undefined)
              const adaptations = buildFieldAdaptations({
                ceePipelineTrace,
                nodeCount,
                edgeCount,
                hasAnalysisReady: hasAR,
              })

              return (
            <RawDataTab
              adaptations={adaptations}
              schema={schemaSignal}
              requests={buildRequestEntries(traces)}
              rawResponse={ceePipelineTrace}
            />
              )
            })()
          )}

          {/* Payload Lab Tab (unsafe only) */}
          {activeTab === 'payload-lab' && (
            <PayloadLabTab
              onRunTest={async (payload, _seed, _nSamples) => {
                const startTime = Date.now()

                // Call actual ISL conformal endpoint
                const res = await fetch('/bff/isl/api/v1/causal/counterfactual/conformal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })

                if (!res.ok) {
                  const text = await res.text().catch(() => '')
                  throw new Error(text || `HTTP ${res.status}`)
                }

                const rawResponse = await res.json()
                const duration = Date.now() - startTime

                // Transform ISLConformalResponse to ISLTestResponse format
                // ISLConformalResponse: { predictions[], overall_calibration, sample_size }
                // ISLTestResponse: { raw_response, summary: { options[], duration_ms, n_samples_used } }
                const predictions = rawResponse.predictions ?? []
                const options = predictions.map((pred: { node_id?: string; prediction?: number; confidence_interval?: { lower?: number; upper?: number } }) => ({
                  id: pred.node_id ?? 'unknown',
                  label: pred.node_id ?? 'Unknown',
                  p10: pred.confidence_interval?.lower ?? 0,
                  p50: pred.prediction ?? 0,
                  p90: pred.confidence_interval?.upper ?? 0,
                  winner_pct: 0, // Not applicable for single predictions
                }))

                return {
                  raw_response: rawResponse,
                  summary: {
                    options,
                    duration_ms: duration,
                    n_samples_used: rawResponse.sample_size ?? 0,
                  },
                } as ISLTestResponse
              }}
              onNavigateToTab={(tabId) => setActiveTab(tabId as DebugPanelTab)}
            />
          )}

          {/* Overview Tab - contains all existing content */}
          {activeTab === 'overview' && (
            <>
          {/* Version Info */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            <div
              style={{ fontWeight: 600, marginBottom: 4, color: '#334155', cursor: 'help' }}
              title="Current client build version, git branch, and build timestamp"
            >
              Versions
              <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px 8px', color: '#64748b' }}>
              <span>Client:</span>
              <span style={{ color: '#0ea5e9' }}>{clientBuild}</span>
              <span>Branch:</span>
              <span>{versionInfo?.branch ?? '—'}</span>
              <span>Built:</span>
              <span>{versionInfo?.timestamp?.replace('T', ' ').replace('Z', ' UTC') ?? '—'}</span>
            </div>
          </div>

          {/* Service Health */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            <div
              style={{ fontWeight: 600, marginBottom: 6, color: '#334155', cursor: 'help' }}
              title="Backend service health: BFF (gateway), CEE (AI engine), ISL (inference), PLoT (simulation)"
            >
              Services
              <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
            </div>
            {servicesLoading ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Loading...</div>
            ) : services.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No service data available</div>
            ) : (
              services.map((service) => <ServiceRow key={service.name} service={service} />)
            )}
          </div>

          {/* CEE Response Structure - helps debug edge field mapping issues */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            <div
              style={{ fontWeight: 600, marginBottom: 6, color: '#334155', cursor: 'help' }}
              title="CEE draft-graph response structure. Shows edge fields present and sample data to debug mapping issues."
            >
              CEE Response
              <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
            </div>
            {(() => {
              const pipelineNodeCount = ceePipelineTrace?.final_graph?.node_count
              const pipelineEdgeCount = ceePipelineTrace?.final_graph?.edge_count
              const fallbackNodeCount = canvasNodes.length
              const fallbackEdgeCount = canvasEdges.length

              const nodeCount =
                typeof pipelineNodeCount === 'number' && pipelineNodeCount > 0
                  ? pipelineNodeCount
                  : fallbackNodeCount

              const edgeCount =
                typeof pipelineEdgeCount === 'number' && pipelineEdgeCount > 0
                  ? pipelineEdgeCount
                  : fallbackEdgeCount

              const anyData = nodeCount > 0 || edgeCount > 0

              const sampleEdgeRaw = ceePipelineTrace?.final_graph?.edges?.[0]
              const sampleEdgeCanvas = (canvasEdges[0] as any)?.data
              const sampleEdge = sampleEdgeRaw ?? sampleEdgeCanvas

              const edgeKeys = sampleEdge && typeof sampleEdge === 'object'
                ? Object.keys(sampleEdge as Record<string, unknown>).join(', ')
                : '—'

              if (!anyData) {
                return <div style={{ color: '#94a3b8' }}>No CEE response data (run a draft first)</div>
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '2px 8px', color: '#64748b' }}>
                  <span>Nodes:</span>
                  <span style={{ color: '#0ea5e9' }}>{nodeCount}</span>
                  <span>Edges:</span>
                  <span style={{ color: '#0ea5e9' }}>{edgeCount}</span>
                  <span>Edge Keys:</span>
                  <span style={{ color: '#22c55e', wordBreak: 'break-word' }}>{edgeKeys}</span>
                  {sampleEdge && (
                    <>
                      <span>Sample Edge:</span>
                      <details style={{ color: '#64748b' }}>
                        <summary style={{ cursor: 'pointer', color: '#3b82f6' }}>View JSON</summary>
                        <pre style={{
                          fontSize: 9,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          background: '#f8fafc',
                          padding: 4,
                          borderRadius: 4,
                          marginTop: 4,
                          maxHeight: 150,
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(sampleEdge, null, 2)}
                        </pre>
                      </details>
                    </>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Canvas Edges - shows what DraftChat stored after processing CEE response */}
          <CanvasEdgesSection />

          {/* Gate Statuses */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{ fontWeight: 600, marginBottom: 6, fontSize: 10, fontFamily: 'monospace', color: '#334155', cursor: 'help' }}
              title="Pipeline stage gates: graph_readiness (CEE draft), validation (ISL validate), run (PLoT simulate), robustness (ISL robustness)"
            >
              Stage Gates
              <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_GATES.map((gate) => (
                <GateStatusChip key={gate} gate={gate} record={gates[gate]} />
              ))}
            </div>
          </div>

          {/* Sensitivity Analysis Section (Factor Sensitivity Phase 1) */}
          <SensitivityAnalysisSection />

          {/* Trace Verification Section */}
          <TraceVerification traces={traces} />

          {/* Warnings Section with Quick Actions Bar - show non-2xx responses and errors */}
          {(() => {
            const warnings = traces
              .filter((t) => t.completed && (t.error || (t.status && (t.status < 200 || t.status >= 300))))
              .slice(0, 5)
            if (warnings.length === 0) return null

            // Find the most recent failed request for quick actions
            const latestFailure = warnings[0]
            const failedPayload = tracedPayloads.find((p) => p.id === latestFailure?.requestId)

            return (
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fef3c7',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#92400e',
                    cursor: 'help',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  title="Recent errors and non-2xx responses from API calls"
                >
                  <span>
                    Warnings ({warnings.length})
                    <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400 }}>⚠️</span>
                  </span>
                  {/* Quick Actions Bar */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {failedPayload && (
                      <button
                        onClick={() => navigateToContractInspector(failedPayload.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: 8,
                          background: '#fde68a',
                          border: '1px solid #fbbf24',
                          borderRadius: 3,
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          color: '#92400e',
                        }}
                        title="View failed request details in Contract Inspector"
                      >
                        🔍 Details
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const markdown = warnings.map((w) => {
                          const parts = [`**${w.status || 'ERR'}** ${w.endpoint.replace('/bff/', '/')}`]
                          if (w.error) parts.push(`— ${w.error}`)
                          if (w.requestId) parts.push(`(${w.requestId.slice(0, 8)})`)
                          return `- ${parts.join(' ')}`
                        }).join('\n')
                        copyTextToClipboard(markdown)
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: 8,
                        background: '#fde68a',
                        border: '1px solid #fbbf24',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        color: '#92400e',
                      }}
                      title="Copy all warnings to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                {warnings.map((w) => (
                  <div
                    key={w.requestId}
                    style={{
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: '#92400e',
                      padding: '2px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{w.status || 'ERR'}</span>
                      {' '}
                      <span>{w.endpoint.replace('/bff/', '/')}</span>
                      {w.error && (
                        <span style={{ color: '#b45309', marginLeft: 4 }}>— {w.error}</span>
                      )}
                    </span>
                    {/* Per-warning action buttons */}
                    {tracedPayloads.find((p) => p.id === w.requestId) && (
                      <button
                        onClick={() => navigateToContractInspector(w.requestId)}
                        style={{
                          padding: '1px 4px',
                          fontSize: 8,
                          background: 'transparent',
                          border: '1px solid #fbbf24',
                          borderRadius: 2,
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          color: '#b45309',
                        }}
                        title="View this request in Contract Inspector"
                      >
                        →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Failure History Panel - comprehensive failure overview */}
          {(() => {
            // Get all failed requests from traced payloads
            const failedPayloads = tracedPayloads.filter(
              (p) => p.completed && (p.error || (p.status && p.status >= 400))
            )
            if (failedPayloads.length === 0) return null

            // Group failures by service
            const byService: Record<string, number> = {}
            const byStatus: Record<string, number> = {}
            for (const p of failedPayloads) {
              byService[p.service] = (byService[p.service] || 0) + 1
              const statusGroup = p.status ? `${Math.floor(p.status / 100)}xx` : 'ERR'
              byStatus[statusGroup] = (byStatus[statusGroup] || 0) + 1
            }

            return (
              <div
                id="debug-failure-history"
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fef2f2',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#991b1b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    Failure History ({failedPayloads.length})
                    <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400 }}>📊</span>
                  </span>
                  <button
                    onClick={() => navigateToContractInspector()}
                    style={{
                      padding: '2px 6px',
                      fontSize: 8,
                      background: '#fecaca',
                      border: '1px solid #f87171',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      color: '#991b1b',
                    }}
                    title="View all requests in Contract Inspector"
                  >
                    View All →
                  </button>
                </div>

                {/* Statistics row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 9, fontFamily: 'monospace' }}>
                  <div style={{ color: '#64748b' }}>
                    <span style={{ fontWeight: 600 }}>By Service:</span>
                    {Object.entries(byService).map(([svc, count]) => (
                      <span key={svc} style={{ marginLeft: 6, color: '#991b1b' }}>
                        {svc}: {count}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: '#64748b' }}>
                    <span style={{ fontWeight: 600 }}>By Status:</span>
                    {Object.entries(byStatus).map(([status, count]) => (
                      <span key={status} style={{ marginLeft: 6, color: status === '5xx' ? '#dc2626' : '#f59e0b' }}>
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recent failures timeline */}
                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {failedPayloads.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigateToContractInspector(p.id)}
                      style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: '#7f1d1d',
                        padding: '3px 4px',
                        marginBottom: 2,
                        background: '#fee2e2',
                        borderRadius: 3,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      title={`Click to view details for ${p.endpoint}`}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, minWidth: 28 }}>{p.status || 'ERR'}</span>
                        <span style={{ color: '#64748b', minWidth: 32 }}>{p.service}</span>
                        <span>{p.endpoint.replace('/bff/', '/').slice(0, 30)}</span>
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 8 }}>
                        {new Date(p.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Raw Error Data - malformed response debugging */}
          {rawErrorData && (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #e2e8f0',
                background: '#fef2f2',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 6,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  ⚠️ Malformed Response Data
                  <span style={{ marginLeft: 4, fontWeight: 400, color: '#b91c1c' }}>
                    {rawErrorData.timestamp ? new Date(rawErrorData.timestamp).toLocaleTimeString() : ''}
                  </span>
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(JSON.stringify(rawErrorData, null, 2))
                  }}
                  style={{
                    padding: '2px 6px',
                    fontSize: 9,
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                  title="Copy error data to clipboard"
                >
                  📋 Copy
                </button>
              </div>
              {rawErrorData.expectedShape && (
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#7f1d1d', marginBottom: 4 }}>
                  Expected: {rawErrorData.expectedShape}
                </div>
              )}
              {rawErrorData.validationErrors && rawErrorData.validationErrors.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#991b1b', fontWeight: 600 }}>
                    Hard Errors ({rawErrorData.validationErrors.length}):
                  </div>
                  {rawErrorData.validationErrors.slice(0, 5).map((err, i) => (
                    <div key={i} style={{ fontSize: 9, fontFamily: 'monospace', color: '#b91c1c', paddingLeft: 8 }}>
                      • {err}
                    </div>
                  ))}
                </div>
              )}
              {rawErrorData.validationWarnings && rawErrorData.validationWarnings.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#92400e', fontWeight: 600 }}>
                    Soft Warnings ({rawErrorData.validationWarnings.length}):
                  </div>
                  {rawErrorData.validationWarnings.slice(0, 5).map((warn, i) => (
                    <div key={i} style={{ fontSize: 9, fontFamily: 'monospace', color: '#b45309', paddingLeft: 8 }}>
                      • {warn}
                    </div>
                  ))}
                </div>
              )}
              {rawErrorData.payload != null && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: 9, fontFamily: 'monospace', color: '#7f1d1d', cursor: 'pointer' }}>
                    Raw Payload (click to expand)
                  </summary>
                  <pre
                    style={{
                      fontSize: 8,
                      fontFamily: 'monospace',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 3,
                      padding: 6,
                      maxHeight: 150,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      margin: '4px 0 0 0',
                    }}
                  >
                    {JSON.stringify(rawErrorData.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Request Traces */}
          <div style={{ maxHeight: tracesPanelMaxHeight, overflowY: 'auto' }}>
            <div
              style={{
                padding: '6px 12px',
                background: '#f8fafc',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: '#334155',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky',
                top: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{ cursor: 'help' }}
                title="Recent BFF API requests with method, endpoint, status, and response time"
              >
                Recent Requests ({traces.length})
                <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
              </span>
              {traces.length > 0 && (
                <button
                  onClick={() => setClearConfirmOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 9,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 2,
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none' }}
                  title="Clear all request history"
                >
                  Clear History
                </button>
              )}
            </div>
            {/* Clear History Confirmation */}
            {clearConfirmOpen && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef3c7',
                  borderBottom: '1px solid #fcd34d',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 10,
                }}
              >
                <span style={{ color: '#92400e' }}>Clear all {traces.length} request{traces.length !== 1 ? 's' : ''} and payloads?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setClearConfirmOpen(false)}
                    style={{
                      background: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearHistory}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 10,
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {/* Most recent request ID with copy button */}
            {traces.length > 0 && (
              <div style={{ padding: '4px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <RequestIdDisplay requestId={traces[0]?.requestId} />
              </div>
            )}
            {traces.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                No requests yet
              </div>
            ) : (
              traces.slice(0, 10).map((trace) => <TraceRow key={trace.requestId} trace={trace} />)
            )}
          </div>

          {/* Contract Inspector - Payload Inspection with Schema Validation */}
          <div id="debug-contract-inspector" style={{ borderTop: '2px solid #e2e8f0' }}>
            <ContractInspector />
          </div>
            </>
          )}
          </div>{/* End scrollable content area */}
        </div>
      )}
    </div>
  )
}

export default DebugPanel

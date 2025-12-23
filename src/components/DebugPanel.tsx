/**
 * Debug Panel Component
 *
 * Collapsible diagnostic panel for staging environments.
 * Displays service versions, request traces, gate statuses, and export functionality.
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
  type RequestTrace,
  type DownstreamCall,
  type TraceReceived,
} from '../lib/debug-state'
import { useGateStore, ALL_GATES, type GateName, type GateStatus } from '../lib/gate-state'
import { getClientBuild, getVersionInfo } from '../lib/version-cache'
import { exportDiagnosticBundle } from '../lib/diagnostic-bundle'
import { getAllServiceHealthArray, type ServiceHealthInfo, type HealthStatus } from '../lib/service-health'
import { useCanvasStore } from '../canvas/store'

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
 * Request status indicator colors
 */
function getRequestStatusColor(status?: number): string {
  if (!status) return '#94a3b8' // pending - gray
  if (status >= 200 && status < 300) return '#22c55e' // success - green
  if (status >= 400 && status < 500) return '#f59e0b' // client error - amber
  return '#ef4444' // server error - red
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
  const statusColor = getRequestStatusColor(trace.status)
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

        {/* Status */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
            }}
          />
          <span style={{ color: statusColor }}>{trace.status ?? 'pending'}</span>
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
            <span style={{ color: statusColor }}>{call.status}</span>
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
        <span style={{ color: edgeCount > 0 ? '#22c55e' : '#94a3b8' }}>
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

/**
 * Debug Panel main component
 */
export function DebugPanel() {
  const [visible, setVisible] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [traces, setTraces] = useState<RequestTrace[]>([])
  const [exporting, setExporting] = useState(false)
  const [services, setServices] = useState<ServiceHealthInfo[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const servicesFetched = useRef(false)

  const gates = useGateStore((s) => s.gates)

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
        setServices(healthData)
        servicesFetched.current = true
      } catch (err) {
        console.warn('[DebugPanel] Failed to fetch service health:', err)
        // Set empty array on failure - UI will show "unavailable"
        setServices([])
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [visible, collapsed])

  // Handle export
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      await exportDiagnosticBundle()
    } finally {
      setExporting(false)
    }
  }, [])

  if (!visible) return null

  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 99998,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: collapsed ? 120 : 400,
        transition: 'max-width 0.2s ease',
      }}
    >
      {/* Collapsed state */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
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
          <span>DIAG</span>
          <span style={{ opacity: 0.6 }}>{clientBuild}</span>
        </button>
      ) : (
        /* Expanded state */
        <div
          style={{
            background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: '#1e293b',
              color: '#f8fafc',
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
            <div style={{ display: 'flex', gap: 8 }}>
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

          {/* Warnings Section - show non-2xx responses and errors */}
          {(() => {
            const warnings = traces
              .filter((t) => t.completed && (t.error || (t.status && (t.status < 200 || t.status >= 300))))
              .slice(0, 5)
            if (warnings.length === 0) return null

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
                  }}
                  title="Recent errors and non-2xx responses from API calls"
                >
                  Warnings ({warnings.length})
                  <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400 }}>⚠️</span>
                </div>
                {warnings.map((w) => (
                  <div
                    key={w.requestId}
                    style={{
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: '#92400e',
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{w.status || 'ERR'}</span>
                    {' '}
                    <span>{w.endpoint.replace('/bff/', '/')}</span>
                    {w.error && (
                      <span style={{ color: '#b45309', marginLeft: 4 }}>— {w.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Request Traces */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
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
                cursor: 'help',
              }}
              title="Recent BFF API requests with method, endpoint, status, and response time"
            >
              Recent Requests ({traces.length})
              <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>ⓘ</span>
            </div>
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
        </div>
      )}
    </div>
  )
}

export default DebugPanel

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

import { useState, useEffect, useCallback, useRef } from 'react'
import { getRecentTraces, type RequestTrace } from '../lib/debug-state'
import { useGateStore, ALL_GATES, type GateName, type GateStatus } from '../lib/gate-state'
import { getClientBuild, getVersionInfo } from '../lib/version-cache'
import { exportDiagnosticBundle } from '../lib/diagnostic-bundle'
import { getAllServiceHealthArray, type ServiceHealthInfo, type HealthStatus } from '../lib/service-health'

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
  return (
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
      title={record.message || `Gate: ${gate}`}
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
  )
}

/**
 * Request trace row component
 */
function TraceRow({ trace }: { trace: RequestTrace }) {
  const statusColor = getRequestStatusColor(trace.status)
  const method = trace.method.toUpperCase()
  const endpoint = trace.endpoint.replace('/bff/', '/')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr 80px 60px',
        gap: 8,
        padding: '4px 8px',
        fontSize: 10,
        fontFamily: 'monospace',
        borderBottom: '1px solid #e2e8f0',
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
  )
}

/**
 * Service health row component
 */
function ServiceRow({ service }: { service: ServiceHealthInfo }) {
  const statusColor = HEALTH_STATUS_COLORS[service.status]
  const version = service.version || '—'
  const commit = service.commit ? `(${service.commit.slice(0, 7)})` : ''

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr 70px',
        gap: 8,
        padding: '2px 0',
        fontSize: 10,
        fontFamily: 'monospace',
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
            <span style={{ fontSize: 12, fontWeight: 600 }}>Debug Panel</span>
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
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#334155' }}>Versions</div>
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
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#334155' }}>Services</div>
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
              style={{ fontWeight: 600, marginBottom: 6, fontSize: 10, fontFamily: 'monospace', color: '#334155' }}
            >
              Stage Gates
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_GATES.map((gate) => (
                <GateStatusChip key={gate} gate={gate} record={gates[gate]} />
              ))}
            </div>
          </div>

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
              }}
            >
              Recent Requests ({traces.length})
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

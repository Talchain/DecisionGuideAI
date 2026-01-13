/**
 * Contract Inspector Components (Debug Panel)
 *
 * UI components for inspecting request/response payloads and contract validation.
 * Only rendered in dev/staging environments.
 */

import { useState, useCallback, useMemo } from 'react'
import { usePayloadTraceStore, type TracedPayload } from '../lib/payload-trace-store'
import { validatePLoTRequest, type ContractValidationResult } from '../lib/contract-validators'

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#334155',
  },
  filters: {
    display: 'flex',
    gap: 4,
    padding: '4px 12px',
    borderBottom: '1px solid #e2e8f0',
    background: '#fafafa',
  },
  filterChip: (active: boolean) => ({
    padding: '2px 6px',
    borderRadius: 3,
    border: '1px solid',
    borderColor: active ? '#3b82f6' : '#e2e8f0',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#64748b',
    fontSize: 9,
    cursor: 'pointer',
  }),
  traceList: {
    maxHeight: 150,
    overflowY: 'auto' as const,
  },
  traceRow: (selected: boolean) => ({
    display: 'grid',
    gridTemplateColumns: '50px 1fr 50px 60px 50px',
    gap: 6,
    padding: '4px 8px',
    fontSize: 9,
    alignItems: 'center',
    cursor: 'pointer',
    background: selected ? '#eff6ff' : 'transparent',
    borderBottom: '1px solid #f1f5f9',
  }),
  detail: {
    padding: '8px 12px',
    borderTop: '1px solid #e2e8f0',
    background: '#fafafa',
  },
  jsonViewer: {
    maxHeight: 200,
    overflowY: 'auto' as const,
    background: '#1e293b',
    color: '#e2e8f0',
    padding: 8,
    borderRadius: 4,
    fontSize: 9,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    position: 'relative' as const,
  },
  copyBtn: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    padding: '2px 6px',
    background: '#475569',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: 2,
    fontSize: 8,
    cursor: 'pointer',
  },
  checkList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    marginTop: 8,
  },
  checkRow: (passed: boolean, severity: 'error' | 'warning') => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '2px 4px',
    borderRadius: 2,
    background: passed ? '#f0fdf4' : severity === 'error' ? '#fef2f2' : '#fffbeb',
    color: passed ? '#166534' : severity === 'error' ? '#991b1b' : '#92400e',
    fontSize: 9,
  }),
}

// ============================================================================
// JsonViewer Component
// ============================================================================

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const jsonStr = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }, [data])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [jsonStr])

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{ fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▶' : '▼'} {label}
        </span>
      </div>
      {!collapsed && (
        <div style={styles.jsonViewer}>
          <button
            onClick={handleCopy}
            style={styles.copyBtn}
            title="Copy to clipboard"
          >
            {copied ? '✓' : '⧉'}
          </button>
          {jsonStr}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ContractChecks Component
// ============================================================================

function ContractChecks({ validation }: { validation?: ContractValidationResult }) {
  if (!validation || validation.checks.length === 0) {
    return null
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
        Contract Checks
        <span style={{ marginLeft: 6, fontWeight: 400 }}>
          {validation.valid ? (
            <span style={{ color: '#22c55e' }}>✓ valid</span>
          ) : (
            <span style={{ color: '#ef4444' }}>
              ✗ {validation.errorCount} error{validation.errorCount !== 1 ? 's' : ''}
              {validation.warningCount > 0 && `, ${validation.warningCount} warning${validation.warningCount !== 1 ? 's' : ''}`}
            </span>
          )}
        </span>
      </div>
      <div style={styles.checkList}>
        {validation.checks.map((check, i) => (
          <div key={i} style={styles.checkRow(check.passed, check.severity)}>
            <span>{check.passed ? '✓' : check.severity === 'error' ? '✗' : '⚠'}</span>
            <span style={{ fontWeight: 500 }}>{check.name}</span>
            {!check.passed && check.message && (
              <span style={{ opacity: 0.8 }}>— {check.message}</span>
            )}
            {!check.passed && check.path && (
              <span style={{ opacity: 0.6, fontSize: 8 }}>@ {check.path}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// RequestDetail Component
// ============================================================================

interface RequestDetailProps {
  payload: TracedPayload
  onOpenInPayloadLab?: (body: unknown) => void
}

function RequestDetail({ payload, onOpenInPayloadLab }: RequestDetailProps) {
  // Compute request validation for PLoT error responses
  const requestValidation = useMemo(() => {
    if (payload.service === 'PLoT' && payload.status && payload.status >= 400) {
      return validatePLoTRequest(payload.request.body)
    }
    return null
  }, [payload.service, payload.status, payload.request.body])

  // Get status label for error responses
  const getStatusLabel = (status?: number): string | null => {
    if (!status) return null
    if (status === 422) return 'BLOCKED'
    if (status >= 500) return 'ERROR'
    if (status >= 400) return 'CLIENT ERROR'
    return null
  }

  const statusLabel = getStatusLabel(payload.status)

  return (
    <div style={styles.detail}>
      {/* Header info */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: '#334155' }}>
            {payload.method} {payload.endpoint}
          </span>
          {/* Task 4: Open in Payload Lab button - only show for ISL requests */}
          {onOpenInPayloadLab && payload.service === 'ISL' && payload.request?.body && (
            <button
              onClick={() => onOpenInPayloadLab(payload.request.body)}
              style={{
                padding: '2px 6px',
                fontSize: 9,
                border: '1px solid #93c5fd',
                borderRadius: 4,
                background: '#dbeafe',
                cursor: 'pointer',
                color: '#1d4ed8',
              }}
              title="Open ISL request body in Payload Lab for editing and testing"
            >
              🧪 Open in Payload Lab
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px 8px', color: '#64748b' }}>
          <span>Request ID:</span>
          <span style={{ fontFamily: 'monospace', fontSize: 8 }}>{payload.id}</span>
          <span>Status:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: getStatusColor(payload.status) }}>
              {payload.status ?? 'pending'}
            </span>
            {statusLabel && (
              <span
                style={{
                  background: payload.status === 422 ? '#fef2f2' : '#fee2e2',
                  color: '#991b1b',
                  padding: '1px 4px',
                  borderRadius: 2,
                  fontSize: 8,
                  fontWeight: 600,
                }}
              >
                {statusLabel}
              </span>
            )}
          </span>
          <span>Duration:</span>
          <span>{payload.duration ? `${payload.duration}ms` : '—'}</span>
          <span>Service:</span>
          <span style={{ textTransform: 'uppercase' }}>{payload.service}</span>
        </div>
      </div>

      {/* Error banner for 4xx/5xx */}
      {payload.error && (
        <div style={{ marginBottom: 8, padding: 8, background: '#fef2f2', borderRadius: 4, color: '#991b1b' }}>
          <span style={{ fontWeight: 600 }}>Error:</span> {payload.error}
        </div>
      )}

      {/* Request validation (for PLoT error responses) */}
      {requestValidation && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
            Request Validation
            <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 9 }}>
              {requestValidation.valid ? (
                <span style={{ color: '#22c55e' }}>✓ valid</span>
              ) : (
                <span style={{ color: '#ef4444' }}>
                  ✗ {requestValidation.errorCount} issue{requestValidation.errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
          <ContractChecks validation={requestValidation} />
        </div>
      )}

      {/* Response contract validation */}
      {payload.contractValidation && payload.contractValidation.checks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
            Response Validation
          </div>
          <ContractChecks validation={payload.contractValidation} />
        </div>
      )}

      {/* Request JSON */}
      <JsonViewer data={payload.request.body} label="Request Body" />

      {/* Response JSON */}
      {payload.response && (
        <JsonViewer data={payload.response.body} label="Response Body" />
      )}
    </div>
  )
}

// ============================================================================
// TraceRow Component
// ============================================================================

function TraceRow({
  payload,
  selected,
  onClick,
}: {
  payload: TracedPayload
  selected: boolean
  onClick: () => void
}) {
  const statusColor = getStatusColor(payload.status)
  const schemaValid = payload.contractValidation?.valid ?? true
  const schemaColor = schemaValid ? '#22c55e' : '#ef4444'
  const isError = payload.status && payload.status >= 400

  // Get short status label
  const getShortLabel = (status?: number): string | null => {
    if (!status) return null
    if (status === 422) return 'BLK'
    if (status >= 500) return 'ERR'
    return null
  }
  const shortLabel = getShortLabel(payload.status)

  return (
    <div style={styles.traceRow(selected)} onClick={onClick}>
      {/* Method */}
      <span
        style={{
          background: payload.method === 'GET' ? '#dbeafe' : '#fce7f3',
          color: payload.method === 'GET' ? '#1d4ed8' : '#be185d',
          padding: '1px 4px',
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        {payload.method}
      </span>

      {/* Endpoint */}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: isError ? '#991b1b' : '#334155',
          fontWeight: isError ? 500 : 400,
        }}
        title={payload.endpoint}
      >
        {payload.endpoint.replace('/bff/', '/')}
      </span>

      {/* Status */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
        <span style={{ color: statusColor }}>{payload.status ?? '...'}</span>
        {shortLabel && (
          <span
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              padding: '0 2px',
              borderRadius: 2,
              fontSize: 7,
              fontWeight: 600,
            }}
          >
            {shortLabel}
          </span>
        )}
      </span>

      {/* Duration */}
      <span style={{ color: '#64748b', textAlign: 'right' }}>
        {payload.duration ? `${payload.duration}ms` : '—'}
      </span>

      {/* Schema status */}
      <span
        style={{ color: schemaColor, textAlign: 'center' }}
        title={schemaValid ? 'Schema valid' : 'Schema issues'}
      >
        {payload.completed ? (schemaValid ? '✓' : '✗') : '...'}
      </span>
    </div>
  )
}

// ============================================================================
// ContractInspector Main Component
// ============================================================================

interface ContractInspectorProps {
  /** Task 4: Callback to open a payload in Payload Lab */
  onOpenInPayloadLab?: (body: unknown) => void
}

export function ContractInspector({ onOpenInPayloadLab }: ContractInspectorProps = {}) {
  // Subscribe to raw state (primitive values or stable references)
  const allPayloads = usePayloadTraceStore((s) => s.payloads)
  const selectedId = usePayloadTraceStore((s) => s.selectedId)
  const filterService = usePayloadTraceStore((s) => s.filterService)
  const filterStatus = usePayloadTraceStore((s) => s.filterStatus)
  const selectPayload = usePayloadTraceStore((s) => s.selectPayload)
  const setFilterService = usePayloadTraceStore((s) => s.setFilterService)
  const setFilterStatus = usePayloadTraceStore((s) => s.setFilterStatus)
  const exportPayloads = usePayloadTraceStore((s) => s.exportPayloads)
  const clearPayloads = usePayloadTraceStore((s) => s.clearPayloads)

  // Compute derived values with useMemo to avoid infinite re-renders
  const payloads = useMemo(() => {
    let filtered = allPayloads
    if (filterService) {
      filtered = filtered.filter((p) => p.service === filterService)
    }
    if (filterStatus === 'error') {
      filtered = filtered.filter((p) => p.error || (p.status && p.status >= 400))
    } else if (filterStatus === 'schema') {
      filtered = filtered.filter((p) => p.contractValidation && !p.contractValidation.valid)
    }
    return filtered
  }, [allPayloads, filterService, filterStatus])

  const selectedPayload = useMemo(() => {
    if (!selectedId) return null
    return allPayloads.find((p) => p.id === selectedId) ?? null
  }, [allPayloads, selectedId])

  const stats = useMemo(() => ({
    total: allPayloads.length,
    errors: allPayloads.filter((p) => p.error || (p.status && p.status >= 400)).length,
    schemaIssues: allPayloads.filter((p) => p.contractValidation && !p.contractValidation.valid).length,
  }), [allPayloads])

  const handleExport = useCallback(() => {
    const json = exportPayloads()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contract-trace-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportPayloads])

  if (stats.total === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>
            Contract Inspector
            <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>
              (no requests)
            </span>
          </span>
        </div>
        <div style={{ padding: 12, color: '#94a3b8', textAlign: 'center' }}>
          Make API calls to see payload inspection
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span>
          Contract Inspector
          <span style={{ marginLeft: 4, color: '#94a3b8', fontSize: 9, fontWeight: 400 }}>
            ({stats.total} requests
            {stats.schemaIssues > 0 && (
              <span style={{ color: '#ef4444' }}>, {stats.schemaIssues} schema issues</span>
            )}
            )
          </span>
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleExport}
            style={{
              padding: '2px 6px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            Export
          </button>
          <button
            onClick={clearPayloads}
            style={{
              padding: '2px 6px',
              background: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <span style={{ color: '#64748b', marginRight: 4 }}>Filter:</span>
        {/* Service filters */}
        {(['CEE', 'PLoT', 'ISL'] as const).map((svc) => (
          <span
            key={svc}
            style={styles.filterChip(filterService === svc)}
            onClick={() => setFilterService(filterService === svc ? null : svc)}
          >
            {svc}
          </span>
        ))}
        <span style={{ width: 8 }} />
        {/* Status filters */}
        <span
          style={styles.filterChip(filterStatus === 'error')}
          onClick={() => setFilterStatus(filterStatus === 'error' ? null : 'error')}
        >
          Errors
        </span>
        <span
          style={styles.filterChip(filterStatus === 'schema')}
          onClick={() => setFilterStatus(filterStatus === 'schema' ? null : 'schema')}
        >
          Schema Issues
        </span>
      </div>

      {/* Trace list */}
      <div style={styles.traceList}>
        {payloads.map((p) => (
          <TraceRow
            key={p.id}
            payload={p}
            selected={p.id === selectedPayload?.id}
            onClick={() => selectPayload(p.id === selectedPayload?.id ? null : p.id)}
          />
        ))}
      </div>

      {/* Selected detail */}
      {selectedPayload && (
        <RequestDetail
          payload={selectedPayload}
          onOpenInPayloadLab={onOpenInPayloadLab}
        />
      )}
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status?: number): string {
  if (!status) return '#94a3b8' // pending - gray
  if (status >= 200 && status < 300) return '#22c55e' // success - green
  if (status >= 400 && status < 500) return '#f59e0b' // client error - amber
  return '#ef4444' // server error - red
}

export default ContractInspector

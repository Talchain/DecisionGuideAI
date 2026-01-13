/**
 * RawDataTab Component
 *
 * Displays raw vs adapted data diff, schema detection, and contract inspection.
 * Part of the Debug Console redesign.
 *
 * Features:
 * - Raw vs Adapted Diff with field adaptations
 * - Schema Detection Section
 * - Contract Inspector enhancements (copy curl, open raw JSON)
 * - Filter by service and "Errors only"
 */

import { useState, useCallback } from 'react'
import type { FieldAdaptation, RequestEntry, SchemaDetectionResult } from './types'
import { detectSchema } from './HeadlineSignals'

interface RawDataTabProps {
  adaptations?: FieldAdaptation[]
  schema?: SchemaDetectionResult
  requests?: RequestEntry[]
  rawResponse?: unknown
}

// =============================================================================
// Field Adaptations Section
// =============================================================================

interface FieldAdaptationsSectionProps {
  adaptations: FieldAdaptation[]
}

function FieldAdaptationsSection({ adaptations }: FieldAdaptationsSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (adaptations.length === 0) {
    return (
      <div style={{ padding: '12px', color: '#64748b', fontSize: 11 }}>
        No field adaptations applied.
      </div>
    )
  }

  const displayAdaptations = expanded ? adaptations : adaptations.slice(0, 5)

  return (
    <div style={{ padding: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h4 style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>
          Field Adaptations ({adaptations.length} changes)
        </h4>
        {adaptations.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            {expanded ? 'Collapse' : 'Expand All'}
          </button>
        )}
      </div>

      <div
        style={{
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {displayAdaptations.map((adaptation, index) => (
          <div
            key={`${adaptation.path}-${index}`}
            style={{
              padding: '8px 12px',
              borderBottom: index < displayAdaptations.length - 1 ? '1px solid #e2e8f0' : 'none',
              fontSize: 11,
              fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#3b82f6', fontWeight: 500 }}>{adaptation.path}:</span>
              <span style={{ color: '#ef4444' }}>
                {JSON.stringify(adaptation.rawValue)}
              </span>
              <span style={{ color: '#64748b' }}>→</span>
              <span style={{ color: '#22c55e' }}>
                {JSON.stringify(adaptation.adaptedValue)}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              ({adaptation.reason})
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Schema Detection Section
// =============================================================================

interface SchemaDetectionSectionProps {
  schema: SchemaDetectionResult
}

function SchemaDetectionSection({ schema }: SchemaDetectionSectionProps) {
  return (
    <div style={{ padding: '12px' }}>
      <h4 style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: '0 0 8px 0' }}>
        Schema Detection
      </h4>
      <div
        style={{
          background: schema.isMatch ? '#dcfce7' : '#fef9c3',
          border: `1px solid ${schema.isMatch ? '#86efac' : '#fde047'}`,
          borderRadius: 6,
          padding: '12px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr',
            gap: '4px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          <span style={{ color: '#64748b' }}>Requested:</span>
          <span style={{ color: '#334155', fontWeight: 500 }}>{schema.requested}</span>
          
          <span style={{ color: '#64748b' }}>Detected:</span>
          <span style={{ color: '#334155', fontWeight: 500 }}>{schema.detected}</span>
          
          <span style={{ color: '#64748b' }}>Reason:</span>
          <span style={{ color: '#64748b' }}>{schema.reason}</span>
          
          <span style={{ color: '#64748b' }}>Status:</span>
          <span style={{ color: schema.isMatch ? '#166534' : '#854d0e', fontWeight: 600 }}>
            {schema.isMatch ? '✓ Match' : '⚠ Mismatch'}
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Copy Curl Generator
// =============================================================================

function generateCurl(request: RequestEntry): string {
  const headers = Object.entries(request.headers)
    .filter(([k]) => {
      const lower = k.toLowerCase()
      return !lower.includes('key') && !lower.includes('secret') && !lower.includes('token')
    })
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' ')

  const bodyStr = request.body ? `-d '${JSON.stringify(request.body)}'` : ''

  return `curl -X ${request.method} "${request.url}" ${headers} ${bodyStr}`.trim()
}

// =============================================================================
// Request Entry Row
// =============================================================================

interface RequestRowProps {
  request: RequestEntry
}

function RequestRow({ request }: RequestRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [curlCopied, setCurlCopied] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)

  const handleCopyCurl = useCallback(() => {
    const curl = generateCurl(request)
    navigator.clipboard.writeText(curl).then(() => {
      setCurlCopied(true)
      setTimeout(() => setCurlCopied(false), 1500)
    })
  }, [request])

  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(request.response, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setJsonCopied(true)
      setTimeout(() => setJsonCopied(false), 1500)
    })
  }, [request.response])

  const isError = request.status && (request.status < 200 || request.status >= 400)
  const statusColor = isError ? '#ef4444' : request.status ? '#22c55e' : '#94a3b8'

  return (
    <div
      style={{
        borderBottom: '1px solid #e2e8f0',
        background: isError ? '#fef2f2' : 'transparent',
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            background: request.method === 'GET' ? '#dbeafe' : '#fce7f3',
            color: request.method === 'GET' ? '#1d4ed8' : '#be185d',
            borderRadius: 3,
          }}
        >
          {request.method}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#334155',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {request.url}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {request.status || 'pending'}
        </span>
        {request.duration && (
          <span style={{ fontSize: 10, color: '#64748b' }}>
            {request.duration}ms
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '8px 12px 12px 32px' }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={handleCopyCurl}
              style={{
                padding: '4px 8px',
                background: curlCopied ? '#dcfce7' : '#f1f5f9',
                border: '1px solid',
                borderColor: curlCopied ? '#86efac' : '#e2e8f0',
                borderRadius: 4,
                fontSize: 10,
                cursor: 'pointer',
                color: curlCopied ? '#166534' : '#64748b',
              }}
            >
              {curlCopied ? '✓ Copied' : '📋 Copy curl'}
            </button>
            {request.response && (
              <button
                onClick={handleCopyJson}
                style={{
                  padding: '4px 8px',
                  background: jsonCopied ? '#dcfce7' : '#f1f5f9',
                  border: '1px solid',
                  borderColor: jsonCopied ? '#86efac' : '#e2e8f0',
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: 'pointer',
                  color: jsonCopied ? '#166534' : '#64748b',
                }}
              >
                {jsonCopied ? '✓ Copied' : '📄 Copy JSON'}
              </button>
            )}
          </div>

          {/* Request body */}
          {request.body && (
            <details style={{ marginBottom: 8 }}>
              <summary
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                Request Body
              </summary>
              <pre
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  background: '#f8fafc',
                  padding: 8,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 150,
                  margin: 0,
                }}
              >
                {String(JSON.stringify(request.body, null, 2))}
              </pre>
            </details>
          )}

          {/* Response */}
          {request.response && (
            <details>
              <summary
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                Response
              </summary>
              <pre
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  background: '#f8fafc',
                  padding: 8,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 200,
                  margin: 0,
                }}
              >
                {String(JSON.stringify(request.response, null, 2))}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Contract Inspector Section
// =============================================================================

interface ContractInspectorSectionProps {
  requests: RequestEntry[]
}

function ContractInspectorSection({ requests }: ContractInspectorSectionProps) {
  const [filter, setFilter] = useState<'all' | 'errors'>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')

  // Extract unique services from URLs
  const services = Array.from(
    new Set(
      requests.map((r) => {
        const match = r.url.match(/\/bff\/([^/]+)/)
        return match ? match[1] : 'other'
      })
    )
  )

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (filter === 'errors' && r.status && r.status >= 200 && r.status < 400) {
      return false
    }
    if (serviceFilter !== 'all') {
      const match = r.url.match(/\/bff\/([^/]+)/)
      const service = match ? match[1] : 'other'
      if (service !== serviceFilter) return false
    }
    return true
  })

  return (
    <div style={{ padding: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h4 style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>
          Contract Inspector ({filteredRequests.length} requests)
        </h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
            }}
          >
            <option value="all">All services</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFilter(filter === 'all' ? 'errors' : 'all')}
            style={{
              padding: '4px 8px',
              background: filter === 'errors' ? '#fee2e2' : '#f1f5f9',
              border: '1px solid',
              borderColor: filter === 'errors' ? '#fca5a5' : '#e2e8f0',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              color: filter === 'errors' ? '#991b1b' : '#64748b',
            }}
          >
            {filter === 'errors' ? '✓ Errors only' : 'Errors only'}
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {filteredRequests.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
            No requests match the current filters.
          </div>
        ) : (
          filteredRequests.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function RawDataTab({
  adaptations = [],
  schema,
  requests = [],
  rawResponse,
}: RawDataTabProps) {
  // Auto-detect schema if not provided but rawResponse is available
  const effectiveSchema = schema || (rawResponse ? detectSchema(rawResponse) : undefined)

  return (
    <div>
      {/* Field Adaptations */}
      <FieldAdaptationsSection adaptations={adaptations} />

      {/* Schema Detection */}
      {effectiveSchema && <SchemaDetectionSection schema={effectiveSchema} />}

      {/* Contract Inspector */}
      {requests.length > 0 && <ContractInspectorSection requests={requests} />}

      {/* Empty state */}
      {adaptations.length === 0 && !effectiveSchema && requests.length === 0 && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: 12,
          }}
        >
          No raw data available. Run an analysis to see request details.
        </div>
      )}
    </div>
  )
}

export { generateCurl }
export default RawDataTab

/**
 * DataFlowTab Component
 *
 * Service chain tracing for Debug Panel V2.
 * Shows request/response boundaries for CEE, PLoT, and ISL.
 */

import { useCallback, useState, CSSProperties } from 'react'
import { BoundaryCard, type BoundaryStatus } from '../components'
import type { DebugData, ServiceCallData } from '../hooks/useDebugData'

// Human-readable HTTP status labels
const HTTP_STATUS_LABELS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorised',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Timeout',
  422: 'Unprocessable',
  429: 'Rate Limited',
  500: 'Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

/**
 * Format HTTP status code with human-readable label
 */
function formatHttpStatus(status: number | null): string {
  if (status === null) return '—'
  const label = HTTP_STATUS_LABELS[status]
  return label ? `${status} ${label}` : String(status)
}

export interface DataFlowTabProps {
  /** Debug data from useDebugData hook */
  data: DebugData
}

function serviceStatusToBoundary(service: ServiceCallData | null): BoundaryStatus {
  if (!service) return 'unavailable'
  if (service.error) return 'error'
  if (service.success) return 'success'
  if (service.status === null) return 'pending'
  return 'unavailable'
}

function downloadPayload(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function DiagnosticBadge({ present, label }: { present: boolean; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        background: present ? '#dcfce7' : '#f1f5f9',
        color: present ? '#166534' : '#64748b',
        border: `1px solid ${present ? '#86efac' : '#e2e8f0'}`,
      }}
    >
      {present ? '✓' : '✗'} {label}
    </span>
  )
}

function RawResponseInspector({
  title,
  response,
  downstreamCallsPath,
}: {
  title: string
  response: unknown
  downstreamCallsPath?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const responseObj = response as Record<string, unknown> | undefined

  if (!responseObj) return null

  const keys = Object.keys(responseObj)
  const traceObj = responseObj.trace as Record<string, unknown> | undefined
  const metaObj = responseObj.meta as Record<string, unknown> | undefined
  const traceKeys = traceObj ? Object.keys(traceObj) : null
  const metaKeys = metaObj ? Object.keys(metaObj) : null

  // Check various paths for downstream_calls
  const hasDownstreamDirect = !!responseObj.downstream_calls
  const hasDownstreamTrace = !!traceObj?.downstream_calls
  const hasDownstreamData = !!(responseObj.data as Record<string, unknown>)?.downstream_calls
  const hasDownstreamBody = !!(responseObj.body as Record<string, unknown>)?.downstream_calls
  const hasDownstreamBodyTrace = !!((responseObj.body as Record<string, unknown>)?.trace as Record<string, unknown>)?.downstream_calls

  return (
    <details
      style={{
        marginTop: 12,
        padding: 8,
        background: '#f8fafc',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
      }}
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#475569',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Inspect {title.replace('Raw ', '').replace(' Keys', '')} Structure
      </summary>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Top-level keys:</div>
        <pre
          style={{
            margin: 0,
            padding: 8,
            fontSize: 10,
            fontFamily: 'monospace',
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            overflow: 'auto',
            maxHeight: 80,
          }}
        >
          {JSON.stringify(keys)}
        </pre>

        {traceKeys && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 }}>trace keys:</div>
            <pre
              style={{
                margin: 0,
                padding: 8,
                fontSize: 10,
                fontFamily: 'monospace',
                background: '#fff',
                borderRadius: 4,
                border: '1px solid #e2e8f0',
                overflow: 'auto',
                maxHeight: 60,
              }}
            >
              {JSON.stringify(traceKeys)}
            </pre>
          </div>
        )}

        {metaKeys && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 }}>meta keys:</div>
            <pre
              style={{
                margin: 0,
                padding: 8,
                fontSize: 10,
                fontFamily: 'monospace',
                background: '#fff',
                borderRadius: 4,
                border: '1px solid #e2e8f0',
                overflow: 'auto',
                maxHeight: 60,
              }}
            >
              {JSON.stringify(metaKeys)}
            </pre>
          </div>
        )}

        {title.toLowerCase().includes('plot') && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              downstream_calls check:
            </div>
            <ul
              style={{
                margin: 0,
                padding: '0 0 0 16px',
                fontSize: 10,
                color: '#64748b',
              }}
            >
              <li>
                response.downstream_calls:{' '}
                <span style={{ color: hasDownstreamDirect ? '#16a34a' : '#dc2626' }}>
                  {hasDownstreamDirect ? '✓' : '✗'}
                </span>
              </li>
              <li>
                response.trace.downstream_calls:{' '}
                <span style={{ color: hasDownstreamTrace ? '#16a34a' : '#dc2626' }}>
                  {hasDownstreamTrace ? '✓' : '✗'}
                </span>
              </li>
              <li>
                response.data.downstream_calls:{' '}
                <span style={{ color: hasDownstreamData ? '#16a34a' : '#dc2626' }}>
                  {hasDownstreamData ? '✓' : '✗'}
                </span>
              </li>
              <li>
                response.body.downstream_calls:{' '}
                <span style={{ color: hasDownstreamBody ? '#16a34a' : '#dc2626' }}>
                  {hasDownstreamBody ? '✓' : '✗'}
                </span>
              </li>
              <li>
                response.body.trace.downstream_calls:{' '}
                <span style={{ color: hasDownstreamBodyTrace ? '#16a34a' : '#dc2626' }}>
                  {hasDownstreamBodyTrace ? '✓' : '✗'}
                </span>
              </li>
            </ul>
            {downstreamCallsPath && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: '#16a34a',
                  fontFamily: 'monospace',
                }}
              >
                Found at: {downstreamCallsPath}
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  )
}

export function DataFlowTab({ data }: DataFlowTabProps) {
  const handleDownloadCee = useCallback(() => {
    downloadPayload(
      { request: data.payloads.cee_request, response: data.payloads.cee_response },
      'cee-boundary'
    )
  }, [data.payloads])

  const handleDownloadPlot = useCallback(() => {
    downloadPayload(
      { request: data.payloads.plot_request, response: data.payloads.plot_response },
      'plot-boundary'
    )
  }, [data.payloads])

  const handleDownloadIsl = useCallback(() => {
    downloadPayload(
      { request: data.payloads.isl_request, response: data.payloads.isl_response },
      'isl-boundary'
    )
  }, [data.payloads])

  // Paths Checked collapsible state - default collapsed on success
  const [pathsCheckedExpanded, setPathsCheckedExpanded] = useState(
    data.diagnostics.isl_data_source === 'none'
  )

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 12,
  }

  const headerStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#64748b',
    marginBottom: 8,
  }

  const diagnosticRowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  }

  const sectionStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#64748b',
    marginBottom: 12,
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Service boundaries</div>

      {/* UI → CEE Boundary */}
      <BoundaryCard
        title="UI → CEE"
        endpoint={data.services.cee?.endpoint ?? '/cee/v3/draft-graph'}
        status={data.services.cee?.status ?? null}
        duration_ms={data.services.cee?.duration_ms ?? null}
        request={data.payloads.cee_request}
        response={data.payloads.cee_response}
        error={data.services.cee?.error}
        boundaryStatus={serviceStatusToBoundary(data.services.cee)}
        onDownload={data.payloads.cee_request || data.payloads.cee_response ? handleDownloadCee : undefined}
        defaultExpanded={false}
      >
        <div style={diagnosticRowStyle}>
          <DiagnosticBadge present={!!data.payloads.cee_request} label="Request captured" />
          <DiagnosticBadge present={!!data.payloads.cee_response} label="Response captured" />
          <DiagnosticBadge present={data.diagnostics.cee_trace_present} label="CEE trace present" />
          <DiagnosticBadge
            present={!!data.cee_observability}
            label={
              data.cee_observability?.raw_io_included
                ? 'Observability (raw I/O)'
                : 'Observability (metadata)'
            }
          />
        </div>

        {/* CEE Observability Status */}
        {data.cee_observability && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              fontSize: 11,
              color: '#166534',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              ✓ CEE Observability Available
            </div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>
              {data.cee_observability.totals && (
                <>
                  {data.cee_observability.totals.total_llm_calls} LLM call{data.cee_observability.totals.total_llm_calls !== 1 ? 's' : ''}
                  {' • '}
                  {data.cee_observability.totals.total_tokens.total.toLocaleString()} tokens
                  {' • '}
                  {data.cee_observability.raw_io_included && (
                    <span style={{ color: '#f59e0b' }}> Raw I/O included</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <RawResponseInspector title="Raw CEE response keys" response={data.payloads.cee_response} />
      </BoundaryCard>

      {/* UI → PLoT Boundary */}
      <BoundaryCard
        title="UI → PLoT"
        endpoint={data.services.plot?.endpoint ?? '/plot/v2/run'}
        status={data.services.plot?.status ?? null}
        duration_ms={data.services.plot?.duration_ms ?? null}
        request={data.payloads.plot_request}
        response={data.payloads.plot_response}
        error={data.services.plot?.error}
        boundaryStatus={serviceStatusToBoundary(data.services.plot)}
        onDownload={data.payloads.plot_request || data.payloads.plot_response ? handleDownloadPlot : undefined}
        defaultExpanded={false}
      >
        <div style={diagnosticRowStyle}>
          <DiagnosticBadge present={!!data.payloads.plot_request} label="Request captured" />
          <DiagnosticBadge present={!!data.payloads.plot_response} label="Response captured" />
          <DiagnosticBadge
            present={data.diagnostics.plot_has_downstream_calls}
            label="downstream_calls present"
          />
        </div>

        {/* PLoT downstream_calls diagnostic */}
        {data.payloads.plot_response && !data.diagnostics.plot_has_downstream_calls && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 12,
              color: '#92400e',
            }}
          >
            ⚠ PLoT response missing downstream_calls.isl — either PLoT not deployed with this
            feature or ISL call was skipped
          </div>
        )}

        {data.diagnostics.plot_has_downstream_calls && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              fontSize: 12,
              color: '#166534',
            }}
          >
            ✓ downstream_calls.isl present —{' '}
            {data.services.isl?.success ? 'success' : data.services.isl?.error ? 'failed' : 'status unknown'}
          </div>
        )}

        <RawResponseInspector
          title="Raw PLoT response keys"
          response={data.payloads.plot_response}
          downstreamCallsPath={data.diagnostics.downstream_calls_path_found}
        />
      </BoundaryCard>

      {/* PLoT → ISL Boundary */}
      {data.services.isl ? (
        <BoundaryCard
          title="PLoT → ISL"
          endpoint={data.services.isl.endpoint ?? '/isl/robustness'}
          status={data.services.isl.status ?? null}
          duration_ms={data.services.isl.duration_ms ?? null}
          request={data.payloads.isl_request}
          response={data.payloads.isl_response}
          error={data.services.isl.error}
          boundaryStatus={serviceStatusToBoundary(data.services.isl)}
          onDownload={data.payloads.isl_request || data.payloads.isl_response ? handleDownloadIsl : undefined}
          defaultExpanded={false}
        >
          <div style={diagnosticRowStyle}>
            <DiagnosticBadge present={!!data.payloads.isl_request} label="Request captured" />
            <DiagnosticBadge present={!!data.payloads.isl_response} label="Response captured" />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: '#64748b',
              fontFamily: 'monospace',
            }}
          >
            Source: {data.diagnostics.isl_data_source}
          </div>
          <RawResponseInspector title="Raw ISL response keys" response={data.payloads.isl_response} />
        </BoundaryCard>
      ) : (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            PLoT → ISL
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            ISL trace not available — requires PLoT update to expose downstream_calls.isl
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
            ISL data source: {data.diagnostics.isl_data_source}
          </div>
        </div>
      )}

      {/* ISL Data Source Diagnostic Panel - Always visible */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#64748b',
            marginBottom: 12,
          }}
        >
          ISL data diagnostic
        </div>

        <div>
          {/* Data Source Status */}
          <div
            style={{
              padding: 8,
              borderRadius: 4,
              marginBottom: 12,
              // Success states (downstream_calls or direct_capture) use green, failure uses red
              background:
                data.diagnostics.isl_data_source === 'none'
                  ? '#fef2f2'
                  : '#f0fdf4',
              border: `1px solid ${
                data.diagnostics.isl_data_source === 'none'
                  ? '#fecaca'
                  : '#86efac'
              }`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color:
                  data.diagnostics.isl_data_source === 'none'
                    ? '#991b1b'
                    : '#166534',
              }}
            >
              {data.diagnostics.isl_data_source === 'none' && '✗ ISL Data Path Issue'}
              {data.diagnostics.isl_data_source === 'downstream_calls' &&
                '✓ ISL Data Path Confirmed'}
              {data.diagnostics.isl_data_source === 'direct_capture' && '✓ ISL Data Path Confirmed'}
              {data.diagnostics.isl_data_source === 'plot_response_extraction' &&
                '✓ ISL Data Extracted from PLoT Response'}
              {data.diagnostics.isl_data_source === 'cee_enrichment_extraction' &&
                '✓ ISL Data Lifted from CEE-Embedded Enrichment'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {data.diagnostics.isl_data_source === 'none' &&
                'ISL data not found in direct capture or PLoT downstream_calls'}
              {data.diagnostics.isl_data_source === 'downstream_calls' &&
                'ISL data extracted from PLoT response (downstream_calls.isl)'}
              {data.diagnostics.isl_data_source === 'direct_capture' &&
                'ISL data captured directly via payload trace store'}
              {data.diagnostics.isl_data_source === 'plot_response_extraction' &&
                'ISL fields extracted from top-level PLoT response body (no downstream_calls.isl)'}
              {data.diagnostics.isl_data_source === 'cee_enrichment_extraction' &&
                'ISL-derived fields lifted from the CEE turn response analysis_result enrichment (V5-canonical path: no browser-visible PLoT/ISL calls)'}
            </div>
          </div>

          {/* Troubleshooting tips when no ISL data */}
          {data.diagnostics.isl_data_source === 'none' && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 6,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Troubleshooting:</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: '#78350f' }}>
                <li>Check PLoT build includes downstream_calls feature</li>
                <li>Verify PLoT → ISL call succeeded (check PLoT logs)</li>
                <li>
                  Current PLoT build:{' '}
                  <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 2 }}>
                    {data.builds.plot || 'unknown'}
                  </code>
                </li>
              </ul>
            </div>
          )}

          {/* downstream_calls path check */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              downstream_calls Path Check
            </div>
            <div
              style={{
                padding: 8,
                borderRadius: 4,
                background:
                  data.diagnostics.plot_has_downstream_calls ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${
                  data.diagnostics.plot_has_downstream_calls ? '#86efac' : '#e2e8f0'
                }`,
              }}
            >
              {data.diagnostics.downstream_calls_path_found ? (
                <div style={{ fontSize: 12, color: '#166534' }}>
                  ✓ Found at:{' '}
                  <code
                    style={{
                      fontFamily: 'monospace',
                      background: '#dcfce7',
                      padding: '1px 4px',
                      borderRadius: 2,
                    }}
                  >
                    {data.diagnostics.downstream_calls_path_found}
                  </code>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b' }}>✗ Not found in any path</div>
              )}
            </div>
          </div>

          {/* All paths checked - collapsible, default collapsed on success */}
          <div>
            <button
              onClick={() => setPathsCheckedExpanded(!pathsCheckedExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: '#475569',
                marginBottom: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span>{pathsCheckedExpanded ? '▼' : '▶'}</span>
              Paths Checked ({data.diagnostics.downstream_calls_paths_checked.length})
            </button>
            {pathsCheckedExpanded && (
              <div
                style={{
                  padding: 8,
                  borderRadius: 4,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                {data.diagnostics.downstream_calls_paths_checked.map((path) => (
                  <div
                    key={path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '2px 0',
                      color:
                        path === data.diagnostics.downstream_calls_path_found
                          ? '#16a34a'
                          : '#64748b',
                    }}
                  >
                    <span>
                      {path === data.diagnostics.downstream_calls_path_found ? '✓' : '✗'}
                    </span>
                    <span>{path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ISL details if available */}
          {data.services.isl && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                ISL Call Details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '4px 12px',
                  fontSize: 11,
                  padding: 8,
                  borderRadius: 4,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Endpoint: </span>
                  <code style={{ fontFamily: 'monospace' }}>
                    {data.services.isl.endpoint ?? '—'}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Status: </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      color: data.services.isl.success ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {formatHttpStatus(data.services.isl.status)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Duration: </span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {data.services.isl.duration_ms != null
                      ? `${Math.round(data.services.isl.duration_ms)}ms`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Success: </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      color: data.services.isl.success ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {data.services.isl.success ? 'true' : 'false'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CEE Downstream Calls Section */}
      {data.cee_downstream && data.cee_downstream.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            CEE downstream calls ({data.cee_downstream.length})
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
            CEE calls captured from PLoT downstream_calls.cee (e.g., /review, /decision-review)
          </div>
          {data.cee_downstream.map((call, index) => (
            <div
              key={index}
              style={{
                padding: 10,
                background: call.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${call.success ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 6,
                marginBottom: index < data.cee_downstream!.length - 1 ? 8 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: call.success ? '#166534' : '#991b1b',
                  }}
                >
                  {call.success ? '✓' : '✗'} {call.endpoint}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    background: call.success ? '#dcfce7' : '#fee2e2',
                    borderRadius: 4,
                    color: call.success ? '#166534' : '#991b1b',
                  }}
                >
                  {call.status_code}
                </span>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  {call.latency_ms}ms
                </span>
              </div>

              {/* Schema/key info for debugging */}
              {(call.schema_version || call.request_keys) && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#475569',
                    background: '#f8fafc',
                    padding: 6,
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  {call.schema_version && (
                    <div>
                      <span style={{ color: '#64748b' }}>Schema: </span>
                      <code style={{ fontFamily: 'monospace' }}>{call.schema_version}</code>
                    </div>
                  )}
                  {call.request_keys && (
                    <div>
                      <span style={{ color: '#64748b' }}>Request Keys: </span>
                      <code style={{ fontFamily: 'monospace' }}>{call.request_keys.join(', ')}</code>
                    </div>
                  )}
                  {call.payload_hash && !call.request && (
                    <div>
                      <span style={{ color: '#64748b' }}>Payload Hash: </span>
                      <code style={{ fontFamily: 'monospace' }}>{call.payload_hash}</code>
                      <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                        (full payload not available)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {call.error && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#991b1b',
                    background: '#fee2e2',
                    padding: 6,
                    borderRadius: 4,
                  }}
                >
                  Error: {call.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
          No data flow recorded. Run an analysis to see service boundaries.
        </div>
      )}
    </div>
  )
}

export default DataFlowTab

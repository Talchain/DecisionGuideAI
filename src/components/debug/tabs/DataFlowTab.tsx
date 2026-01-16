/**
 * DataFlowTab Component
 *
 * Service chain tracing for Debug Panel V2.
 * Shows request/response boundaries for CEE, PLoT, and ISL.
 */

import { useCallback, useState, CSSProperties } from 'react'
import { BoundaryCard, type BoundaryStatus } from '../components'
import type { DebugData, ServiceCallData } from '../hooks/useDebugData'

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

  // Check various paths for downstream_calls
  const hasDownstreamDirect = !!responseObj.downstream_calls
  const hasDownstreamTrace = !!(responseObj.trace as Record<string, unknown>)?.downstream_calls
  const hasDownstreamData = !!(responseObj.data as Record<string, unknown>)?.downstream_calls

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
        {title}
      </summary>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Response keys:</div>
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
            maxHeight: 100,
          }}
        >
          {JSON.stringify(keys, null, 2)}
        </pre>

        {title.toLowerCase().includes('plot') && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              downstream_calls path check:
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

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 12,
  }

  const headerStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
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

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Service Boundaries</div>

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
        </div>
        <RawResponseInspector title="Raw CEE Response Keys" response={data.payloads.cee_response} />
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
          title="Raw PLoT Response Keys"
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
          <RawResponseInspector title="Raw ISL Response Keys" response={data.payloads.isl_response} />
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

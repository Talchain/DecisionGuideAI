/**
 * DataFlowTab Component
 *
 * Service chain tracing for Debug Panel V2.
 * Shows request/response boundaries for CEE, PLoT, and ISL.
 */

import { useCallback, CSSProperties } from 'react'
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
      />

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
      />

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
        />
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

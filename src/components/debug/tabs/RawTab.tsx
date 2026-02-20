/**
 * RawTab Component (displayed as "Captured" in UI)
 *
 * Shows captured payloads for Debug Panel V2.
 * Note: Payloads are redacted at capture time (truncated strings,
 * capped arrays, sensitive keys masked) for privacy/performance.
 * This tab shows the redacted captured data, not truly "raw" payloads.
 */

import { useState, useMemo, useCallback, useEffect, CSSProperties } from 'react'
import { JsonViewer } from '../components'
import type { DebugData } from '../hooks/useDebugData'

export interface RawTabProps {
  /** Debug data from useDebugData hook */
  data: DebugData
}

/**
 * Check if we're in production environment.
 * CRITICAL: Raw LLM I/O must be blocked in production for security.
 */
function isProductionEnvironment(): boolean {
  return (
    import.meta.env.PROD ||
    import.meta.env.MODE === 'production' ||
    window.location.hostname === 'olumi.netlify.app'
  )
}

type PayloadType =
  | 'cee_request'
  | 'cee_response'
  | 'plot_request'
  | 'plot_response'
  | 'isl_request'
  | 'isl_response'
  | 'm2_request'
  | 'm2_response'
  | 'cee_downstream_request'
  | 'cee_downstream_response'
  | 'llm_raw'
  | 'full_bundle'
  | 'observability_bundle'
  | `llm_prompt_${number}`
  | `llm_response_${number}`

interface PayloadOption {
  id: PayloadType
  label: string
  available: boolean
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

export function RawTab({ data }: RawTabProps) {
  const [selectedPayload, setSelectedPayload] = useState<PayloadType>('cee_response')

  // Build payload options
  const payloadOptions = useMemo((): PayloadOption[] => {
    const options: PayloadOption[] = [
      { id: 'cee_request', label: 'CEE Request', available: data.payloads.cee_request !== undefined },
      { id: 'cee_response', label: 'CEE Response', available: data.payloads.cee_response !== undefined },
      { id: 'plot_request', label: 'PLoT Request', available: data.payloads.plot_request !== undefined },
      { id: 'plot_response', label: 'PLoT Response', available: data.payloads.plot_response !== undefined },
      { id: 'isl_request', label: 'ISL Request', available: data.payloads.isl_request !== undefined },
      { id: 'isl_response', label: 'ISL Response', available: data.payloads.isl_response !== undefined },
      { id: 'm2_request', label: 'M2 Review Request', available: data.payloads.m2_request !== undefined },
      { id: 'm2_response', label: 'M2 Review Response', available: data.payloads.m2_response !== undefined },
      { id: 'cee_downstream_request', label: 'CEE Downstream Request', available: data.payloads.cee_downstream_request !== undefined },
      { id: 'cee_downstream_response', label: 'CEE Downstream Response', available: data.payloads.cee_downstream_response !== undefined },
      { id: 'llm_raw', label: 'LLM Raw', available: data.pipeline.llm_raw !== undefined },
      { id: 'full_bundle', label: 'Full Bundle', available: data.hasData },
    ]

    // Add observability bundle if available
    if (data.cee_observability) {
      options.push({
        id: 'observability_bundle',
        label: 'Observability Bundle',
        available: true,
      })
    }

    // CRITICAL: Block raw LLM I/O in production
    const isProd = isProductionEnvironment()
    if (!isProd && data.cee_observability?.raw_io_included) {
      const llmCalls = data.cee_observability.llm_calls

      // Group LLM I/O by step
      llmCalls.forEach((call, i) => {
        if (call.raw_prompt) {
          options.push({
            id: `llm_prompt_${i}` as PayloadType,
            label: `LLM Prompt (${call.step})`,
            available: true,
          })
        }
        if (call.raw_response) {
          options.push({
            id: `llm_response_${i}` as PayloadType,
            label: `LLM Response (${call.step})`,
            available: true,
          })
        }
      })
    }

    return options
  }, [data.payloads, data.hasData, data.pipeline.llm_raw, data.cee_observability])

  // Get selected payload data
  const selectedData = useMemo(() => {
    // Handle standard payloads
    switch (selectedPayload) {
      case 'cee_request':
        return data.payloads.cee_request
      case 'cee_response':
        return data.payloads.cee_response
      case 'plot_request':
        return data.payloads.plot_request
      case 'plot_response':
        return data.payloads.plot_response
      case 'isl_request':
        return data.payloads.isl_request
      case 'isl_response':
        return data.payloads.isl_response
      case 'm2_request':
        return data.payloads.m2_request
      case 'm2_response':
        return data.payloads.m2_response
      case 'cee_downstream_request':
        return data.payloads.cee_downstream_request
      case 'cee_downstream_response':
        return data.payloads.cee_downstream_response
      case 'llm_raw':
        return data.pipeline.llm_raw
      case 'full_bundle':
        return data.payloads
      case 'observability_bundle':
        return data.cee_observability
    }

    // Handle LLM prompts/responses (only in non-production)
    if (selectedPayload.startsWith('llm_prompt_')) {
      const index = parseInt(selectedPayload.split('_')[2])
      const call = data.cee_observability?.llm_calls[index]
      return call?.raw_prompt ?? null
    }

    if (selectedPayload.startsWith('llm_response_')) {
      const index = parseInt(selectedPayload.split('_')[2])
      const call = data.cee_observability?.llm_calls[index]
      return call?.raw_response ?? null
    }

    return undefined
  }, [selectedPayload, data.payloads, data.pipeline.llm_raw, data.cee_observability])

  // Handle download
  const handleDownload = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    downloadPayload(selectedData, `${selectedPayload}-${timestamp}`)
  }, [selectedData, selectedPayload])

  // Select first available option if current is not available
  useEffect(() => {
    const currentOption = payloadOptions.find((o) => o.id === selectedPayload)
    if (!currentOption?.available) {
      const firstAvailable = payloadOptions.find((o) => o.available)
      if (firstAvailable) {
        setSelectedPayload(firstAvailable.id)
      }
    }
  }, [payloadOptions, selectedPayload])

  // Memoize character count to avoid repeated JSON.stringify on every render
  const characterCount = useMemo(() => {
    if (selectedData === undefined) return null
    try {
      return JSON.stringify(selectedData).length
    } catch {
      return null
    }
  }, [selectedData])

  const selectorStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  }

  const chipStyle = (isSelected: boolean, isAvailable: boolean): CSSProperties => ({
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: isSelected ? 600 : 400,
    borderRadius: 6,
    cursor: isAvailable ? 'pointer' : 'not-allowed',
    border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
    background: isSelected ? '#eff6ff' : isAvailable ? '#fff' : '#f8fafc',
    color: isSelected ? '#1d4ed8' : isAvailable ? '#334155' : '#94a3b8',
    transition: 'all 0.1s',
    opacity: isAvailable ? 1 : 0.6,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      {/* Payload Selector */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#64748b',
            marginBottom: 8,
          }}
        >
          Select payload
        </div>
        <div style={selectorStyle} role="radiogroup" aria-label="Payload selector">
          {payloadOptions.map((option) => (
            <button
              key={option.id}
              style={chipStyle(selectedPayload === option.id, option.available)}
              onClick={() => option.available && setSelectedPayload(option.id)}
              disabled={!option.available}
              role="radio"
              aria-checked={selectedPayload === option.id}
              aria-label={option.label}
            >
              {option.label}
              {!option.available && ' (N/A)'}
            </button>
          ))}
        </div>
      </div>

      {/* Security Warning for Raw LLM I/O (non-production only) */}
      {(selectedPayload.startsWith('llm_prompt_') || selectedPayload.startsWith('llm_response_')) && (
        <div style={{
          padding: 12,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 6,
          fontSize: 12,
          color: '#92400e',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            ⚠ Security Notice: Raw LLM I/O
          </div>
          <div style={{ fontSize: 11, color: '#78716c' }}>
            Raw prompts and responses may contain sensitive information.
            This data is only accessible in non-production environments and is blocked in production builds.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {characterCount !== null
            ? `${characterCount.toLocaleString()} characters`
            : 'No data'}
        </div>
        <button
          onClick={handleDownload}
          disabled={selectedData === undefined}
          style={{
            padding: '6px 16px',
            fontSize: 11,
            cursor: selectedData !== undefined ? 'pointer' : 'not-allowed',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            background: selectedData !== undefined ? '#fff' : '#f8fafc',
            color: selectedData !== undefined ? '#334155' : '#94a3b8',
          }}
          aria-label={`Download ${selectedPayload}`}
        >
          Download
        </button>
      </div>

      {/* JSON Viewer */}
      <JsonViewer
        data={selectedData}
        maxHeight={500}
        showCopy
        showDownload={false}
        label={`${selectedPayload} payload`}
      />

      {/* Notice about captured payloads */}
      <div
        style={{
          padding: '8px 12px',
          background: '#fef3c7',
          border: '1px solid #fde047',
          borderRadius: 6,
          fontSize: 11,
          color: '#854d0e',
        }}
      >
        Captured payloads (redacted: truncated strings, capped arrays, masked sensitive keys).
        May still contain decision content — do not share publicly.
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
          No payloads recorded. Run an analysis to capture request/response data.
        </div>
      )}
    </div>
  )
}

export default RawTab

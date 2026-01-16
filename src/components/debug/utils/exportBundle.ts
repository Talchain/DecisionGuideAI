/**
 * Debug Bundle Export Utility
 *
 * Exports all debug data as a comprehensive JSON bundle or individual files.
 * Creates a structured bundle containing all payloads and diagnostic info.
 */

import type { DebugData, BuildVersions, DiagnosticChecks } from '../hooks/useDebugData'
import { getVersionInfo, getClientBuild } from '../../../lib/version-cache'
import { getBufferedLogs, type BufferedLog } from '../../../utils/debugLogBuffer'

// =============================================================================
// Types
// =============================================================================

interface DiagnosticInfo {
  timestamp: string
  request_id: string | null
  environment: string
  client_version: string
  user_agent: string
}

interface DebugBundle {
  /** Bundle metadata */
  meta: {
    version: '1.1'
    created_at: string
    request_id: string | null
    client_build: string | null
    environment: string
    /** Redaction policy applied at capture time */
    redaction: {
      enabled: true
      max_string_length: number
      max_array_items: number
      max_depth: number
    }
  }
  /** Diagnostic summary */
  diagnostic: DiagnosticInfo
  /** Service build versions */
  builds: BuildVersions
  /** All payloads */
  payloads: {
    cee_request: unknown
    cee_response: unknown
    plot_request: unknown
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  }
  /** Service status summary */
  services: {
    cee: { status: number | null; duration_ms: number | null; success: boolean } | null
    plot: { status: number | null; duration_ms: number | null; success: boolean } | null
    isl: { status: number | null; duration_ms: number | null; success: boolean } | null
  }
  /** Pipeline summary */
  pipeline: {
    status: string
    total_duration_ms: number | null
    llm_metadata: unknown
    node_extraction: unknown
    connectivity: unknown
  }
  /** Gate statuses */
  gates: Array<{ name: string; status: string; message?: string }>
  /** Captured console logs */
  console_logs: BufferedLog[]
  /** Diagnostic checks for troubleshooting */
  diagnostic_checks: DiagnosticChecks
  /** README content */
  readme: string
}

// =============================================================================
// Helpers
// =============================================================================

function getEnvironment(): string {
  return import.meta.env.VITE_APP_ENV || 'development'
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatShortTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
}

function generateReadme(data: DebugData): string {
  const timestamp = formatTimestamp()
  const requestId = data.overall.request_id ?? 'unknown'
  const environment = getEnvironment()

  return `# Olumi Debug Bundle

Generated: ${timestamp}
Request ID: ${requestId}
Environment: ${environment}

## Contents

- diagnostic.json - System and request metadata
- cee_request.json - CEE draft-graph request payload
- cee_response.json - CEE draft-graph response payload
- plot_request.json - PLoT v2/run request payload
- plot_response.json - PLoT v2/run response payload
- isl_request.json - ISL robustness request payload (if available)
- isl_response.json - ISL robustness response payload (if available)

## Data Redaction Notice

Payloads are REDACTED at capture time:
- Long strings truncated to 1000 characters
- Arrays capped to 10 items
- Sensitive keys (password, token, secret, apiKey) masked
- Object depth limited to 8 levels

Despite redaction, payloads may still contain decision content
(factor names, option labels, goal descriptions).

## Usage

1. Share this bundle with the engineering team for debugging
2. Do NOT share publicly - contains decision content even after redaction
3. Request ID can be used to correlate with server logs

## Service Status

CEE: ${data.services.cee?.success ? 'OK' : data.services.cee?.error ? 'ERROR' : 'N/A'}
PLoT: ${data.services.plot?.success ? 'OK' : data.services.plot?.error ? 'ERROR' : 'N/A'}
ISL: ${data.services.isl?.success ? 'OK' : data.services.isl?.error ? 'ERROR' : 'N/A'}
`
}

function downloadFile(content: string, filename: string, type = 'application/json'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Build a complete debug bundle from DebugData
 */
export function buildDebugBundle(data: DebugData): DebugBundle {
  const timestamp = formatTimestamp()
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  return {
    meta: {
      version: '1.1',
      created_at: timestamp,
      request_id: data.overall.request_id,
      client_build: clientBuild,
      environment: getEnvironment(),
      redaction: {
        enabled: true,
        max_string_length: 1000,
        max_array_items: 10,
        max_depth: 8,
      },
    },
    diagnostic: {
      timestamp,
      request_id: data.overall.request_id,
      environment: getEnvironment(),
      client_version: versionInfo?.short ?? 'unknown',
      user_agent: navigator.userAgent,
    },
    builds: data.builds,
    payloads: {
      cee_request: data.payloads.cee_request ?? null,
      cee_response: data.payloads.cee_response ?? null,
      plot_request: data.payloads.plot_request ?? null,
      plot_response: data.payloads.plot_response ?? null,
      isl_request: data.payloads.isl_request ?? null,
      isl_response: data.payloads.isl_response ?? null,
    },
    services: {
      cee: data.services.cee
        ? {
            status: data.services.cee.status,
            duration_ms: data.services.cee.duration_ms,
            success: data.services.cee.success,
          }
        : null,
      plot: data.services.plot
        ? {
            status: data.services.plot.status,
            duration_ms: data.services.plot.duration_ms,
            success: data.services.plot.success,
          }
        : null,
      isl: data.services.isl
        ? {
            status: data.services.isl.status,
            duration_ms: data.services.isl.duration_ms,
            success: data.services.isl.success,
          }
        : null,
    },
    pipeline: {
      status: data.pipeline.status,
      total_duration_ms: data.pipeline.total_duration_ms ?? null,
      llm_metadata: data.pipeline.llm_metadata ?? null,
      node_extraction: data.pipeline.node_extraction ?? null,
      connectivity: data.pipeline.connectivity ?? null,
    },
    gates: data.gates.map((g) => ({
      name: g.name,
      status: g.status,
      message: g.message,
    })),
    console_logs: getBufferedLogs(),
    diagnostic_checks: data.diagnostics,
    readme: generateReadme(data),
  }
}

/**
 * Export all debug data as a single JSON bundle file
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export function exportDebugBundle(data: DebugData): void {
  const bundle = buildDebugBundle(data)
  const json = JSON.stringify(bundle, null, 2)

  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  downloadFile(json, filename)
}

/**
 * Export individual payload file
 */
export function exportPayloadFile(
  payload: unknown,
  payloadType: string,
  requestId: string | null
): void {
  const json = JSON.stringify(payload, null, 2)
  const shortId = requestId?.slice(0, 8) ?? 'unknown'
  const timestamp = formatShortTimestamp()
  const filename = `${payloadType}-${shortId}-${timestamp}.json`

  downloadFile(json, filename)
}

/**
 * Copy request ID to clipboard
 */
export async function copyRequestId(requestId: string | null): Promise<boolean> {
  if (!requestId) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(requestId)
      return true
    }

    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = requestId
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

export default exportDebugBundle

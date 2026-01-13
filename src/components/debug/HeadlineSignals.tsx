/**
 * HeadlineSignals Component
 *
 * Displays 6 key signals in a compact row for quick debugging overview.
 *
 * Signals:
 * 1. Route - Request path (e.g., "UI → /bff/engine → CEE staging")
 * 2. Schema - Requested vs detected schema version
 * 3. Structure - Response fields (factors count, analysis_ready presence)
 * 4. Pipeline - CEE trace status and duration
 * 5. Top Issue - First warning/error or "✓ No issues"
 * 6. Request ID - Trace ID with copy button
 */

import { useState, useCallback } from 'react'
import type { HeadlineSignal, SchemaDetectionResult } from './types'

interface HeadlineSignalsProps {
  route?: string
  schema?: SchemaDetectionResult
  structureInfo?: { factorCount: number; hasAnalysisReady: boolean }
  response?: unknown
  trace?: unknown
  pipelineStatus?: { status: string; duration?: number }
  topIssue?: { message: string; severity: 'warning' | 'error' } | null
  requestId?: string
  /** Fallback: canvas store node count (used if response data unavailable) */
  canvasNodeCount?: number
  /** Fallback: canvas store edge count (used if response data unavailable) */
  canvasEdgeCount?: number
}

const STATUS_COLORS = {
  ok: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  warn: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  error: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  info: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
}

function SignalChip({ signal }: { signal: HeadlineSignal }) {
  const colors = STATUS_COLORS[signal.status]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 10px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        minWidth: 100,
        flex: '1 1 auto',
      }}
      title={signal.tooltip || signal.value}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: colors.text,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 2,
        }}
      >
        {signal.label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: colors.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {signal.value}
      </span>
    </div>
  )
}

function RequestIdChip({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(requestId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [requestId])

  const shortId = requestId.length > 8 ? `[${requestId.slice(0, 8)}]` : `[${requestId}]`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 10px',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        minWidth: 100,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 2,
        }}
      >
        Request ID
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: '#334155',
            fontFamily: 'monospace',
          }}
          title={requestId}
        >
          {shortId}
        </span>
        <button
          onClick={handleCopy}
          style={{
            padding: '1px 4px',
            background: copied ? '#dcfce7' : 'transparent',
            color: copied ? '#166534' : '#64748b',
            border: 'none',
            borderRadius: 3,
            fontSize: 10,
            cursor: 'pointer',
          }}
          title="Copy full request ID"
        >
          {copied ? '✓' : '📋'}
        </button>
      </div>
    </div>
  )
}

/**
 * Detect schema version from response structure
 */
export function detectSchema(response: unknown): SchemaDetectionResult {
  if (!response || typeof response !== 'object') {
    return { requested: 'v3', detected: 'unknown', reason: 'No response data', isMatch: false }
  }

  const obj = response as Record<string, unknown>

  // 1) Explicit schema_version === '3.0' → v3
  if (obj.schema_version === '3.0') {
    return { requested: 'v3', detected: 'v3', reason: "schema_version === '3.0'", isMatch: true }
  }

  // 2) analysis_ready exists → v3
  if ('analysis_ready' in obj && obj.analysis_ready !== undefined) {
    return { requested: 'v3', detected: 'v3', reason: 'analysis_ready present', isMatch: true }
  }

  // V3: nested under graph with analysis_ready
  if ('graph' in obj && typeof obj.graph === 'object' && obj.graph !== null) {
    const graph = obj.graph as Record<string, unknown>
    if ('analysis_ready' in graph) {
      return { requested: 'v3', detected: 'v3', reason: 'graph.analysis_ready present', isMatch: true }
    }
  }

  const edges = (obj.edges || (obj.graph as Record<string, unknown>)?.edges) as unknown[]
  if (Array.isArray(edges) && edges.length > 0) {
    const firstEdge = edges[0] as Record<string, unknown>

    // 3) flat strength_mean → v3
    if (typeof (firstEdge as any).strength_mean === 'number') {
      return { requested: 'v3', detected: 'v3', reason: 'edges[0].strength_mean present', isMatch: true }
    }

    // 4) nested strength.mean → v2
    const strength = (firstEdge as any).strength
    if (strength && typeof strength === 'object' && typeof (strength as any).mean === 'number') {
      return { requested: 'v3', detected: 'v2', reason: 'edges[0].strength.mean present', isMatch: false }
    }
  }

  return { requested: 'v3', detected: 'legacy', reason: 'no v2/v3 markers found', isMatch: false }
}

function getPipeline(trace: unknown): any | null {
  if (!trace || typeof trace !== 'object') return null
  const t = trace as any
  return (t.pipeline ?? t) as any
}

function getOptionCountFromNodeExtraction(trace: unknown): number | null {
  const pipeline = getPipeline(trace)
  const raw = pipeline?.node_extraction?.raw
  if (!raw || typeof raw !== 'object') return null
  const count = (raw as any).option
  return typeof count === 'number' ? count : null
}

function getTransformsCount(trace: unknown): number | null {
  const pipeline = getPipeline(trace)
  if (!pipeline) return null
  if (!Array.isArray(pipeline.transforms)) return null
  return pipeline.transforms.length
}

function deriveKindCountsFromResponse(response: unknown): Record<string, number> {
  if (!response || typeof response !== 'object') return {}
  const obj = response as any
  const nodes = Array.isArray(obj.nodes)
    ? obj.nodes
    : obj.graph && Array.isArray(obj.graph.nodes)
      ? obj.graph.nodes
      : []

  const counts: Record<string, number> = {}
  for (const n of nodes) {
    const kind = (n as any)?.kind ?? (n as any)?.type
    if (typeof kind !== 'string' || kind.trim().length === 0) continue
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  return counts
}

function validateCounts(counts: Record<string, number>): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  const decision = counts.decision ?? 0
  const goal = counts.goal ?? 0
  const option = counts.option ?? 0

  if (decision < 1) missing.push('decision')
  if (goal < 1) missing.push('goal')
  if (option < 2) missing.push('option')

  return { valid: missing.length === 0, missing }
}

export function HeadlineSignals({
  route,
  schema,
  structureInfo,
  response,
  trace,
  pipelineStatus,
  topIssue,
  requestId,
  canvasNodeCount,
  canvasEdgeCount,
}: HeadlineSignalsProps) {
  const signals: HeadlineSignal[] = []

  // 1. Route
  signals.push({
    id: 'route',
    label: 'Route',
    value: route || 'UI → /bff/engine',
    status: 'info',
    tooltip: route,
  })

  // 2. Schema
  if (schema) {
    signals.push({
      id: 'schema',
      label: 'Schema',
      value: `${schema.detected} ${schema.isMatch ? '✓' : '⚠'}`,
      status: schema.isMatch ? 'ok' : 'warn',
      tooltip: `Requested: ${schema.requested} | Detected: ${schema.detected} | ${schema.reason}`,
    })
  } else {
    signals.push({
      id: 'schema',
      label: 'Schema',
      value: 'v3 (default)',
      status: 'info',
    })
  }

  // 3. Structure (PoC: show actual node/edge counts)
  // Priority: 1) response.nodes/edges, 2) response.graph.nodes/edges, 3) canvas store counts, 4) structureInfo
  {
    const obj: any = response && typeof response === 'object' ? (response as any) : null
    const nodes = Array.isArray(obj?.nodes)
      ? obj.nodes
      : Array.isArray(obj?.graph?.nodes)
        ? obj.graph.nodes
        : null
    const edges = Array.isArray(obj?.edges)
      ? obj.edges
      : Array.isArray(obj?.graph?.edges)
        ? obj.graph.edges
        : null

    // Response-derived counts
    const responseNodeCount = nodes ? nodes.length : null
    const responseEdgeCount = edges ? edges.length : null

    // Use response counts first, then fall back to canvas store counts
    const nodeCount = responseNodeCount ?? canvasNodeCount ?? null
    const edgeCount = responseEdgeCount ?? canvasEdgeCount ?? null

    if (nodeCount !== null || edgeCount !== null) {
      const n = nodeCount ?? 0
      const e = edgeCount ?? 0
      const source = responseNodeCount !== null ? 'response' : 'canvas'
      signals.push({
        id: 'structure',
        label: 'Structure',
        value: `${n} nodes, ${e} edges`,
        status: n > 0 ? 'ok' : 'warn',
        tooltip: `Source: ${source}`,
      })
    } else if (structureInfo) {
      const parts = []
      parts.push(`Factors: ${structureInfo.factorCount}`)
      parts.push(`analysis_ready: ${structureInfo.hasAnalysisReady ? '✓' : '✗'}`)
      signals.push({
        id: 'structure',
        label: 'Structure',
        value: parts.join(' | '),
        status: structureInfo.hasAnalysisReady ? 'ok' : 'warn',
      })
    } else {
      signals.push({
        id: 'structure',
        label: 'Structure',
        value: 'No data',
        status: 'info',
      })
    }
  }

  // 4. LLM_OUTPUT (options count)
  {
    const optionCount = getOptionCountFromNodeExtraction(trace)
    signals.push({
      id: 'llm_output',
      label: 'LLM_OUTPUT',
      value: optionCount === null ? '—' : `options: ${optionCount}`,
      status: optionCount === null ? 'info' : optionCount >= 2 ? 'ok' : 'error',
      tooltip: optionCount === null ? 'node_extraction unavailable' : 'From trace.pipeline.node_extraction.raw.option',
    })
  }

  // 5. REPAIRS (transform count)
  {
    const tCount = getTransformsCount(trace)
    let value = '—'
    let status: HeadlineSignal['status'] = 'info'

    if (tCount !== null) {
      value = tCount === 0 ? 'none' : `${tCount} applied`
      status = tCount === 0 ? 'ok' : 'warn'
    }

    signals.push({
      id: 'repairs',
      label: 'REPAIRS',
      value,
      status,
      tooltip: tCount === null ? 'transforms unavailable' : 'From trace.pipeline.transforms',
    })
  }

  // 6. FINAL_VALIDITY
  {
    const pipeline = getPipeline(trace)
    const validated = pipeline?.node_extraction?.validated
    const validatedCounts: Record<string, number> =
      validated && typeof validated === 'object'
        ? Object.fromEntries(
            Object.entries(validated as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'number' ? v : 0])
          )
        : {}

    const counts = Object.keys(validatedCounts).length > 0 ? validatedCounts : deriveKindCountsFromResponse(response)
    const { valid, missing } = validateCounts(counts)

    const value = Object.keys(counts).length === 0
      ? '—'
      : valid
        ? 'valid ✓'
        : `missing: ${missing.join(', ')}`

    const status: HeadlineSignal['status'] = Object.keys(counts).length === 0 ? 'info' : valid ? 'ok' : 'error'

    signals.push({
      id: 'final_validity',
      label: 'FINAL_VALIDITY',
      value,
      status,
      tooltip:
        Object.keys(validatedCounts).length > 0
          ? 'Derived from trace.pipeline.node_extraction.validated'
          : 'Derived from response.nodes kind/type counts',
    })
  }

  // 7. Pipeline
  if (pipelineStatus) {
    const duration = pipelineStatus.duration ? `(${(pipelineStatus.duration / 1000).toFixed(1)}s)` : ''
    signals.push({
      id: 'pipeline',
      label: 'Pipeline',
      value: `${pipelineStatus.status.toUpperCase()} ${duration}`,
      status: pipelineStatus.status === 'success' || pipelineStatus.status === 'SUCCESS' ? 'ok' : 
              pipelineStatus.status === 'unavailable' ? 'info' : 'warn',
    })
  } else {
    signals.push({
      id: 'pipeline',
      label: 'Pipeline',
      value: 'unavailable',
      status: 'info',
    })
  }

  // 8. Top Issue
  if (topIssue) {
    signals.push({
      id: 'issue',
      label: 'Top Issue',
      value: topIssue.message.slice(0, 30) + (topIssue.message.length > 30 ? '...' : ''),
      status: topIssue.severity === 'error' ? 'error' : 'warn',
      tooltip: topIssue.message,
    })
  } else {
    signals.push({
      id: 'issue',
      label: 'Top Issue',
      value: '✓ No issues',
      status: 'ok',
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}
    >
      {signals.map((signal) => (
        <SignalChip key={signal.id} signal={signal} />
      ))}
      {requestId && <RequestIdChip requestId={requestId} />}
    </div>
  )
}

export default HeadlineSignals

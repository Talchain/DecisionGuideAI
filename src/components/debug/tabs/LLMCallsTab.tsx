/**
 * LLMCallsTab Component
 *
 * Consolidated view of all LLM interactions for Debug Panel V2.
 * Aggregates CEE observability LLM calls and M2 Review call.
 */

import { useMemo, useState, Fragment, CSSProperties } from 'react'
import { JsonViewer } from '../components'
import type { DebugData, LLMCallRecord } from '../hooks/useDebugData'
import { formatDuration } from '../utils'

export interface LLMCallsTabProps {
  /** Debug data from useDebugData hook */
  data: DebugData
}

interface LLMCallRow {
  id: string
  stage: string
  model: string
  provider: string
  tokens: {
    input: number
    output: number
    total: number
  } | null
  duration_ms: number | null
  status: 'success' | 'error' | 'pending'
  timestamp: string | null
  error?: string
  raw?: LLMCallRecord
  isM2?: boolean
}

export function LLMCallsTab({ data }: LLMCallsTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Aggregate all LLM calls
  const allCalls = useMemo((): LLMCallRow[] => {
    const calls: LLMCallRow[] = []

    // CEE LLM calls from observability
    if (data.cee_observability?.llm_calls && data.cee_observability.llm_calls.length > 0) {
      data.cee_observability.llm_calls.forEach((call, i) => {
        calls.push({
          id: `cee-${i}`,
          stage: `CEE: ${call.step}`,
          model: call.model,
          provider: call.provider,
          tokens: call.tokens,
          duration_ms: call.latency_ms,
          status: call.success ? 'success' : 'error',
          timestamp: call.started_at,
          error: call.error,
          raw: call,
        })
      })
    } else if (data.pipeline.llm_metadata) {
      // Fallback: Use pipeline.llm_metadata when cee_observability.llm_calls is empty
      // This happens when CEE response doesn't include observability data but has llm_metadata
      const llmMeta = data.pipeline.llm_metadata
      const tokenUsage = llmMeta.token_usage
      calls.push({
        id: 'pipeline-llm-0',
        stage: 'CEE: draft_graph',
        model: llmMeta.model ?? '—',
        provider: '—', // Provider not available in llm_metadata
        tokens: tokenUsage ? {
          input: tokenUsage.prompt_tokens ?? 0,
          output: tokenUsage.completion_tokens ?? 0,
          total: tokenUsage.total_tokens ?? 0,
        } : null,
        duration_ms: llmMeta.duration_ms ?? null,
        status: 'success', // If we have metadata, the call succeeded
        timestamp: null,
      })
    }

    // M2 Review call (if available)
    if (data.m2_review) {
      // Model from review_meta.model (populated into m2_review.model), fallback to cee_operations
      const decisionReviewOps = data.cee_operations?.decision_review
      const m2Call: LLMCallRow = {
        id: 'm2-review',
        stage: 'M2 Decision Review',
        model: data.m2_review.model ?? decisionReviewOps?.model ?? '—',
        provider: decisionReviewOps?.provider ?? '—',
        tokens: null,
        duration_ms: data.m2_review.duration_ms,
        status: data.m2_review.status === 'success' ? 'success' :
                data.m2_review.status === 'failed' ? 'error' :
                data.m2_review.status === 'skipped' ? 'error' :
                data.m2_review.status === 'pending' ? 'pending' : 'error',
        timestamp: null,
        error: data.m2_review.error ?? undefined,
        isM2: true,
      }
      calls.push(m2Call)
    }

    // Sort by timestamp (newest first), with M2 at the end
    return calls.sort((a, b) => {
      if (a.isM2) return 1
      if (b.isM2) return -1
      if (!a.timestamp && !b.timestamp) return 0
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [data.cee_observability, data.m2_review, data.cee_operations, data.pipeline.llm_metadata])

  // Totals
  const totals = useMemo(() => {
    const totalTokens = allCalls.reduce(
      (acc, call) => ({
        input: acc.input + (call.tokens?.input ?? 0),
        output: acc.output + (call.tokens?.output ?? 0),
        total: acc.total + (call.tokens?.total ?? 0),
      }),
      { input: 0, output: 0, total: 0 }
    )
    const totalDuration = allCalls.reduce((acc, call) => acc + (call.duration_ms ?? 0), 0)
    const successCount = allCalls.filter((c) => c.status === 'success').length
    const errorCount = allCalls.filter((c) => c.status === 'error').length

    return { totalTokens, totalDuration, successCount, errorCount }
  }, [allCalls])

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

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  }

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#475569',
  }

  const tdStyle: CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  }

  const statusBadgeStyle = (status: 'success' | 'error' | 'pending'): CSSProperties => ({
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    background:
      status === 'success' ? '#dcfce7' :
      status === 'error' ? '#fef2f2' : '#fef3c7',
    color:
      status === 'success' ? '#166534' :
      status === 'error' ? '#991b1b' : '#92400e',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Summary Stats */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>LLM call summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <div
            style={{
              padding: 12,
              background: '#f0f9ff',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>
              {allCalls.length}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Total Calls</div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#dcfce7',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>
              {totals.successCount}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Succeeded</div>
          </div>
          <div
            style={{
              padding: 12,
              background: totals.errorCount > 0 ? '#fef2f2' : '#f8fafc',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: totals.errorCount > 0 ? '#991b1b' : '#64748b',
              }}
            >
              {totals.errorCount}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Failed</div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#f8fafc',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
              {totals.totalTokens.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Total Tokens</div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#f8fafc',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#334155' }}>
              {formatDuration(totals.totalDuration)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Total Duration</div>
          </div>
        </div>
      </div>

      {/* Calls Table */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>LLM calls ({allCalls.length})</div>
        {allCalls.length > 0 ? (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Tokens</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {allCalls.map((call) => (
                <Fragment key={call.id}>
                  <tr
                    style={{
                      cursor: 'pointer',
                      background: expandedRow === call.id ? '#f8fafc' : 'transparent',
                    }}
                    onClick={() => setExpandedRow(expandedRow === call.id ? null : call.id)}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{call.stage}</div>
                      {call.timestamp && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          {new Date(call.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                      {call.isM2 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#3b82f6',
                            marginTop: 2,
                          }}
                        >
                          LLM-Enhanced Review
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{call.model}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{call.provider}</div>
                    </td>
                    <td style={tdStyle}>
                      {call.tokens ? (
                        <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          <span style={{ color: '#059669' }}>{call.tokens.input.toLocaleString()}</span>
                          <span style={{ color: '#94a3b8' }}> / </span>
                          <span style={{ color: '#3b82f6' }}>{call.tokens.output.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {call.duration_ms !== null ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          {formatDuration(call.duration_ms)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(call.status)}>
                        {call.status === 'success' ? '✓' : call.status === 'error' ? '✗' : '⏳'}
                        {' '}{call.status}
                      </span>
                    </td>
                  </tr>
                  {expandedRow === call.id && (
                    <tr key={`${call.id}-expanded`}>
                      <td
                        colSpan={5}
                        style={{
                          padding: 16,
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        {call.error && (
                          <div
                            style={{
                              padding: 8,
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: 4,
                              marginBottom: 12,
                              color: '#991b1b',
                              fontSize: 12,
                            }}
                          >
                            <strong>Error:</strong> {call.error}
                          </div>
                        )}
                        {call.raw && (
                          <details open>
                            <summary
                              style={{
                                cursor: 'pointer',
                                fontSize: 11,
                                color: '#64748b',
                                marginBottom: 8,
                              }}
                            >
                              View Raw Call Data
                            </summary>
                            <JsonViewer data={call.raw} maxHeight={300} />
                          </details>
                        )}
                        {call.isM2 && data.m2_review?.raw && (
                          <details open>
                            <summary
                              style={{
                                cursor: 'pointer',
                                fontSize: 11,
                                color: '#64748b',
                                marginBottom: 8,
                              }}
                            >
                              View M2 Response
                            </summary>
                            <JsonViewer data={data.m2_review.raw} maxHeight={300} />
                          </details>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 12,
            }}
          >
            No LLM calls recorded. Run an analysis to see LLM interactions.
          </div>
        )}
      </div>

      {/* Token Breakdown (if available) */}
      {data.cee_observability?.totals && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Token usage breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                padding: 12,
                background: '#f0fdf4',
                borderRadius: 6,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                {data.cee_observability.totals.total_tokens.input.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Input Tokens</div>
            </div>
            <div
              style={{
                padding: 12,
                background: '#eff6ff',
                borderRadius: 6,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                {data.cee_observability.totals.total_tokens.output.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Output Tokens</div>
            </div>
            <div
              style={{
                padding: 12,
                background: '#f8fafc',
                borderRadius: 6,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                {data.cee_observability.totals.total_tokens.total.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Total Tokens</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LLMCallsTab

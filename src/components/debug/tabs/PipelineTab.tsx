/**
 * PipelineTab Component
 *
 * CEE internal processing stages for Debug Panel V2.
 * Shows artefact chain, pipeline stages, and connectivity.
 */

import { useState, useMemo, useCallback, CSSProperties } from 'react'
import { PipelineStage, JsonViewer } from '../components'
import type { DebugData, LlmRawData } from '../hooks/useDebugData'
import { formatDuration } from '../utils'

/**
 * Copy text to clipboard with fallback for older browsers.
 * Returns true on success, false on failure.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
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

function LlmRawSection({
  llmRaw,
  llmRawPathFound,
}: {
  llmRaw: LlmRawData | undefined
  llmRawPathFound: string | null
}) {
  const [showRawText, setShowRawText] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<'success' | 'error' | null>(null)

  const handleCopyHash = useCallback(async () => {
    if (llmRaw?.hash) {
      const success = await copyToClipboard(llmRaw.hash)
      setCopyFeedback(success ? 'success' : 'error')
      setTimeout(() => setCopyFeedback(null), 1500)
    }
  }, [llmRaw?.hash])

  const handleCopyText = useCallback(async () => {
    if (llmRaw?.text) {
      const success = await copyToClipboard(llmRaw.text)
      setCopyFeedback(success ? 'success' : 'error')
      setTimeout(() => setCopyFeedback(null), 1500)
    }
  }, [llmRaw?.text])

  if (!llmRaw) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
          Raw LLM Output
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Not available — CEE response does not include llm_raw data
        </div>
        {llmRawPathFound === null && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
            Checked paths: response.trace.pipeline.llm_raw, response.trace.llm_raw, response.pipeline_trace.llm_raw, response.llm_raw
          </div>
        )}
      </div>
    )
  }

  return (
    <details
      style={{
        marginTop: 12,
        padding: 12,
        background: '#f0fdf4',
        borderRadius: 6,
        border: '1px solid #86efac',
      }}
    >
      <summary
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#166534',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Raw LLM Output {llmRaw.truncated && <span style={{ color: '#f59e0b' }}>(truncated)</span>}
      </summary>

      <div style={{ marginTop: 12 }}>
        {/* Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px 16px',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Hash</span>
            <span
              style={{ fontFamily: 'monospace', cursor: llmRaw.hash ? 'pointer' : 'default' }}
              onClick={handleCopyHash}
              title={llmRaw.hash ? 'Click to copy' : ''}
            >
              {llmRaw.hash ?? '—'}{' '}
              {copyFeedback === 'success' && <span style={{ color: '#16a34a' }}>✓</span>}
              {copyFeedback === 'error' && <span style={{ color: '#dc2626' }}>✗</span>}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Characters</span>
            <span style={{ fontFamily: 'monospace' }}>
              {llmRaw.char_count?.toLocaleString() ?? '—'}
            </span>
          </div>
          {llmRaw.node_counts && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Options</span>
                <span style={{ fontFamily: 'monospace' }}>{llmRaw.node_counts.options ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Factors</span>
                <span style={{ fontFamily: 'monospace' }}>{llmRaw.node_counts.factors ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Outcomes</span>
                <span style={{ fontFamily: 'monospace' }}>{llmRaw.node_counts.outcomes ?? '—'}</span>
              </div>
            </>
          )}
          {llmRaw.edge_count !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Edges</span>
              <span style={{ fontFamily: 'monospace' }}>{llmRaw.edge_count}</span>
            </div>
          )}
        </div>

        {/* Truncation Warning */}
        {llmRaw.truncated && (
          <div
            style={{
              padding: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 4,
              fontSize: 11,
              color: '#92400e',
              marginBottom: 12,
            }}
          >
            ⚠ Output was truncated during capture
          </div>
        )}

        {/* Source Path */}
        {llmRawPathFound && (
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12, fontFamily: 'monospace' }}>
            Source: {llmRawPathFound}
          </div>
        )}

        {/* Raw Text Toggle */}
        {llmRaw.text && (
          <>
            <button
              onClick={() => setShowRawText((v) => !v)}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                background: '#fff',
                marginRight: 8,
              }}
            >
              {showRawText ? 'Hide Raw Text' : 'View Raw Text'}
            </button>
            <button
              onClick={handleCopyText}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                background: '#fff',
              }}
            >
              Copy Raw Text{' '}
              {copyFeedback === 'success' && <span style={{ color: '#16a34a' }}>✓</span>}
              {copyFeedback === 'error' && <span style={{ color: '#dc2626' }}>✗</span>}
            </button>

            {showRawText && (
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  background: '#fff',
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  overflow: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {llmRaw.text}
              </pre>
            )}
          </>
        )}
      </div>
    </details>
  )
}

export interface PipelineTabProps {
  /** Debug data from useDebugData hook */
  data: DebugData
}

function formatNodeCounts(counts: Record<string, number> | undefined): string {
  if (!counts) return 'No data'
  const parts: string[] = []
  const labels: Record<string, string> = {
    decision: 'decision',
    goal: 'goal',
    option: 'options',
    factor: 'factors',
    outcome: 'outcomes',
  }
  for (const [key, singular] of Object.entries(labels)) {
    const count = counts[key]
    if (typeof count === 'number' && count > 0) {
      parts.push(`${count} ${count === 1 ? singular : singular}`)
    }
  }
  return parts.join(', ') || 'No nodes'
}

function ArtefactChip({
  label,
  counts,
  status,
}: {
  label: string
  counts?: Record<string, number>
  status: 'ok' | 'warn' | 'error' | 'neutral'
}) {
  const colors = {
    ok: { bg: '#dcfce7', border: '#86efac', text: '#166534' },
    warn: { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
    error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
    neutral: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
  }
  const c = colors[status]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        minWidth: 100,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{label}</span>
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
        {formatNodeCounts(counts)}
      </span>
    </div>
  )
}

function Arrow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: '#94a3b8',
        fontSize: 14,
        padding: '0 4px',
      }}
      aria-hidden="true"
    >
      →
    </div>
  )
}

export function PipelineTab({ data }: PipelineTabProps) {
  const [showFullLlmOutput, setShowFullLlmOutput] = useState(false)

  const nodeExtraction = data.pipeline.node_extraction
  const llmMetadata = data.pipeline.llm_metadata
  const connectivity = data.pipeline.connectivity

  // Artefact chain status
  const rawStatus = nodeExtraction?.raw ? 'ok' : 'neutral'
  const normalisedStatus = nodeExtraction?.normalised ? 'ok' : 'neutral'
  const validatedStatus = nodeExtraction?.validated ? 'ok' : 'neutral'

  const sectionStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
    marginBottom: 12,
  }

  // Build stages for pipeline
  const stages = useMemo(() => {
    const result = []

    // LLM Draft stage
    if (llmMetadata || data.pipeline.stages.some((s) => s.id === 'llm_draft')) {
      const llmStage = data.pipeline.stages.find((s) => s.id === 'llm_draft')
      result.push({
        id: 'llm_draft',
        name: 'LLM Draft',
        status: 'success' as const,
        duration_ms: llmStage?.duration_ms,
        defaultExpanded: true,
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Metadata grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px 16px',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Model</span>
                <span style={{ fontFamily: 'monospace' }}>{llmMetadata?.model ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Temperature</span>
                <span style={{ fontFamily: 'monospace' }}>{llmMetadata?.temperature ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Prompt Tokens</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {llmMetadata?.token_usage?.prompt_tokens ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Completion Tokens</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {llmMetadata?.token_usage?.completion_tokens ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Total Tokens</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {llmMetadata?.token_usage?.total_tokens ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Duration</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatDuration(llmStage?.duration_ms)}
                </span>
              </div>
            </div>

            {/* View Full button */}
            {llmStage?.details && (
              <button
                onClick={() => setShowFullLlmOutput((v) => !v)}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  background: '#fff',
                  alignSelf: 'flex-start',
                }}
              >
                {showFullLlmOutput ? 'Hide Full Output' : 'View Full Output'}
              </button>
            )}

            {showFullLlmOutput && llmStage?.details && (
              <JsonViewer data={llmStage.details} maxHeight={300} showCopy />
            )}

            {/* Raw LLM Output Section */}
            <LlmRawSection
              llmRaw={data.pipeline.llm_raw}
              llmRawPathFound={data.diagnostics.llm_raw_path_found}
            />
          </div>
        ),
      })
    }

    // Node Extraction stage
    if (nodeExtraction) {
      const extractionStage = data.pipeline.stages.find((s) => s.id === 'node_extraction')
      result.push({
        id: 'node_extraction',
        name: 'Node Extraction',
        status: 'success' as const,
        duration_ms: extractionStage?.duration_ms,
        defaultExpanded: false,
        content: <JsonViewer data={nodeExtraction} maxHeight={300} showCopy />,
      })
    }

    // Transforms stage
    const transformsStage = data.pipeline.stages.find((s) => s.id === 'transforms')
    if (transformsStage) {
      result.push({
        id: 'transforms',
        name: 'Transforms',
        status: 'success' as const,
        duration_ms: transformsStage.duration_ms,
        defaultExpanded: false,
        content: <JsonViewer data={transformsStage.details} maxHeight={300} showCopy />,
      })
    }

    // Final Graph stage
    const finalGraphStage = data.pipeline.stages.find((s) => s.id === 'final_graph')
    if (finalGraphStage) {
      result.push({
        id: 'final_graph',
        name: 'Final Graph',
        status: 'success' as const,
        duration_ms: finalGraphStage.duration_ms,
        defaultExpanded: false,
        content: <JsonViewer data={finalGraphStage.details} maxHeight={300} showCopy />,
      })
    }

    return result
  }, [data.pipeline.stages, data.pipeline.llm_raw, data.diagnostics.llm_raw_path_found, llmMetadata, nodeExtraction, showFullLlmOutput])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Artefact Chain Summary */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Artefact Chain</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <ArtefactChip label="Raw" counts={nodeExtraction?.raw} status={rawStatus} />
          <Arrow />
          <ArtefactChip label="Normalised" counts={nodeExtraction?.normalised} status={normalisedStatus} />
          <Arrow />
          <ArtefactChip label="Validated" counts={nodeExtraction?.validated} status={validatedStatus} />
        </div>
      </div>

      {/* CEE Trace Diagnostic */}
      {data.ceeTrace && (
        <div
          style={{
            ...sectionStyle,
            background: data.ceeTrace.degraded ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${data.ceeTrace.degraded ? '#fde68a' : '#86efac'}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: data.ceeTrace.degraded ? '#92400e' : '#166534',
              marginBottom: 8,
            }}
          >
            {data.ceeTrace.degraded ? '⚠ CEE Degraded Mode' : '✓ CEE Normal'}
          </div>
          {data.ceeTrace.reason && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              Reason: <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 4px', borderRadius: 2 }}>{data.ceeTrace.reason}</code>
            </div>
          )}
          {data.ceeTrace.latency_ms !== undefined && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              Latency: {formatDuration(data.ceeTrace.latency_ms)}
            </div>
          )}
          {data.ceeTrace.source && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Source: {data.ceeTrace.source}
            </div>
          )}
        </div>
      )}

      {/* Connectivity Summary */}
      {connectivity && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Graph Connectivity</div>
          <div style={{ fontSize: 12, color: '#334155' }}>
            {connectivity.decision_count > 0 && `${connectivity.decision_count} decision`}
            {connectivity.option_count > 0 && ` → ${connectivity.option_count} options`}
            {connectivity.factor_count > 0 && ` ← ${connectivity.factor_count} factors`}
            {connectivity.goal_count > 0 && ` → ${connectivity.goal_count} goal`}
            {connectivity.edge_count > 0 && ` (${connectivity.edge_count} edges)`}
          </div>
        </div>
      )}

      {/* Pipeline Stages */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Pipeline Stages</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.length > 0 ? (
            stages.map((stage) => (
              <PipelineStage
                key={stage.id}
                name={stage.name}
                status={stage.status}
                duration_ms={stage.duration_ms}
                defaultExpanded={stage.defaultExpanded}
              >
                {stage.content}
              </PipelineStage>
            ))
          ) : (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 12,
              }}
            >
              No pipeline stages recorded
            </div>
          )}
        </div>
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
          No pipeline data available. Run an analysis to see processing stages.
        </div>
      )}
    </div>
  )
}

export default PipelineTab

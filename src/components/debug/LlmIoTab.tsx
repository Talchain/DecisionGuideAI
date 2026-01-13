import { useMemo, useState } from 'react'

type PipelineLike = any

function getPipeline(trace: unknown): PipelineLike | null {
  if (!trace || typeof trace !== 'object') return null
  const t = trace as any
  return (t.pipeline ?? t) as PipelineLike
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {})
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function countKinds(obj: unknown): Record<string, number> {
  if (!obj || typeof obj !== 'object') return {}
  const r = obj as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(r)) {
    out[k] = typeof v === 'number' ? v : 0
  }
  return out
}

function isRequiredKind(kind: string): boolean {
  return kind === 'decision' || kind === 'option' || kind === 'goal'
}

export function LlmIoTab({ trace }: { trace: unknown }) {
  const pipeline = useMemo(() => getPipeline(trace), [trace])

  const capabilities = useMemo(
    () => ({
      llmMetadataAvailable: !!pipeline?.llm_metadata,
      llmRawAvailable: !!pipeline?.llm_raw,
      nodeExtractionAvailable: !!pipeline?.node_extraction,
      transformsAvailable: !!pipeline?.transforms,
      tokenUsageAvailable: !!pipeline?.llm_metadata?.token_usage,
    }),
    [pipeline]
  )

  const [promptOpen, setPromptOpen] = useState(false)
  const [rawOpen, setRawOpen] = useState(true)

  const llmMetadata = pipeline?.llm_metadata
  const llmRaw = pipeline?.llm_raw
  const nodeExtraction = pipeline?.node_extraction

  const rawCounts = useMemo(() => countKinds(nodeExtraction?.raw), [nodeExtraction])

  const requiredKinds = useMemo(() => ['decision', 'option', 'goal'], [])

  if (!capabilities.llmRawAvailable) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontSize: 12, textAlign: 'center' }}>
        LLM output not captured. CEE trace update required.
      </div>
    )
  }

  const model = llmMetadata?.model
  const promptVersion = llmMetadata?.prompt_version
  const temperature = llmMetadata?.temperature
  const tokenUsage = llmMetadata?.token_usage

  const durationMs = typeof pipeline?.total_duration_ms === 'number' ? pipeline.total_duration_ms : undefined

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Metadata</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 12px', fontSize: 11 }}>
          <div style={{ color: '#64748b' }}>model</div>
          <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{model ?? '—'}</div>

          <div style={{ color: '#64748b' }}>prompt_version</div>
          <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{promptVersion ?? '—'}</div>

          <div style={{ color: '#64748b' }}>temperature</div>
          <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{temperature ?? '—'}</div>

          <div style={{ color: '#64748b' }}>duration</div>
          <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{durationMs !== undefined ? `${durationMs}ms` : '—'}</div>
        </div>

        {capabilities.tokenUsageAvailable && (
          <div style={{ marginTop: 10, fontSize: 11, fontFamily: 'monospace', color: '#334155' }}>
            tokens: {tokenUsage.prompt_tokens} prompt + {tokenUsage.completion_tokens} completion = {tokenUsage.total_tokens} total
          </div>
        )}
      </div>

      {llmRaw?.prompt_text && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
            onClick={() => setPromptOpen((v) => !v)}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Prompt</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copyToClipboard(String(llmRaw.prompt_text))
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#fff',
                }}
              >
                Copy
              </button>
              <span style={{ fontSize: 11, color: '#64748b' }}>{promptOpen ? 'Collapse' : 'Expand'}</span>
            </div>
          </div>

          {promptOpen && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                fontSize: 10,
                lineHeight: 1.4,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 260,
                overflow: 'auto',
              }}
            >
              {String(llmRaw.prompt_text)}
            </pre>
          )}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
          onClick={() => setRawOpen((v) => !v)}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Raw Output</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(formatJson(llmRaw?.output_json ?? llmRaw?.output_text))
              }}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                background: '#fff',
              }}
            >
              Copy
            </button>
            <span style={{ fontSize: 11, color: '#64748b' }}>{rawOpen ? 'Collapse' : 'Expand'}</span>
          </div>
        </div>

        {llmRaw?.truncated && (
          <div style={{ padding: '8px 12px', background: '#fef3c7', borderBottom: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
            Warning: LLM output was truncated.
          </div>
        )}

        {rawOpen && (
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 10,
              lineHeight: 1.4,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {formatJson(llmRaw?.output_json ?? llmRaw?.output_text)}
          </pre>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Node Kinds Summary</div>

        {!capabilities.nodeExtractionAvailable ? (
          <div style={{ color: '#64748b', fontSize: 11 }}>node_extraction not available. CEE trace update required.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 8,
            }}
          >
            {Object.entries(rawCounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kind, count]) => {
                const required = isRequiredKind(kind)
                const isOk = !required ? true : kind === 'option' ? count >= 2 : count >= 1
                const bg = required && !isOk ? '#fee2e2' : '#f8fafc'
                const border = required && !isOk ? '#fca5a5' : '#e2e8f0'
                const suffix = required ? (isOk ? '✓' : '⚠') : ''
                return (
                  <div key={kind} style={{ border: `1px solid ${border}`, background: bg, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      {kind} {required ? '(required)' : ''}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#0f172a' }}>
                      {kind}: {count} {suffix}
                    </div>
                  </div>
                )
              })}

            {requiredKinds
              .filter((k) => !(k in rawCounts))
              .map((missing) => (
                <div key={missing} style={{ border: '1px solid #fca5a5', background: '#fee2e2', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: '#991b1b', textTransform: 'uppercase', fontWeight: 700 }}>
                    {missing} (required)
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#991b1b' }}>{missing}: 0 ⚠</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LlmIoTab

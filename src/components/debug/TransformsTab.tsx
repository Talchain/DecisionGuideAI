import { useMemo, useState } from 'react'

type PipelineLike = any

function getPipeline(trace: unknown): PipelineLike | null {
  if (!trace || typeof trace !== 'object') return null
  const t = trace as any
  return (t.pipeline ?? t) as PipelineLike
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function badgeStyle(status: string): { bg: string; fg: string; border: string } {
  const s = status.toLowerCase()
  if (s === 'success') return { bg: '#dcfce7', fg: '#166534', border: '#86efac' }
  if (s === 'failed' || s === 'error') return { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' }
  if (s === 'repaired' || s === 'success_with_repairs') return { bg: '#fef9c3', fg: '#854d0e', border: '#fde047' }
  if (s === 'skipped') return { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' }
  return { bg: '#e0f2fe', fg: '#0369a1', border: '#7dd3fc' }
}

function countsToString(counts: Record<string, number> | undefined): string {
  if (!counts) return '—'
  const parts = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k[0]}:${v}`)
  return parts.join(' ')
}

export function TransformsTab({ trace }: { trace: unknown }) {
  const pipeline = useMemo(() => getPipeline(trace), [trace])

  const capabilities = useMemo(
    () => ({
      nodeExtractionAvailable: !!pipeline?.node_extraction,
      transformsAvailable: Array.isArray(pipeline?.transforms),
      stagesAvailable: Array.isArray(pipeline?.stages),
    }),
    [pipeline]
  )

  const stages: any[] = Array.isArray(pipeline?.stages) ? pipeline.stages : []
  const transforms: any[] = Array.isArray(pipeline?.transforms) ? pipeline.transforms : []

  const [openStage, setOpenStage] = useState<string | null>(null)

  if (!capabilities.stagesAvailable && !capabilities.transformsAvailable) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontSize: 12, textAlign: 'center' }}>
        Detailed transform data requires CEE update.
      </div>
    )
  }

  const rawCounts = pipeline?.node_extraction?.raw
  const normalisedCounts = pipeline?.node_extraction?.normalised
  const validatedCounts = pipeline?.node_extraction?.validated

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Pipeline Stages</div>

        {!capabilities.stagesAvailable ? (
          <div style={{ color: '#64748b', fontSize: 11 }}>Stages not available.</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 100px 120px',
                gap: 8,
                padding: '8px 10px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: 10,
                fontWeight: 700,
                color: '#475569',
              }}
            >
              <div>Stage Name</div>
              <div>Status</div>
              <div>Duration</div>
              <div>Actions</div>
            </div>

            {stages.map((s) => {
              const status = String(s.status ?? 'unknown')
              const badge = badgeStyle(status)
              const hasDetails = s.details && typeof s.details === 'object'
              const id = String(s.name ?? s.stage ?? 'stage')
              const expanded = openStage === id
              return (
                <div key={id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 100px 120px',
                      gap: 8,
                      padding: '8px 10px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{id}</div>
                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.fg,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ color: '#334155' }}>{typeof s.duration_ms === 'number' ? `${s.duration_ms}ms` : '—'}</div>
                    <div>
                      <button
                        disabled={!hasDetails}
                        onClick={() => setOpenStage(expanded ? null : id)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          cursor: hasDetails ? 'pointer' : 'not-allowed',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          background: hasDetails ? '#fff' : '#f1f5f9',
                          color: '#334155',
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>

                  {expanded && hasDetails && (
                    <pre
                      style={{
                        margin: 0,
                        padding: 10,
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        maxHeight: 220,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatJson(s.details)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Artefact Chain Summary</div>

        {!capabilities.nodeExtractionAvailable ? (
          <div style={{ color: '#64748b', fontSize: 11 }}>node_extraction not available. CEE trace update required.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>
            <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 999, background: '#f8fafc' }}>
              Raw ({countsToString(rawCounts)})
            </div>
            <div style={{ padding: '6px 10px', color: '#64748b' }}>→</div>
            <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 999, background: '#f8fafc' }}>
              Normalised ({countsToString(normalisedCounts)})
            </div>
            <div style={{ padding: '6px 10px', color: '#64748b' }}>→</div>
            <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 999, background: '#f8fafc' }}>
              Validated ({countsToString(validatedCounts)})
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Transforms</div>

        {!capabilities.transformsAvailable ? (
          <div style={{ color: '#64748b', fontSize: 11 }}>
            Detailed transform data requires CEE update.
          </div>
        ) : transforms.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 11 }}>none</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transforms.map((t, idx) => {
              const stage = String(t.stage ?? 'unknown')
              const trigger = String(t.trigger ?? '')
              const attempted = !!t.repair_attempted
              const success = !!t.repair_success
              const headerBadge = attempted ? (success ? 'REPAIRED' : 'ATTEMPTED') : 'TRANSFORM'
              const headerStyle = badgeStyle(success ? 'repaired' : attempted ? 'failed' : 'success')

              return (
                <details key={`${stage}-${idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <summary
                    style={{
                      listStyle: 'none',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{stage}</div>
                      <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{trigger}</div>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        border: `1px solid ${headerStyle.border}`,
                        background: headerStyle.bg,
                        color: headerStyle.fg,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    >
                      {headerBadge}
                    </span>
                  </summary>

                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 10px', fontSize: 11 }}>
                      <div style={{ color: '#64748b' }}>repair_attempted</div>
                      <div style={{ fontFamily: 'monospace', color: '#0f172a' }}>{String(attempted)}</div>
                      <div style={{ color: '#64748b' }}>repair_success</div>
                      <div style={{ fontFamily: 'monospace', color: '#0f172a' }}>{String(success)}</div>
                      <div style={{ color: '#64748b' }}>before_counts</div>
                      <div style={{ fontFamily: 'monospace', color: '#0f172a' }}>{formatJson(t.before_counts)}</div>
                      <div style={{ color: '#64748b' }}>after_counts</div>
                      <div style={{ fontFamily: 'monospace', color: '#0f172a' }}>{formatJson(t.after_counts)}</div>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        maxHeight: 240,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatJson(t.changes)}
                    </pre>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}>Validation Result</div>

        <div style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
          Final status: {String(pipeline?.status ?? 'unknown').toUpperCase()}
        </div>

        {capabilities.nodeExtractionAvailable && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
            validated counts: {countsToString(validatedCounts)}
          </div>
        )}
      </div>
    </div>
  )
}

export default TransformsTab

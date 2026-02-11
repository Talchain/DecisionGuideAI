/**
 * ContractIntegrityTab Component
 *
 * Surfaces all CIL (Contract Integrity Layer) checks in one view.
 * Reads data already present in the debug bundle — no new API calls.
 *
 * Five sections:
 * 1. Seed chain — UI→PLoT→ISL seed consistency
 * 2. Strength audit — default-signature edge detection
 * 3. Request chain — request ID propagation
 * 4. Repairs applied — PLoT repair entries
 * 5. Validation warnings — CEE + ISL validation issues
 */

import { useMemo, useState, CSSProperties } from 'react'
import type { DebugData } from '../hooks/useDebugData'
import { CIL_WARNING_CODES, CIL_THRESHOLDS } from '@talchain/schemas'

// =============================================================================
// Types
// =============================================================================

export interface ContractIntegrityTabProps {
  data: DebugData
}

type SectionStatus = 'pass' | 'warn' | 'fail' | 'unavailable'

interface SeedChainData {
  seed_source: string | null
  seed_used: unknown
  ui_sent_seed: unknown
  isl_seed: unknown
  consistent: boolean | null
}

interface StrengthAuditData {
  total_edges: number
  structural_excluded: number
  defaulted_count: number
  defaulted_percentage: number
  defaulted_edge_ids: string[]
  strength_warnings: Array<{ code: string; message: string }>
}

interface RepairEntry {
  code: string
  layer: string
  field_path: string
  before: unknown
  after: unknown
  severity: string
}

// =============================================================================
// Status helpers
// =============================================================================

const STATUS_CONFIG = {
  pass: { label: 'Pass', color: '#16a34a', bg: '#dcfce7', border: '#86efac', icon: '\u2713' },
  warn: { label: 'Warn', color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: '\u26A0' },
  fail: { label: 'Fail', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '\u2717' },
  unavailable: { label: 'N/A', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: '\u2139' },
} as const

function StatusBadge({ status }: { status: SectionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  )
}

function OverallBadge({ status }: { status: SectionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        color: cfg.color,
      }}
    >
      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
      Contract integrity: {cfg.label.toLowerCase()}
    </div>
  )
}

function worstStatus(statuses: SectionStatus[]): SectionStatus {
  if (statuses.includes('fail')) return 'fail'
  if (statuses.includes('warn')) return 'warn'
  if (statuses.every(s => s === 'unavailable')) return 'unavailable'
  return 'pass'
}

// =============================================================================
// Section wrapper
// =============================================================================

function Section({
  title,
  status,
  children,
  defaultExpanded = true,
}: {
  title: string
  status: SectionStatus
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#334155',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 10 }}>{expanded ? '\u25BC' : '\u25B6'}</span>
          {title}
        </span>
        <StatusBadge status={status} />
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px', fontSize: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function DataUnavailable() {
  return (
    <div style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{'\u2139'}</span> Data not available
    </div>
  )
}

function KvRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 11 : undefined, color: '#334155', maxWidth: '60%', wordBreak: 'break-all', textAlign: 'right' }}>
        {value ?? <span style={{ color: '#94a3b8' }}>{'\u2014'}</span>}
      </span>
    </div>
  )
}

// =============================================================================
// Extraction helpers (pure functions operating on DebugData)
// =============================================================================

function extractSeedChain(data: DebugData): { data: SeedChainData | null; status: SectionStatus } {
  const plotResponse = data.payloads.plot_response as Record<string, unknown> | undefined
  const plotRequest = data.payloads.plot_request as Record<string, unknown> | undefined

  if (!plotResponse && !plotRequest) {
    return { data: null, status: 'unavailable' }
  }

  const meta = plotResponse?.meta as Record<string, unknown> | undefined
  const seedSource = (meta?.seed_source as string) ?? null
  const seedUsed = meta?.seed_used ?? meta?.seed ?? null
  const uiSentSeed = plotRequest?.seed ?? null

  // ISL seed if available
  const islRequest = data.payloads.isl_request as Record<string, unknown> | undefined
  const islSeed = islRequest?.seed ?? null

  // Check consistency
  let consistent: boolean | null = null
  if (seedUsed != null) {
    const seedStr = String(seedUsed)
    const uiMatch = uiSentSeed == null || String(uiSentSeed) === seedStr
    const islMatch = islSeed == null || String(islSeed) === seedStr
    consistent = uiMatch && islMatch
  }

  let status: SectionStatus = 'pass'
  if (seedUsed == null) {
    // Can't verify chain without a seed value
    status = 'unavailable'
  } else if (consistent === false) {
    status = 'fail'
  } else if (seedSource === 'server_generated') {
    status = 'warn'
  }

  return {
    data: {
      seed_source: seedSource,
      seed_used: seedUsed,
      ui_sent_seed: uiSentSeed,
      isl_seed: islSeed,
      consistent,
    },
    status,
  }
}

/**
 * Build a map of node ID → kind from captured graph data.
 * Used to identify structural wiring edges (decision→option, option→factor).
 */
function buildNodeKindMap(
  ceeResponse: Record<string, unknown> | undefined,
  plotRequest: Record<string, unknown> | undefined
): Map<string, string> {
  const map = new Map<string, string>()

  // Try ceeResponse.nodes first
  const ceeNodes = ceeResponse?.nodes
  if (Array.isArray(ceeNodes)) {
    for (const node of ceeNodes) {
      if (!node || typeof node !== 'object') continue
      const n = node as Record<string, unknown>
      const id = n.id as string | undefined
      const kind = (n.kind ?? n.type) as string | undefined
      if (id && kind) map.set(id, kind)
    }
  }

  // Fallback to plotRequest.graph.nodes
  if (map.size === 0 && plotRequest?.graph && typeof plotRequest.graph === 'object') {
    const graph = plotRequest.graph as Record<string, unknown>
    const plotNodes = graph.nodes
    if (Array.isArray(plotNodes)) {
      for (const node of plotNodes) {
        if (!node || typeof node !== 'object') continue
        const n = node as Record<string, unknown>
        const id = n.id as string | undefined
        const kind = (n.kind ?? n.type) as string | undefined
        if (id && kind) map.set(id, kind)
      }
    }
  }

  return map
}

function extractStrengthAudit(data: DebugData): { data: StrengthAuditData | null; status: SectionStatus } {
  const ceeResponse = data.payloads.cee_response as Record<string, unknown> | undefined
  const plotRequest = data.payloads.plot_request as Record<string, unknown> | undefined

  let edges: unknown[] | null = null
  if (Array.isArray(ceeResponse?.edges)) {
    edges = ceeResponse.edges as unknown[]
  } else if (plotRequest?.graph && typeof plotRequest.graph === 'object') {
    const graph = plotRequest.graph as Record<string, unknown>
    if (Array.isArray(graph.edges)) {
      edges = graph.edges as unknown[]
    }
  }

  if (!edges || edges.length === 0) {
    return { data: null, status: 'unavailable' }
  }

  // Check CEE validation warnings for pre-computed details
  const validationWarnings = ceeResponse?.validation_warnings
  let detailsFromWarning: Record<string, unknown> | null = null
  if (Array.isArray(validationWarnings)) {
    for (const w of validationWarnings) {
      if (!w || typeof w !== 'object') continue
      const warning = w as Record<string, unknown>
      const code = warning.code as string | undefined
      if (code === CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT || code === CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED) {
        if (warning.details && typeof warning.details === 'object') {
          detailsFromWarning = warning.details as Record<string, unknown>
          break
        }
      }
    }
  }

  // Pre-computed counts from CEE warning details (when available).
  // Only use totals when both total_edges AND structural_edges_excluded are present
  // to avoid computing percentage against mismatched counts.
  let precomputedTotalCausal: number | null = null
  let precomputedStructuralExcluded: number | null = null
  let precomputedDefaultedIds: string[] | null = null
  if (detailsFromWarning) {
    const hasTotal = typeof detailsFromWarning.total_edges === 'number'
    const hasStructural = typeof detailsFromWarning.structural_edges_excluded === 'number'
    if (hasTotal && hasStructural) {
      precomputedTotalCausal = detailsFromWarning.total_edges as number
      precomputedStructuralExcluded = detailsFromWarning.structural_edges_excluded as number
    }
    const ids = detailsFromWarning.defaulted_edge_ids ?? detailsFromWarning.mean_defaulted_edge_ids
    if (Array.isArray(ids)) {
      precomputedDefaultedIds = ids.map(String)
    }
  }

  // Build node kind map for structural edge exclusion (fallback)
  const structuralKinds = new Set(['decision', 'option'])
  const nodeKindMap = buildNodeKindMap(ceeResponse, plotRequest)

  // Partition edges: causal vs structural
  const causalEdges: Array<Record<string, unknown>> = []
  let structuralCount = 0
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') continue
    const e = edge as Record<string, unknown>
    const fromId = e.from as string | undefined
    const fromKind = fromId ? nodeKindMap.get(fromId) : undefined
    if (fromKind && structuralKinds.has(fromKind)) {
      structuralCount++
    } else {
      causalEdges.push(e)
    }
  }

  const totalCausal = precomputedTotalCausal ?? causalEdges.length
  const structuralExcluded = precomputedStructuralExcluded ?? structuralCount

  // Default signature detection on causal edges only
  const defaultedEdgeIds: string[] = []
  if (precomputedDefaultedIds) {
    defaultedEdgeIds.push(...precomputedDefaultedIds)
  } else {
    for (const e of causalEdges) {
      const fromId = (e.from as string) ?? '?'
      const toId = (e.to as string) ?? '?'
      const edgeLabel = `${fromId} \u2192 ${toId}`

      let mean: number | null = null
      let std: number | null = null
      const strength = e.strength as Record<string, unknown> | undefined
      if (strength && typeof strength === 'object') {
        mean = typeof strength.mean === 'number' ? strength.mean : null
        std = typeof strength.std === 'number' ? strength.std : null
      }
      if (mean === null && typeof e.strength_mean === 'number') mean = e.strength_mean
      if (std === null && typeof e.strength_std === 'number') std = e.strength_std

      if (mean !== null && std !== null && Math.abs(Math.abs(mean) - CIL_THRESHOLDS.STRENGTH_DEFAULT_MEAN) < CIL_THRESHOLDS.STRENGTH_DEFAULT_TOLERANCE && Math.abs(std - CIL_THRESHOLDS.STRENGTH_DEFAULT_STD) < CIL_THRESHOLDS.STRENGTH_DEFAULT_TOLERANCE) {
        defaultedEdgeIds.push(edgeLabel)
      }
    }
  }

  const defaultedCount = defaultedEdgeIds.length
  const defaultedPercentage = totalCausal > 0 ? (defaultedCount / totalCausal) * 100 : 0

  // Extract strength-related validation warnings
  const strengthWarnings: Array<{ code: string; message: string }> = []
  if (Array.isArray(validationWarnings)) {
    for (const w of validationWarnings) {
      if (!w || typeof w !== 'object') continue
      const warning = w as Record<string, unknown>
      const code = warning.code as string | undefined
      if (code === CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED || code === CIL_WARNING_CODES.EDGE_STRENGTH_LOW || code === CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT) {
        strengthWarnings.push({
          code: code,
          message: (warning.message as string) ?? code,
        })
      }
    }
  }

  // Strength issues → warn only, never fail (data quality, not integrity failure)
  let status: SectionStatus = 'pass'
  if (defaultedPercentage >= CIL_THRESHOLDS.DEFAULTED_PERCENTAGE_WARN || strengthWarnings.length > 0) {
    status = 'warn'
  }

  return {
    data: {
      total_edges: totalCausal,
      structural_excluded: structuralExcluded,
      defaulted_count: defaultedCount,
      defaulted_percentage: defaultedPercentage,
      defaulted_edge_ids: defaultedEdgeIds,
      strength_warnings: strengthWarnings,
    },
    status,
  }
}

export function deriveRequestChainStatus(chain: DebugData['request_id_chain']): SectionStatus {
  if (!chain) return 'unavailable'

  // Only score the analysis chain (hard invariant). Draft-graph trace is informational.
  const ac = chain.analysis_chain
  const values = [ac.ui_sent, ac.plot_received, ac.forwarded_to_isl, ac.isl_echoed]
  const nonNull = values.filter(v => v !== null)
  if (nonNull.length === 0) return 'unavailable'

  const hasNulls = values.some(v => v === null)
  const uniqueIds = new Set(nonNull)

  // If IDs diverge, it's always a fail
  if (uniqueIds.size > 1) return 'fail'

  // Incomplete chain (fewer than 2 IDs present) → warn, even if the single ID "matches" itself
  if (nonNull.length < 2) return 'warn'

  // all_match with ≥2 IDs is a real pass
  if (ac.all_match) return 'pass'

  // Some IDs still null → warn
  if (hasNulls) return 'warn'
  return 'pass'
}

function extractRepairs(data: DebugData): { repairs: RepairEntry[]; status: SectionStatus } {
  const plotResponse = data.payloads.plot_response as Record<string, unknown> | undefined
  if (!plotResponse) {
    return { repairs: [], status: 'unavailable' }
  }

  const repairsRaw = plotResponse.repairs_applied
  if (!Array.isArray(repairsRaw) || repairsRaw.length === 0) {
    return { repairs: [], status: 'pass' }
  }

  const repairs: RepairEntry[] = repairsRaw.map((r: unknown) => {
    const entry = r as Record<string, unknown>
    return {
      code: (entry.code as string) ?? (entry.type as string) ?? '?',
      layer: (entry.layer as string) ?? '?',
      field_path: (entry.field_path as string) ?? (entry.path as string) ?? '?',
      before: entry.before ?? null,
      after: entry.after ?? null,
      severity: (entry.severity as string) ?? 'info',
    }
  })

  const warnCount = repairs.filter(r => r.severity === 'warn' || r.severity === 'warning').length
  let status: SectionStatus = 'pass'
  if (warnCount > CIL_THRESHOLDS.REPAIR_WARN_THRESHOLD) {
    status = 'fail'
  } else if (warnCount > 0) {
    status = 'warn'
  }

  return { repairs, status }
}

export function deriveValidationStatus(data: DebugData): SectionStatus {
  const ceeResponse = data.payloads.cee_response as Record<string, unknown> | undefined
  const ceeWarnings = Array.isArray(ceeResponse?.validation_warnings) ? ceeResponse.validation_warnings : []
  const bundleIssues = data.validation?.issues ?? []

  const allItems = [...ceeWarnings, ...bundleIssues]
  if (allItems.length === 0 && !ceeResponse) return 'unavailable'
  if (allItems.length === 0) return 'pass'

  // Check for errors/blockers
  const hasError = allItems.some((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const i = item as Record<string, unknown>
    return i.severity === 'error' || i.severity === 'blocker'
  })
  if (hasError) return 'fail'
  return 'warn'
}

// =============================================================================
// Component
// =============================================================================

export function ContractIntegrityTab({ data }: ContractIntegrityTabProps) {
  const seedChain = useMemo(() => extractSeedChain(data), [data])
  const strengthAudit = useMemo(() => extractStrengthAudit(data), [data])
  const requestChainStatus = useMemo(() => deriveRequestChainStatus(data.request_id_chain), [data.request_id_chain])
  const repairsResult = useMemo(() => extractRepairs(data), [data])
  const validationStatus = useMemo(() => deriveValidationStatus(data), [data])

  const overall = useMemo(
    () => worstStatus([seedChain.status, strengthAudit.status, requestChainStatus, repairsResult.status, validationStatus]),
    [seedChain.status, strengthAudit.status, requestChainStatus, repairsResult.status, validationStatus]
  )

  const sectionGap = 12

  if (!data.hasData) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
        Run an analysis to see contract integrity checks
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap, padding: 12 }}>
      {/* Overall status badge */}
      <OverallBadge status={overall} />

      {/* Section 1: Seed chain */}
      <Section title="Seed chain" status={seedChain.status}>
        {seedChain.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <KvRow label="Seed source" value={seedChain.data.seed_source} mono />
            <KvRow label="Seed used" value={seedChain.data.seed_used != null ? String(seedChain.data.seed_used) : null} mono />
            <KvRow label="UI sent seed" value={seedChain.data.ui_sent_seed != null ? String(seedChain.data.ui_sent_seed) : null} mono />
            <KvRow label="ISL seed" value={seedChain.data.isl_seed != null ? String(seedChain.data.isl_seed) : null} mono />
            <KvRow
              label="Chain consistent"
              value={
                seedChain.data.consistent === true ? (
                  <span style={{ color: '#16a34a' }}>{'\u2713'} Yes</span>
                ) : seedChain.data.consistent === false ? (
                  <span style={{ color: '#dc2626' }}>{'\u2717'} No</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Unknown</span>
                )
              }
            />
          </div>
        ) : (
          <DataUnavailable />
        )}
      </Section>

      {/* Section 2: Strength audit */}
      <Section title="Strength audit" status={strengthAudit.status}>
        {strengthAudit.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <MetricBox label="Causal edges" value={strengthAudit.data.total_edges} />
              <MetricBox label="Defaulted" value={strengthAudit.data.defaulted_count} warn={strengthAudit.data.defaulted_count > 0} />
              <MetricBox label="Percentage" value={`${strengthAudit.data.defaulted_percentage.toFixed(1)}%`} warn={strengthAudit.data.defaulted_percentage >= 50} />
            </div>
            {strengthAudit.data.structural_excluded > 0 && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Structural wiring excluded: {strengthAudit.data.structural_excluded}
              </div>
            )}

            {strengthAudit.data.defaulted_edge_ids.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#64748b' }}>
                  Defaulted edge IDs ({strengthAudit.data.defaulted_edge_ids.length})
                </summary>
                <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 10, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {strengthAudit.data.defaulted_edge_ids.map(id => (
                    <span key={id} style={{ padding: '2px 6px', background: '#f1f5f9', borderRadius: 3 }}>
                      {id}
                    </span>
                  ))}
                </div>
              </details>
            )}

            {strengthAudit.data.strength_warnings.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                  Strength warnings
                </div>
                {strengthAudit.data.strength_warnings.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 8px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 4,
                      fontSize: 11,
                      color: '#92400e',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{w.code}</span>
                    {w.message !== w.code && <span style={{ marginLeft: 6 }}>{w.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DataUnavailable />
        )}
      </Section>

      {/* Section 3: Request chain */}
      <Section title="Request chain" status={requestChainStatus}>
        {data.request_id_chain ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Analysis chain (hard invariant) */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Analysis chain
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <KvRow label="UI sent" value={data.request_id_chain.analysis_chain.ui_sent} mono />
                <KvRow label="PLoT received" value={data.request_id_chain.analysis_chain.plot_received} mono />
                <KvRow label="Forwarded to ISL" value={data.request_id_chain.analysis_chain.forwarded_to_isl} mono />
                <KvRow label="ISL echoed" value={data.request_id_chain.analysis_chain.isl_echoed} mono />
                <KvRow
                  label="All match"
                  value={
                    data.request_id_chain.analysis_chain.all_match ? (
                      <span style={{ color: '#16a34a' }}>{'\u2713'} Yes</span>
                    ) : (
                      <span style={{ color: '#dc2626' }}>{'\u2717'} No</span>
                    )
                  }
                />
              </div>
            </div>

            {/* Draft-graph trace (informational — no scoring) */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Draft-graph trace{' '}
                <span style={{ fontSize: 9, fontWeight: 400, color: '#94a3b8' }}>(informational)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <KvRow label="CEE trace" value={data.request_id_chain.draft_trace.cee_trace} mono />
              </div>
            </div>
          </div>
        ) : (
          <DataUnavailable />
        )}
      </Section>

      {/* Section 4: Repairs applied */}
      <Section title="Repairs applied" status={repairsResult.status} defaultExpanded={repairsResult.repairs.length > 0}>
        {data.payloads.plot_response ? (
          repairsResult.repairs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Layer</th>
                    <th style={thStyle}>Path</th>
                    <th style={thStyle}>Before</th>
                    <th style={thStyle}>After</th>
                    <th style={thStyle}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {repairsResult.repairs.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace' }}>{r.code}</span></td>
                      <td style={tdStyle}>{r.layer}</td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.field_path}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{formatCellValue(r.before)}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{formatCellValue(r.after)}</span></td>
                      <td style={tdStyle}>
                        <SeverityPill severity={r.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#16a34a', fontSize: 12 }}>No repairs needed</div>
          )
        ) : (
          <DataUnavailable />
        )}
      </Section>

      {/* Section 5: Validation warnings */}
      <Section title="Validation warnings" status={validationStatus}>
        {(() => {
          const ceeResponse = data.payloads.cee_response as Record<string, unknown> | undefined
          const ceeWarnings: unknown[] = Array.isArray(ceeResponse?.validation_warnings) ? (ceeResponse.validation_warnings as unknown[]) : []
          const bundleIssues = data.validation?.issues ?? []

          if (!ceeResponse && bundleIssues.length === 0) return <DataUnavailable />
          if (ceeWarnings.length === 0 && bundleIssues.length === 0) {
            return <div style={{ color: '#16a34a', fontSize: 12 }}>No validation warnings</div>
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* CEE validation_warnings */}
              {ceeWarnings.map((w, i) => {
                const warning = w as Record<string, unknown>
                const code = (warning.code as string) ?? '?'
                const message = (warning.message as string) ?? ''
                const severity = (warning.severity as string) ?? 'warning'
                return (
                  <WarningRow key={`cee-${i}`} code={code} message={message} severity={severity} source="CEE" />
                )
              })}

              {/* Bundle validation issues */}
              {bundleIssues.map((issue, i) => (
                <WarningRow
                  key={`bundle-${i}`}
                  code={issue.code}
                  message={issue.message}
                  severity={issue.severity}
                  source={issue.source.toUpperCase()}
                />
              ))}
            </div>
          )
        })()}
      </Section>
    </div>
  )
}

// =============================================================================
// Small subcomponents
// =============================================================================

function MetricBox({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div
      style={{
        padding: 8,
        background: warn ? '#fef2f2' : '#f9fafb',
        border: `1px solid ${warn ? '#fecaca' : '#e5e7eb'}`,
        borderRadius: 4,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: warn ? '#dc2626' : '#334155' }}>
        {value}
      </div>
    </div>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    info: { bg: '#eff6ff', text: '#2563eb' },
    warn: { bg: '#fef3c7', text: '#d97706' },
    warning: { bg: '#fef3c7', text: '#d97706' },
    error: { bg: '#fef2f2', text: '#dc2626' },
  }
  const c = colors[severity] ?? colors.info
  return (
    <span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: c.bg, color: c.text }}>
      {severity}
    </span>
  )
}

function WarningRow({ code, message, severity, source }: { code: string; message: string; severity: string; source: string }) {
  const severityColors: Record<string, { bg: string; border: string; text: string }> = {
    error: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    blocker: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  }
  const c = severityColors[severity] ?? severityColors.info
  return (
    <div
      style={{
        padding: '6px 10px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
      }}
    >
      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: c.text, flexShrink: 0 }}>{code}</span>
      <span style={{ color: '#475569', flex: 1, minWidth: 0 }}>{message}</span>
      <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0, textTransform: 'uppercase' }}>{source}</span>
    </div>
  )
}

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return '\u2014'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    const str = JSON.stringify(v)
    return str.length > 40 ? str.slice(0, 37) + '...' : str
  } catch {
    return '[object]'
  }
}

// Shared table cell styles
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
  color: '#475569',
  fontSize: 10,
}

const tdStyle: CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'top',
}

export default ContractIntegrityTab

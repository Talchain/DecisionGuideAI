/**
 * LensInfoPanel — Contextual panel overlay for expanded graph lenses.
 *
 * Renders a summary panel when causal, evidence, or robustness lens is active.
 * Positioned in the bottom-left corner of the canvas (above minimap).
 *
 * Design system: bg-panel, border-panel-border, Inter font, no emoji.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import type { LensMode } from '../store'

/** Causal lens panel: shows variable/edge count, model summary, and edge table */
function CausalPanel() {
  const nodes = useCanvasStore(s => s.nodes)
  const hiddenNodeIds = useCanvasStore(s => s.lens._hiddenNodeIds)
  const hiddenEdgeIds = useCanvasStore(s => s.lens._hiddenEdgeIds)
  const edges = useCanvasStore(s => s.edges)
  const causalEdgeParams = useCanvasStore(s => s.lens._causalEdgeParams)
  const [showTable, setShowTable] = useState(false)

  const variableCount = nodes.length - hiddenNodeIds.size
  const causalEdgeCount = edges.length - hiddenEdgeIds.size

  // Build edge table data with source/target labels
  const edgeTableRows = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, (n.data as Record<string, unknown>)?.label as string ?? n.id]))
    const rows: Array<{ from: string; to: string; mean: number; std: number | null; existsProb: number | null }> = []
    for (const [edgeId, params] of causalEdgeParams) {
      const edge = edges.find(e => e.id === edgeId)
      if (!edge) continue
      rows.push({
        from: nodeMap.get(edge.source) ?? edge.source,
        to: nodeMap.get(edge.target) ?? edge.target,
        ...params,
      })
    }
    return rows
  }, [causalEdgeParams, edges, nodes])

  return (
    <div data-testid="lens-info-causal">
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        Causal model
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-light, #908D8D)', lineHeight: 1.5 }}>
        Showing the causal model used for inference.{' '}
        {variableCount} variable{variableCount !== 1 ? 's' : ''},{' '}
        {causalEdgeCount} causal edge{causalEdgeCount !== 1 ? 's' : ''}.{' '}
        Organisational nodes (decision, options) are hidden.
      </div>
      {/* Collapsible edge table */}
      {edgeTableRows.length > 0 && (
        <button
          type="button"
          onClick={() => setShowTable(p => !p)}
          className="flex items-center gap-1 mt-2 cursor-pointer"
          style={{ fontSize: 10, fontWeight: 500, color: 'var(--semantic-info, #3b82f6)', background: 'none', border: 'none', padding: 0 }}
        >
          {showTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showTable ? 'Hide' : 'Show'} edge table
        </button>
      )}
      {showTable && (
        <div className="mt-2 max-h-[200px] overflow-y-auto" style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-light, #908D8D)', textAlign: 'left' }}>
                <th style={{ padding: '2px 4px' }}>From</th>
                <th style={{ padding: '2px 4px' }}>To</th>
                <th style={{ padding: '2px 4px' }}>Mean</th>
                <th style={{ padding: '2px 4px' }}>Std</th>
                <th style={{ padding: '2px 4px' }}>P(exists)</th>
              </tr>
            </thead>
            <tbody>
              {edgeTableRows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-default, #EEE6D8)' }}>
                  <td style={{ padding: '2px 4px', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.from}>{r.from}</td>
                  <td style={{ padding: '2px 4px', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.to}>{r.to}</td>
                  <td style={{ padding: '2px 4px' }}>{r.mean >= 0 ? '+' : ''}{r.mean.toFixed(2)}</td>
                  <td style={{ padding: '2px 4px', color: r.std === null ? 'var(--text-disabled, #C5C0B8)' : undefined }}>{r.std !== null ? r.std.toFixed(2) : '\u2014'}</td>
                  <td style={{ padding: '2px 4px', color: r.existsProb === null ? 'var(--text-disabled, #C5C0B8)' : undefined }}>{r.existsProb !== null ? `${Math.round(r.existsProb * 100)}%` : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Evidence lens panel: shows grounded/assumed/missing counts */
function EvidencePanel() {
  const evidenceNodeClass = useCanvasStore(s => s.lens._evidenceNodeClass)
  const evidenceEdgeClass = useCanvasStore(s => s.lens._evidenceEdgeClass)

  const nodeCounts = useMemo(() => {
    let grounded = 0, assumed = 0, none = 0, total = 0
    for (const [, cls] of evidenceNodeClass) {
      if (cls === 'na') continue
      total++
      if (cls === 'grounded') grounded++
      else if (cls === 'assumed') assumed++
      else none++
    }
    return { grounded, assumed, none, total }
  }, [evidenceNodeClass])

  const assumedEdgeCount = useMemo(() => {
    let count = 0
    for (const [, cls] of evidenceEdgeClass) {
      if (cls === 'assumed' || cls === 'unknown') count++
    }
    return count
  }, [evidenceEdgeClass])

  return (
    <div data-testid="lens-info-evidence">
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        Evidence quality
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-light, #908D8D)', lineHeight: 1.5 }}>
        {nodeCounts.grounded} of {nodeCounts.total} factor{nodeCounts.total !== 1 ? 's' : ''} have evidence.{' '}
        {assumedEdgeCount} edge{assumedEdgeCount !== 1 ? 's are' : ' is'} model-assumed.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--semantic-success-light, #dcfce7)', border: '1px solid var(--semantic-success, #22c55e)' }} />
          Grounded
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--semantic-warning-light, #fef9c3)', border: '1px solid var(--semantic-warning, #eab308)' }} />
          Assumed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--semantic-danger-light, #fee2e2)', border: '1px solid var(--semantic-danger, #ef4444)' }} />
          No data
        </span>
      </div>
    </div>
  )
}

/** Robustness lens panel: shows stability, ranked fragile edges, actionable coaching */
function RobustnessPanel() {
  const report = useCanvasStore(s => s.results.report)
  const fragileEdgeIds = useCanvasStore(s => s.lens._fragileEdgeIds)
  const nodes = useCanvasStore(s => s.nodes)

  const { stability, fragileList, topFocusLabel } = useMemo(() => {
    const reportAny = report as Record<string, unknown> | null | undefined
    const rob = reportAny?.robustness as Record<string, unknown> | undefined
    const rawFragile = (rob?.fragile_edges ?? []) as Array<Record<string, unknown>>
    const nodeMap = new Map(nodes.map(n => [n.id, (n.data as Record<string, unknown>)?.label as string ?? n.id]))

    // Build ranked fragile list sorted by switch_probability desc
    const list: Array<{ from: string; to: string; switchProb: number; altWinner: string | null }> = []
    for (const fe of rawFragile) {
      const sp = (fe.switch_probability ?? fe.switchProbability ?? fe.marginal_switch_probability) as number | undefined
      if (typeof sp !== 'number' || sp <= 0.3) continue
      const fromId = (fe.from_id ?? fe.fromId ?? fe.source) as string
      const toId = (fe.to_id ?? fe.toId ?? fe.target) as string
      const altWinner = (fe.alternative_winner_label ?? fe.alternativeWinnerLabel) as string | null ?? null
      list.push({
        from: nodeMap.get(fromId) ?? fromId,
        to: nodeMap.get(toId) ?? toId,
        switchProb: sp,
        altWinner,
      })
    }
    list.sort((a, b) => b.switchProb - a.switchProb)

    return {
      stability: typeof rob?.recommendation_stability === 'number'
        ? Math.round((rob.recommendation_stability as number) * 100)
        : null,
      fragileList: list,
      topFocusLabel: list.length > 0
        ? `${list[0].from} \u2192 ${list[0].to}`
        : null,
    }
  }, [report, nodes])

  return (
    <div data-testid="lens-info-robustness">
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        Robustness
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-light, #908D8D)', lineHeight: 1.5 }}>
        {stability !== null && (
          <>Recommendation stability: {stability}%. </>
        )}
        Fragile edges: {fragileEdgeIds.size}.
      </div>
      {/* Ranked fragile edge list */}
      {fragileList.length > 0 && (
        <div className="mt-2 space-y-1" style={{ fontSize: 10 }}>
          {fragileList.map((fe, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-danger font-semibold" style={{ minWidth: 32 }}>{Math.round(fe.switchProb * 100)}%</span>
              <span className="text-text-body truncate" title={`${fe.from} \u2192 ${fe.to}`}>
                {fe.from} \u2192 {fe.to}
              </span>
              {fe.altWinner && (
                <span className="text-text-light ml-auto flex-shrink-0" title={`Alternative: ${fe.altWinner}`}>
                  \u2192 {fe.altWinner}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Actionable coaching */}
      {topFocusLabel && (
        <div style={{ fontSize: 11, color: 'var(--text-body, #3F3F3E)', marginTop: 6, lineHeight: 1.4 }}>
          If you could strengthen one relationship, focus on: <strong>{topFocusLabel}</strong>
        </div>
      )}
    </div>
  )
}

/** Main panel — renders per active lens mode */
export function LensInfoPanel() {
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full') as LensMode

  if (lensMode !== 'causal' && lensMode !== 'evidence' && lensMode !== 'robustness') {
    return null
  }

  return (
    <div
      className="border border-panel-border bg-panel shadow-2 rounded-md"
      style={{
        position: 'absolute',
        bottom: 48,
        left: 12,
        zIndex: 5,
        padding: '10px 14px',
        maxWidth: 320,
        animation: 'thinkingModeIn 150ms cubic-bezier(0.0, 0, 0.2, 1) both',
      }}
      data-testid="lens-info-panel"
    >
      {lensMode === 'causal' && <CausalPanel />}
      {lensMode === 'evidence' && <EvidencePanel />}
      {lensMode === 'robustness' && <RobustnessPanel />}
    </div>
  )
}

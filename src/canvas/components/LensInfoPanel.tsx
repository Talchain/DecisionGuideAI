/**
 * LensInfoPanel — Contextual panel overlay for expanded graph lenses.
 *
 * Renders a summary panel when causal, evidence, or robustness lens is active.
 * Positioned in the bottom-left corner of the canvas (above minimap).
 *
 * Design system: bg-panel, border-panel-border, Inter font, no emoji.
 *
 * ⭐ WHILE IT HOLDS THE SLOT, IT CARRIES THE STALE FACT (27 Sep 2026). The
 * whole-graph stale sentence (`AnalysisStateCue`, "Model changed · previous
 * findings shown as Last run") is the canvas foot, bottom-LEFT — the same slot
 * this panel holds, and this panel OUTRANKS it there (one slot, one occupant).
 * So the moment a lens opens, the foot line yields — and the Robustness view
 * then shows run figures (switch probabilities, sensitive assumptions, the
 * "focus on" edge, all from `results.report`). Without the lines below, a
 * changed-since-run model would show last-run figures with NO stale label: the
 * truth regression N3 (`OVERLAY_BAND_RIGHT_CELL_MIN`) exists to forbid — the
 * whole-graph stale cue must never be hidden by another occupant.
 *
 * On exactly the cue's own predicate (`useModelChangedSinceRun`, the one the
 * cards ask before `Last run ·`), the panel therefore
 *   · opens with the cue's sentence, verbatim — the occupant that takes the
 *     slot takes the fact with it, so the sentence is still said exactly once
 *     on the canvas (the foot line is not rendered while this panel holds the
 *     slot), in every lens mode, because the cards' labels it explains are
 *     still on screen in every mode; and
 *   · labels its own run-derived section `Last run · Robustness`, the cards'
 *     prefix, so "previous findings shown as Last run" is true of this panel's
 *     figures too. The causal and evidence views read the model, not the run,
 *     and take no label.
 * `AnalysisStateCue.band.spec.tsx` pins both, with the band arbitrating.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useOverlayCell } from './CanvasOverlayBand'
import { ANALYSIS_STATE_CUE_COPY } from './AnalysisStateCue'
import { useModelChangedSinceRun } from '../hooks/useModelChangedSinceRun'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { lensFragileRowAlternative } from '../../components/results/utils/fragileEdgeCopy'
import type { LensMode } from '../store'
import type { CausalLensEdgeParams } from '../domain/edgeValueProvenance'

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
    const rows: Array<{ from: string; to: string } & CausalLensEdgeParams> = []
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
      <div style={{ fontSize: 11, color: 'var(--text-light, #6E6B6B)', lineHeight: 1.5 }}>
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
          style={{ fontSize: 11, fontWeight: 500, color: 'var(--info)', background: 'none', border: 'none', padding: 0 }}
        >
          {showTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showTable ? 'Hide' : 'Show'} edge table
        </button>
      )}
      {showTable && (
        <div className="mt-2 max-h-[200px] overflow-y-auto" style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-light, #6E6B6B)', textAlign: 'left' }}>
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
                  {/* ROADMAP 2.954 — provenance-gated Mean: an unset strength
                      renders this table's own absent-quantity mark (the em
                      dash its Std / P(exists) cells use), never the `+0.50`
                      default; the sign renders only from the STATED direction
                      ('−' U+2212, `formatNumericLabel`'s sign). */}
                  <td style={{ padding: '2px 4px', color: r.magnitude === null ? 'var(--text-light, #6E6B6B)' : undefined }}>
                    {r.magnitude !== null
                      ? `${r.direction === 'positive' ? '+' : r.direction === 'negative' ? '−' : ''}${r.magnitude.toFixed(2)}`
                      : '—'}
                  </td>
                  <td style={{ padding: '2px 4px', color: r.std === null ? 'var(--text-light, #6E6B6B)' : undefined }}>{r.std !== null ? r.std.toFixed(2) : '\u2014'}</td>
                  <td style={{ padding: '2px 4px', color: r.existsProb === null ? 'var(--text-light, #6E6B6B)' : undefined }}>{r.existsProb !== null ? `${Math.round(r.existsProb * 100)}%` : '\u2014'}</td>
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
      <div style={{ fontSize: 11, color: 'var(--text-light, #6E6B6B)', lineHeight: 1.5 }}>
        {nodeCounts.grounded} of {nodeCounts.total} factor{nodeCounts.total !== 1 ? 's' : ''} have evidence.{' '}
        {assumedEdgeCount} edge{assumedEdgeCount !== 1 ? 's are' : ' is'} model-assumed.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success-light)', border: '1px solid var(--success)' }} />
          Grounded
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning-light)', border: '1px solid var(--warning)' }} />
          Assumed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger-light)', border: '1px solid var(--danger)' }} />
          No data
        </span>
      </div>
    </div>
  )
}

/** Robustness lens panel: shows stability, ranked fragile edges, actionable coaching */
function RobustnessPanel({ lastRun }: { lastRun: boolean }) {
  const report = useCanvasStore(s => s.results.report)
  const fragileEdgeIds = useCanvasStore(s => s.lens._fragileEdgeIds)
  const nodes = useCanvasStore(s => s.nodes)

  const { fragileList, topFocusLabel } = useMemo(() => {
    const reportAny = report as Record<string, unknown> | null | undefined
    const rob = reportAny?.robustness as Record<string, unknown> | undefined
    const rawFragile = (rob?.fragile_edges ?? []) as Array<Record<string, unknown>>
    const nodeMap = new Map(nodes.map(n => [n.id, (n.data as Record<string, unknown>)?.label as string ?? n.id]))

    // Build ranked fragile list. Presence branch (schemas 0.30.0, the same
    // class #543 closed on the results surfaces): `switch_probability` ABSENT
    // means NOT COMPUTED — never zero — and `marginal_switch_probability` is a
    // DIFFERENT Monte Carlo (P(flip | only this edge varies)), never a
    // fallback. Only a MEASURED switch probability earns a rendered percentage
    // or a threshold pass on its own account; an unmeasured edge the marginal
    // MC evidences as fragile is listed qualitatively (em dash, after every
    // measured edge — the contract forbids deriving a ranking position from a
    // substitute).
    const list: Array<{ from: string; to: string; switchProb: number | undefined; altWinner: string | null }> = []
    for (const fe of rawFragile) {
      const measuredRaw = (fe.switch_probability ?? fe.switchProbability) as number | undefined
      const measured = typeof measuredRaw === 'number' ? measuredRaw : undefined
      const marginal = (fe.marginal_switch_probability ?? fe.marginalSwitchProbability) as number | undefined
      // A present measurement — including 0 — decides eligibility itself; the
      // marginal MC qualifies an edge only when NO measurement exists.
      const eligible = measured !== undefined
        ? measured > 0.3
        : typeof marginal === 'number' && marginal > 0.3
      if (!eligible) continue
      const fromId = (fe.from_id ?? fe.fromId ?? fe.source) as string
      const toId = (fe.to_id ?? fe.toId ?? fe.target) as string
      const altWinner = (fe.alternative_winner_label ?? fe.alternativeWinnerLabel) as string | null ?? null
      list.push({
        from: nodeMap.get(fromId) ?? fromId,
        to: nodeMap.get(toId) ?? toId,
        switchProb: measured,
        altWinner,
      })
    }
    // Measured desc; unmeasured last with producer order preserved
    // (-Infinity is an ordering sentinel only — the comparator
    // plot-lite-service#294 shipped — and never renders).
    list.sort((a, b) => {
      const av = typeof a.switchProb === 'number' ? a.switchProb : Number.NEGATIVE_INFINITY
      const bv = typeof b.switchProb === 'number' ? b.switchProb : Number.NEGATIVE_INFINITY
      return bv - av
    })

    return {
      // ⛔ REMOVED (ROADMAP 2.1273): `stability`, which was
      // `Math.round(rob.recommendation_stability * 100)` and rendered below as
      // "Recommendation stability: {N}%."
      //
      // This was the most explicit instance of the defect in the product: it
      // named the withheld statistic by its own name. PLoT WITHHOLDS
      // `robustness.recommendation_stability` (`src/routes/v2/run.ts` at PLoT
      // `8bf54150`) because ISL derives it as `option_wins[winner]/n_samples` —
      // the leading option's `win_probability` RELABELLED, carrying zero
      // independent information — so this sentence asserted a distinct
      // robustness measurement that was never made.
      //
      // A null-guard was not sufficient: on a fresh run the field is absent and
      // the sentence already suppressed itself, but a HYDRATED `scenarios.analysis`
      // payload written before the withdrawal still carries the value (the V2
      // response mapper passes it through verbatim), so `typeof === 'number'`
      // was TRUE and the claim rendered for a signed-in user.
      //
      // The rest of this panel is untouched: the sensitive-assumption count and
      // the ranked fragile-edge list are producer-measured quantities with their
      // own presence branches. REINSTATEMENT TRIGGER: PLoT supplies a genuine
      // numeric robustness/stability field distinct from the win probability.
      fragileList: list,
      topFocusLabel: list.length > 0
        ? `${list[0].from} \u2192 ${list[0].to}`
        : null,
    }
  }, [report, nodes])

  return (
    <div data-testid="lens-info-robustness">
      <div data-testid="lens-info-robustness-heading" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {/* Every figure below is from the run in `results.report`. Once the
            model has changed since that run they are LAST-RUN figures, and
            they say so in the cards' own words (see the header). */}
        {lastRun ? `${LAST_RUN_PREFIX}Robustness` : 'Robustness'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-light, #6E6B6B)', lineHeight: 1.5 }}>
        {/* ⛔ The "Recommendation stability: {N}%." sentence was here (2.1273).
            See the note at the removed `stability` derivation above. */}
        Sensitive assumptions: {fragileEdgeIds.size}.
      </div>
      {/* Ranked fragile edge list */}
      {fragileList.length > 0 && (
        <div className="mt-2 space-y-1" style={{ fontSize: 11 }}>
          {fragileList.map((fe, i) => (
            <div key={i} className="flex items-center gap-1">
              {typeof fe.switchProb === 'number' ? (
                <span className="text-danger font-semibold" style={{ minWidth: 32 }}>{Math.round(fe.switchProb * 100)}%</span>
              ) : (
                // Not computed — the file's own absent-quantity mark (the
                // causal table's Std / P(exists) cells): an em dash, never a
                // number derived from the marginal quantity.
                <span style={{ minWidth: 32, color: 'var(--text-light, #6E6B6B)' }}>{'\u2014'}</span>
              )}
              <span className="text-text-body truncate" title={`${fe.from} \u2192 ${fe.to}`}>
                {fe.from} \u2192 {fe.to}
              </span>
              {fe.altWinner && (
                <span className="text-text-light ml-auto flex-shrink-0" title={lensFragileRowAlternative(fe.altWinner).title}>
                  {lensFragileRowAlternative(fe.altWinner).text}
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

/** The stale sentence's element inside the panel (see the header). */
export const LENS_INFO_STALE_TESTID = 'lens-info-stale'

/** Main panel — renders per active lens mode */
export function LensInfoPanel() {
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full') as LensMode

  const wants = lensMode === 'causal' || lensMode === 'evidence' || lensMode === 'robustness'
  // The stale cue's own predicate — never a restated rule (see the header).
  const modelChangedSinceRun = useModelChangedSinceRun()
  // ⚠ THIS PANEL'S OLD `bottom: 48; left: 12` SAT ON TOP OF THE VIEWPORT-CONTROLS
  // TOOLBAR (`fixed; left: 12; bottom: 12; z-index: 1100`, ~150px tall) — a
  // collision that was in no register row. The band's left padding clears the
  // toolbar by construction, so the panel no longer has to guess.
  const { granted, target } = useOverlayCell('bottom-left', 'lens-info-panel', wants)

  if (!wants || !granted) return null

  const body = (
    <div
      className="border border-panel-border bg-panel shadow-2 rounded-md"
      style={{
        pointerEvents: 'auto',
        padding: '10px 14px',
        maxWidth: 320,
        animation: 'thinkingModeIn 150ms cubic-bezier(0.0, 0, 0.2, 1) both',
      }}
      data-testid="lens-info-panel"
    >
      {/* The whole-graph stale sentence, carried while this panel displaces
          the foot line that normally says it. Same words, same live region. */}
      {modelChangedSinceRun && (
        <div
          data-testid={LENS_INFO_STALE_TESTID}
          role="status"
          aria-live="polite"
          style={{ fontSize: 11, color: 'var(--text-light, #6E6B6B)', lineHeight: 1.4, marginBottom: 6 }}
        >
          {ANALYSIS_STATE_CUE_COPY}
        </div>
      )}
      {lensMode === 'causal' && <CausalPanel />}
      {lensMode === 'evidence' && <EvidencePanel />}
      {lensMode === 'robustness' && <RobustnessPanel lastRun={modelChangedSinceRun} />}
    </div>
  )

  return target ? createPortal(body, target) : body
}

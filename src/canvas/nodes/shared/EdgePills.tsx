/**
 * EdgePills — small outlined pills on factor nodes pre-analysis showing each
 * connected outcome/risk: entity shape (9px) + direction (raises/lowers) +
 * strength percentage + the target's label.
 *
 * The target label is read verbatim from the payload and is never inferred,
 * derived, abbreviated, or substituted with the id. A pill is only rendered
 * when its target has a non-empty label, so we never show a bare "65%" with
 * no decode path (brief scope 1); a missing label degrades gracefully to an
 * omitted pill rather than throwing (A2). Capped at 4.
 *
 * The same rule now applies to the NUMBER: a strength is shown only when
 * something actually set it. An edge the user simply drew carries
 * `USER_EDGE_DEFAULTS.weight` (0.3) and `direction: 'positive'` — a UI default
 * and an assumed direction — which this pill used to announce as "30%" and
 * "Raises". Unset edges now read "Not set" with no arrow.
 *
 * Per spec Section 14: 0.5px border, default colour, 10px font, border-radius 10px.
 */
import { useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { NodeShapeIndicator } from '../NodeShapeIndicator'
import { computeSignedMean } from '../../domain/edges'
import { isEdgeValueSet } from '../../domain/edgeValueProvenance'
import type { NodeType } from '../../domain/nodes'

interface EdgePillsProps {
  nodeId: string
}

export function EdgePills({ nodeId }: EdgePillsProps) {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)

  const pills = useMemo(() => {
    const outbound = edges.filter(e => e.source === nodeId)
    return outbound
      .map(e => {
        const targetNode = nodes.find(n => n.id === e.target)
        if (!targetNode) return null
        const kind = (targetNode.type ?? targetNode.data?.type ?? 'factor') as NodeType
        // Only show pills for outcome and risk targets
        if (kind !== 'outcome' && kind !== 'risk') return null
        // Target label read verbatim from the payload — never inferred, derived,
        // or substituted. Absent label ⇒ omit the pill (no bare "65%").
        const rawLabel = targetNode.data?.label
        const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
        if (!label) return null
        // ⛔ Provenance gate (canvas/domain/edgeValueProvenance.ts).
        // `computeSignedMean` falls back to the edge's `weight`, which
        // `USER_EDGE_DEFAULTS`/`DEFAULT_EDGE_DATA` pin at 0.3/0.5 — so before
        // this gate a freshly drawn edge announced "30% link strength" and a
        // "Raises" direction that came from `USER_EDGE_DEFAULTS.direction`,
        // neither of which anyone had chosen. When nothing set the strength we
        // keep the pill (the shape and the target label ARE real — the user
        // drew this connection) and say so, rather than reporting a default as
        // a measurement or silently hiding the relationship.
        const edgeData = e.data as Record<string, unknown> | undefined
        if (!isEdgeValueSet(edgeData, 'weight')) {
          return { id: e.id, kind, label, direction: null, pct: null }
        }
        // Retain the sign so the pill can show direction (raises / lowers).
        const signed = computeSignedMean(edgeData)
        const strength = Math.abs(signed)
        if (strength === 0) return null
        return {
          id: e.id,
          kind,
          label,
          direction: signed >= 0 ? ('up' as const) : ('down' as const),
          pct: Math.round(strength * 100),
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      // Unset pills sort last (-1): a known strength outranks "not set", and
      // the cap of 4 should spend its slots on the numbers we actually have.
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
      .slice(0, 4)
  }, [edges, nodes, nodeId])

  if (pills.length === 0) return null

  return (
    <div className="flex gap-[3px] mt-1 flex-wrap">
      {pills.map(p => (
        <span
          key={p.id}
          className="inline-flex items-center gap-0.5 text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border-[0.5px] border-panel-border text-text-light"
        >
          {/* Direction for screen readers — the arrow glyph below is aria-hidden,
              so without this the pill would announce only the % and label.
              Uses the approved "Raises"/"Lowers" vocabulary. `sr-only` is out of
              flow, so the visible pill layout is unchanged. Omitted entirely
              when the strength is unset: the direction would come from
              `USER_EDGE_DEFAULTS.direction`, which nobody chose. */}
          {p.direction !== null && (
            <span className="sr-only">{p.direction === 'up' ? 'Raises' : 'Lowers'}</span>
          )}
          <NodeShapeIndicator nodeKind={p.kind} size={9} />
          {p.direction === 'up' && (
            <ArrowUp size={9} className="text-success shrink-0" aria-hidden="true" />
          )}
          {p.direction === 'down' && (
            <ArrowDown size={9} className="text-danger shrink-0" aria-hidden="true" />
          )}
          {/* Audit §8 P0-4: this percentage is link STRENGTH (edge weight),
              not confidence — labelled so it can't be read as the same number
              family as ConnRow's "N% conf." (beliefExists).
              P1-10: when nothing set the strength we say "Not set" instead of
              reporting the UI default. `role="img"` + aria-label so assistive
              tech announces the disclosure rather than a bare fragment. */}
          {p.pct !== null ? (
            <span title="Link strength" aria-label={`${p.pct}% link strength`}>{p.pct}%</span>
          ) : (
            <span
              className="italic"
              role="img"
              title="Link strength not set — open this connection to estimate it"
              aria-label="Link strength not set"
              data-testid={`edge-pill-strength-unset-${p.id}`}
            >
              Not set
            </span>
          )}
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  )
}

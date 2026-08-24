/**
 * InspectorRouter — resolves selected node/edge type and renders the correct panel
 * inside an InspectorShell.
 */

import { memo, useMemo, useCallback, type ComponentType } from 'react'
import { useCanvasStore } from '../../store'
import type { NodeType, FactorCategory } from '../../domain/nodes'
import { InspectorShell } from './InspectorShell'
import { ConfidenceBadge } from './shared/ConfidenceBadge'
import { TechnicalDisclosure } from './shared/TechnicalDisclosure'
import { useTechToggle } from './useTechToggle'
import { INSPECTOR_READ_ONLY_REASON } from './useInspectorMutations'
import { getTypeLabel, EDGE_TYPE_LABEL } from './inspectorStrings'
import { resolveEdgeValueDisplay } from '../../domain/edgeValueProvenance'
import type { EdgeValueSource } from '../../domain/edgeValueProvenance'

// Panel imports — lazy would be premature, these are small
import { EdgePanel } from './panels/EdgePanel'
import { OptionPanel } from './panels/OptionPanel'
import { GoalPanel } from './panels/GoalPanel'
import { FactorControllablePanel } from './panels/FactorControllablePanel'
import { DecisionPanel } from './panels/DecisionPanel'
import { FactorObservablePanel } from './panels/FactorObservablePanel'
import { FactorExternalPanel } from './panels/FactorExternalPanel'
import { OutcomePanel } from './panels/OutcomePanel'
import { RiskPanel } from './panels/RiskPanel'
import { GenericNodePanel } from './panels/GenericNodePanel'
import { InspectorQuickActions } from './shared/InspectorQuickActions'
import { resolveElementLabel } from '../../domain/elementLabel'
import { typography } from '../../../styles/typography'

// Entity colour map — used as fallback for inspector header entity colour
const TOP_BAR_COLORS: Record<string, string> = {
  goal:       'var(--goal)',
  decision:   'var(--info)',
  option:     'var(--option)',
  factor:     'var(--factor)',
  outcome:    'var(--success)',
  risk:       'var(--danger)',
  edge:       'var(--factor)',
}

// Pill border colour classes (30% opacity via hex suffix)
const PILL_COLORS: Record<string, string> = {
  goal:       'var(--goal)',
  decision:   'var(--info)',
  option:     'var(--option)',
  factor:     'var(--factor)',
  outcome:    'var(--success)',
  risk:       'var(--danger)',
}

/**
 * Every NODE panel type → its panel. TOTAL by construction: `Record` over the
 * union minus 'edge' (early-returned) and null (guarded), so adding a panel
 * type without an arm here fails the typecheck instead of silently rendering
 * nothing.
 */
const NODE_PANELS: Record<Exclude<NonNullable<PanelType>, 'edge'>, ComponentType<import('./types').InspectorPanelProps>> = {
  'goal':                 GoalPanel,
  'decision':             DecisionPanel,
  'option':               OptionPanel,
  'factor-controllable':  FactorControllablePanel,
  'factor-observable':    FactorObservablePanel,
  'factor-external':      FactorExternalPanel,
  'outcome':              OutcomePanel,
  'risk':                 RiskPanel,
  'generic':              GenericNodePanel,
}

interface InspectorRouterProps {
  nodeId: string | null
  edgeId: string | null
  onClose: () => void
  dragHandlers?: import('./types').DragHandlers
}

type PanelType =
  | 'edge'
  | 'goal'
  | 'decision'
  | 'option'
  | 'factor-controllable'
  | 'factor-observable'
  | 'factor-external'
  | 'outcome'
  | 'risk'
  /**
   * L-24 — the real fallback. This used to be `null` for `action`,
   * `constraint`, `ghost-option` and anything a future producer emits, and the
   * router then rendered NOTHING: the user selected an element and the
   * inspector silently refused to appear.
   */
  | 'generic'
  | null

function resolvePanelType(
  nodeId: string | null,
  edgeId: string | null,
  nodes: { id: string; type?: string; data?: Record<string, unknown> }[],
): PanelType {
  if (edgeId) return 'edge'
  if (!nodeId) return null

  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const type = ((node.type || node.data?.kind || 'decision') as string) as NodeType

  if (type === 'factor') {
    const category = node.data?.category as FactorCategory | undefined
    switch (category) {
      case 'controllable': return 'factor-controllable'
      case 'observable':   return 'factor-observable'
      case 'external':     return 'factor-external'
      default:             return 'factor-controllable'
    }
  }

  switch (type) {
    case 'goal':       return 'goal'
    case 'decision':   return 'decision'
    case 'option':     return 'option'
    case 'outcome':    return 'outcome'
    case 'risk':       return 'risk'
    // L-24 — every OTHER resolvable node gets a panel. `null` above is
    // reserved for "there is no node", which is the only honest silence.
    default:           return 'generic'
  }
}

/** Node kinds NodeShapeIndicator has a shape for. */
const SHAPED_KINDS = new Set<string>([
  'goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action', 'constraint',
])

export const InspectorRouter = memo(function InspectorRouter({
  nodeId,
  edgeId,
  onClose,
  dragHandlers,
}: InspectorRouterProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { techMode, setTechMode } = useTechToggle()

  const panelType = useMemo(
    () => resolvePanelType(nodeId, edgeId, nodes as { id: string; type?: string; data?: Record<string, unknown> }[]),
    [nodeId, edgeId, nodes],
  )

  // Navigate to another node (e.g., clicking a ConnectionRow)
  const handleNavigate = useCallback((id: string) => {
    const store = useCanvasStore.getState()
    // Check if it's a node or edge
    const isNode = store.nodes.some(n => n.id === id)
    if (isNode) {
      store.selectNodeWithoutHistory?.(id)
    }
  }, [])

  if (!panelType) return null

  // ─── Edge panel ────────────────────────────────────────────────
  if (panelType === 'edge' && edgeId) {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return null

    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    const sourceLabel = resolveElementLabel(sourceNode?.data)
    const targetLabel = resolveElementLabel(targetNode?.data)
    const edgeLabel = `${sourceLabel} \u2192 ${targetLabel}`

    // Edge confidence from beliefExists — PROVENANCE-GATED.
    // `getEdgeConfidence` returns the raw field, which is `0.8` on any edge the
    // user merely drew. Rendering that as a "high · 80%" badge presents a UI
    // default as a measurement.
    const epDisplay = resolveEdgeValueDisplay(edge.data as Record<string, unknown> | undefined, 'beliefExists')
    const ep = epDisplay.show ? epDisplay.value : null
    const edgeConfidenceLevel = ep !== null ? (ep >= 0.7 ? 'high' as const : ep >= 0.4 ? 'medium' as const : 'low' as const) : undefined
    const confidencePct = ep !== null ? Math.round(ep * 100) : undefined

    // Top bar inherits source node type colour
    const sourceKind = (sourceNode?.type || sourceNode?.data?.kind || 'factor') as NodeType

    return (
      <InspectorShell
        topBarColor={TOP_BAR_COLORS[sourceKind] ?? TOP_BAR_COLORS.factor}
        label={edgeLabel}
        typePill={EDGE_TYPE_LABEL}
        typePillColor={PILL_COLORS[sourceKind]}
        confidenceBadge={
          edgeConfidenceLevel ? (
            <ConfidenceBadge level={edgeConfidenceLevel} value={confidencePct} />
          ) : undefined
        }
        confidenceLevel={edgeConfidenceLevel}
        techMode={techMode}
        onTechToggleChange={setTechMode}
        onClose={onClose}
        dragHandlers={dragHandlers}
        quickActions={
          <InspectorQuickActions
            elementId={edgeId}
            elementLabel={edgeLabel}
            panelType="edge"
            labelContext={{ sourceLabel, targetLabel }}
          />
        }
      >
        <div
          id="inspector-authority-notice"
          role="note"
          data-testid="inspector-authority-notice"
          className={`rounded border border-panel-border bg-panel-hover px-3 py-2 ${typography.panelBody} text-text-body`}
        >
          {INSPECTOR_READ_ONLY_REASON}
        </div>
        <fieldset
          disabled
          aria-describedby="inspector-authority-notice"
          data-authority="disabled"
          className="contents"
        >
          <EdgePanel
            edgeId={edgeId}
            techMode={techMode}
            onClose={onClose}
            onNavigate={handleNavigate}
          />
        </fieldset>
      </InspectorShell>
    )
  }

  // ─── Node panels ───────────────────────────────────────────────
  if (!nodeId) return null
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const nodeType = (node.type || node.data?.kind || 'decision') as NodeType
  const category = node.data?.category as FactorCategory | undefined
  const rawLabel = String(node.data?.label ?? 'Untitled')
  // Truncate normalised range notation like "(0-1, share of £..." from display
  const label = /\(0[-–]1/.test(rawLabel) ? rawLabel.split(/\(0[-–]1/)[0].trim() : rawLabel
  const topColor = TOP_BAR_COLORS[nodeType] ?? TOP_BAR_COLORS.factor
  const pillColor = PILL_COLORS[nodeType]
  const typePill = getTypeLabel(nodeType, category)

  // Confidence badge — only for specific node types
  let confidenceBadge: React.ReactNode | undefined
  let nodeConfidenceLevel: 'high' | 'medium' | 'low' | undefined
  if (nodeType === 'goal' || nodeType === 'outcome' || nodeType === 'risk') {
    // Derive from inbound edge confidence average
    const inboundEdges = edges.filter(e => e.target === nodeId)
    if (inboundEdges.length > 0) {
      // PROVENANCE-GATED, and this one is worse than the edge case: an
      // AVERAGE reads as far more evidentiary than a single field. On a freshly
      // drawn graph every inbound edge returned the same `0.8`, so the goal
      // node showed "high · 80%" — a synthetic aggregate of a constant.
      // Unset edges are EXCLUDED from the mean rather than counted as 0.8; when
      // none of the inbound edges was characterised there is no badge at all.
      const confidences = inboundEdges
        .map(e => resolveEdgeValueDisplay(e.data as Record<string, unknown> | undefined, 'beliefExists'))
        .filter((d): d is { show: true; value: number; source: EdgeValueSource } => d.show)
        .map(d => d.value)
      if (confidences.length > 0) {
        const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
        const level = (avg >= 0.7 ? 'high' : avg >= 0.4 ? 'medium' : 'low') as const
        nodeConfidenceLevel = level
        confidenceBadge = <ConfidenceBadge level={level} value={Math.round(avg * 100)} />
      }
    }
  }

  const panelProps = {
    nodeId,
    techMode,
    onClose,
    onNavigate: handleNavigate,
  }

  // Typed as a TOTAL map over every NODE panel type (edge is handled by the
  // early return above, null by the guard at the top). Before this it was an
  // untyped object literal indexed by the full union, so `panelType` could be
  // 'edge' at the lookup and TypeScript reported TS2339 on the missing key —
  // a real hole, not noise: a panel type added to the union but forgotten here
  // would have resolved to `undefined` and rendered nothing, which is exactly
  // the L-24 defect this PR is closing. Now a missing arm is a TYPE ERROR.
  const PanelComponent = panelType === 'edge' ? null : NODE_PANELS[panelType]

  if (!PanelComponent) return null

  return (
    <InspectorShell
      topBarColor={topColor}
      /* A kind with no shape (e.g. `ghost-option`) falls through to the shell's
         generic icon rather than rendering a shape that means something else. */
      nodeKind={SHAPED_KINDS.has(nodeType) ? nodeType : undefined}
      nodeId={nodeId}
      label={label}
      typePill={typePill}
      typePillColor={pillColor}
      confidenceBadge={confidenceBadge}
      confidenceLevel={nodeConfidenceLevel}
      techMode={techMode}
      onTechToggleChange={setTechMode}
      onClose={onClose}
      dragHandlers={dragHandlers}
      quickActions={
        <InspectorQuickActions
          elementId={nodeId}
          elementLabel={label}
          panelType={panelType}
        />
      }
    >
      {/* Full raw label in disclosure only when truncated */}
      {rawLabel !== label && (
        <TechnicalDisclosure visible={techMode}>
          <div>System: raw_label: {rawLabel}</div>
        </TechnicalDisclosure>
      )}
      <div
        id="inspector-authority-notice"
        role="note"
        data-testid="inspector-authority-notice"
        className={`rounded border border-panel-border bg-panel-hover px-3 py-2 ${typography.panelBody} text-text-body`}
      >
        {INSPECTOR_READ_ONLY_REASON}
      </div>
      <fieldset
        disabled
        aria-describedby="inspector-authority-notice"
        data-authority="disabled"
        className="contents"
      >
        <PanelComponent {...panelProps} />
      </fieldset>
    </InspectorShell>
  )
})

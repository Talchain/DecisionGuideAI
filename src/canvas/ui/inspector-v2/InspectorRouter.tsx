/**
 * InspectorRouter — resolves selected node/edge type and renders the correct panel
 * inside an InspectorShell.
 */

import { memo, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../store'
import type { NodeType, FactorCategory } from '../../domain/nodes'
import { InspectorShell } from './InspectorShell'
import { ConfidenceBadge } from './shared/ConfidenceBadge'
import { TechnicalDisclosure } from './shared/TechnicalDisclosure'
import { useTechToggle } from './useTechToggle'
import { useNodeMutations } from './useInspectorMutations'
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
    default:           return null
  }
}

export const InspectorRouter = memo(function InspectorRouter({
  nodeId,
  edgeId,
  onClose,
  dragHandlers,
}: InspectorRouterProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { techMode, setTechMode } = useTechToggle()
  const nodeMutations = useNodeMutations(nodeId ?? '')

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
    const sourceLabel = String(sourceNode?.data?.label ?? edge.source)
    const targetLabel = String(targetNode?.data?.label ?? edge.target)
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
      >
        <EdgePanel
          edgeId={edgeId}
          techMode={techMode}
          onClose={onClose}
          onNavigate={handleNavigate}
        />
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

  const PanelComponent = {
    'goal':                 GoalPanel,
    'decision':             DecisionPanel,
    'option':               OptionPanel,
    'factor-controllable':  FactorControllablePanel,
    'factor-observable':    FactorObservablePanel,
    'factor-external':      FactorExternalPanel,
    'outcome':              OutcomePanel,
    'risk':                 RiskPanel,
  }[panelType]

  if (!PanelComponent) return null

  return (
    <InspectorShell
      topBarColor={topColor}
      nodeKind={nodeType}
      nodeId={nodeId}
      label={label}
      onLabelChange={nodeMutations.setLabel}
      typePill={typePill}
      typePillColor={pillColor}
      confidenceBadge={confidenceBadge}
      confidenceLevel={nodeConfidenceLevel}
      techMode={techMode}
      onTechToggleChange={setTechMode}
      onClose={onClose}
      dragHandlers={dragHandlers}
    >
      {/* Full raw label in disclosure only when truncated */}
      {rawLabel !== label && (
        <TechnicalDisclosure visible={techMode}>
          <div>System: raw_label: {rawLabel}</div>
        </TechnicalDisclosure>
      )}
      <PanelComponent {...panelProps} />
    </InspectorShell>
  )
})

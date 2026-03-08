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
import { getEdgeConfidence } from '../../domain/edges'

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

// Entity colour map for the 3px top bar
const TOP_BAR_COLORS: Record<string, string> = {
  goal:       'var(--color-goal,    #F5C433)',
  decision:   'var(--color-info,    #63ADCF)',
  option:     'var(--color-option,  #AAA7E4)',
  factor:     'var(--color-factor,  #B0A899)',
  outcome:    'var(--color-success, #67C89E)',
  risk:       'var(--color-danger,  #EA7B4B)',
  edge:       'var(--color-factor,  #B0A899)',
}

// Pill border colour classes (30% opacity via hex suffix)
const PILL_COLORS: Record<string, string> = {
  goal:       'var(--color-goal,    #F5C433)',
  decision:   'var(--color-info,    #63ADCF)',
  option:     'var(--color-option,  #AAA7E4)',
  factor:     'var(--color-factor,  #B0A899)',
  outcome:    'var(--color-success, #67C89E)',
  risk:       'var(--color-danger,  #EA7B4B)',
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

    // Edge confidence from beliefExists
    const ep = getEdgeConfidence(edge.data as Record<string, unknown> | undefined)
    const confidenceLevel = ep !== null ? (ep >= 0.7 ? 'high' : ep >= 0.4 ? 'medium' : 'low') : undefined
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
          confidenceLevel ? (
            <ConfidenceBadge level={confidenceLevel} value={confidencePct} />
          ) : undefined
        }
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
  if (nodeType === 'goal' || nodeType === 'outcome' || nodeType === 'risk') {
    // Derive from inbound edge confidence average
    const inboundEdges = edges.filter(e => e.target === nodeId)
    if (inboundEdges.length > 0) {
      const confidences = inboundEdges
        .map(e => getEdgeConfidence(e.data as Record<string, unknown> | undefined))
        .filter((v): v is number => v !== null)
      if (confidences.length > 0) {
        const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
        const level = avg >= 0.7 ? 'high' : avg >= 0.4 ? 'medium' : 'low'
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
      label={label}
      onLabelChange={nodeMutations.setLabel}
      typePill={typePill}
      typePillColor={pillColor}
      confidenceBadge={confidenceBadge}
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

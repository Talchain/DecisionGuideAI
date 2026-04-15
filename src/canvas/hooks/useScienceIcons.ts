/**
 * useScienceIcons — returns up to 2 applicable science guidance icons for a node.
 *
 * Implements spec Section 4.1 (8 PoC-ready triggers).
 * Priority order per spec Section 3.5: lower priority number = higher visual priority.
 * Max 2 icons returned, sorted by priority.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useNodeDisplayMetadata } from './useNodeDisplayMetadata'
import {
  FileQuestion, Sparkles, Unlink, Frame, ShieldAlert, EyeOff, Anchor, Gauge,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { NodeType } from '../domain/nodes'
import { computeSignedMean } from '../domain/edges'
import { unwrapInterventionValue } from '../utils/labelUtils'

export interface ScienceIconDef {
  id: string
  icon: ComponentType<{ size?: number; className?: string }>
  tooltip: string
  action: string
  colour: string
  priority: number
}

const MAX_ICONS = 2

export function useScienceIcons(nodeId: string, nodeType: NodeType): ScienceIconDef[] {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const displayMetadata = useNodeDisplayMetadata(nodeId, nodeType)

  return useMemo(() => {
    const icons: ScienceIconDef[] = []
    const nodeData = nodes.find(n => n.id === nodeId)?.data as Record<string, unknown> | undefined
    if (!nodeData) return icons

    const label = (nodeData.label as string) ?? ''
    const observedState = nodeData.observedState as Record<string, unknown> | undefined
    const category = nodeData.category as string | undefined
    const extractionType = observedState?.extractionType as string | undefined
    const value = observedState?.value as number | undefined
    const prior = nodeData.prior as { range_min?: number; range_max?: number } | undefined
    const uncertaintyDrivers = observedState?.uncertainty_drivers as string[] | undefined

    // --- Factor-specific triggers ---
    if (nodeType === 'factor') {
      // 1. Evidence gap: factor value null, no prior
      if (value == null && !(prior?.range_min != null && prior?.range_max != null)) {
        icons.push({
          id: 'evidence-gap',
          icon: FileQuestion,
          tooltip: 'No evidence for this factor. Analysis will use defaults.',
          action: `Help me estimate ${label}`,
          colour: 'text-warning',
          priority: 1,
        })
      }

      // 2. Olumi estimate
      if (extractionType === 'inferred') {
        icons.push({
          id: 'olumi-estimate',
          icon: Sparkles,
          tooltip: 'Olumi estimated this value. May not match reality.',
          action: `Confirm or adjust the value for ${label}`,
          colour: 'text-text-light',
          priority: 3,
        })
      }

      // 7. Anchoring: intervention spread < 20% baseline
      if (ceeAnalysisReady?.options && ceeAnalysisReady.options.length >= 3) {
        const vals: number[] = []
        for (const opt of ceeAnalysisReady.options) {
          const interventions = opt.interventions as Record<string, unknown> | undefined
          if (!interventions) continue
          // Use the shared helper so the unwrap is consistent with display
          // paths and never coerces null/string into a fake 0 (which would
          // pollute the spread calculation and falsely trigger anchoring).
          const { value: v } = unwrapInterventionValue(interventions[nodeId])
          if (v != null) vals.push(v)
        }
        if (vals.length >= 3) {
          const baseline = (value ?? vals[0]) || 0.01
          const spread = Math.max(...vals) - Math.min(...vals)
          if (spread / Math.max(Math.abs(baseline), 0.01) < 0.2) {
            icons.push({
              id: 'anchoring',
              icon: Anchor,
              tooltip: 'Options clustered around current value.',
              action: `Consider a wider range for ${label}`,
              colour: 'text-warning',
              priority: 7,
            })
          }
        }
      }

      // 8. Overconfidence: top-ranked factor, inferred, no uncertainty_drivers
      const rank = displayMetadata.sensitivityRank
      if ((rank === 1 || rank === 2) && extractionType === 'inferred' && (!uncertaintyDrivers || uncertaintyDrivers.length === 0)) {
        icons.push({
          id: 'overconfidence',
          icon: Gauge,
          tooltip: 'High-leverage assumption with no supporting evidence.',
          action: `What evidence supports ${label}?`,
          colour: 'text-warning',
          priority: 4,
        })
      }
    }

    // --- Node-level triggers (any node type with edges) ---
    // 3. Weak connection: any connected edge exists_probability < 0.7
    const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId)
    const hasWeakEdge = connectedEdges.some(e => {
      const ep = (e.data as any)?.exists_probability ?? (e.data as any)?.beliefExists
      return typeof ep === 'number' && ep < 0.7
    })
    if (hasWeakEdge && nodeType !== 'decision' && nodeType !== 'goal') {
      const weakEdge = connectedEdges.find(e => {
        const ep = (e.data as any)?.exists_probability ?? (e.data as any)?.beliefExists
        return typeof ep === 'number' && ep < 0.7
      })
      const ep = weakEdge ? ((weakEdge.data as any)?.exists_probability ?? (weakEdge.data as any)?.beliefExists) : null
      const pctText = typeof ep === 'number' ? `${Math.round(ep * 100)}% confidence.` : ''
      icons.push({
        id: 'weak-connection',
        icon: Unlink,
        tooltip: `This relationship is uncertain. ${pctText}`,
        action: `What evidence supports the connection involving ${label}?`,
        colour: 'text-warning',
        priority: 5,
      })
    }

    // --- Decision-node-only triggers ---
    if (nodeType === 'decision') {
      // 4. Narrow framing: < 3 options
      const optionCount = nodes.filter(n => n.type === 'option' || n.data?.type === 'option').length
      if (optionCount < 3) {
        icons.push({
          id: 'narrow-framing',
          icon: Frame,
          tooltip: 'Few options considered. Better decisions come from more alternatives.',
          action: 'Suggest more options for this decision',
          colour: 'text-warning',
          priority: 2,
        })
      }

      // 5. Missing risks: <= 1 risk nodes
      const riskCount = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk').length
      if (riskCount <= 1) {
        icons.push({
          id: 'missing-risks',
          icon: ShieldAlert,
          tooltip: 'Few risks modelled. What else could go wrong?',
          action: 'What could go wrong with this decision?',
          colour: 'text-warning',
          priority: 2,
        })
      }
    }

    // --- Option-only triggers ---
    if (nodeType === 'option') {
      // 6. Status quo bias
      const isBaseline = (nodeData as any)?.is_baseline === true
      if (isBaseline) {
        icons.push({
          id: 'status-quo-bias',
          icon: EyeOff,
          tooltip: 'Status quo bias: inaction risks often underestimated.',
          action: 'What could go wrong with doing nothing?',
          colour: 'text-warning',
          priority: 6,
        })
      }
    }

    // Sort by priority, take max 2
    icons.sort((a, b) => a.priority - b.priority)
    return icons.slice(0, MAX_ICONS)
  }, [nodeId, nodeType, nodes, edges, ceeAnalysisReady, displayMetadata.sensitivityRank])
}

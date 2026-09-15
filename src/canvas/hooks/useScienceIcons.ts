/**
 * ⚠ THESE TOOLTIPS STATE WHAT WAS OBSERVED. THEY DO NOT PREDICT OR ADVISE.
 *
 * Founder's rule, 15 Sep 2026: the UI renders the data; it does not decide what
 * the data means. Four of these said more than this hook can know, and the
 * strings were authored here from local rules — there is no producer stamp
 * behind any of them.
 *
 *   "Analysis will use defaults"              → a claim about the ENGINE
 *   "Better decisions come from more alternatives" → a claim about DECISIONS IN GENERAL
 *   "inaction risks often underestimated"     → a claim about PEOPLE in general
 *   "High-leverage assumption"                → leverage is a computed judgement
 *
 * Each is now the observation that prompted it, and nothing more.
 *
 * ⭐ THE `action` STRINGS ARE UNTOUCHED, AND THEY ARE THE VALUABLE HALF.
 * "What evidence supports X?" hands the question back to the reader and reaches
 * a real AI turn through `ScienceIcon`'s discuss button. That is the
 * science-grounded move; the tooltip was only ever the label on the door.
 */
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
  FileQuestion, Unlink, Frame, ShieldAlert, Anchor, Gauge,
} from 'lucide-react'
import { biasSignal } from '../shared/biasSignalTitles'
import type { ComponentType } from 'react'
import type { NodeType } from '../domain/nodes'
// `computeSignedMean` was imported here with ZERO call sites (verified at the
// bytes, ROADMAP 2.954) — removed rather than left as an invitation to wire a
// fourth raw-signed channel (#629's `getStrengthDescription` precedent).
import { unwrapInterventionValue } from '../utils/labelUtils'
import { useGuidanceStore } from '../stores/guidanceStore'

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
  /**
   * ⭐⭐ ONE VOICE PER NODE — the producer's, when it has one.
   *
   * Two coaching systems were marking the same cards. `NodeCoachingMarker`
   * (BaseNode.tsx:1290) renders the producer's own `guidance_items`, which
   * arrive on the turn envelope carrying a DSK claim id and a protocol — real,
   * attributable decision science. This hook derives its signals from the shape
   * of the graph in the browser: options clustered near a value, a factor with
   * no evidence, few risks modelled.
   *
   * Both are useful. Both on one node is the product talking over itself, and
   * when they disagree the reader has no way to tell which one to believe — two
   * internally-consistent authorities, the defect this estate keeps paying for.
   *
   * So the producer wins by precedence, decided here rather than at five call
   * sites. ⛔ NOT by deleting this hook: when the producer says nothing about a
   * node — and it says nothing about most of them — these observations are the
   * only thing the reader gets, and they are true. It degrades correctly in
   * both directions, which is why this does not depend on settling how often
   * the guidance channel actually fires.
   */
  const producerNamesThisNode = useGuidanceStore((s) =>
    s.guidanceItems.some((i) => i.target_object?.id === nodeId),
  )

  return useMemo(() => {
    const icons: ScienceIconDef[] = []
    if (producerNamesThisNode) return icons
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
          tooltip: 'No observed data for this factor.',
          action: `Help me estimate ${label}`,
          colour: 'text-warning',
          priority: 1,
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
          tooltip: 'No supporting evidence recorded for this assumption.',
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
          tooltip: 'Few options modelled.',
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
        // BOTH channels — name AND icon — from the one registry entry, so
        // the icon can no longer drift from the title it sits beside
        // (review-folds C15; /simplify item 3). Rendered output is
        // byte-identical to the old literals.
        // ⚠ `is_baseline` is the producer's field and naming it is fair. Calling
        // the reader BIASED is not: the tooltip read "Status quo bias is
        // modelled as doing nothing", which diagnoses a person from a flag on
        // an option. The icon and the registry entry stay; the sentence states
        // the fact instead.
        const statusQuo = biasSignal('status_quo_bias')
        icons.push({
          id: 'status-quo-bias',
          icon: statusQuo.icon,
          tooltip: 'The baseline option — modelled as doing nothing.',
          action: 'What could go wrong with staying on the baseline?',
          colour: 'text-warning',
          priority: 6,
        })
      }
    }

    // Sort by priority, take max 2
    icons.sort((a, b) => a.priority - b.priority)
    return icons.slice(0, MAX_ICONS)
  }, [nodeId, nodeType, nodes, edges, ceeAnalysisReady, displayMetadata.sensitivityRank, producerNamesThisNode])
}

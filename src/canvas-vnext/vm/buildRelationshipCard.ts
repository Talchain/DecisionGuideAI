// Relationship card + edge visual builders (UI-SEM-074 why-it-matters gate,
// UI-SEM-075 edge encoding). Pure functions — no React, no store imports.

import { computeSignedMean, getEdgeConfidence } from '../../canvas/domain/edges'
import { isEdgeFragile, getFragileEdgeSwitchProbability, type FragileEdgeCandidate } from '../../canvas/utils/fragileEdgeMatch'
import {
  getStrengthLabel,
  getConfidenceWord,
  relationshipSentence,
  WHY_FRAGILE,
  WHY_FEEDS_LEADER,
  ACTION_LABELS,
  EDIT_DISABLED_HINT,
  CHALLENGE_DISABLED_HINT,
} from './strings'
import { strengthBandWidth, polarityFromSignedMean, polarityColor, existenceDashArray } from '../edges/edgeEncoding'
import type { AnalysisContextVM, EdgeVisualVM, RelationshipCardVM, RelationshipAction } from './types'

interface MinimalEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown> | undefined
}

interface MinimalNode {
  id: string
  type?: string
  data?: Record<string, unknown> | undefined
}

function labelOf(nodesById: Map<string, MinimalNode>, id: string): string {
  const n = nodesById.get(id)
  const label = n?.data?.label
  return typeof label === 'string' && label ? label : id
}

function kindOf(nodesById: Map<string, MinimalNode>, id: string): string | undefined {
  const n = nodesById.get(id)
  return n?.type || (n?.data?.kind as string | undefined)
}

/**
 * Structural (non-causal) edge detection — mirrors StyledEdge.tsx (lines
 * 410-446): explicit data.edge_type 'structural' wins; any OTHER explicit
 * edge_type disables inference; otherwise decision→option and option→factor
 * are structural by node kind.
 */
export function detectStructural(
  edge: MinimalEdge,
  nodesById: Map<string, MinimalNode>,
): { isStructural: boolean; description: string | null } {
  const explicit = edge.data?.edge_type as string | undefined
  const srcKind = kindOf(nodesById, edge.source)
  const tgtKind = kindOf(nodesById, edge.target)
  const describe = (): string => {
    if (srcKind === 'decision' && tgtKind === 'option') return 'Option of this decision'
    if (srcKind === 'option' && tgtKind === 'factor') return 'This option affects this factor'
    return 'Structural link (not analysed)'
  }
  if (explicit === 'structural') return { isStructural: true, description: describe() }
  if (explicit != null && explicit !== '') return { isStructural: false, description: null }
  if ((srcKind === 'decision' && tgtKind === 'option') || (srcKind === 'option' && tgtKind === 'factor')) {
    return { isStructural: true, description: describe() }
  }
  return { isStructural: false, description: null }
}

export function buildEdgeVisual(
  edge: MinimalEdge,
  nodesById: Map<string, MinimalNode>,
  fragileEdges: FragileEdgeCandidate[],
  analysis: AnalysisContextVM,
): EdgeVisualVM {
  const { isStructural } = detectStructural(edge, nodesById)
  if (isStructural) {
    return {
      edgeId: edge.id,
      isStructural: true,
      signedMean: 0,
      polarity: 'unknown',
      strengthLabel: null,
      strokeWidth: 1,
      strokeColor: 'var(--text-light)',
      dashArray: undefined,
      isFragile: false,
      fragileSwitchProbability: null,
    }
  }

  const signedMean = computeSignedMean(edge.data)
  const polarity = polarityFromSignedMean(signedMean)
  const beliefExists = getEdgeConfidence(edge.data)

  // Fragility only exists when a report exists (fresh or stale; stale renders
  // dimmed with the from-a-previous-run treatment — UI-SEM-076).
  const fragile = analysis.hasResults && isEdgeFragile(edge.id, edge.source, edge.target, fragileEdges)
  const switchProb = fragile
    ? getFragileEdgeSwitchProbability(edge.id, edge.source, edge.target, fragileEdges)
    : null

  return {
    edgeId: edge.id,
    isStructural: false,
    signedMean,
    polarity,
    strengthLabel: getStrengthLabel(Math.abs(signedMean)),
    strokeWidth: strengthBandWidth(Math.abs(signedMean)),
    strokeColor: polarityColor(polarity),
    dashArray: existenceDashArray(beliefExists),
    isFragile: fragile,
    fragileSwitchProbability: typeof switchProb === 'number' ? switchProb : null,
  }
}

export interface RelationshipCardInputs {
  edge: MinimalEdge
  nodesById: Map<string, MinimalNode>
  fragileEdges: FragileEdgeCandidate[]
  analysis: AnalysisContextVM
  /** Whether guidanceStore._prefillChat is currently registered. */
  prefillChatAvailable: boolean
}

export function buildRelationshipCard(inputs: RelationshipCardInputs): RelationshipCardVM {
  const { edge, nodesById, fragileEdges, analysis, prefillChatAvailable } = inputs

  const structural = detectStructural(edge, nodesById)
  if (structural.isStructural) {
    return {
      edgeId: edge.id,
      isStructural: true,
      sentence: structural.description ?? 'Structural link (not analysed)',
      strengthLabel: null,
      strengthValue: null,
      confidenceLabel: null,
      confidenceValue: null,
      whyItMatters: null,
      whyIsResultDerived: false,
      whyDetailPct: null,
      evidence: [],
      actions: [
        { kind: 'focus', label: ACTION_LABELS.focus, availability: 'wired' },
        { kind: 'edit', label: ACTION_LABELS.edit, availability: 'disabled', disabledHint: EDIT_DISABLED_HINT },
      ],
      challengePrompt: null,
      isStaleResult: false,
    }
  }

  const signedMean = computeSignedMean(edge.data)
  const beliefExists = getEdgeConfidence(edge.data)
  const sourceLabel = labelOf(nodesById, edge.source)
  const targetLabel = labelOf(nodesById, edge.target)

  // Why-it-matters: REAL signals only (UI-SEM-074) — a fragile-edge match or
  // an endpoint on the fail-closed resolved leading option. Anything else ⇒
  // the block is omitted entirely; no filler coaching.
  let whyItMatters: string | null = null
  let whyIsResultDerived = false
  let whyDetailPct: number | null = null
  if (analysis.hasResults && isEdgeFragile(edge.id, edge.source, edge.target, fragileEdges)) {
    whyItMatters = WHY_FRAGILE
    whyIsResultDerived = true
    const switchProb = getFragileEdgeSwitchProbability(edge.id, edge.source, edge.target, fragileEdges)
    whyDetailPct = typeof switchProb === 'number' ? Math.round(switchProb * 100) : null
  } else if (
    analysis.leadingOptionId != null &&
    (edge.source === analysis.leadingOptionId || edge.target === analysis.leadingOptionId)
  ) {
    whyItMatters = WHY_FEEDS_LEADER
    whyIsResultDerived = true
  }

  const rawClaims = edge.data?.causal_claims
  const evidence = Array.isArray(rawClaims)
    ? rawClaims
        .filter((c: any) => typeof c?.statement === 'string' && c.statement)
        .map((c: any) => ({ statement: c.statement as string, source: typeof c.source === 'string' ? c.source : undefined }))
    : []

  const actions: RelationshipAction[] = [
    { kind: 'focus', label: ACTION_LABELS.focus, availability: 'wired' },
    {
      kind: 'evidence',
      label: ACTION_LABELS.evidence,
      availability: evidence.length > 0 ? 'wired' : 'disabled',
      disabledHint: evidence.length > 0 ? undefined : 'No evidence attached yet',
    },
    {
      kind: 'challenge',
      label: ACTION_LABELS.challenge,
      availability: prefillChatAvailable ? 'wired' : 'disabled',
      disabledHint: prefillChatAvailable ? undefined : CHALLENGE_DISABLED_HINT,
    },
    { kind: 'edit', label: ACTION_LABELS.edit, availability: 'disabled', disabledHint: EDIT_DISABLED_HINT },
  ]

  return {
    edgeId: edge.id,
    isStructural: false,
    sentence: relationshipSentence(sourceLabel, targetLabel, signedMean),
    strengthLabel: getStrengthLabel(Math.abs(signedMean)),
    strengthValue: signedMean,
    confidenceLabel: typeof beliefExists === 'number' ? getConfidenceWord(beliefExists) : null,
    confidenceValue: typeof beliefExists === 'number' ? beliefExists : null,
    whyItMatters,
    whyIsResultDerived,
    whyDetailPct,
    evidence,
    actions,
    challengePrompt: `What if the link between "${sourceLabel}" and "${targetLabel}" is wrong?`,
    isStaleResult: analysis.isStaleResult,
  }
}

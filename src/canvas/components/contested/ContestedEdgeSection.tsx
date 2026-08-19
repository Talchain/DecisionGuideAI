/**
 * ContestedEdgeSection — the contested-edge ADJUDICATION VERTICAL, rehomed.
 *
 * ── WHY THIS FILE EXISTS (Milestone B, domain 11) ───────────────────────────
 * This vertical is the one piece of the Model tab that had no home outside the
 * v1 section stack: it was rendered from INSIDE `model-tab/RelationshipsSection`
 * (846 LOC, slated for cut), so cutting that stack would have taken the product's
 * only way to settle a disagreement between the two validator passes with it.
 * Paul's ruling for this milestone is REHOME → DELETE, never capability
 * destruction, so the vertical moves out FIRST and the section stack's fate is
 * decided separately.
 *
 * It now renders as a sibling of the canonical Model Editor, hosted directly by
 * `ModelTabBody`. Nothing about the user's controls changed — the same ten
 * affordances on the same card, with the same testids, so a user's muscle memory
 * and every existing behavioural spec still bind.
 *
 * ── ⚠ WHY NOT INSIDE `model-tab-v2/` ────────────────────────────────────────
 * That was the obvious target and it is CLOSED, deliberately. The v2 directory's
 * boundary guard (`modelTabV2Boundary.sourceScan.spec.ts`) bans, for every file
 * including the mount host: any import that resolves to a store module, any
 * `getState(`/`setState(` call, and any foreign hook beyond the one authority
 * seam. `ContestedEdgeCard` reads `useCanvasStore` for edge-highlight arbitration,
 * so moving it there would have RED-ed three separate guards.
 *
 * That is not an obstacle to route around — it is the guard working. The v2
 * surface's whole premise is that every write goes through one authority, and
 * this vertical deliberately does NOT: `ModelTabBody::handleResolveContested`
 * writes edge `validation` directly, because no sanctioned setter writes that
 * field and because `accepted_pass2` must stamp the PRODUCER's marker (`'cee'`)
 * rather than the `'user'` that `useEdgeMutations.setStrength` hard-codes.
 * Laundering a producer's number as a user's is the exact defect class the v2
 * boundary exists to prevent. So the vertical sits BESIDE that surface rather
 * than inside it, and its honest deviation stays visible instead of being
 * dressed as compliance.
 *
 * ── WHAT STAYED WITH THE HOST ───────────────────────────────────────────────
 * The resolve handler itself. `buildEdgeAdjudicationEvent` — the sole emitter of
 * the `edge_adjudication` wire event — must keep EXACTLY ONE production caller,
 * and it does: `ModelTabBody.tsx`. This component takes the handler as a prop and
 * emits nothing itself.
 */

import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { typography } from '../../../styles/typography'
import { getDisplayEdgeId } from '../../utils/edgeIdentity'
import type { ValidationMetadata, UserAction } from '../../domain/validation'
import type { EdgeValueSource } from '../../domain/edgeValueProvenance'
import { DetailToggleContext } from '../model-tab/DetailToggleContext'
import { ContestedEdgeCard } from './ContestedEdgeCard'

// ── Contested priority comparator ────────────────────────────────────────────

/**
 * Sort contested edges by priority for the full-audit list:
 *   - Post-analysis (both edges have evoi_rank set): evoi_impact desc
 *   - Pre-analysis: max_divergence desc → distance_to_goal asc → needs_user_input
 *
 * MOVED VERBATIM from `model-tab/RelationshipsSection.tsx`, where it was a
 * private function. There is NO one-per-target cap on this surface — every
 * pending contested edge is rendered as a fully actionable card. The cap is
 * appropriate only for the pre-analysis panel (which has a fixed budget) and
 * lives in `usePreAnalysisData` there.
 */
export function compareContestedPriority(a: Edge, b: Edge): number {
  const aVm = (a.data as Record<string, unknown>)?.validation as ValidationMetadata | undefined
  const bVm = (b.data as Record<string, unknown>)?.validation as ValidationMetadata | undefined
  if (!aVm || !bVm) return 0

  const aPostAnalysis = aVm.evoi_rank !== null && aVm.evoi_rank !== undefined
  const bPostAnalysis = bVm.evoi_rank !== null && bVm.evoi_rank !== undefined
  if (aPostAnalysis && bPostAnalysis) {
    const aImpact = aVm.evoi_impact ?? -Infinity
    const bImpact = bVm.evoi_impact ?? -Infinity
    if (aImpact !== bImpact) return bImpact - aImpact
  }
  if (aVm.max_divergence !== bVm.max_divergence) {
    return bVm.max_divergence - aVm.max_divergence
  }
  if (aVm.distance_to_goal !== bVm.distance_to_goal) {
    return aVm.distance_to_goal - bVm.distance_to_goal
  }
  const aNui = aVm.pass2.needs_user_input ? 1 : 0
  const bNui = bVm.pass2.needs_user_input ? 1 : 0
  return bNui - aNui
}

/**
 * A pending contested edge: the two passes disagree AND nobody has settled it.
 * Exported because the count is displayed in three places that must all agree
 * with what this section actually renders — the previous arrangement recomputed
 * the same predicate in each of them.
 */
export function isPendingContested(edge: Edge): boolean {
  const vm = (edge.data as Record<string, unknown>)?.validation as ValidationMetadata | undefined
  return vm?.status === 'contested' && vm.user_action === 'pending'
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface ContestedEdgeSectionProps {
  /** Causal edges. Non-contested members are ignored, not filtered by the caller. */
  edges: Edge[]
  nodes: Node[]
  fragileEdgeIds?: ReadonlySet<string>
  selectedEdgeIds?: ReadonlySet<string>
  /** Enables the robustness row in the card's detail region. */
  hasRobustnessData?: boolean
  /**
   * ⚠ ABSENT MEANS THE CARDS DO NOT RENDER — and that is deliberate. The card's
   * ten controls all terminate in this handler; rendering them with a no-op
   * would put four resolve buttons on screen that silently discard the user's
   * judgement. "No handler" propagates as "no section", never as a section whose
   * buttons do nothing.
   */
  onResolveContested?: (
    edgeId: string,
    action: UserAction,
    customMean?: number,
    directionSource?: EdgeValueSource | null,
  ) => void
  /**
   * The "Show full detail" state. Provided here rather than inherited, because
   * this section now renders OUTSIDE `ModelTabHeader`'s provider — without it
   * every card would silently fall back to the context default (`false`) and the
   * expert-mode detail region would vanish. That is precisely the class of
   * regression a move like this causes, so it is wired explicitly.
   */
  showDetail?: boolean
}

// ── Section ──────────────────────────────────────────────────────────────────

export function ContestedEdgeSection({
  edges,
  nodes,
  fragileEdgeIds = new Set(),
  selectedEdgeIds,
  hasRobustnessData,
  onResolveContested,
  showDetail = false,
}: ContestedEdgeSectionProps) {
  const sortedContested = useMemo(
    () => edges.filter(isPendingContested).sort(compareContestedPriority),
    [edges],
  )

  // Nothing to settle, or nothing to settle it WITH — render nothing at all
  // rather than an empty heading that implies a queue exists.
  if (sortedContested.length === 0 || !onResolveContested) return null

  return (
    <DetailToggleContext.Provider value={{ showDetail }}>
      <section data-testid="contested-edge-section" className="space-y-2">
        <h3 className={`${typography.panelHeader} text-text-primary`}>
          {sortedContested.length === 1
            ? 'One relationship needs your judgement'
            : `${sortedContested.length} relationships need your judgement`}
        </h3>
        <p className={`${typography.panelMeta} text-text-light`}>
          Our two reviews disagree. Your call settles it.
        </p>
        {sortedContested.map(edge => {
          const edgeId = getDisplayEdgeId(edge)
          const vm = (edge.data as Record<string, unknown>)?.validation as ValidationMetadata
          return (
            <ContestedEdgeCard
              key={edgeId}
              edge={edge}
              nodes={nodes}
              validation={vm}
              isFragile={fragileEdgeIds.has(edgeId)}
              hasRobustnessData={hasRobustnessData}
              isSelected={selectedEdgeIds?.has(edgeId)}
              onResolve={onResolveContested}
            />
          )
        })}
      </section>
    </DetailToggleContext.Provider>
  )
}

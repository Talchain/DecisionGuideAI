/**
 * WhatChangedChip — run-over-run graph delta chip (seamlessness R6; first
 * shippable slice of ROADMAP 2.1 what-changed/compare/timeline).
 *
 * Diffs the LATEST stored run's graph snapshot against the PREVIOUS run's
 * (loadRuns() returns newest-first → runs[0] vs runs[1]; the original
 * orphaned version indexed runs[length-2], the second-OLDEST run). The diff
 * is CLIENT-SIDE over cached runs only — the copy says so; an engine-backed
 * run delta is a later contract.
 *
 * F2 CHANGE B (2026-07-22) — AUGMENT, not replace. Ruled decision: the canvas
 * pulse STAYS (it answers the STRUCTURAL graph-diff question, device-local),
 * AND the click ADDITIONALLY dispatches a real CEE turn (which answers the
 * OUTCOME-delta question — the run-over-run comparison, server-side). The two
 * answer different questions, so both fire. The CEE send goes through the
 * EXISTING chip dispatch mechanism (dispatchAction → buildChipMeta →
 * buildV5Payload); it carries message "What changed since the last run?" and
 * chip.action_type 'what_changed', and the send gate promotes source to
 * 'chip_click' (buildPayload.ts hasBoundAction) — the payload is never
 * hand-built here. FAIL-SAFE: when no conversation hook is in scope
 * (useOptionalConversationContext() === null), the send is simply skipped and
 * the chip degrades to today's pulse-only behaviour — never a broken chip.
 *
 * F2 CHANGE B follow-up (2026-07-22) — the CEE send fires UNCONDITIONALLY, on
 * every click. #423 wired it inside the click handler, but the handler only
 * existed when a LOCAL delta was available (both snapshots present AND a
 * non-empty diff), so identical runs / missing snapshots self-hid the chip and
 * the send was unreachable — a catch-22, since the SERVER (not this device)
 * owns freshness/mode honesty (compared / insufficient_runs / stale /
 * unconfirmed / incomparable). So: the chip renders and sends whenever there is
 * a previous run to reference; only the canvas pulse stays gated on local-diff
 * availability, and the resting accessible name is the ACTION ("What changed?"),
 * never a disability claim.
 *
 * F2B follow-up (2026-07-22) — MOUNT decoupled from the local run count. The
 * one surviving mount boundary (#425 kept `runs.length < 2 → return null`) was
 * still a dead precondition: on the live guest path runHistory stays EMPTY even
 * after several completed analyses (the resultsComplete writer records a run
 * only when `results.seed` is set, which the conversation/V5 envelope path never
 * sets — see store.ts resultsComplete), so the chip never mounted and the send
 * stayed stranded. Because the SERVER owns comparison honesty, the chip now
 * mounts and stays actionable whenever its host analysis surface (ResultsBody)
 * renders — 0, 1, or many stored runs. Clicking always fires the typed send;
 * CEE answers "only one run so far, nothing to compare yet" honestly when true.
 * Local runHistory continues to gate ONLY the pulse/highlight extras.
 *
 * Click pulses the added+modified elements via pulseAppliedTargets (same
 * 2s ring as applied AI edits). Removed elements no longer exist on the
 * canvas and are excluded — the pulse util would filter them fail-closed
 * anyway.
 *
 * Node "modified" = label change only. Position moves are layout, not an
 * analytical delta (auto-layout would otherwise mark every node modified
 * on every run). Edge "modified" = weight or belief change.
 */

import { useMemo, useSyncExternalStore } from 'react'
import { loadRuns } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { pulseAppliedTargets } from '../utils/appliedEditPulse'
import type { Node, Edge } from '@xyflow/react'
import { GitCompareArrows } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useOptionalConversationContext } from '../conversation/ConversationContext'
import { WHAT_CHANGED_CHIP_MESSAGE } from './whatChangedChipMessage'

// Re-exported for callers/tests already importing it from the component. The
// canonical source is the zero-import leaf module ./whatChangedChipMessage,
// so the narrow-gate wire spec can assert it without pulling this component's
// transitive hook graph into the typecheck.
export { WHAT_CHANGED_CHIP_MESSAGE }

interface GraphDiff {
  nodes: { added: string[]; removed: string[]; modified: string[] }
  edges: { added: string[]; removed: string[]; modified: string[] }
}

function computeGraphDiff(
  currentNodes: Node[],
  currentEdges: Edge[],
  previousNodes: Node[],
  previousEdges: Edge[]
): GraphDiff {
  const diff: GraphDiff = {
    nodes: { added: [], removed: [], modified: [] },
    edges: { added: [], removed: [], modified: [] },
  }

  const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]))
  const previousNodeMap = new Map(previousNodes.map(n => [n.id, n]))

  for (const node of currentNodes) {
    const prev = previousNodeMap.get(node.id)
    if (!prev) {
      diff.nodes.added.push(node.id)
    } else if (node.data?.label !== prev.data?.label) {
      diff.nodes.modified.push(node.id)
    }
  }
  for (const node of previousNodes) {
    if (!currentNodeMap.has(node.id)) diff.nodes.removed.push(node.id)
  }

  const currentEdgeMap = new Map(currentEdges.map(e => [e.id, e]))
  const previousEdgeMap = new Map(previousEdges.map(e => [e.id, e]))

  for (const edge of currentEdges) {
    const prev = previousEdgeMap.get(edge.id)
    if (!prev) {
      diff.edges.added.push(edge.id)
    } else if (edge.data?.weight !== prev.data?.weight || edge.data?.belief !== prev.data?.belief) {
      diff.edges.modified.push(edge.id)
    }
  }
  for (const edge of previousEdges) {
    if (!currentEdgeMap.has(edge.id)) diff.edges.removed.push(edge.id)
  }

  return diff
}

function formatCounts(label: string, c: { added: string[]; removed: string[]; modified: string[] }): string | null {
  const parts: string[] = []
  if (c.added.length > 0) parts.push(`+${c.added.length}`)
  if (c.removed.length > 0) parts.push(`-${c.removed.length}`)
  if (c.modified.length > 0) parts.push(`~${c.modified.length}`)
  return parts.length > 0 ? `${label}: ${parts.join(', ')}` : null
}

// The runs list changes only when runsBus emits (add/consolidate/delete).
// A module-level version + useSyncExternalStore keys the memoised parse so
// the analysis tab's frequent re-renders (node drags re-render the dock)
// never re-run loadRuns()'s localStorage JSON.parse of full run payloads.
let runsVersion = 0
const subscribeToRuns = (onStoreChange: () => void) =>
  runsBus.on(() => {
    runsVersion++
    onStoreChange()
  })
const getRunsVersion = () => runsVersion

export function WhatChangedChip() {
  const version = useSyncExternalStore(subscribeToRuns, getRunsVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the cache key for the localStorage read
  const runs = useMemo(() => loadRuns(), [version])
  // FAIL-SAFE seam: optional context is null when this chip renders outside a
  // <ConversationProvider> (no conversation hook) — the CEE send is then
  // skipped and only the canvas pulse fires. Hook is read unconditionally
  // (before the early returns below) to keep hook order stable.
  const dispatchAction = useOptionalConversationContext()?.dispatchAction
  // F2B (2026-07-22): the chip's MOUNT is decoupled from the local run count.
  // The old `runs.length < 2 → return null` boundary stranded the CEE send
  // behind a dead precondition — on the live guest path runHistory stays EMPTY
  // even after completed analyses (the writer never records there), so the chip
  // never mounted and the send was unreachable. The SERVER owns comparison
  // honesty (its what_changed gate answers insufficient_runs / stale /
  // unconfirmed / incomparable), so the chip renders and stays actionable
  // whenever its host analysis surface (ResultsBody) renders — regardless of how
  // many runs are stored locally. Only the pulse/highlight extras below stay
  // gated on a computable local pair.
  const latest = runs[0] // newest-first per loadRuns()'s sort; may be undefined
  const previous = runs[1] // second-newest; undefined with < 2 stored runs
  // LOCAL structural diff — only computable when BOTH runs carry an alignable
  // graph snapshot. A run without one (legacy pre-v1.2 entries) is
  // NON-COMPARABLE locally, not empty — diffing against [] would fabricate an
  // "everything added/removed" delta, so we compute NOTHING and treat the
  // local highlight as unavailable (same rule as computeRunSummary's
  // "Snapshot unavailable" precedent). The SERVER can still answer the
  // outcome delta, so the chip stays actionable regardless.
  const diff =
    latest?.graph && previous?.graph
      ? computeGraphDiff(
          latest.graph.nodes ?? [],
          latest.graph.edges ?? [],
          previous.graph.nodes ?? [],
          previous.graph.edges ?? []
        )
      : null

  const parts = diff
    ? [formatCounts('Nodes', diff.nodes), formatCounts('Edges', diff.edges)].filter(
        (p): p is string => p !== null
      )
    : []

  // F2 CHANGE B follow-up (2026-07-22): the LOCAL-diff availability gate no
  // longer decides whether the chip renders — it only decides whether the
  // canvas pulse can fire. The pulse needs an alignable local pair AND a
  // non-empty delta descriptor to highlight anything ("pulse-when-computable").
  // A zero-delta pair (identical runs) or a missing snapshot yields no local
  // highlight — but the chip is still actionable and the CEE send still fires.
  const localHighlightAvailable = diff !== null && parts.length > 0

  const handleClick = () => {
    // (1) STRUCTURAL answer — the canvas pulse, GATED on local-diff
    // availability. It needs an alignable local pair to highlight anything, so
    // it fires only when a delta is computable; a zero-delta / missing-snapshot
    // click simply skips it (never crashes).
    // F4 (graph-visuals): fit-before-pulse lives at the pulse choke point —
    // appliedEditPulse's flush fits every surviving target into view before
    // the ring fires, for EVERY feeder (applyPatch, applyV5State, this chip).
    // A chip-local fit on top would double the camera move, so the chip
    // delegates. Removed elements are gone from the canvas — only surviving
    // changes can be highlighted (the flush filters fail-closed anyway).
    if (localHighlightAvailable) {
      pulseAppliedTargets({
        nodeIds: [...diff.nodes.added, ...diff.nodes.modified],
        edgeIds: [...diff.edges.added, ...diff.edges.modified],
      })
    }

    // (2) OUTCOME answer — the CEE send fires on EVERY click, UNCONDITIONALLY.
    // The SERVER owns freshness/mode honesty: its four-way gate answers
    // compared / insufficient_runs / stale / unconfirmed / incomparable
    // honestly (F2B byte-confirm §3). Gating the send on the LOCAL diff would
    // hide the honest server answer behind a device-side heuristic — the exact
    // catch-22 this fixes. Dispatch goes through the existing chip mechanism
    // (dispatchAction → buildChipMeta → buildV5Payload); the send gate promotes
    // source to 'chip_click' because 'what_changed' passes isSendableActionType
    // — the payload is not built here. FAIL-SAFE: when dispatchAction is absent
    // (no conversation hook), the click is a no-op beyond the optional pulse.
    if (dispatchAction) {
      void dispatchAction({
        action_type: 'what_changed',
        label: WHAT_CHANGED_CHIP_MESSAGE,
        message: WHAT_CHANGED_CHIP_MESSAGE,
        source: 'chip',
      }).catch(() => {
        // A failed CEE send must never break the chip. The conversation panel
        // surfaces its own send-failure notice.
      })
    }
  }

  // Label + accessible name. With the send always available the chip is always
  // actionable, so the resting state names the ACTION ("What changed?"), never
  // a disability claim. When a local delta IS computable we additionally show
  // the counts and name the highlight it will pulse.
  const label = localHighlightAvailable
    ? `Since your last run: ${parts.join(' • ')}`
    : 'What changed?'
  const ariaLabel = localHighlightAvailable
    ? `Since your last run: ${parts.join(', ')}. Highlight the changes on the canvas.`
    : 'What changed?'

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
    <button
      type="button"
      onClick={handleClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-transparent border border-info/30 text-text-body',
        typography.caption,
        'font-medium cursor-pointer hover:border-info/50 hover:underline',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
      ].join(' ')}
      aria-label={ariaLabel}
      title="Compared with the previous analysis stored on this device"
      data-testid="what-changed-chip"
    >
      <GitCompareArrows size={14} className="text-info flex-none" aria-hidden="true" />
      <span>{label}</span>
    </button>
    {/* Paul's ruling 2026-07-12 (keep + improve): the comparison basis is a
        VISIBLE label, never tooltip-only — this is a device-local diff of
        the last two runs, not producer-versioned comparison. */}
    <span className={`${typography.panelMeta} text-text-light pl-1`}>
      Compared with your previous run on this device
    </span>
    </span>
  )
}

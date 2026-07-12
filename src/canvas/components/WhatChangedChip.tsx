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
  if (runs.length < 2) return null

  const [latest, previous] = runs // newest-first per loadRuns()'s sort
  // A run without a graph snapshot (legacy pre-v1.2 entries) is
  // NON-COMPARABLE, not empty — diffing against [] would fabricate an
  // "everything added/removed" delta. Same rule as computeRunSummary's
  // "Snapshot unavailable" precedent: hide instead.
  if (!latest.graph || !previous.graph) return null
  const diff = computeGraphDiff(
    latest.graph.nodes ?? [],
    latest.graph.edges ?? [],
    previous.graph.nodes ?? [],
    previous.graph.edges ?? []
  )

  const parts = [formatCounts('Nodes', diff.nodes), formatCounts('Edges', diff.edges)].filter(
    (p): p is string => p !== null
  )
  if (parts.length === 0) return null

  const handleClick = () => {
    // Removed elements are gone from the canvas — only surviving changes
    // can be highlighted.
    pulseAppliedTargets({
      nodeIds: [...diff.nodes.added, ...diff.nodes.modified],
      edgeIds: [...diff.edges.added, ...diff.edges.modified],
    })
  }

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
      aria-label={`Since your last run: ${parts.join(', ')}. Highlight the changes on the canvas.`}
      title="Compared with the previous analysis stored on this device"
      data-testid="what-changed-chip"
    >
      <GitCompareArrows size={14} className="text-info flex-none" aria-hidden="true" />
      <span>Since your last run: {parts.join(' • ')}</span>
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

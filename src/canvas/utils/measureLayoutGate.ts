/**
 * Pure gate logic for the measure-then-layout effect in ReactFlowGraph.
 *
 * Extracted so the gating contract can be unit-tested without mounting the
 * full canvas component.
 *
 * The effect's responsibilities:
 *   - Wait until React Flow has measured every unlocked node before calling
 *     applyLayout (so ELK runs against real heights).
 *   - After LAYOUT_MEASUREMENT_FALLBACK_MS, give up and proceed with
 *     DEFAULT_NODE_HEIGHT for any node still unmeasured.
 *   - Block re-entry when another layout run is in progress.
 *
 * This module owns only the gating decision; the effect itself wires the
 * decision to setTimeout / applyLayout / cleanup.
 */

import type { Node } from '@xyflow/react'

export type GateDecision =
  | 'idle'                  // no pending layout — do nothing
  | 'blocked'               // a layout is already in progress
  | 'run-now'               // every unlocked node is measured — invoke applyLayout
  | 'wait-with-fallback'    // measurement incomplete — start the safety timer

/**
 * Minimal readonly view of React Flow's nodeLookup map. Just enough surface
 * for `allUnlockedNodesMeasured` to read the `measured` field without taking
 * a dependency on the full `InternalNode` type. Lets callers pass the React
 * Flow `nodeLookup` directly without an `as unknown as` cast.
 */
export interface MeasuredLookup {
  get(id: string): { measured?: { width?: number; height?: number } } | undefined
}

export interface GateInputs {
  pendingLayout: boolean
  layoutInProgress: boolean
  nodesInitialized: boolean
  storeNodes: Node[]
  /**
   * `true` if every unlocked node in `storeNodes` has measured.width > 0
   * AND measured.height > 0 in React Flow's nodeLookup. Caller computes
   * this from React Flow's `useStore(s => s.nodeLookup)` map.
   */
  allUnlockedNodesMeasured: boolean
}

/**
 * Evaluate the measure-then-layout gate.
 *
 * @returns one of:
 *   - 'idle' when pendingLayout is false
 *   - 'blocked' when a layout is mid-flight (re-entry guard)
 *   - 'run-now' when measurement is complete
 *   - 'wait-with-fallback' when measurement is incomplete; caller starts
 *     the safety timer.
 */
export function evaluateMeasurementGate(inputs: GateInputs): GateDecision {
  if (!inputs.pendingLayout) return 'idle'
  if (inputs.layoutInProgress) return 'blocked'
  if (inputs.nodesInitialized && inputs.allUnlockedNodesMeasured) return 'run-now'
  return 'wait-with-fallback'
}

/**
 * Helper to compute `allUnlockedNodesMeasured` from a React Flow nodeLookup
 * map (or any equivalent map keyed by node id). Mirrors the inline check
 * from the effect.
 */
export function allUnlockedNodesMeasured(
  storeNodes: Node[],
  measuredById: MeasuredLookup,
): boolean {
  for (const node of storeNodes) {
    if ((node.data as Record<string, unknown> | undefined)?.locked === true) continue
    const internal = measuredById.get(node.id)
    const m = internal?.measured
    if (!m || !(m.width && m.width > 0) || !(m.height && m.height > 0)) {
      return false
    }
  }
  return true
}

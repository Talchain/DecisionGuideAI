/**
 * restoreInterventionAudit — the POST-CONDITION for a shared-version restore.
 *
 * WHY THIS EXISTS. A restore used to succeed on the server (HTTP 200, new
 * version row, valid receipt) and then silently revert the canvas, while the
 * panel said "Restored. The shared model and this canvas now show that
 * version." The panel had no way to know: it read the reconcile's add/update/
 * remove COUNTS, which were non-zero and truthful, and claimed success from
 * them. Counts say the apply did something. They never say it did the RIGHT
 * thing, and they cannot see a later write that undoes it.
 *
 * So the success claim is now EARNED: after the apply, we compare the option
 * values on the canvas against the option values in the graph the server
 * actually restored, and the panel only claims a restored canvas when they
 * agree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ THE AUTHORITY IS `graph.nodes[].interventions` — **NOT**
 * `graph.analysis_ready.options[].interventions`.
 *
 * Both exist in a restore receipt, they are DIFFERENT quantities, and they
 * DISAGREE on real traffic. Measured on the captured staging bodies behind this
 * fix (`shared-return-response185.json`, UI 138d9560 / CEE df3e5424):
 *
 *   node-root  70180763 → { 0d2a1d17: { value: 0.3, source: 'user_specified' } }
 *   analysis_ready 70180763 → { 0d2a1d17: { value: 0.7, source: 'cee_hypothesis' } }
 *
 * (In a sibling capture, `…191.json`, the two happen to agree at 0.7 — so a
 * reader who checked only that one would conclude they are interchangeable.
 * They are not.)
 *
 * An audit — or a fix — that trusted the embedded `analysis_ready` would
 * "restore" 0.7 over the user's 0.3 and then certify itself green. The
 * reconcile already treats it as non-authoritative and strips it before the
 * canonical receipt parse (`mergeAppliedGraph.ts:179`). This module must stay
 * consistent with that, which is why the wire reader below never looks at it.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Binding: every comparison is keyed by NODE ID and by INTERVENTION TARGET ID
 * (trap 19 — never by a value predicate another option could satisfy). Values
 * are read through `interventionTargetValue`, which the domain layer declares
 * as "THE ONE reading of an option's intervention map", so this audit cannot
 * drift from what the canvas and the wire actually consider the number to be.
 */

import { interventionTargetValue } from '../domain/interventions'

/** One option value the restore asked for and the canvas does not show. */
export interface RestoreInterventionMismatch {
  /** The option node's id — the identity the comparison is bound to. */
  optionId: string
  /** The factor node the intervention targets. */
  targetNodeId: string
  /** The value the restored graph carries. `undefined` = states no number. */
  restored: number | undefined
  /** The value the canvas ended up with. `undefined` = absent, or node missing. */
  onCanvas: number | undefined
  /** True when no canvas node carries `optionId` at all. */
  missingFromCanvas: boolean
}

function isOptionWireNode(n: unknown): n is { id: string; interventions?: unknown } {
  if (n == null || typeof n !== 'object') return false
  const o = n as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length === 0) return false
  // CEE's node schema spells it `kind`; older/adapter shapes spell it `type`.
  return o.kind === 'option' || o.type === 'option'
}

function canvasNodeInterventions(n: unknown): Record<string, unknown> | undefined {
  if (n == null || typeof n !== 'object') return undefined
  const data = (n as { data?: unknown }).data
  if (data == null || typeof data !== 'object') return undefined
  const iv = (data as { interventions?: unknown }).interventions
  if (iv == null || typeof iv !== 'object' || Array.isArray(iv)) return undefined
  return iv as Record<string, unknown>
}

/**
 * Every option value the restored graph states that the canvas does not match.
 *
 * An EMPTY array is the only thing that entitles a caller to claim the canvas
 * shows the restored model.
 *
 * Scope, stated precisely so no caller over-reads it: this compares the option
 * INTERVENTION values only. It is silent about edges, about factor values, and
 * about anything the restored graph does not state. It is a guard against the
 * measured defect class (a stale producer write landing on top of an
 * authoritative apply), not a general graph-equality check.
 */
export function findRestoredInterventionMismatches(
  restoredGraph: unknown,
  liveNodes: readonly unknown[],
): RestoreInterventionMismatch[] {
  const nodes = (restoredGraph as { nodes?: unknown })?.nodes
  if (!Array.isArray(nodes)) return []

  const liveById = new Map<string, unknown>()
  for (const n of liveNodes) {
    const id = (n as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id.length > 0 && !liveById.has(id)) liveById.set(id, n)
  }

  const mismatches: RestoreInterventionMismatch[] = []

  for (const wireNode of nodes) {
    if (!isOptionWireNode(wireNode)) continue
    const wireInterventions = wireNode.interventions
    if (
      wireInterventions == null ||
      typeof wireInterventions !== 'object' ||
      Array.isArray(wireInterventions)
    ) {
      continue
    }

    const optionId = wireNode.id
    const hasLiveNode = liveById.has(optionId)
    const liveInterventions = hasLiveNode
      ? canvasNodeInterventions(liveById.get(optionId))
      : undefined

    for (const [targetNodeId, wireEntry] of Object.entries(
      wireInterventions as Record<string, unknown>,
    )) {
      const restored = interventionTargetValue(wireEntry)
      // The restored graph states no usable number for this target — there is
      // nothing for the canvas to fail to show, so this is not a mismatch.
      // (Absence is a fact, never a zero to invent.)
      if (restored === undefined) continue

      const onCanvas = liveInterventions
        ? interventionTargetValue(liveInterventions[targetNodeId])
        : undefined

      if (!Object.is(restored, onCanvas)) {
        mismatches.push({
          optionId,
          targetNodeId,
          restored,
          onCanvas,
          missingFromCanvas: !hasLiveNode,
        })
      }
    }
  }

  return mismatches
}

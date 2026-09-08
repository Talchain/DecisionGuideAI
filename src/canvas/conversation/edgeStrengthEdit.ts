/**
 * buildEdgeStrengthEditEvent — the edge-strength slider, as a wire event.
 *
 * ⭐ THE DEFECT THIS CLOSES, stated as the user experiences it: the strength
 * control is an ACTIVE LIE. `useEdgeMutations.setStrength` performs ONE local
 * `updateEdge` and emits nothing, so the user drags the slider, the line
 * changes, the value is stamped `weightSource: 'user'` — and the server never
 * hears about it. On the next reload, or the next re-run, the number the user
 * set is simply not there. That is worse than a disabled control: a disabled
 * control tells the truth.
 *
 * ⚠ THIS MODULE INVENTS NOTHING. It is the `edgeAdjudication.ts` /
 * `factorValueEdit.ts` builder shape, applied to the contract member CEE has
 * consumed since schemas 0.42.0 and the UI has never sent. The wire TYPE comes
 * from `@talchain/schemas` via `buildV5Payload` (see `adaptEdgeStrengthEdit`
 * there); this module decides WHICH fields go into it, and refuses to build
 * anything the contract's own cross-field rules would reject.
 *
 * ── DERIVED AT CEE'S OWN BYTES, NOT FROM THIS REPO'S COMMENTS ───────────────
 * The claim "CEE consumes `edge_strength_edit`" previously lived here only as
 * prose citing CEE `3575b189` / `d5455355`. Re-derived 2026-09-07 at
 * `Talchain/olumi-assistants-service` staging `9de184f1` — which is the
 * DEPLOYED build (`cee-staging.onrender.com/healthz` → `"build":"9de184f"`):
 *
 *   · `system-events/dispatch.ts:291`  `edge_strength_edit: 'mutating'`
 *   · `system-events/dispatch.ts:611`  routes to `dispatchEdgeStrengthEdit`
 *   · `system-events/edge-strength-edit.ts` (616 lines) — resolves the exact
 *     persisted `(from, to)` edge, verifies the expected-before tuple, and
 *     routes the accepted write through the canonical `adjust_edge_strength`
 *     handler.
 *
 * ⚠⚠ AND THE HALF A GREP WOULD HAVE MISSED — `dispatch.ts:570-577`:
 *
 *     const handling =
 *       payload.event.kind === 'edge_strength_edit' &&
 *       declaredHandling === 'mutating' &&
 *       config.features.graphCas.rpcEnforce !== true
 *         ? 'reader_only_refusal'
 *         : declaredHandling;
 *
 * `edge_strength_edit` is the ONLY mutating kind still behind that gate;
 * `factor_value_edit`, `structural_add`, `structural_delete` and
 * `structural_rename` are all deliberately ungated (dispatch.ts:1124, 1791,
 * 2111 each explain why). `CEE_V5_GRAPH_CAS_RPC` is a Render-dashboard value,
 * DEFAULT-SHADOW (`config/index.ts:707`), and CEE's own header says the
 * deployed posture "is currently UNOBSERVABLE FROM ANY CLIENT by
 * construction" and instructs readers to "treat any behaviour that depends on
 * it as needing to be correct under BOTH". Two prose sentences in that repo
 * contradict each other on purpose, each pointing at the other. So:
 *
 *   POSTURE ENFORCE  → the write lands in `scenarios.graph`. The lie is closed.
 *   POSTURE OFF/SHADOW → CEE answers a TYPED, NON-RETRYABLE refusal naming
 *     THIS gesture — `FEATURE_NOT_ENABLED`, `reason:
 *     'edge_strength_edit_reader_only'`, "I can't apply this link-strength
 *     change in this version, so I haven't changed the model."
 *
 * Under BOTH the user is told the truth, which is the whole point of emitting.
 * This is NOT the `structural_add_edge` situation the estate correctly refuses
 * to emit: that kind has NO WRITER AT ALL. Here the writer exists in the
 * deployed bytes and a config value decides whether it runs.
 *
 * ── FAIL-CLOSED, AGAINST THE CONTRACT'S OWN RULES ──────────────────────────
 * Every refusal below is a rule the wire would enforce anyway; checking it here
 * means a drifted producer refuses CLIENT-side (null → the caller simply does
 * not emit) rather than as a production 422 that rejects the WHOLE turn.
 *
 * ⭐⭐ THE ONE RULE THAT IS NOT MERELY MIRRORING THE SCHEMA, and it is the
 * load-bearing one: `expected` IS AN OPTIMISTIC-CONCURRENCY ASSERTION ABOUT
 * WHAT THE SERVER HOLDS — the contract's own words, "the exact signed mean last
 * read from the canonical persisted edge ... not the requested value". The
 * canvas fabricates edge numbers: `DEFAULT_EDGE_DATA.weight = 0.5`,
 * `USER_EDGE_DEFAULTS.weight = 0.3`, and an unstated `direction` falls through
 * to `'positive'`. Sending a DEFAULT as an assertion about the server's bytes
 * would earn the user `edge_expected_tuple_mismatch` → "refresh and reconfirm"
 * for an edit that was perfectly fine — a fabricated conflict.
 *
 * So `expected` is taken from the two READ-SIDE GATES that already answer
 * "was this number SET, or did it fall through to a UI default?" —
 * `resolveEdgeSignedStrengthDisplay` and `resolveEdgeDirectionDisplay`
 * (`canvas/domain/edgeValueProvenance.ts`). Neither is re-implemented here: a
 * second copy of a provenance rule is this estate's signature defect, and these
 * two are the gates every other read-side surface already consumes. When either
 * refuses, we do not know what the server holds, so we do not assert it.
 */
import type { Edge } from '@xyflow/react'

import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
} from '../domain/edgeValueProvenance'
import type { WireSystemEvent } from './types'

/**
 * The contract's endpoint-id rule, verbatim from
 * `@talchain/schemas` 0.50.0 `CanonicalEdgeEndpointIdSchema`: non-blank, no
 * surrounding whitespace, and never a delimiter-bearing composite. The pair
 * `(from, to)` IS the edge's canonical identity — the client edge id is a local
 * artefact CEE has never seen and is deliberately not sent.
 */
function isCanonicalEndpointId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0) return false
  if (id !== id.trim()) return false
  return !id.includes('→') && !id.includes('->')
}

export interface BuildEdgeStrengthEditArgs {
  /** The edge as it was BEFORE the local write — `expected` describes the past. */
  edge: Edge
  /**
   * The number handed to `setStrength`. SIGNED when the caller drives a signed
   * control, and a bare magnitude when it passes `preserveDirection`.
   */
  requestedMean: number
  /**
   * The caller's own `preserveDirection` flag, forwarded unchanged. It is what
   * separates "set the size, leave the sign alone" from "the user stated this
   * direction", and the local write and the wire event MUST agree about which
   * one happened or they are a split-brain by construction.
   */
  preserveDirection?: boolean
}

/**
 * Build the wire event, or `null` when the edit cannot be asserted truthfully.
 *
 * ⚠ `null` IS NOT AN ERROR AND MUST NOT SUPPRESS THE LOCAL WRITE. See
 * `useEdgeMutations.setStrength`: a caller that dropped the user's local edit
 * because the wire could not carry it would trade a disclosed gap for a
 * silently dead control.
 */
export function buildEdgeStrengthEditEvent({
  edge,
  requestedMean,
  preserveDirection,
}: BuildEdgeStrengthEditArgs): WireSystemEvent | null {
  if (!edge) return null
  const from = edge.source
  const to = edge.target
  if (!isCanonicalEndpointId(from) || !isCanonicalEndpointId(to)) return null

  if (typeof requestedMean !== 'number' || !Number.isFinite(requestedMean)) return null
  const magnitude = Math.abs(requestedMean)
  // `magnitude: z.number().finite().min(0).max(1)`. The canvas does NOT share
  // that bound — `EDGE_VALUE_DOMAINS.weight` is declared open and the Model tab
  // weight chip accepts 0–2 (`RelationshipsSection.handleWeightSave`). REFUSE
  // rather than clamp: a clamped 1.5 → 1 sends a number the user never stated
  // and CEE would persist it as theirs.
  if (magnitude > 1) return null

  // `expected` — what we believe the SERVER holds. Both halves must come from a
  // named source or we are asserting a UI default as a fact about the server.
  const strength = resolveEdgeSignedStrengthDisplay(
    edge.data as Record<string, unknown> | undefined,
  )
  if (!strength.show) return null
  const expectedMean = strength.value
  if (!Number.isFinite(expectedMean) || expectedMean < -1 || expectedMean > 1) return null

  const direction = resolveEdgeDirectionDisplay(edge.data as Record<string, unknown> | undefined)
  if (!direction.show) return null
  const expectedDirection = direction.direction

  // The contract's own cross-field rule (`refineEdgeStrengthEdit`): a non-zero
  // `expected.mean` and `expected.effect_direction` must agree. They are
  // resolved by two SEPARATE gates here, so disagreement is reachable — an edge
  // carrying a producer `strength_mean: -0.4` beside a user-stamped
  // `direction: 'positive'`, for instance. That is a state we cannot describe
  // truthfully in one tuple, so we decline to describe it at all.
  //
  // ⚠ ZERO IS EXEMPT AND DELIBERATELY SO. The contract keeps
  // `effect_direction` REQUIRED at `mean === 0` precisely because sign cannot
  // recover direction there — `-0 >= 0` is `true` in JavaScript — so a zero
  // mean agrees with EITHER direction and must not be refused.
  if (expectedMean !== 0) {
    const impliedByMean = expectedMean < 0 ? 'negative' : 'positive'
    if (impliedByMean !== expectedDirection) return null
  }

  // ⚠ THE SAME RULE THE LOCAL WRITE APPLIES, ON PURPOSE. `setStrength` derives
  // `direction: mean >= 0 ? 'positive' : 'negative'` and writes nothing under
  // `preserveDirection`. Re-deriving it differently here would let the canvas
  // and the server disagree about what the user just said.
  const direction_intent: 'preserve' | 'positive' | 'negative' = preserveDirection
    ? 'preserve'
    : requestedMean >= 0
      ? 'positive'
      : 'negative'

  return {
    type: 'edge_strength_edit',
    payload: {
      from,
      to,
      magnitude,
      direction_intent,
      expected: { mean: expectedMean, effect_direction: expectedDirection },
      // ⚠ ALWAYS `'set'`, AND THE OMISSION IS DELIBERATE RATHER THAN AN
      // OVERSIGHT. `'confirm_current'` is a PROVENANCE-ONLY act with its own
      // cross-field rules (it requires `direction_intent: 'preserve'` and
      // `magnitude === abs(expected.mean)` exactly) and its own product
      // meaning — "I ratify the number that is already there". The only
      // gesture that means it is `EdgePanel.handleConfirmCurrentStrength`, and
      // giving it its own intent is a separate, separately-reviewed change.
      // Sending `'set'` for it is not a lie: the user did choose that number.
      intent: 'set',
    },
  }
}

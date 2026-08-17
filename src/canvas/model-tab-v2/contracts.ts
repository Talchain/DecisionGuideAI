/**
 * Model tab v2 — the contracts this surface needs from OTHER lanes.
 * TYPE DECLARATIONS ONLY. No implementations, no runtime values.
 *
 * ⚠ MOUNT-TRAIN STATUS (16 Aug 2026): the surface is now mounted, and the
 * subset of §1 with a live canonical carrier is served by
 * `src/canvas/hooks/useModelEditAuthority.ts` (factor values; prior range and
 * edge adjudication remain reachable through their existing sanctioned seams).
 * The RECEIPT-bearing handle below (`EditProposalHandle`, `applied` only from
 * a receipt) is still the target API and still unimplemented — the authority
 * hook documents why it must not be faked from an echo.
 *
 * This file exists so the two owning lanes have a concrete shape to bind to
 * instead of a paragraph in a design document:
 *   · the WRITE AUTHORITY (Codex's transactional-edit vertical) — §1 below;
 *   · the DOCK / panel-fronting mechanism (PX-A) — §2 below.
 *
 * ⚠ THIS LANE BUILDS NEITHER. Nothing here may be implemented in this
 * directory. A local implementation of §1 would be exactly the "new local
 * writer" the design forbids, and it is how the estate previously ended up
 * with the same edit committed through three different paths with three
 * different provenance stamps.
 *
 * Full rationale: `docs/Design/MODEL-EDITOR-V2.md` §9.
 * (Capital D. `docs/design/` does not exist — it resolves on a case-insensitive
 * macOS filesystem and would break a Linux CI checkout.)
 */

import type { EditCommitState } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — From the write authority (Codex)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The outcome of one proposed edit, as the ROW must render it.
 *
 * ⚠ THE ROW READS THIS; IT DOES NOT DECIDE IT. `state.phase === 'applied'` is
 * reachable only because the authority said so. See `EditCommitState`'s header
 * for why that matters: today an edge-strength edit and a factor-value edit
 * look identical on screen while only one of them reaches the server.
 */
export interface EditProposalHandle {
  state: EditCommitState
  /**
   * Present once the authority has answered. Carries whatever the receipt
   * establishes about the applied value — the row must not re-derive it from
   * the number it sent.
   */
  receipt?: { appliedValue: string; provenanceLiteral: string }
  /**
   * User-facing prose on refusal, never a code or a field path. The estate
   * already has a sanitiser for this class of text
   * (`ModelAdjustments.sanitiseDetail`) — reuse it rather than writing a second.
   */
  error?: string
}

/**
 * The named operations the v2 editor dispatches. Nothing here writes; each is a
 * request to the authority that owns the write.
 *
 * STATUS AT DERIVATION (UI staging `a3c71513`) — the reason this list is split
 * three ways rather than presented as one clean interface:
 *
 *   ALREADY SERVER-AUTHORITATIVE (reuse as-is, do not re-plumb):
 *     · proposeFactorValue      → `factor_value_edit`   (with optimistic revert)
 *     · proposePriorRange       → `prior_range_edit`    (carry-only: CEE
 *                                  persists a typed fact and writes no graph)
 *     · resolveContestedEdge    → `edge_adjudication`
 *
 *   IN FLIGHT ON CODEX'S LANE:
 *     · proposeEdgeStrength     → `edge_strength_edit`  (zero occurrences in the
 *                                  tree at derivation time)
 *
 *   LOCAL-ONLY TODAY — the gap this design depends on closing:
 *     · proposeEdgeLikelihood, proposeEdgeDirection, proposeOptionIntervention,
 *       proposeGoalTarget, proposeFactorConfirmation
 *     These currently terminate in the client store and reach CEE only as the
 *     debounced, VALUE-LESS `direct_graph_edit` ping. Queue A depends on
 *     `proposeOptionIntervention`; Queue B depends on `proposeFactorConfirmation`.
 */
export interface ModelEditAuthority {
  /** Existing. Scale is decided from the node's own cap/unit, not by the row. */
  proposeFactorValue(nodeId: string, typedValue: number): Promise<EditProposalHandle>

  /** Existing. Always commits BOTH bounds; fails closed on inverted bounds. */
  proposePriorRange(nodeId: string, min: number, max: number): Promise<EditProposalHandle>

  /**
   * Existing. ⚠ KEEP ITS PROVENANCE DISCIPLINE EXACTLY: accepting the reviewer's
   * estimate must stamp the value `cee`, NOT `user`. Stamping a producer's
   * number as the human's is provenance laundering, and the current
   * implementation refuses it deliberately.
   */
  resolveContestedEdge(
    edgeId: string,
    verdict: 'accepted_pass1' | 'accepted_pass2' | 'overridden' | 'dismissed',
    value?: number,
  ): Promise<EditProposalHandle>

  /**
   * Codex's lane. ⚠ `directionStated` is load-bearing and must not be inferred:
   * a MAGNITUDE CANNOT CARRY A SIGN. When nothing states a direction, the
   * magnitude is written alone and the direction and its stamp are left
   * untouched — the edge keeps reading "direction not stated" rather than being
   * handed a sign taken off a number.
   */
  proposeEdgeStrength(
    edgeId: string,
    signedMean: number,
    opts: { directionStated: boolean },
  ): Promise<EditProposalHandle>

  /** NEW — local-only today (`setExistsProbability`). `p` in [0,1]. */
  proposeEdgeLikelihood(edgeId: string, p: number): Promise<EditProposalHandle>

  /** NEW — local-only today (`setDirection`). */
  proposeEdgeDirection(edgeId: string, direction: 'positive' | 'negative'): Promise<EditProposalHandle>

  /** NEW — local-only today (`setIntervention`). Queue A depends on this. */
  proposeOptionIntervention(
    optionId: string,
    factorId: string,
    value: number,
  ): Promise<EditProposalHandle>

  /** NEW — local-only today (`setGoalThresholdAndUpdateNode`). */
  proposeGoalTarget(nodeId: string, raw: number, unit?: string): Promise<EditProposalHandle>

  /**
   * NEW — a local annotation today, and stamped WRONG.
   *
   * ⚠ THIS MUST STAMP `user_confirmed`, NOT `user`. The Model tab's Confirm ✓
   * currently writes `setObservedSource('user')`, which the shared classifier
   * maps to the `edited` class — so the pill reads "User edited" for a gesture
   * that ratified somebody else's number. Pre-analysis writes `user_confirmed`
   * for the identical gesture and gets "Confirmed by you". Same act, two
   * stamps, decided by which surface the user happened to be standing on.
   */
  proposeFactorConfirmation(nodeId: string): Promise<EditProposalHandle>

  /**
   * The batch form the repair queues need.
   *
   * ⚠ NOT A CONVENIENCE. Without it, "Apply all shown" over eight rows is eight
   * turns, eight undo steps and eight analysis invalidations for ONE user
   * gesture. The queues are the design's answer to Paul's two repair cases, so
   * this operation is load-bearing, not an optimisation.
   *
   * Partial success must be reportable per item — a batch that reports one
   * aggregate verdict cannot tell the user which three of eight were refused.
   */
  proposeBatch(
    edits: ReadonlyArray<() => Promise<EditProposalHandle>>,
  ): Promise<readonly EditProposalHandle[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — From PX-A (panel fronting)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether the Olumi surface actually came to the front.
 *
 * ⚠ THE RETURN VALUE IS THE POINT. All 12 send-to-AI call sites on today's
 * Model tab (6 components, 11 distinct messages, measured at `a3c71513`) post a
 * real turn into a panel that stays `hidden`, so the user clicks "Discuss this
 * with the AI" and nothing visibly happens. A hand-off that cannot front the
 * panel must be able to SAY so rather than send into silence.
 */
export type PanelFrontingOutcome = 'fronted' | 'deferred'

/**
 * The one call this surface needs from the dock lane.
 *
 * Requirements:
 *   · fronts the Olumi conversation whether it is DOCKED, FLOATING or COLLAPSED
 *     (`revealOlumiSurface()` is the current primitive and the natural basis);
 *   · ⚠ ORIGIN IS `'user'`. These are user gestures. They must not stamp
 *     `outputSurfaceOrigin: 'assistant'` and must not raise the
 *     `AssistantOpenedNotice` — telling the user Olumi opened something they
 *     opened themselves is a lie on the one channel whose purpose is
 *     truthfulness;
 *   · returns the outcome.
 *
 * This lane does NOT build it.
 */
export type FrontOlumiPanel = (opts?: { reason?: string }) => PanelFrontingOutcome

/**
 * The single hand-off helper every v2 send-to-AI affordance goes through.
 *
 * ⚠ THE RULE: no Model-tab control may call `onSendMessage` directly. Fronting
 * happens FIRST, then the send. It matters most for the structural CTAs ("Add a
 * factor", "Add a relationship", "Map interventions", "Explore other
 * strategies") — those terminate in a conversation rather than a mutation, so
 * an invisible conversation makes them dead ends. That combination — the tab's
 * only structural affordance ending in a hidden panel — is the measured
 * mechanism behind "the less I feel like I can actually directly edit the
 * decision model".
 */
export type HandOffToOlumi = (opts: {
  message: string
  reason?: string
}) => PanelFrontingOutcome

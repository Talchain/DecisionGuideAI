/**
 * `structural_add_edge` (schemas 0.50.0) — the wire shape for a NEW causal edge.
 *
 * ⭐⭐ ONE CARRIER, FOUR CANVAS GESTURES. Draw-a-link is the obvious one. The
 * other three are gestures users ALREADY perform and already believe work: the
 * five "Add connected …" affordances, duplicate, and paste. `structural_add`
 * covers the NODES those gestures create and nothing covers the EDGES, so a
 * duplicated subgraph reaches the server as disconnected nodes and returns on
 * the next reload having quietly lost its causal structure.
 *
 * ⚠ THIS MODULE DECIDES WHICH FIELDS GO ON THE WIRE AND NOTHING ELSE. The wire
 * TYPE comes from `@talchain/schemas`; the SEND happens at a store chokepoint,
 * exactly as `planStructuralAddIntent` is called only from `addNode`.
 *
 * ── ADDRESSED BY `(from, to)`, NEVER BY AN ID ─────────────────────────────
 * `EdgeV3Schema` declares NO `id` field, so an edge's only identity in the
 * canonical graph is its endpoint pair, and a client-local id
 * (`reactflow__edge-…`) is explicitly forbidden as a lookup key. Both endpoints
 * therefore use the OPEN endpoint predicate (`isCanonicalEndpointId`), the same
 * one `structural_delete` and `structural_rename` use for EXISTING nodes — NOT
 * `isWireUsableNewNodeId`, which validates a freshly minted id against the
 * narrow `NodeV3Schema.shape.id` pattern. Two predicates, named apart on
 * purpose.
 *
 * ── MAGNITUDE AND DIRECTION ARE SEPARATE, AND THAT IS THE POINT ───────────
 * Inherited from `edge_strength_edit`'s ruling that they must be, "so a strength
 * change cannot reverse an edge accidentally". `magnitude` is UNSIGNED and
 * `effect_direction` excludes `unknown` — a stated magnitude with an unknown
 * direction is an edge whose sign cannot be recovered.
 *
 * ⛔ SO THIS BUILDER NEVER INFERS A DIRECTION FROM THE SIGN OF A NUMBER. An
 * edge whose direction is genuinely unknown is a DIFFERENT product gesture and
 * does not ride this member; a caller that has no direction must not reach here
 * with a guessed one.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────
 * `std` and `exists_probability` are absent BY CONTRACT — "the server owns
 * them". CEE writes the canonical defaults and stamps no provenance claiming a
 * person supplied them, so the canvas's own provenance gates keep reading them
 * as defaults rather than measurements. A client that sent them would be
 * asserting a confidence nobody expressed.
 */
import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import { isCanonicalEndpointId } from './structuralDelete'
import { structuralEdgePairKey, type StructuralAddIntent, type StructuralAddLifecycleRecord } from './structuralAdd'

export type StructuralAddEdgeWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_add_edge' }
>

/** The `effect_direction` values this member admits. `unknown` is excluded. */
export type WireEdgeDirection = StructuralAddEdgeWireEvent['effect_direction']

export function isWireEdgeDirection(value: unknown): value is WireEdgeDirection {
  return value === 'positive' || value === 'negative'
}

/**
 * ⚠ REFUSE, NEVER CLAMP. `magnitude: z.number().finite().min(0).max(1)`. The
 * canvas does NOT share that bound — `EDGE_VALUE_DOMAINS.weight` is declared
 * open and the Model tab's weight chip accepts 0–2 — so a caller can genuinely
 * hold 1.5. Clamping it to 1 would send a number the user never stated and CEE
 * would persist it as theirs, which is the exact reasoning
 * `buildEdgeStrengthEditEvent` records for refusing rather than clamping.
 */
export function isWireUsableMagnitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export interface BuildStructuralAddEdgeArgs {
  from: unknown
  to: unknown
  /** UNSIGNED. The sign is carried by `direction` and applied server-side. */
  magnitude: unknown
  direction: unknown
  /** The canonical hash the client last read. The stale gate is non-optional. */
  baseGraphHash: unknown
}

/**
 * ⭐ THE BUILDER, AND IT FAILS CLOSED IN EVERY ARM.
 *
 * `null` means "this gesture has no truthful wire form", never "send something
 * approximate". Every caller must treat `null` as a stand-down and say so to the
 * user rather than writing locally and hoping — a local edge with no wire event
 * is precisely the silent loss this carrier exists to end.
 */
export function buildStructuralAddEdgeEvent({
  from,
  to,
  magnitude,
  direction,
  baseGraphHash,
}: BuildStructuralAddEdgeArgs): StructuralAddEdgeWireEvent | null {
  if (!isCanonicalEndpointId(from)) return null
  if (!isCanonicalEndpointId(to)) return null
  if (!isWireUsableMagnitude(magnitude)) return null
  if (!isWireEdgeDirection(direction)) return null
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) return null

  return {
    kind: 'structural_add_edge',
    from,
    to,
    magnitude,
    effect_direction: direction,
    base_graph_hash: baseGraphHash,
  } as StructuralAddEdgeWireEvent
}

/* ════════════════════════════════════════════════════════════════════════
 * CAPTURE — turning a canvas gesture into a durable intent
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * ⭐⭐⭐ THE RULE THAT DECIDES WHICH GESTURES CAN RIDE THIS CARRIER, AND IT IS
 * NOT THE ONE I EXPECTED WHEN I STARTED.
 *
 * `structural_add_edge` REQUIRES a `magnitude` and an `effect_direction`. A
 * freshly drawn link has neither: `onConnect` creates it from
 * `USER_EDGE_DEFAULTS`, which is `weight: 0.3, direction: 'positive'` and
 * carries **no `weightSource` and no `directionSource`** — so the canvas's own
 * provenance gates already read both as NOT SET, and every surface says so.
 *
 * ⛔ SO A BARE DRAW-A-LINK MUST NOT BE SENT. Putting `0.3` on the wire would
 * assert a strength the user never stated, CEE would persist it as theirs, and
 * PLoT would analyse it — a fabricated number reaching the model through the one
 * door this estate guards hardest. `USER_EDGE_DEFAULTS.weight` is the exact
 * constant `formatNumericLabel`'s header records the canvas once printing as a
 * measurement (ROADMAP 2.950). Sending it would be that defect, server-side.
 *
 * ⭐ WHAT THIS DOES COVER: every gesture whose edge arrives WITH a stated
 * strength and direction — today, an edge COPIED from one that already had
 * both (duplicate, paste), and any edge whose strength somebody states later,
 * via `retryStructuralAddEdgeCapture`.
 *
 * ⚠⚠ CORRECTED 18 Sep 2026 — THIS PARAGRAPH NAMED THE "ADD CONNECTED …"
 * AFFORDANCES AS COVERED, "carrying real provenance from … the choice the user
 * made". **That is false, and it is two different things under one word.** The
 * "direction" those items choose is `edgeDirection` — the TOPOLOGY, i.e. which
 * end of the new link is the source (`getEdgeDirectionForKind` returns
 * `'to-target'` or `'from-target'`). It is NOT `effect_direction`, the
 * positive/negative SIGN this member requires. The gesture states neither a
 * magnitude nor a sign: it builds the edge from `USER_EDGE_DEFAULTS`, which
 * carries no `weightSource` and no `directionSource`. So an "Add connected …"
 * link stands down here at `strength_not_stated`, exactly like a bare drag —
 * which is the correct outcome and the reason `store.addNodeWithEdge` records
 * the stand-down on the edge for `EdgePanel` to act on. ⭐ Two senses of
 * "direction" under one name is CLAUDE.md trap 21, and it had already produced a
 * false coverage claim in this file's own header.
 *
 * ⚠⚠ AND THE GAP THIS LEAVES, STATED RATHER THAN PAPERED OVER: a link drawn
 * with no strength CANNOT become durable under the current contract. It cannot
 * ride this member (no magnitude to state), and it cannot be repaired later by
 * `edge_strength_edit` either, because that member EDITS an edge the server
 * already holds — and the server never received this one. The product gesture
 * "these two things are connected, I don't yet know how strongly" has no wire
 * form. That is a CONTRACT gap, not a UI one, and it is reported rather than
 * worked around here.
 */
export interface StructuralAddEdgeIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** The canvas edge id — LOCAL only, never sent. Used to bind the intent. */
  readonly edgeId: string
  readonly from: string
  readonly to: string
  /** UNSIGNED, and provenance-gated: only a strength somebody SET reaches here. */
  readonly magnitude: number
  readonly direction: WireEdgeDirection
  /** `null` means "no turn has stamped one yet" — a DEFERRAL, never a drop. */
  readonly baseGraphHash: string | null
  /**
   * The `StructuralAddIntent.id` of the node add this link DEPENDS ON — set
   * only when one gesture minted the endpoint node and this link together
   * (`store.addNodeWithEdge`). While it is set, `baseGraphHash` is `null`: the
   * only true base is the hash that node's own write returns, which does not
   * exist yet. See {@link chainStructuralAddEdgeToNodeAdd}.
   */
  readonly afterNodeAddIntentId?: string
}

export type ResolvedStructuralAddEdgeIntent = StructuralAddEdgeIntent & {
  readonly baseGraphHash: string
}

/** Why an add-edge gesture produced no wire intent. Never a silent drop. */
export type StructuralAddEdgeStandDownReason =
  /** The mutation came from a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'
  /** The edge is not on the canvas, so there is nothing to add on the wire. */
  | 'edge_absent'
  /** An endpoint is not a canonical id — a dangling edge is what CEE refuses. */
  | 'endpoint_unusable'
  /**
   * ⭐ THE COMMON ONE, AND IT IS NOT A FAILURE. Nobody has stated a strength or
   * a direction, so there is no truthful `magnitude` to send. See the header.
   */
  | 'strength_not_stated'

export type CaptureStructuralAddEdgeResult =
  | { ok: true; intent: StructuralAddEdgeIntent; deferred: boolean }
  | { ok: false; reason: StructuralAddEdgeStandDownReason }

export interface CaptureStructuralAddEdgeInput {
  /** The edges AFTER the add — the gesture's own result, never the prior state. */
  readonly edgesAfter: ReadonlyArray<{ id: string; source: string; target: string; data?: unknown }>
  readonly edgeId: string
  readonly baseGraphHash: unknown
  readonly externalMutationActive: boolean
  /**
   * The provenance-gated strength for an edge's data, injected rather than
   * imported so this module holds no second copy of the gate. Callers pass
   * `resolveEdgeSignedStrengthDisplay`; it returns `show: false` for anything
   * nobody set, INCLUDING `USER_EDGE_DEFAULTS`.
   */
  readonly resolveSignedStrength: (data: unknown) => { show: boolean; value?: number }
  /** Same discipline for the direction claim. */
  readonly resolveDirection: (data: unknown) => { show: boolean; direction?: string }
  readonly makeId: () => string
  /**
   * The kind of the node at an endpoint id (`decision` / `option` / `factor` …),
   * read from the graph the gesture produced. Optional: without it every link is
   * treated as causal, exactly as before.
   */
  readonly endpointKind?: (id: string) => string | undefined
}

/**
 * ⭐ CEE'S STRUCTURAL-LINK CONVENTION — the one form every Decision → option and
 * option → factor link takes in the committed graph (read back on served CEE,
 * scenario 9b0c62d6, 24 Sep 2026: all four `dec_pricing → opt_*` and every
 * `opt_* → fac_*` edge carry `strength {mean: 1, std: 0.01}`,
 * `effect_direction: 'positive'`, `exists_probability: 1`).
 *
 * These links make NO causal claim — the option's effect lives in its
 * interventions, not in the link — so sending the convention is not the
 * fabricated strength the stand-down below exists to stop. Without it,
 * Decision "+ Add option" persisted an option CEE could never compare ("It isn't
 * connected to anything yet").
 */
export const STRUCTURAL_LINK_CONVENTION = { magnitude: 1, direction: 'positive' } as const

const STRUCTURAL_KIND_PAIRS: ReadonlySet<string> = new Set(['decision>option', 'option>factor'])

/** The convention when `source → target` is structural by kind, else `null` (a causal link). */
export function structuralLinkConvention(
  sourceKind: string | undefined,
  targetKind: string | undefined,
): typeof STRUCTURAL_LINK_CONVENTION | null {
  if (!sourceKind || !targetKind) return null
  return STRUCTURAL_KIND_PAIRS.has(`${sourceKind}>${targetKind}`) ? STRUCTURAL_LINK_CONVENTION : null
}

export function captureStructuralAddEdge(
  input: CaptureStructuralAddEdgeInput,
): CaptureStructuralAddEdgeResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  // BOUND BY IDENTITY — the edge id, never an endpoint-pair scan another edge
  // could satisfy. Two edges between the same nodes cannot coexist, but a scan
  // would still find the WRONG one mid-gesture while the canvas holds both.
  const edge = input.edgesAfter.find((e) => e.id === input.edgeId)
  if (!edge) return { ok: false, reason: 'edge_absent' }
  if (!isCanonicalEndpointId(edge.source) || !isCanonicalEndpointId(edge.target)) {
    return { ok: false, reason: 'endpoint_unusable' }
  }

  // ⛔ THE PROVENANCE GATE — the whole reason this capture exists rather than a
  // straight read of `edge.data.weight`. Both halves must be SET: a stated
  // magnitude with an unstated direction is an edge whose sign cannot be
  // recovered, which the contract excludes by construction.
  const rawBaseForStructural = input.baseGraphHash
  const structural = structuralLinkConvention(
    input.endpointKind?.(edge.source),
    input.endpointKind?.(edge.target),
  )
  if (structural) {
    const base =
      typeof rawBaseForStructural === 'string' && rawBaseForStructural.length > 0 ? rawBaseForStructural : null
    return {
      ok: true,
      deferred: base === null,
      intent: {
        id: input.makeId(),
        edgeId: edge.id,
        from: edge.source,
        to: edge.target,
        magnitude: structural.magnitude,
        direction: structural.direction,
        baseGraphHash: base,
      },
    }
  }

  const strength = input.resolveSignedStrength(edge.data)
  const direction = input.resolveDirection(edge.data)
  if (!strength.show || typeof strength.value !== 'number') {
    return { ok: false, reason: 'strength_not_stated' }
  }
  if (!direction.show || !isWireEdgeDirection(direction.direction)) {
    return { ok: false, reason: 'strength_not_stated' }
  }

  const magnitude = Math.abs(strength.value)
  // The contract bound, applied at CAPTURE so an unsendable intent never enters
  // the queue. Refuse, never clamp — see `isWireUsableMagnitude`.
  if (!isWireUsableMagnitude(magnitude)) return { ok: false, reason: 'strength_not_stated' }

  const rawBase = input.baseGraphHash
  const baseGraphHash = typeof rawBase === 'string' && rawBase.length > 0 ? rawBase : null

  return {
    ok: true,
    deferred: baseGraphHash === null,
    intent: {
      id: input.makeId(),
      edgeId: edge.id,
      from: edge.source,
      to: edge.target,
      magnitude,
      direction: direction.direction,
      baseGraphHash,
    },
  }
}

/** Stamp a deferred intent with the hash that has since arrived, or refuse. */
export function resolveStructuralAddEdgeBase(
  intent: StructuralAddEdgeIntent,
  currentBaseGraphHash: string | null,
): ResolvedStructuralAddEdgeIntent | null {
  if (typeof intent.baseGraphHash === 'string' && intent.baseGraphHash.length > 0) {
    return intent as ResolvedStructuralAddEdgeIntent
  }
  if (typeof currentBaseGraphHash !== 'string' || currentBaseGraphHash.length === 0) return null
  return { ...intent, baseGraphHash: currentBaseGraphHash }
}

/* ════════════════════════════════════════════════════════════════════════
 * CHAINING — a link whose endpoint was minted by the SAME gesture
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * ⭐⭐ BIND A LINK TO THE NODE ADD IT DEPENDS ON.
 *
 * THE SERVED DEFECT (UI `eec722ab`, CEE staging, 25 Sep 2026 23:12Z): Decision
 * "+ Add option" sent `structural_add` on base `a8e8…` → 200, `graph_hash`
 * `4892…`; then `structural_add_edge` for the decision link ALSO on `a8e8…` →
 * 409 `BASE_HASH_DIVERGED`, `expected_base_graph_hash: 4892…`. CEE kept an
 * option linked to nothing (OPTION_NOT_LINKED_TO_DECISION — unrunnable).
 *
 * `store.addNodeWithEdge` captures both halves in ONE `set()` against ONE
 * `lastServerGraphHash`, and an add ALWAYS moves CEE's hash, so the link's
 * captured base is stale BY CONSTRUCTION. Serialising the two sends does not
 * help on its own: the link's payload is built with the base it carries.
 *
 * So the link carries NO base of its own — `null`, "not yet" — plus the id of
 * the node add, and {@link readChainedStructuralAddEdge} stamps the hash that
 * node's write RETURNED. This is a chain, not a refresh: it asserts exactly the
 * graph the user produced (theirs plus the node), and a turn that moved the
 * graph in between still refuses it, as it should.
 *
 * BOUND BY IDENTITY: chained only when the link's endpoint IS the node this add
 * minted. Any other pairing is returned unchanged.
 */
export function chainStructuralAddEdgeToNodeAdd(
  edge: StructuralAddEdgeIntent,
  nodeAdd: Pick<StructuralAddIntent, 'id' | 'nodeId'>,
): StructuralAddEdgeIntent {
  if (edge.from !== nodeAdd.nodeId && edge.to !== nodeAdd.nodeId) return edge
  return { ...edge, baseGraphHash: null, afterNodeAddIntentId: nodeAdd.id }
}

/** Where a queued link stands relative to the node add it depends on. */
export type ChainedStructuralAddEdgeReadiness =
  /** No dependency — the ordinary drain rules apply. */
  | { readonly kind: 'independent' }
  /** The node add has not settled yet. Leave the link in the queue. */
  | { readonly kind: 'hold' }
  /**
   * The node add COMMITTED. `baseGraphHash` is the hash its write returned, or
   * `null` when that response carried none — then the freshest known hash is
   * the only base left, exactly as for any deferred intent.
   */
  | { readonly kind: 'send'; readonly baseGraphHash: string | null }
  /**
   * The node add COMMITTED and its committed graph ALREADY HOLDS this exact
   * pair — CEE wrote the link in the node's own commit. Nothing to send; the
   * local link is canonical truth as it stands.
   */
  | { readonly kind: 'already_linked' }
  /**
   * The node add did not commit (refused, unconfirmed) or its record is gone.
   * The link is NOT sent: it would name an endpoint the server may not hold,
   * and the node's own settle has already told the user where the gesture
   * stands.
   */
  | { readonly kind: 'stand_down'; readonly nodeStatus: 'refused' | 'unconfirmed' | 'missing' }

/**
 * Read whether a queued link may go on the wire yet. Pure — the drain supplies
 * the store's add queue and add lifecycle.
 */
export function readChainedStructuralAddEdge(
  intent: StructuralAddEdgeIntent,
  pendingAdds: ReadonlyArray<Pick<StructuralAddIntent, 'id'>>,
  addLifecycle: ReadonlyArray<StructuralAddLifecycleRecord>,
): ChainedStructuralAddEdgeReadiness {
  const dependsOn = intent.afterNodeAddIntentId
  if (typeof dependsOn !== 'string' || dependsOn.length === 0) return { kind: 'independent' }
  if (pendingAdds.some((a) => a.id === dependsOn)) return { kind: 'hold' }
  const record = addLifecycle.find((r) => r.intent.id === dependsOn)
  if (!record) return { kind: 'stand_down', nodeStatus: 'missing' }
  if (record.status === 'in_flight') return { kind: 'hold' }
  if (record.status === 'committed') {
    // ⭐ THE SERVER'S ANSWER FIRST. The node's own commit may already hold this
    // exact pair (CEE #1937 links a new option to a model's sole decision in the
    // same write). Then the link is DONE: sending it would only draw CEE's
    // "already an option" reply into the conversation. Read by identity — the
    // pair, in its direction — never by a copy of CEE's rule.
    if (record.committedIncidentEdgeKeys?.includes(structuralEdgePairKey(intent.from, intent.to))) {
      return { kind: 'already_linked' }
    }
    const hash = record.committedGraphHash
    return { kind: 'send', baseGraphHash: typeof hash === 'string' && hash.length > 0 ? hash : null }
  }
  return { kind: 'stand_down', nodeStatus: record.status }
}

/**
 * The wire payload for one captured intent.
 *
 * Field names are the CONTRACT's, not the intent's, and the mapping lives in
 * exactly one place so a rename of the internal shape cannot silently change
 * what goes on the wire.
 */
export function buildStructuralAddEdgeWirePayload(
  intent: ResolvedStructuralAddEdgeIntent,
): Record<string, unknown> {
  return {
    from: intent.from,
    to: intent.to,
    magnitude: intent.magnitude,
    effect_direction: intent.direction,
    base_graph_hash: intent.baseGraphHash,
  }
}

export const STRUCTURAL_ADD_EDGE_DEFERRED_NOTICE =
  "Connection drawn. It isn't saved to the model yet — I'll save it with your next message. If you reload before then, it won't be there."

export const STRUCTURAL_ADD_EDGE_UNCONFIRMED_TOAST =
  "That connection went out just as you sent something else, so I can't tell you whether it saved. It's on the canvas — reload this decision to see what the model actually holds."

/**
 * ⭐ WHAT A USER IS TOLD WHEN THE LINK CANNOT BE SAVED AT ALL YET.
 *
 * Not a failure message, because nothing failed: they drew a connection and have
 * not said how strong it is, and the model has no way to hold "connected, but
 * unknown".
 *
 * ⛔⛔ THE FIRST VERSION OF THIS SENTENCE INSTRUCTED A GESTURE THE PRODUCT
 * REFUSES. ITS REASONING IS KEPT HERE STRUCK RATHER THAN DELETED, BECAUSE THE
 * REASONING IS WHAT WOULD BRING IT BACK:
 *
 * ~~"Set its strength to save it to the model — until then it stays on your
 * canvas only." Naming the ONE thing that makes it durable is the whole job of
 * this sentence — a generic "couldn't save" would leave them with no move.~~
 *
 * The instinct is right; the instruction was not executable. The ONLY writer of
 * `weight`/`weightSource` is `EdgePanel.setStrength`, and `EdgePanel` renders
 * that control `disabled` unless `edgeStrengthEditIsAssertable` holds — which
 * asks `buildEdgeStrengthEditEvent` for a strength **the server holds**, the one
 * thing a freshly drawn link has not got. So the very condition that fires this
 * notice also greys the control it pointed at, while the inspector beside it
 * says *"no strength on record … Ask Olumi to set its strength."* Both sentences
 * shipped in one bundle at `5978e8f4`.
 *
 * ⭐⭐ THE REVIEW LESSON, WHICH IS THE TRANSFERABLE PART: that sentence was
 * checked for being TRUTHFUL ABOUT A STATE, and witnessed on a real build. It
 * was never checked for the EXECUTABILITY OF THE ACTION IT INSTRUCTS. **Those
 * are two different properties of one string**, and only the first had a test.
 * `structuralAddEdge.needsStrengthNoticeIsExecutable.spec.ts` pins the second.
 *
 * ⛔ THE MOVE IT NAMES, AND THE ONE IT REFUSES TO NAME — THEY ARE NOT THE SAME
 * ACTION, AND THAT DISTINCTION IS THE WHOLE FIX.
 *
 * It does NOT say "set its strength", and it does NOT say "ask Olumi to set its
 * strength": both instruct an act upon an edge THE SERVER DOES NOT HAVE, which
 * is the defect this sentence is being rewritten to end. (⚠ The inspector's
 * `INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON` does say the latter. It is sound for
 * ITS population — a server-held link with no stated strength — and suspect for
 * this one. Two populations, one sentence; reported, not changed here.)
 *
 * It DOES say "ask Olumi to add this connection", because that is a DIFFERENT
 * act with its own evidence, derived at CEE `staging` d1fb9d4:
 *   · `add_edge` is a member of the LLM tool enum
 *     (`orchestrator/tools/anthropic-edit-graph-schema.ts:52`)
 *   · the prompt permits it EXACTLY in this case —
 *     *"Do not add_node, remove_node, add_edge, or remove_edge unless the user
 *     explicitly asked for a topology change"* (`edit-graph.ts:723`, `:731`)
 *   · and `add_edge` carries its own edge normalisation (`:1376`)
 *
 * ⭐ LADDER RUNG: **WIRE-WITNESSED.** Driven at the wire on the deployed build,
 * guest, fresh scenario, a pair chosen BY KIND and PINNED UNCONNECTED FIRST:
 * the request HELD rather than acting (`blocks: ["error","held_proposal"]`,
 * *"Nothing in the model moves until you confirm"*), one `"Yes"` confirmed it,
 * and a COLD RE-READ went **17 -> 18 edges** carrying
 * `{ strength: { mean: 0.3, std: 0.1 }, effect_direction: "positive" }`.
 *
 * ⚠ n=1 — ONE pair, ONE phrasing, factor->factor, guest, ONE build. **It proves
 * the route EXISTS AND PERSISTS. It does not measure RELIABILITY**, and a
 * separate lane's witness of a different request shape landed 1 of 4. **So the
 * copy still names the route and promises no outcome** — "if you want it in the
 * model", never "and it will be saved".
 *
 * ⛔ THIS ENTRY PREVIOUSLY READ "CODE EXISTS + PROMPT-SANCTIONED, NOT
 * wire-witnessed … the estate's one witness returned ZERO ops." **Both clauses
 * were superseded by the measurement above.** Kept struck rather than deleted
 * because the zero-ops citation is still in circulation: ~~"the structural edit
 * tool returned zero ops, so this route is unproven"~~ — that was an **add-RISK**
 * request; this is a **connect-two-existing-factors** request. **Two n=1
 * experiments of DIFFERENT SHAPES are not a disagreement**, and retiring the old
 * one as "wrong" would be as careless as inheriting it.
 *
 * ⭐ AND THE NUMBER CEE WROTE IS THE POINT OF THE WHOLE ASYMMETRY: `mean 0.3` —
 * the EXACT value this capture refuses to send. **CEE is entitled to ESTIMATE
 * and stamps it as its own; the canvas is not entitled to FABRICATE.** This
 * sentence sits precisely on that line.
 *
 * ⭐ AND THE ASYMMETRY THIS EXPOSES, WHICH IS BIGGER THAN THE COPY: **CEE can
 * add an edge WITH a strength to its own canonical graph from a chat turn; the
 * human canvas cannot.** The AI can do what the human cannot.
 */
export const STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE =
  "Connection drawn — it stays on your canvas only. Olumi can't save a link that has no strength. Ask Olumi to add this connection in the chat if you want it in the model."

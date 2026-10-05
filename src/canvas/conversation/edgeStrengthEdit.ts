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
 * ⚠⚠ AND THE FIRST VERSION OF THIS MODULE GOT THAT RULE WRONG IN THE ONE WAY
 * THAT MATTERS — corrected here, with the wrong reasoning left standing so it
 * is not re-derived. The original text read:
 *
 *   ~~So `expected` is taken from the two READ-SIDE GATES that already answer
 *   "was this number SET, or did it fall through to a UI default?" —
 *   `resolveEdgeSignedStrengthDisplay` and `resolveEdgeDirectionDisplay`
 *   (`canvas/domain/edgeValueProvenance.ts`).~~
 *
 * Those gates answer *may a surface SPEAK this number?*, and a user's own entry
 * is emphatically speakable — `setStrength` stamps `weightSource: 'user'` on
 * every local edit, INCLUDING the ones this builder refused to send, so the
 * gate said `show: true` and `expected` became a number only this client had
 * ever seen. The file those gates live in carries the header **"NOT FOR WIRE
 * PAYLOADS"**; the reviewer who approved this quoted it and argued it away as
 * *"a provenance question, not a numeric-behaviour one"*. That was the right
 * distinction and the wrong conclusion: `expected` is not a numeric-behaviour
 * question either. It is a question about the SERVER, and neither gate answers
 * it. The warning was the finding.
 *
 * `expected` is now taken from `./edgeServerStatedStrength.ts`, which answers
 * only that question and refuses when nothing proves the answer. Read its
 * header for the writer enumeration showing why no value of `weightSource` —
 * `'cee'` included — can stand in for it.
 *
 * ⚠ NOTHING IS RE-IMPLEMENTED. The display gates keep their whole job on the
 * display side; a second copy of a provenance rule would be this estate's
 * signature defect, and the fix is to name the two questions apart, not to
 * duplicate an answer.
 */
import type { Edge } from '@xyflow/react'

import { serverStatedStrengthOf } from './edgeServerStatedStrength'
import { isStrengthDefinitional } from '../domain/strengthDefinitional'
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
  /**
   * An EXPLICIT direction, stated by the caller rather than read off the sign of
   * `requestedMean`. When present it wins over both the sign rule and
   * `preserveDirection`.
   *
   * ⚠⚠ THIS IS NOT A CONVENIENCE, AND ROUTING A DIRECTION THROUGH
   * `requestedMean` INSTEAD IS UNSOUND. This file's own header states the rule —
   * *"a MAGNITUDE CANNOT CARRY A SIGN … at zero it is not even ambiguous, it is
   * unrepresentable (`-0 >= 0` is `true`)"*. A direction-only edit on an edge
   * whose server-stated magnitude is `0` therefore CANNOT be expressed as a
   * signed number: `-0` reads as `'positive'` and the user's `negative` is
   * silently inverted on the wire. `magnitude` and `direction_intent` are
   * separate fields in the contract for exactly this reason
   * (`@talchain/schemas` 0.54.0 — the version both repos pin; this cited 0.50.0
   * until 10 Sep 2026 and the describe string is unchanged across the two:
   * *"Direction is carried separately so a strength
   * change cannot reverse an edge accidentally"*), and this parameter is how a
   * caller reaches the second one without lying through the first.
   */
  directionIntent?: 'positive' | 'negative'
}

/**
 * ⭐ DOES THIS `set` CHANGE NOTHING THE SERVER HOLDS? CEE's own rule, mirrored exactly (`edge-strength-edit.ts`,
 * `set_target_unchanged`): the magnitude asked for IS the server-stated `|mean|`, and the direction is preserved or
 * restated as it already is. CEE refuses every such `set` — *"That link already has exactly that strength and
 * direction, so I haven't recorded it as your judgement"* — so it is never an edit, and no caller may write or stamp
 * it as one. Agreeing with the value that is there is `confirm_current` (`buildEdgeStrengthConfirmEvent`).
 * Acceptance #87 5986653143 (DL 0df0e1, 5 Oct): Review "0.25 → 0.25 · Confirm" sent this `set`, CEE refused it, and
 * the row still said "User edited".
 */
export function edgeStrengthEditChangesNothing(event: WireSystemEvent | null): boolean {
  if (event === null || event.type !== 'edge_strength_edit') return false
  const p = event.payload as {
    readonly magnitude?: unknown
    readonly direction_intent?: unknown
    readonly expected?: { readonly mean?: unknown; readonly effect_direction?: unknown }
    readonly intent?: unknown
  }
  if (p.intent !== 'set' || typeof p.magnitude !== 'number' || typeof p.expected?.mean !== 'number') return false
  return p.magnitude === Math.abs(p.expected.mean)
    && (p.direction_intent === 'preserve' || p.direction_intent === p.expected.effect_direction)
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
  directionIntent,
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

  // `expected` — what the SERVER holds. NOT what this canvas holds.
  //
  // ⚠⚠ THIS IS THE FIX-FORWARD ON #1287 AND THE ONE LINE TO READ. This gate was
  // `resolveEdgeSignedStrengthDisplay` + `resolveEdgeDirectionDisplay`, the two
  // DISPLAY resolvers — over a file header that says, in capitals, **NOT FOR
  // WIRE PAYLOADS**. They admit any value carrying a provenance stamp, and
  // `setStrength` stamps `weightSource: 'user'` on EVERY local edit including
  // the ones this builder just refused to send. So `expected` was built from a
  // number only this client had ever seen, and CEE — which compares it with a
  // bare `!==` and no tolerance — answers `edge_expected_tuple_mismatch`,
  // *"That link has changed since you opened it"*: a concurrent modification by
  // a third party who does not exist, for an edit that was fine.
  //
  // `serverStatedStrengthOf` answers the question this payload actually asks,
  // and refuses when nothing proves the answer. Its header carries the writer
  // enumeration that shows why no value of `weightSource` — including `'cee'` —
  // can stand in for it. Both halves arrive together as ONE recorded fact
  // because CEE compares both exactly; re-deriving either from a field the
  // canvas mutates locally is how the first version got here.
  const expected = serverStatedStrengthOf(edge.data as Record<string, unknown> | undefined)
  if (!expected) return null

  // ⚠ THE SAME RULE THE LOCAL WRITE APPLIES, ON PURPOSE. `setStrength` derives
  // `direction: mean >= 0 ? 'positive' : 'negative'` and writes nothing under
  // `preserveDirection`. Re-deriving it differently here would let the canvas
  // and the server disagree about what the user just said.
  // An EXPLICIT direction wins over both other rules. It is the only encoding
  // that survives a zero magnitude — see `directionIntent`'s note for why the
  // sign rule below cannot be asked to carry this question.
  const direction_intent: 'preserve' | 'positive' | 'negative' = directionIntent
    ? directionIntent
    : preserveDirection
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
      expected: { mean: expected.mean, effect_direction: expected.effect_direction },
      // ⚠ ALWAYS `'set'` ON THIS BUILDER. `'confirm_current'` is a
      // PROVENANCE-ONLY act with its own cross-field rules and its own product
      // meaning — "I ratify the number that is already there" — so it has its
      // own builder below (`buildEdgeStrengthConfirmEvent`) rather than a flag
      // here. Two acts, two builders, neither able to emit the other's shape.
      //
      // ⛔⛔ AMENDED 13 Sep 2026, AND THE SENTENCE THIS REPLACES WAS REFUTED AT
      // THE WIRE. It read: *"Sending `'set'` for it is not a lie: the user did
      // choose that number."* True about honesty, and beside the point — the
      // act CANNOT SUCCEED. CEE refuses a `set` that resolves to the strength
      // and direction already persisted (`set_target_unchanged`,
      // `system-events/edge-strength-edit.ts`), and its refusal text says
      // *"Confirm the current strength explicitly if you want to adopt the
      // existing value."* Witnessed on served `e6d7971b`: a user who agreed
      // with Olumi's estimate pressed Confirm, sent `intent:'set'` with
      // `magnitude` equal to `expected.mean`, and was refused.
      //
      // So the reasoning was about the wrong property. A label is not a lie
      // only if the thing it names can happen.
      intent: 'set',
    },
  }
}

/**
 * ⭐⭐ RATIFY THE STRENGTH THAT IS ALREADY THERE — the act the product has been
 * prescribing and unable to perform.
 *
 * "I agree with this estimate" is a DIFFERENT ACT from "change it to X", not a
 * degenerate case of it, and the producer treats it that way: a `set` resolving
 * to the persisted tuple is refused as `set_target_unchanged`, while
 * `confirm_current` is *"permission to stamp exactly two provenance fields"*.
 * Conflating them is what made the existing Confirm control unable to land.
 *
 * ⚠ EVERY FIELD IS DERIVED FROM THE SERVER-STATED TUPLE, AND THAT IS WHAT MAKES
 * THE CROSS-FIELD RULES UNBREAKABLE RATHER THAN MERELY OBSERVED. The contract
 * requires `direction_intent: 'preserve'` and `magnitude === abs(expected.mean)`
 * EXACTLY (`refineEdgeStrengthEdit` rule 2, mirrored at `v5/buildPayload.ts`).
 * Both are computed here from the same `expected` in the same expression, so
 * there is no arrangement of inputs that produces a payload violating them — as
 * opposed to a caller passing a magnitude that happens to match today.
 *
 * ⛔ THERE IS NO `requestedMean` PARAMETER, DELIBERATELY. A confirmation that
 * accepted a number could be handed one that differs from the persisted value,
 * and would then be a silent `set` wearing a confirmation's name — the mirror
 * image of the defect this closes. The only number it can send is the one the
 * server already holds.
 *
 * ⚠ AND CONFIRMING IS NOT VALIDATING. This records that a person agreed with an
 * estimate. It does not make the estimate correct, evidenced, or scientifically
 * supported, and no surface may present a confirmed strength as more than
 * "someone with judgement looked at this and did not change it".
 *
 * Returns `null` when nothing proves what the server holds — the same
 * `serverStatedStrengthOf` refusal the edit builder makes, for the same reason:
 * an `expected` tuple built from a number only this client has seen produces
 * `edge_expected_tuple_mismatch`, a concurrent modification by nobody.
 */
export function buildEdgeStrengthConfirmEvent({
  edge,
}: {
  edge: Edge | undefined | null
}): WireSystemEvent | null {
  if (!edge) return null
  const from = edge.source
  const to = edge.target
  if (!isCanonicalEndpointId(from) || !isCanonicalEndpointId(to)) return null

  const expected = serverStatedStrengthOf(edge.data as Record<string, unknown> | undefined)
  if (!expected) return null

  // Same `[0, 1]` contract bound the edit builder refuses rather than clamps.
  // Unreachable through a well-formed server tuple; asserted anyway, because
  // "unreachable" is a claim about today's producer.
  const magnitude = Math.abs(expected.mean)
  if (!Number.isFinite(magnitude) || magnitude > 1) return null

  return {
    type: 'edge_strength_edit',
    payload: {
      from,
      to,
      magnitude,
      direction_intent: 'preserve',
      expected: { mean: expected.mean, effect_direction: expected.effect_direction },
      intent: 'confirm_current',
    },
  }
}

/**
 * Can a strength edit on THIS EDGE be truthfully asserted to the server?
 *
 * ⭐ THE PER-EDGE GATE, AND IT IS A DERIVATION RATHER THAN A RE-STATEMENT OF THE
 * RULES ABOVE. A surface that offers a strength editor may offer it only where
 * the edit can reach the server: where `expected` is not assertable the builder
 * returns null, the edit lands LOCAL-ONLY, and an affordance that looks
 * server-backed while writing locally is design §2 F6 — the exact harm the Model
 * tab v2 was built to close. The gate is therefore PER-EDGE, never per-surface:
 * two rows in one list can legitimately differ.
 *
 * The question is asked OF THE BUILDER rather than of a copy of its conditions,
 * because a hand-copied gate is this estate's dominant defect class — it agrees
 * with its source on the day it is written and drifts silently afterwards
 * (CLAUDE.md trap 12). There is no second list here to keep in sync.
 *
 * ⚠ THE PROBE VALUE IS `0`, AND THE CHOICE IS LOAD-BEARING. Zero is inside every
 * numeric bound the builder enforces (finite, `magnitude ∈ [0, 1]`), so the only
 * things that can make this `null` are properties of the EDGE — a non-canonical
 * endpoint id, or no server-stated `expected` tuple. `preserveDirection: true`
 * is chosen for the same reason: it takes the direction question off the table,
 * so the answer is about the edge rather than about a number nobody has typed.
 *
 * ⚠ IT DOES NOT ANSWER "will THIS number be accepted", and must not be read as
 * though it did. The magnitude the user eventually types is checked at the
 * commit by the builder itself, against the same rules. Promising more here
 * would require a second copy of the contract's domain bound — the thing this
 * function exists to avoid.
 *
 * ⚠ AND IT FAILS CLOSED BY CONSTRUCTION. Were the builder ever to gain a rule
 * that rejects a zero magnitude, this reads `false` and the affordance renders
 * DISABLED — an edge that could have been edited looking like one that cannot,
 * which is the SAFE direction. The unsafe direction (an editor whose write
 * cannot land) is unreachable while this asks the builder rather than telling it.
 *
 * ⭐ AND A LINK THAT HOLDS BY DEFINITION IS NOT EDITABLE (MG ruling, 1 Oct 2026).
 * The builder WOULD build an event for it — it carries a server-stated tuple —
 * but CEE refuses every strength change on a definitional link (the parts of a
 * total, a risk's exposure to the goal), so an editor there is the same harm as
 * one whose write never leaves the browser: an offer that cannot land. ONE
 * predicate, `isStrengthDefinitional`, asked here so every caller of this gate
 * (the inspector fence and its note, the double-click hint, the Model tab row,
 * the results review entries) closes together. It is live only while the weight
 * is still CEE's: a strength the person set stays editable exactly as before.
 *
 * ⚠ THE BUILDER IS DELIBERATELY UNTOUCHED. Returning `null` there would turn a
 * stray write into a LOCAL-ONLY one (`not_wire_encodable`); this gate keeps the
 * editor from opening instead. And a caller whose false branch has words must
 * check `isStrengthDefinitional` FIRST: a definition is never "no strength on
 * record" or "cannot reach the model" — that is a different, transport fact.
 */
export function edgeStrengthEditIsAssertable(edge: Edge | undefined | null): boolean {
  if (!edge) return false
  if (isStrengthDefinitional(edge.data as Record<string, unknown> | undefined)) return false
  return buildEdgeStrengthEditEvent({ edge, requestedMean: 0, preserveDirection: true }) !== null
}

/**
 * Build the wire event for a DIRECTION-ONLY edit — "this link helps rather than
 * hurts" — leaving the strength the server holds exactly as it is.
 *
 * ⭐⭐ THE CARRIER ALREADY EXISTED; WHAT DID NOT WAS A WAY TO REACH IT. Derived
 * at `@talchain/schemas` 0.54.0 (the version BOTH repos pin — CEE
 * `package.json:97`, UI `package.json:116`. This read 0.50.0 until 10 Sep 2026,
 * a pin the staging merge in this very head had already moved; re-derived at the
 * vendored 0.54.0 tarball, `EdgeStrengthDirectionIntent` is still
 * `['preserve','positive','negative']` and `EdgeStrengthEditIntent` still
 * `['set','confirm_current']`, so the conclusion HOLDS and only the number was
 * stale): `edge_strength_edit` carries
 * `direction_intent: 'preserve' | 'positive' | 'negative'` as a FIELD OF ITS
 * OWN, and CEE has a `'mutating'` writer for the kind
 * (`SYSTEM_EVENT_HANDLING`, `system-events/dispatch.ts`) whose
 * `resolveEdgeStrengthTarget` resolves `effectDirection` from that field and
 * routes the write through the canonical `adjust_edge_strength` handler. So a
 * direction change has been server-expressible since 0.42.0 and reached CEE as
 * nothing at all: `useInspectorMutations.setDirection` performed one local
 * `updateEdge` and stamped `directionSource: 'user'` — a provenance claim about
 * a fact the server was never told, which then vanished on the next reload.
 * That silent loss is the reason this exists.
 *
 * ⚠ NO NEW EVENT KIND, AND THAT IS THE POINT. Minting one would need an
 * olumi-schemas release, a CEE re-vendor and a sequenced two-service deploy
 * (every `SystemEventSchema` member is `.strict()` inside a discriminated union,
 * so an older reader rejects the WHOLE turn, not just the field). This reuses
 * the deployed member instead, so the reader-first obligation is ALREADY
 * SATISFIED rather than newly incurred.
 *
 * ⚠ IT DELEGATES TO `buildEdgeStrengthEditEvent` RATHER THAN ASSEMBLING A
 * SECOND PAYLOAD. Every rule that decides whether this edit can be asserted —
 * canonical endpoint ids, the server-stated `expected` tuple, the magnitude
 * bound — lives there and is applied here by CALLING it. A second copy of those
 * conditions is this estate's dominant defect class (CLAUDE.md trap 12): it
 * agrees with its source on the day it is written and drifts silently after.
 *
 * ⚠ THE MAGNITUDE IS THE SERVER'S, NOT THE CANVAS'S. `expected.mean` is what
 * CEE holds; `edge.data.weight` is a locally-mutable number this client may
 * have written and the server may never have seen. CEE compares `expected` with
 * a bare `!==` and answers `edge_expected_tuple_mismatch` — *"That link has
 * changed since you opened it"* — on any disagreement, so sending the local
 * weight would manufacture a phantom concurrent edit for a change that was fine.
 *
 * Returns `null` on the same terms as the strength builder: the edit cannot be
 * asserted truthfully. `null` is NOT an error and must not suppress the local
 * write — see `setDirection`.
 */
export interface BuildEdgeDirectionEditArgs {
  /** The edge as it was BEFORE the local write — `expected` describes the past. */
  edge: Edge
  /** The direction the USER chose. Never inferred from a number. */
  direction: 'positive' | 'negative'
}

export function buildEdgeDirectionEditEvent({
  edge,
  direction,
}: BuildEdgeDirectionEditArgs): WireSystemEvent | null {
  if (!edge) return null

  // Asked of the same resolver the strength builder uses, for the same reason
  // its own note gives: no value of `weightSource` — `'cee'` included — can
  // stand in for a fact the server actually stated.
  const expected = serverStatedStrengthOf(edge.data as Record<string, unknown> | undefined)
  if (!expected) return null

  return buildEdgeStrengthEditEvent({
    edge,
    // The size the server holds, unchanged. Passed UNSIGNED and paired with an
    // explicit `directionIntent`: the sign of this number is deliberately not
    // load-bearing, because at `expected.mean === 0` it could not be.
    requestedMean: Math.abs(expected.mean),
    directionIntent: direction,
  })
}

/**
 * Can a direction edit on THIS EDGE be truthfully asserted to the server?
 *
 * ⭐ THE PER-EDGE GATE, ASKED OF THE BUILDER RATHER THAN RESTATED — the same
 * shape as `edgeStrengthEditIsAssertable` above and for the same reason. A
 * surface offering a direction control where the write cannot land is design §2
 * F6: an affordance that looks server-backed while writing locally.
 *
 * ⚠ THE PROBE DIRECTION IS ARBITRARY AND THAT IS SAFE, unlike the probe VALUE
 * in the strength gate. `direction` cannot influence the builder's `null` arms —
 * both members are legal at every magnitude, including zero — so the answer is
 * a property of the EDGE alone: a non-canonical endpoint id, or no server-stated
 * `expected` tuple. If that ever stops being true this reads `false` and the
 * affordance renders DISABLED, which is the safe direction.
 */
export function edgeDirectionEditIsAssertable(edge: Edge | undefined | null): boolean {
  if (!edge) return false
  return buildEdgeDirectionEditEvent({ edge, direction: 'positive' }) !== null
}

/**
 * What the deferral queue does with a QUEUED link-strength `set` at the moment
 * it finally dispatches.
 *
 *   · `unchanged`    — send the payload exactly as queued.
 *   · `rebased`      — send `event`: the same request, with `expected`
 *                      re-read from what the server holds NOW.
 *   · `already_held` — the server already holds exactly what this edit asks
 *                      for, so there is nothing to send.
 */
export type DeferredEdgeStrengthDispatch<E extends QueuedSystemEvent = WireSystemEvent> =
  | { kind: 'unchanged' }
  | { kind: 'rebased'; event: E }
  | { kind: 'already_held' }

/** The shape a queued send carries — wire or internal event, same `type` + `payload`. */
interface QueuedSystemEvent {
  readonly type: string
  readonly payload?: Record<string, unknown>
}

/**
 * ⭐⭐ `expected` IS A CLAIM ABOUT THE SERVER AT DISPATCH, NOT AT THE CLICK
 * (canvas audit edit-values F1/F2, reproduced 3/3 on served `d87eeb94`).
 *
 * `setStrength` builds its whole wire event at the click, including
 * `expected` from `serverStatedStrengthOf(edge.data)`. That is right for a send
 * that leaves at once. It is wrong for one the in-flight lock QUEUES: the queued
 * payload carries the tuple the server held before the edit already on the
 * wire, so once that edit applies CEE refuses the queued one with 409
 * `edge_expected_tuple_mismatch` — every step of a slow slider drag, the second
 * of two quick band clicks. Worse, when the user later moves the link back to
 * that old value, the stale tuple matches again and a superseded gesture
 * APPLIES over the newer choice (the skeptic's resurrect run: CEE -0.85, panel
 * "Moderate 0.30").
 *
 * The request the user made (`magnitude`, `direction_intent`) is unchanged
 * here; only the ASSERTION about what the server holds is re-read, from the same
 * `serverStatedStrengthOf` the builder uses, off the edge as it stands when the
 * send actually leaves. That is exactly what a click made after the first
 * receipt would have sent — the control run with an 8 s gap, which applied.
 *
 * ⛔ WHAT THIS DOES NOT REBASE, deliberately:
 *   · `confirm_current` — "I agree with THIS number". Its magnitude IS the
 *     asserted tuple (`refineEdgeStrengthEdit` rule 2); re-reading it would
 *     confirm a number the person never saw. Left to CEE to refuse.
 *   · a DIRECTION edit (`directionEdit`) — its magnitude is the server's `|mean|`
 *     read at the click (`buildEdgeDirectionEditEvent`), so re-reading only
 *     `expected` would send the old magnitude against the new tuple and silently
 *     undo a strength edit that landed in between. Rebasing it needs the pending
 *     register re-keyed as well; left as queued, so a stale one is refused.
 *   · an edge the store no longer holds, an endpoint pair that no longer
 *     matches, or no server-stated tuple — nothing proves a better answer, so
 *     the queued payload stands and CEE decides.
 *
 * `already_held` is returned only when the tuple MOVED since the click and now
 * equals the request (drag 0.25 → 0.3 → 0.35 → back to 0.3 while the 0.3 was on
 * the wire). Sending it would earn `set_target_unchanged`, "That link already
 * has exactly that strength", about a gesture that landed. An unmoved tuple is
 * never short-circuited: that send is the click's own business.
 */
export function rebaseDeferredEdgeStrengthEdit<E extends QueuedSystemEvent>(
  event: E,
  edge: Edge | undefined | null,
  opts: { directionEdit: boolean },
): DeferredEdgeStrengthDispatch<E> {
  if (event.type !== 'edge_strength_edit' || opts.directionEdit) return { kind: 'unchanged' }
  const payload = event.payload
  if (!payload || payload.intent !== 'set') return { kind: 'unchanged' }
  if (!edge || edge.source !== payload.from || edge.target !== payload.to) return { kind: 'unchanged' }
  const now = serverStatedStrengthOf(edge.data as Record<string, unknown> | undefined)
  if (!now) return { kind: 'unchanged' }
  const queued = payload.expected as { mean?: unknown; effect_direction?: unknown } | undefined
  if (queued && queued.mean === now.mean && queued.effect_direction === now.effect_direction) {
    return { kind: 'unchanged' }
  }
  const magnitude = payload.magnitude
  const intent = payload.direction_intent
  if (
    typeof magnitude === 'number' &&
    Math.abs(now.mean) === magnitude &&
    (intent === 'preserve' || intent === now.effect_direction)
  ) {
    return { kind: 'already_held' }
  }
  return {
    kind: 'rebased',
    event: {
      ...event,
      payload: { ...payload, expected: { mean: now.mean, effect_direction: now.effect_direction } },
    },
  }
}

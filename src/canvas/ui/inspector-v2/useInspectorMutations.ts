/**
 * Inspector v2 — typed mutation hooks
 *
 * All panels use these instead of raw store calls.
 * Single interception point for validate-patch migration.
 */

import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../../store'
import type { RiskImpact } from '../../domain/nodes'
import { useOptionalConversationContext } from '../../conversation/ConversationContext'
import { isProvenNoWriteConflict } from '../../../v5/provenNoWriteConflict'
import {
  buildEdgeStrengthEditWirePayload,
  buildEdgeStrengthRevertPatch,
  captureEdgeStrengthEdit,
  edgeStrengthDivergedNotice,
  readEdgeStrengthExpected,
  readRefusedCurrentStrength,
  EDGE_STRENGTH_NOTICE,
  type EdgeStrengthDirectionIntent,
  type EdgeStrengthEditIntent,
  type EdgeStrengthExpected,
} from '../../mutations/edgeStrengthEdit'

// ─── Editor-written-field manifest (single source of truth) ────────────
//
// Every setter below writes one or more top-level `data` fields. Which fields
// each setter writes is declared ONCE here, co-located with the setters, rather
// than re-typed into a hand-list inside a distant guard spec (that mirror
// silently drifted and OMITTED edge `label`, so `label` could be denylisted with
// the deny-direction guard staying green — Codex P2).
//
// This map CANNOT drift from the setters: the co-located behavioural spec
// (__tests__/useInspectorMutations.writtenFields.spec.tsx) renders the hooks,
// asserts the returned setter names EQUAL these keys (a new/removed setter fails
// RED), and DRIVES every setter to assert the data-field keys it actually writes
// EQUAL the value here (a setter that starts writing a new/renamed field fails
// RED). `analyticalNodeFields.registry.spec.ts` imports EDITOR_WRITTEN_FIELDS as
// its deny-direction persist set (no persistent editor field may be denylisted),
// so the manifest, the setters and the guard can no longer disagree.
//
// Fields written by editors OUTSIDE this hook (e.g. the goal-threshold store
// action, the baseline toggle, the model-action apply path) are NOT listed here
// — they are named in the registry guard's residual list with their write sites.

/**
 * The node-label length limit, OWNED BY THE SETTER THAT ENFORCES IT (L-04).
 *
 * The inspector input previously allowed 500 characters while this setter
 * sliced to 100 and reported nothing — a silent truncation the user could not
 * see coming. The input now imports this constant rather than re-typing a
 * number, so the two cannot drift apart again: there is one limit, and it is
 * this one.
 */
export const NODE_LABEL_MAX_LENGTH = 100

/** node setter name → the top-level `data` field(s) that setter writes. */
export const NODE_SETTER_FIELDS = {
  setLabel: ['label'],
  setDescription: ['description'],
  setThreshold: ['goal_threshold_raw', 'goal_threshold_unit'],
  // Also clears the top-level `display_value` — CEE writes that key at either
  // level, and a value commit invalidates BOTH copies of the old prose.
  setObservedValue: ['observedState', 'display_value'],
  setIntervention: ['interventions'],
  removeIntervention: ['interventions'],
  setPriorRange: ['prior'],
  setObservedRawValue: ['observedState'],
  setObservedUnit: ['observedState'],
  setObservedCap: ['observedState'],
  setObservedBaseline: ['observedState'],
  setObservedStd: ['observedState'],
  setObservedSource: ['observedState'],
  setCategory: ['category'],
  setExtractionType: ['extractionType'],
  setFactorType: ['factor_type'],
  setStateSpaceRange: ['state_space'],
  setUncertaintyDrivers: ['uncertainty_drivers'],
  setGoalCap: ['goal_threshold_cap'],
  setProbability: ['probability'],
  setImpact: ['impact'],
} as const satisfies Record<string, readonly string[]>

/** edge setter name → the top-level `data` field(s) that setter writes. */
export const EDGE_SETTER_FIELDS = {
  // The `*Source` markers ride along with the value each setter writes: a
  // user moving the slider is the ONLY thing that turns a defaulted number
  // into a set one, so the stamp is written in the same update as the value
  // and can never lag behind it.
  // `direction` is the SIGNED-mean path, which is the default and what the
  // guard spec drives. A caller passing `{ preserveDirection: true }` writes
  // `weight` + `weightSource` only, deliberately leaving `direction` alone —
  // see the setter's own header for why a magnitude cannot carry a sign.
  setStrength: ['weight', 'direction', 'weightSource', 'directionSource'],
  // The DURABLE twin of `setStrength` (schemas 0.42.0). It writes the SAME
  // fields — it is `setStrength` plus a wire emission, not a different write —
  // so a caller can swap one for the other without changing what lands in the
  // store. See the setter's own header for why the emission cannot live inside
  // `setStrength` itself.
  commitStrength: ['weight', 'direction', 'weightSource', 'directionSource'],
  setStd: ['strengthStd', 'strengthStdSource'],
  setExistsProbability: ['beliefExists', 'beliefExistsSource'],
  setLabel: ['label'],
  setDirection: ['direction', 'directionSource'],
} as const satisfies Record<string, readonly string[]>

/**
 * The flattened, de-duplicated set of node/edge `data` fields the inspector
 * setters write. Derived from the per-setter maps above so it cannot disagree
 * with them. This is the export the deny-direction registry guard consumes.
 */
export const EDITOR_WRITTEN_FIELDS = {
  node: [...new Set(Object.values(NODE_SETTER_FIELDS).flat())],
  edge: [...new Set(Object.values(EDGE_SETTER_FIELDS).flat())],
} as const

/**
 * ⭐ THE INSPECTOR'S READ-ONLY POLICY LIVES IN ITS ENFORCEMENT, NOT IN A TABLE.
 *
 * Two authority manifests used to sit here — `NODE_SETTER_AUTHORITY` (21 keys)
 * and `EDGE_SETTER_AUTHORITY` (5), every value `'disabled'`. They were DELETED
 * on 26 Aug 2026 because they had **zero code consumers**: outside their own
 * definition and `mutationAuthority.spec.ts`, every reference to either was a
 * comment or a documentation string, and NONE WAS A CONSUMER. Nothing branched
 * on them. A table nothing reads cannot drift — and cannot enforce either; it
 * was a hand-maintained mirror of a decision that is actually made somewhere
 * else.
 *
 * ⚠ THAT SENTENCE SAID "every reference … was a COMMENT" UNTIL 27 Aug 2026,
 * AND THAT WAS FALSE — corrected after an independent review found the
 * counter-example. `canvas/domain/analyticalNodeFields.ts:158` names
 * `NODE_SETTER_AUTHORITY.setPriorRange` inside a RUNTIME STRING LITERAL, in a
 * file imported by `useAutosave`, `graphChangeDiff`, `analyticalChange` and
 * `useGraphEditEvents` — so it ships to browsers. The narrow claim the
 * deletion actually rests on ("zero code CONSUMERS": nothing branches on
 * either table) is true and was always the load-bearing one; "a COMMENT" was a
 * careless widening of it. **The distinction matters because a string that
 * ships is prose the PRODUCT carries, not prose the repo carries** — this
 * deletion converts that literal from true to false, and repairing it is a
 * separate owned follow-up, deliberately not done here because you cannot
 * write "the table was deleted" before it is.
 *
 * WHERE IT IS ACTUALLY MADE: `InspectorRouter` wraps every panel — node
 * (`InspectorRouter.tsx:334`) and edge (`:221`) — in an unconditional
 * `<fieldset disabled data-authority="disabled">`, beneath a note rendering
 * `INSPECTOR_READ_ONLY_REASON` and bound to it by `aria-describedby`.
 *
 * ⭐ THE FIELDSET IS STRUCTURAL WHERE THE MANIFESTS WERE CLERICAL. It disables
 * every descendant FORM CONTROL — `button`, `input`, `select`, `textarea` —
 * without anyone remembering to classify it. The manifests could only record a
 * decision after the fact; the fieldset makes it. Their one real contribution —
 * a completeness check that every setter was classified — is replaced by a
 * DOM-level claim that no control escapes the boundary, which holds however
 * many setters exist.
 *
 * ⚠ THIS PARAGRAPH SAID "STRICTLY STRONGER … a setter added tomorrow is inert"
 * UNTIL 27 Aug 2026. AN INDEPENDENT REVIEW REFUTED IT BY EXECUTION, so the
 * scope is now stated exactly. `<fieldset disabled>` inerts form-associated
 * descendants ONLY. It does NOT inert a `[role="button"]` div, a
 * `[contenteditable]`, or an `a[href]`. Measured inside this very boundary:
 * one such div (`EmptyDescriptionPrompt`, `tabindex=0`) takes focus, fires its
 * handler and opens an editor, while the two real `<button>`s beside it are
 * disabled in the same run. "A setter added tomorrow is inert" is therefore
 * true of a form control and false of a div with a click handler — which is
 * exactly the kind of control someone adds without thinking of it as a setter.
 *
 * ⭐ THE BOUND ON THAT FINDING, CARRIED EXACTLY AND NOT UPGRADED: **NO WRITE
 * ESCAPES.** The `<textarea>` that opens is itself inside the fieldset and
 * natively disabled, and the review explicitly DECLINED to claim user
 * reachability, because the store write it exercised came from a synthetic
 * `fireEvent.change` that bypasses the browser's own gating. So this is a
 * recorded SCOPE LIMIT of the mechanism, not a known user-facing defect. Do
 * not cite it as one; do not widen it without measuring it yourself. The exact
 * set of non-inerted controls is pinned in
 * `__tests__/inspectorAuthorityBinding.spec.tsx`
 * (`NOT_INERTED_BY_THE_FIELDSET_NODE`), so it REDs if it grows or shrinks
 * rather than living only in this comment.
 *
 * The setters below remain exported because producer/reconciliation code uses
 * them; being callable in code has never been what made a control reachable to
 * a user, and the fieldset is what decides that.
 *
 * ⚠ DO NOT REINTRODUCE A CLASSIFICATION TABLE HERE. If you want to know why a
 * control is inert, read the fieldset and the notice; both are pinned by
 * `__tests__/inspectorAuthorityBinding.spec.tsx`, which fails if the boundary,
 * the copy, or the aria binding between them is removed — per region, so a
 * break in one is not masked by the other.
 *
 * ⚠ AND NOTE WHICH QUESTION THIS IS. `CANONICAL_EDIT_AUTHORITY`
 * (`canvas/mutations/mutationAuthority.ts`) answers a DIFFERENT one — see its
 * header. It governs whether a control may LOOK like a shared-model edit. This
 * file governs whether the Inspector's controls are reachable at all.
 */

/**
 * Receipt-bearing actions mounted elsewhere and intentionally preserved.
 *
 * ⚠⚠ NARROWED, schemas 0.50.0 — AND THE NARROWING IS THE POINT, NOT A TIDY-UP.
 * This sentence used to open "This inspector is read-only because these changes
 * cannot yet be saved to the shared model." That was true of every control in
 * the panel when it was written. It stopped being true the moment the title
 * gained a durable `structural_rename` carrier: the NAME now writes to
 * `scenarios.graph` and survives a reload, while the panel body still cannot.
 *
 * A blanket claim over a control that no longer obeys it is this estate's trap
 * 21 — two questions under one sentence — and the failure mode is specific and
 * bad: a user reads "changes cannot be saved", renames anyway because the
 * pencil is right there, and then does not trust the rename that DID save. The
 * copy therefore names the exception rather than being quietly left to rot.
 *
 * ⚠ SCOPE, EXACTLY. The `<fieldset disabled>` in `InspectorRouter` is unchanged
 * and still wraps the whole panel body; it never wrapped the shell header, which
 * is where the title lives, so nothing about the enforcement boundary moved
 * here. Only the sentence describing it did.
 */
export const INSPECTOR_READ_ONLY_REASON =
  "You can rename this — the name saves to the shared model. The other fields here are read-only for now because those changes can't yet be saved. Use the Model tab for supported factor values or ask Olumi to change structure."

// ─── Node mutations ────────────────────────────────────────────────
export function useNodeMutations(nodeId: string) {
  const updateNode = useCanvasStore(s => s.updateNode)
  // P4 transport — prior-range edits ride the conversation dispatcher when a
  // provider is present; optional so isolated renders still edit locally.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent
  const getNode = useCallback(() => {
    return useCanvasStore.getState().nodes.find(n => n.id === nodeId)
  }, [nodeId])

  const setLabel = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, NODE_LABEL_MAX_LENGTH)
    if (trimmed && trimmed !== node.data?.label) {
      updateNode(nodeId, { data: { ...node.data, label: trimmed } })
    }
  }, [nodeId, updateNode, getNode])

  const setDescription = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, 500)
    if (trimmed !== node.data?.description) {
      updateNode(nodeId, { data: { ...node.data, description: trimmed || undefined } })
    }
  }, [nodeId, updateNode, getNode])

  const setThreshold = useCallback((raw: number, unit: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, {
      data: {
        ...node.data,
        goal_threshold_raw: raw,
        goal_threshold_unit: unit,
      },
    })
  }, [nodeId, updateNode, getNode])

  /**
   * Write `observedState.value` — ALWAYS the MODEL-scale number (for a capped
   * factor, raw/cap), never a display magnitude. The advanced editors bind
   * straight to it as "Normalised value" (0-1), which is why this setter does
   * NO normalising of its own: it stores exactly what it is given.
   *
   * `rawValue` (ROADMAP 1.346) is the OPTIONAL user-unit magnitude that
   * produced `value`. It exists so the panel's number input — which shows the
   * user-unit magnitude — can commit BOTH halves in ONE `updateNode`. Two
   * separate setter calls would push two history entries and fire two
   * freshness invalidations for a single user edit, and would leave a window in
   * which `value` and `raw_value` disagree about the same number. Callers that
   * genuinely edit only the normalised value (the advanced editors) pass one
   * argument and are unaffected.
   *
   * `opts.source` (ROADMAP 2.121 slice 1) is the OPTIONAL provenance stamp for
   * the number being committed, written in the SAME update for the same reason
   * `rawValue` is: `observedState.source` gates the "AI estimate" / "User
   * edited" pill and the "N to verify" count, so a marker committed in a second
   * `updateNode` would lag the number it describes by one history entry. It is
   * OPT-IN and defaults to no write — existing callers (the inspector panels and
   * advanced editors) are byte-identical without it, so this widening adds a
   * capability to the #513 arc rather than changing its behaviour. Callers that
   * want it pass the marker they can justify; nothing is defaulted to 'user'.
   */
  const setObservedValue = useCallback((value: number, rawValue?: number, opts?: { source?: string }) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        // `display_value` is CEE-authored prose for the PREVIOUS value ("£30k").
        // The formatter only lets a fresh raw_value outrank it when the unit is
        // a meaningful one — so after a commit with no raw_value, or with a
        // unitless/"scale" unit, a stale display_value keeps rendering verbatim
        // on the canvas node. Clearing both locations (CEE writes it at the top
        // level, the canonical home is inside observedState) drops the renderer
        // to its live fallback until the server's graph_patch supplies a fresh
        // one. Clearing is right and re-deriving here would be wrong: this
        // string is the server's to author.
        display_value: undefined,
        observedState: {
          ...existing,
          value,
          ...(typeof rawValue === 'number' && Number.isFinite(rawValue) ? { raw_value: rawValue } : {}),
          ...(opts?.source ? { source: opts.source } : {}),
          display_value: undefined,
        },
      },
    })
  }, [nodeId, updateNode, getNode])

  const setIntervention = useCallback((factorId: string, value: number) => {
    const node = getNode()
    if (!node) return
    // Cast to `unknown` (not `number`) — existing intervention map may contain
    // V3 objects ({ value, source, ... }) under other keys. The spread below
    // preserves heterogeneous values; downstream display paths route every
    // read through `unwrapInterventionValue` (see labelUtils.ts).
    const existing = (node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: { ...existing, [factorId]: value },
      },
    })
  }, [nodeId, updateNode, getNode])

  const removeIntervention = useCallback((factorId: string) => {
    const node = getNode()
    if (!node) return
    const existing = { ...((node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined) }
    delete existing[factorId]
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: existing,
      },
    })
  }, [nodeId, updateNode, getNode])

  const setPriorRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.prior as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        prior: { ...existing, range_min: min, range_max: max },
      },
    })
    // P4 transport (schemas 0.34.0) — the user-set range REACHES THE SERVER.
    // This is the single seam every prior-range editor shares, so emitting
    // here covers all callers. Best-effort AFTER the local write (an absent
    // conversation context or failed send never breaks the local edit);
    // fail-closed on shapes the wire's own rule would refuse (inverted or
    // non-finite bounds build no event — never a production 422). CEE
    // persists the event as a typed turn fact and writes NO graph: carrying
    // the judgement is this seam's whole job; whether confirmed ranges feed
    // the maths is a separate, explicit design decision.
    if (!sendSystemEvent) return
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return
    const distribution = typeof existing?.distribution === 'string' && existing.distribution.length > 0
      ? existing.distribution
      : undefined
    void Promise.resolve(
      sendSystemEvent({
        type: 'prior_range_edit',
        payload: {
          target_id: nodeId,
          range_min: min,
          range_max: max,
          ...(distribution !== undefined ? { distribution } : {}),
        },
      }),
    ).catch(() => {
      // Background judgement receipt — the local edit stands; re-editing
      // re-emits. Mirrors the other best-effort background sends.
    })
  }, [nodeId, updateNode, getNode, sendSystemEvent])

  // ── observedState sub-field mutations ──

  const setObservedField = useCallback((field: string, val: unknown) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: { ...node.data, observedState: { ...existing, [field]: val } },
    })
  }, [nodeId, updateNode, getNode])

  const setObservedRawValue = useCallback((v: number) => setObservedField('raw_value', v), [setObservedField])
  const setObservedUnit = useCallback((v: string) => setObservedField('unit', v || undefined), [setObservedField])
  const setObservedCap = useCallback((v: number) => setObservedField('cap', v), [setObservedField])
  const setObservedBaseline = useCallback((v: number) => setObservedField('baseline', v), [setObservedField])
  const setObservedStd = useCallback((v: number) => setObservedField('std', v), [setObservedField])
  const setObservedSource = useCallback((v: string) => setObservedField('source', v || undefined), [setObservedField])

  // ── classification mutations ──

  const setCategory = useCallback((category: 'controllable' | 'observable' | 'external') => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, category } })
  }, [nodeId, updateNode, getNode])

  const setExtractionType = useCallback((extractionType: 'explicit' | 'inferred') => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, extractionType } })
  }, [nodeId, updateNode, getNode])

  const setFactorType = useCallback((factor_type: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, factor_type: factor_type || undefined } })
  }, [nodeId, updateNode, getNode])

  // ── normalisation range ──

  const setStateSpaceRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.state_space as Record<string, unknown> | undefined
    const range = (existing?.range as Record<string, unknown>) ?? {}
    updateNode(nodeId, {
      data: { ...node.data, state_space: { ...existing, range: { ...range, min, max } } },
    })
  }, [nodeId, updateNode, getNode])

  // ── uncertainty drivers ──

  const setUncertaintyDrivers = useCallback((drivers: string[]) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, uncertainty_drivers: drivers } })
  }, [nodeId, updateNode, getNode])

  // ── goal cap ──

  const setGoalCap = useCallback((cap: number) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, goal_threshold_cap: cap } })
  }, [nodeId, updateNode, getNode])

  // ── risk probability × impact (P1.7) ──
  // Canonical scales (RiskNodeDataSchema): probability is a 0-1 number, impact is
  // the RiskImpact enum. Callers pass values already on those scales — the panel
  // owns any percentage↔decimal conversion. The clamp here is defensive
  // normalisation only (same class as the observed/belief clamps).

  const setProbability = useCallback((probability: number) => {
    const node = getNode()
    if (!node) return
    if (Number.isNaN(probability)) return
    const clamped = Math.min(1, Math.max(0, probability))
    updateNode(nodeId, { data: { ...node.data, probability: clamped } })
  }, [nodeId, updateNode, getNode])

  const setImpact = useCallback((impact: RiskImpact) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, impact } })
  }, [nodeId, updateNode, getNode])

  return {
    setLabel, setDescription, setThreshold, setObservedValue,
    setIntervention, removeIntervention, setPriorRange,
    setObservedRawValue, setObservedUnit, setObservedCap,
    setObservedBaseline, setObservedStd, setObservedSource,
    setCategory, setExtractionType, setFactorType,
    setStateSpaceRange, setUncertaintyDrivers, setGoalCap,
    setProbability, setImpact,
  }
}

// ─── Edge mutations ────────────────────────────────────────────────
export function useEdgeMutations(edgeId: string) {
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const conversation = useOptionalConversationContext()
  const sendSystemEvent = conversation?.sendSystemEvent
  const getEdge = useCallback(() => {
    return useCanvasStore.getState().edges.find(e => e.id === edgeId)
  }, [edgeId])

  /**
   * ⭐⭐ THE SERVER-SIDE BASELINE FOR THIS EDGE — the one piece of state this
   * hook holds, and the reason it must exist.
   *
   * `edge_strength_edit.expected` is an assertion about what CEE PERSISTED, and
   * it must describe the edge as it was BEFORE the user's gesture. That is not
   * readable at commit time: the signed slider calls `setStrength` on EVERY
   * tick, so by the time the user releases it the store already holds the new
   * value and reading "current" would assert the number we are about to send —
   * a tautology CEE would compare against itself.
   *
   * So the baseline is captured on the FIRST write of a gesture (before that
   * write lands) and advanced only when we learn something:
   *   · a dispatch we hear no refusal for  → the server now holds what we sent;
   *   · a refusal naming `details.edge.current` → the server's real value;
   *   · anything else → cleared, so the next gesture re-reads the canvas.
   *
   * ⚠ A WRONG BASELINE IS SAFE BY CONSTRUCTION — it can only ever produce a
   * REFUSAL, never a wrong write, because CEE compares the tuple exactly before
   * mutating anything. That is what licenses a client-side baseline at all;
   * see `mutations/edgeStrengthEdit.ts` for the full argument.
   */
  const expectedRef = useRef<EdgeStrengthExpected | null>(null)
  const baselineEdgeIdRef = useRef<string>(edgeId)
  if (baselineEdgeIdRef.current !== edgeId) {
    // A different edge is a different assertion. Never carry one edge's
    // baseline onto another — that is the value-predicate binding error this
    // repo's specs exist to catch, reached through a stale ref.
    baselineEdgeIdRef.current = edgeId
    expectedRef.current = null
  }

  /** Capture the pre-write baseline once per gesture, from the LIVE edge. */
  const captureBaseline = useCallback(() => {
    if (expectedRef.current !== null) return
    const edge = getEdge()
    if (!edge) return
    expectedRef.current = readEdgeStrengthExpected(edge)
  }, [getEdge])

  /**
   * `mean` is a SIGNED strength: the magnitude is `|mean|` and, by default, the
   * direction is derived from its sign. That is the right contract for a signed
   * control (`EdgePanel`, `EdgeAdvancedEditor` both drive a signed slider).
   *
   * `opts.preserveDirection` (adversarial review F1/F2) writes the MAGNITUDE
   * ONLY and leaves the edge's `direction` exactly as it is — including ABSENT.
   *
   * WHY THIS LIVES HERE AND NOT IN THE CALLER. A magnitude cannot encode a
   * direction, so no arithmetic at a call site can express "set the size, leave
   * the sign alone" through a signed parameter:
   *
   *   - AT ZERO the sign is not ambiguous, it is UNREPRESENTABLE. `-0 >= 0` is
   *     `true` in JavaScript, so a caller re-applying a negative direction as
   *     `-n` hands over `-0` and this rule reads it as POSITIVE. That is the
   *     proven regression: zeroing a negative edge's weight flipped its
   *     direction, silently, and a later magnitude restore came back with the
   *     wrong sign.
   *   - ABSENCE has no encoding at all. An edge with no `direction` would have
   *     one FABRICATED by any sign-derived write — and edges are in the
   *     canonical graph-hash keep-list, so that is analysis-relevant state.
   *
   * A caller-side patch could only skip the write (dropping the user's edit) or
   * invent a non-zero magnitude, and would leave the identical trap armed for
   * the next magnitude-only editor. What was missing is an interface, not a
   * calculation. The sign rule itself is left alone: for a genuinely signed
   * control `-0` and `0` are the same number and neither direction is more
   * honest than the other, which is precisely why zero must be preserved rather
   * than re-derived.
   *
   * With `preserveDirection` the emitted patch is `{...edge.data, weight,
   * weightSource}` — byte-identical in shape to the hand-rolled write the Model
   * tab used to do, now inside the manifest.
   */
  const setStrength = useCallback((mean: number, opts?: { preserveDirection?: boolean }) => {
    const edge = getEdge()
    if (!edge) return
    const absWeight = Math.abs(mean)
    updateEdge(edgeId, {
      data: {
        ...edge.data,
        weight: absWeight,
        // The key is OMITTED, not set to undefined: the store merges
        // `{...e.data, ...updates.data}`, so an explicit `direction: undefined`
        // would overwrite a real direction with nothing.
        // The direction stamp rides with the direction, exactly as
        // `weightSource` rides with the weight: a user dragging the SIGNED
        // slider IS stating a direction, so the value stops being a default in
        // the same update. Under `preserveDirection` neither key is written —
        // a magnitude edit must not mint a direction claim (ROADMAP 2.263).
        ...(opts?.preserveDirection
          ? {}
          : { direction: mean >= 0 ? 'positive' : 'negative', directionSource: 'user' }),
        weightSource: 'user',
      },
    })
  }, [edgeId, updateEdge, getEdge])

  const setStd = useCallback((std: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, strengthStd: std, strengthStdSource: 'user' } })
  }, [edgeId, updateEdge, getEdge])

  const setExistsProbability = useCallback((ep: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, {
      data: { ...edge.data, beliefExists: ep, beliefExistsSource: 'user' },
    })
  }, [edgeId, updateEdge, getEdge])

  const setLabel = useCallback((value: string) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, label: value || undefined } })
  }, [edgeId, updateEdge, getEdge])

  const setDirection = useCallback((direction: 'positive' | 'negative') => {
    const edge = getEdge()
    if (!edge) return
    // The user picking +/− is the ONLY thing that turns the defaulted
    // `direction: 'positive'` into a stated one (ROADMAP 2.263).
    updateEdge(edgeId, { data: { ...edge.data, direction, directionSource: 'user' } })
  }, [edgeId, updateEdge, getEdge])


  /**
   * ⭐ THE DURABLE STRENGTH COMMIT (schemas 0.42.0) — `setStrength` plus the
   * wire event that makes it survive a reload.
   *
   * ⚠⚠ WHY THE EMISSION IS NOT INSIDE `setStrength`, which is where a reader
   * looking for "the single seam every caller shares" would put it — and where
   * the sibling `setPriorRange` correctly puts its own.
   *
   * `setPriorRange` is called ONCE, on a commit. `setStrength` is called on
   * EVERY TICK of a continuous drag (`EdgePanel.handleStrengthChange` →
   * `SignedStrengthSlider.onChange`). Emitting there would fire one CEE TURN
   * PER ANIMATION FRAME — dozens of turns, dozens of LLM calls, and a race in
   * which the last write to land is whichever turn the network happened to
   * finish last, not the value the user released on. So the local write and the
   * durable commit are deliberately different verbs, and the affordances say
   * which one they mean: the slider writes continuously and commits on BLUR,
   * while a preset click and a confirmation are complete gestures that commit
   * immediately.
   *
   * BEST-EFFORT AFTER THE LOCAL WRITE, exactly like `setPriorRange`: an absent
   * conversation context or a failed send never breaks the local edit. What is
   * NOT best-effort is honesty about the outcome — a refusal CEE proves it did
   * not write is reverted, because leaving it is the product asserting a
   * strength the model declined.
   */
  const commitStrength = useCallback((
    mean: number,
    opts?: {
      preserveDirection?: boolean
      /** `confirm_current` is provenance-only — see the contract's refinement. */
      intent?: EdgeStrengthEditIntent
      /** Surfaced to the user when the server declines. */
      onNotice?: (message: string) => void
    },
  ) => {
    // Capture the pre-write baseline BEFORE the local write, so `expected`
    // describes the server's edge rather than the value we are about to send.
    captureBaseline()
    const expected = expectedRef.current
    const edgesBefore = useCanvasStore.getState().edges

    setStrength(mean, opts?.preserveDirection ? { preserveDirection: true } : undefined)

    if (!sendSystemEvent) return

    const intent: EdgeStrengthEditIntent = opts?.intent ?? 'set'
    // ⚠ MIRRORS THE LOCAL WRITE EXACTLY, including at zero. `setStrength`
    // writes `mean >= 0 ? 'positive' : 'negative'`, and `-0 >= 0` is `true`, so
    // a signed drag to zero stamps POSITIVE locally. Sending anything else here
    // — 'preserve', say — would leave the canvas and the model disagreeing
    // about direction on exactly the value where the sign is unrecoverable.
    // The limitation is `setStrength`'s, documented in its own header; this
    // must not quietly diverge from it.
    const directionIntent: EdgeStrengthDirectionIntent = opts?.preserveDirection
      ? 'preserve'
      : mean >= 0 ? 'positive' : 'negative'

    const captured = captureEdgeStrengthEdit({
      edgesBefore,
      edgeId,
      magnitude: Math.abs(mean),
      directionIntent,
      intent,
      expected,
      externalMutationActive: (useCanvasStore.getState() as { _externalMutationActive?: number })
        ._externalMutationActive
        ? true
        : false,
      makeId: () => `esr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    })
    if (!captured.ok) return

    const record = captured.intent
    // Advance the baseline optimistically: if we hear nothing, the server holds
    // what we sent, and the NEXT gesture must assert that rather than the value
    // from before this one (which would refuse forever).
    expectedRef.current = {
      mean: record.directionIntent === 'negative' ? -record.magnitude : record.magnitude,
      effect_direction:
        record.directionIntent === 'preserve'
          ? record.expected.effect_direction
          : record.directionIntent,
    }

    void Promise.resolve(
      sendSystemEvent({
        type: 'edge_strength_edit',
        payload: buildEdgeStrengthEditWirePayload(record),
      }),
    ).catch((err: unknown) => {
      const conflictCategory = (err as { conflictCategory?: string } | null)?.conflictCategory
      const kind = (err as { kind?: string } | null)?.kind

      if (!isProvenNoWriteConflict(conflictCategory)) {
        // We hold NO committed bytes, so we know neither that it landed nor
        // that it did not. The value is LEFT ALONE — reverting on a guess is
        // data loss, which is strictly worse than the lie it would prevent.
        // The baseline is cleared so the next gesture re-reads the canvas
        // rather than compounding an assertion we can no longer support.
        expectedRef.current = null
        opts?.onNotice?.(
          kind === 'transport'
            ? EDGE_STRENGTH_NOTICE.unconfirmed_transport
            : EDGE_STRENGTH_NOTICE.unconfirmed_server,
        )
        return
      }

      // CEE proved it wrote nothing. The canvas must stop asserting the value.
      const current = readRefusedCurrentStrength((err as { details?: unknown } | null)?.details)
      const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
      const stillOurs =
        edge !== undefined &&
        Math.abs(
          ((edge.data as Record<string, unknown> | undefined)?.weight as number | undefined) ?? NaN,
        ) === record.magnitude
      // STAND-DOWN DISCIPLINE: write only when the edge STILL HOLDS THE
      // MAGNITUDE THIS GESTURE SENT. If the user has edited again, or a server
      // graph has landed, the canvas is describing something this gesture never
      // saw and restoring would be a silent overwrite dressed as a correction.
      if (stillOurs) {
        updateEdge(edgeId, {
          data: { ...(edge!.data as Record<string, unknown>), ...buildEdgeStrengthRevertPatch(record) },
        })
      }

      // Re-baseline from the SERVER's own account where it gave one, so the
      // user's next attempt asserts the truth and succeeds instead of refusing
      // identically forever — an affordance terminating in refusal.
      expectedRef.current = current
      opts?.onNotice?.(
        conflictCategory === 'edge_target_not_found' ||
          conflictCategory === 'edge_target_ambiguous'
          ? EDGE_STRENGTH_NOTICE.target_unresolvable
          : conflictCategory === 'edge_expected_tuple_mismatch'
            ? edgeStrengthDivergedNotice(current)
            : EDGE_STRENGTH_NOTICE.base_hash_diverged,
      )
    })
  }, [edgeId, updateEdge, setStrength, sendSystemEvent, captureBaseline])

  return { setStrength, commitStrength, setStd, setExistsProbability, setLabel, setDirection }
}

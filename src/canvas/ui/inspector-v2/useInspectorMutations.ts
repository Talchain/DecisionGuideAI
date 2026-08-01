/**
 * Inspector v2 — typed mutation hooks
 *
 * All panels use these instead of raw store calls.
 * Single interception point for validate-patch migration.
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../../store'
import type { RiskImpact } from '../../domain/nodes'

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

// ─── Node mutations ────────────────────────────────────────────────
export function useNodeMutations(nodeId: string) {
  const updateNode = useCanvasStore(s => s.updateNode)
  const getNode = useCallback(() => {
    return useCanvasStore.getState().nodes.find(n => n.id === nodeId)
  }, [nodeId])

  const setLabel = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, 100)
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
  }, [nodeId, updateNode, getNode])

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
  const getEdge = useCallback(() => {
    return useCanvasStore.getState().edges.find(e => e.id === edgeId)
  }, [edgeId])

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

  return { setStrength, setStd, setExistsProbability, setLabel, setDirection }
}

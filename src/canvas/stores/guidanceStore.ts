/**
 * Guidance Store — cross-surface focus state for GuidanceItems
 *
 * Holds the latest guidance_items from the OrchestratorResponseEnvelopeV2
 * and tracks the currently focused item across the strip, inspector, and canvas.
 */
import { create } from 'zustand'
import { AlertTriangle, Lightbulb, type LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// § 1 — CEE contract types
// ---------------------------------------------------------------------------

export type GuidanceCategory = 'must_fix' | 'should_fix' | 'could_fix' | 'technique'
export type GuidanceSource = 'analysis' | 'structural' | 'prompt'
export type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'mixed'

export interface GuidanceTargetObject {
  type: 'node' | 'edge' | 'option' | 'graph' | 'framing'
  id?: string
  label?: string
}

export type GuidanceAction =
  | { type: 'approve_patch'; operations: Record<string, unknown>[] }
  | { type: 'open_inspector'; node_id: string; field?: string }
  | { type: 'discuss'; prompt: string }
  | { type: 'run_exercise'; exercise: 'pre_mortem' | 'devil_advocate' | 'disconfirmation' }
  | { type: 'navigate'; target: string }

export interface GuidanceItem {
  item_id: string
  /**
   * Producer `signal_code` VERBATIM when supplied — an OPEN, producer-owned
   * SCREAMING_SNAKE vocabulary (never allowlisted, never rendered as user copy;
   * data-* only). Absent when the producer sent none: the V5 derivation never
   * invents one from the block type. V4-envelope guidance always carries it.
   */
  signal_code?: string
  /**
   * Producer four-value `category` VERBATIM when supplied; absent otherwise —
   * the V5 derivation never defaults it. Rendering surfaces fall back to a
   * neutral display treatment (or suppress the category badge), never a
   * synthesised data value. V4-envelope guidance always carries it.
   */
  category?: GuidanceCategory
  source: GuidanceSource
  title: string
  detail?: string
  /**
   * Producer `action_label` VERBATIM when supplied; absent otherwise. The CTA
   * label the producer authored for this item — the UI renders it verbatim and
   * never invents its own. V4-envelope guidance always carries it.
   */
  actionLabel?: string
  /**
   * Producer `signal` display line VERBATIM when supplied; absent otherwise.
   * User-facing producer copy (distinct from `signal_code`, which is a data-*
   * code and never rendered) — carried today only on the deterministic
   * stale-rerun nudge. Rendered verbatim where present, never synthesised.
   */
  signal?: string
  primary_action: GuidanceAction
  target_object?: GuidanceTargetObject
  /**
   * Optional additional elements this item is relevant to (e.g. a
   * WEAKLY_CONNECTED_NODE signal referencing both the weakly-connected node
   * and its isolated neighbours). Inspectors match `id` against the currently
   * selected element in addition to `target_object.id`.
   */
  related_elements?: Array<{ id?: string; type?: string; label?: string }>
  valid_while?: { analysis_hash?: string; graph_hash?: string }
  fact_ids?: string[]
  citations?: string[]
  /**
   * COARSE 0-100 urgency, higher = more urgent (the producer's 0.19.0
   * `priority` verbatim when supplied — band-granular, ties normal — else
   * the UI's 50 fail-closed default). Budget/filter/style on it. It is NOT
   * a display order: the display order is severity-major (`category`) then
   * ascending `priorityRank` (Stage 2). Every ordering consumer must go
   * through `compareGuidanceDisplayOrder` below — never hand-roll a priority
   * sort (that is how the UI-SEM-085 `100 - rank` inversion happened).
   */
  priority: number
  /**
   * The producer's 0.19.0 `priority_rank` VERBATIM: ASCENDING display
   * ordinal, LOWER = shown FIRST, positive integers, UNBOUNDED (never
   * invert against 100 — ranks >= 100 are routine; bands: 1-9 lifecycle,
   * 10-99 review cards, 100-199 coaching, 200+ prompts). Equal ranks are
   * producer-order ties. PRESENCE = the producer ranked this item; absence
   * (pre-0.19.0 blocks, exercise blocks, V4-envelope items) = unranked, and
   * consumers fall closed to their unranked treatment.
   */
  priorityRank?: number
  /**
   * UI-SEM-085: true ONLY when the producer emitted `priority` for this
   * item; absent or false means `priority` is the UI's 50 default and
   * carries NO urgency information. Set at the single defaulting site in
   * `deriveGuidance` (src/v5/extractPhase3FromV5Response.ts) — read it, never
   * re-derive it (a producer may legitimately send 50). Rank provenance
   * needs no flag: `priorityRank` presence IS it.
   */
  priorityIsProducerSupplied?: boolean
  /**
   * DSK science provenance, producer-owned passthrough (the same field family
   * the decision_quality_prompts wire path carries — see
   * `components/results/utils/decisionQualityPrompts.ts`). PRESENCE of
   * `dsk_claim_id` is the attestation; an item without it is "not grounded in
   * a cited DSK claim" and every surface must render NO badge for it — never
   * a default id, never an inferred strength. `dsk_protocol_id` only ever
   * travels alongside the claim id. Wire truth (derived 2026-08-08 from the
   * golden-journey captures): CEE emits these on decision_quality_prompts and
   * exercise dsk_provenance TODAY, and on NO guidance-bearing block yet
   * (0/185 coaching blocks) — the display contract below is ready for the
   * CEE-side emission (ROADMAP 2.456) and renders honest absence meanwhile.
   * Surfaces MUST derive the badge through `deriveGuidanceDskProvenance`
   * below, never read these fields directly (one home for the honesty rule).
   */
  dsk_claim_id?: string
  dsk_protocol_id?: string
  evidence_strength?: EvidenceStrength
}

/**
 * The store's own closed evidence-strength vocabulary, runtime form of the
 * `EvidenceStrength` type above (this path's wire contract includes 'mixed';
 * deliberately NOT the dqp path's three-word set — each path gates on its own
 * declared vocabulary, see decisionQualityPrompts.DSK_EVIDENCE_STRENGTHS).
 */
export const GUIDANCE_EVIDENCE_STRENGTHS = ['strong', 'medium', 'weak', 'mixed'] as const

/**
 * DSK science provenance for a guidance item's badge — the VIEW shape every
 * rendering surface consumes. Present ONLY when the item attested a
 * `dsk_claim_id`. Ids ride as data-* attributes, never as user copy.
 */
export interface GuidanceDskProvenance {
  /** DSK claim id verbatim, e.g. "DSK-B-003" — data-* only, never copy. */
  claimId: string
  /** DSK protocol id, e.g. "DSK-P-002", when cited — data-* only. */
  protocolId?: string
  /** Closed-vocabulary evidence strength, verbatim, when attested. */
  strength?: EvidenceStrength
}

/**
 * The ONE home of the guidance DSK badge honesty rule (the
 * `deriveDskGrounding` rule, applied to this wire path):
 *   - id-gate AS A UNIT: no non-empty string `dsk_claim_id` ⇒ NO provenance
 *     object, whatever else the item carries — a strength without an attested
 *     claim is not evidence of anything;
 *   - `dsk_protocol_id` carried only when a non-empty string, only alongside
 *     the claim id;
 *   - `evidence_strength` carried VERBATIM only when a member of the closed
 *     vocabulary above; anything else fails closed to absent. The store holds
 *     verbatim-passthrough objects TypeScript never runtime-checked (the V4
 *     envelope path stores wire items as-is), so every gate here is a RUNTIME
 *     check — the type is not the guard.
 */
export function deriveGuidanceDskProvenance(
  item: GuidanceItem,
): GuidanceDskProvenance | undefined {
  const claimId = item.dsk_claim_id
  if (typeof claimId !== 'string' || claimId.length === 0) return undefined
  const protocolId = item.dsk_protocol_id
  const strength = item.evidence_strength
  return {
    claimId,
    ...(typeof protocolId === 'string' && protocolId.length > 0 ? { protocolId } : {}),
    ...(typeof strength === 'string' &&
    (GUIDANCE_EVIDENCE_STRENGTHS as readonly string[]).includes(strength)
      ? { strength }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// § 2 — Store state and actions
// ---------------------------------------------------------------------------

export interface GuidanceState {
  guidanceItems: GuidanceItem[]
  activeGuidanceItemId: string | null
  /** Task 3: Deep-link field target for inspector scroll-to-field */
  inspectorDeepLinkField: string | null
  /** Registered by ConversationPanel so inspector actions can send messages */
  _sendMessage: ((text: string) => void) | null
  /** Registered by ConversationPanel so cross-surface Analyse CTAs can trigger the hidden run path */
  _runAnalysis: (() => void) | null
  /** Registered by ConversationPanel so evidence blocks can send chip-style turns (display/submitted separation) */
  _sendChip: ((label: string, message: string) => void) | null
  /** Registered by ConversationPanel so inspector actions can scroll to a patch block */
  _scrollToPatch: ((patchId: string) => void) | null
  /** Registered by ConversationPanel so inspector "Ask about this" can pre-fill chat input */
  _prefillChat: ((text: string) => void) | null
  /** Registered by ConversationPanel — unified action dispatch with chip_metadata */
  _dispatchAction: ((opts: { action_type?: string; parameters?: Record<string, unknown>; label: string; message: string; hidden?: boolean; source: string }) => void) | null
  /**
   * Identity token for the ACTIVE registration. Ownership checks must use
   * this, never a callback identity: with the singleton conversation
   * context, two panel hosts register the SAME sendMessage/dispatchAction
   * function objects, so callback identity cannot discriminate hosts.
   */
  _registrationToken: object | null
}

export interface GuidanceActions {
  /** Replace array with items from a new envelope. Clears stale activeGuidanceItemId. */
  setGuidanceItems: (items: GuidanceItem[]) => void
  /** Clear all guidance (on local graph edits). */
  clearGuidanceItems: () => void
  /** Set the focused item. Pass null to clear. */
  setActiveGuidanceItem: (itemId: string | null) => void
  /**
   * Register conversation callbacks (called from ConversationPanel on mount).
   *
   * Returns an unregister function. Cleanup MUST go through it: it only clears
   * the callbacks if this registration is still the active one. Two
   * ConversationPanel hosts can coexist (floating panel + dock Olumi tab);
   * before this guard, whichever unmounted LAST nulled the shared callbacks
   * and silently killed every cross-surface run/ask CTA.
   */
  registerConversationCallbacks: (
    sendMessage: (text: string) => void,
    scrollToPatch: (patchId: string) => void,
    sendChip?: (label: string, message: string) => void,
    runAnalysis?: () => void,
    prefillChat?: (text: string) => void,
    dispatchAction?: (opts: { action_type?: string; parameters?: Record<string, unknown>; label: string; message: string; hidden?: boolean; source: string }) => void,
  ) => () => void
  /**
   * Evict items whose valid_while hashes no longer match the current state.
   *
   * Rules:
   * - Items with no valid_while are always kept.
   * - Items with valid_while.analysis_hash set: cleared if currentAnalysisHash
   *   differs OR if currentAnalysisHash is null/undefined (can't verify).
   * - Items with valid_while.graph_hash set: cleared when any structural graph
   *   change occurs (caller passes graphChanged=true). If graphChanged is false,
   *   only analysis_hash is checked.
   */
  evictStaleItems: (opts: {
    currentAnalysisHash: string | null | undefined
    graphChanged?: boolean
  }) => void
  /**
   * Remove guidance items whose target_object matches any of the provided IDs.
   * Only clears items where target_object.type is 'node' or 'edge'.
   * Items without target_object or with other target types are never cleared.
   */
  clearItemsByTargetIds: (ids: string[]) => void
  /** Remove a single guidance item by item_id (e.g. after user acts on a chip). */
  dismissItem: (itemId: string) => void
  /**
   * Adopt whatever this browser persisted for `scenarioId`, subject to the SAME
   * `valid_while` rules a live run obeys. See §4 below for why this is an
   * explicit call and not a module-evaluation spread.
   *
   * Returns the number of items adopted (0 when there is nothing to adopt, the
   * blob is for another decision, or every item failed its freshness gate) —
   * a number, so a caller and a test can bind to the outcome rather than infer
   * it from the store.
   */
  rehydrateGuidance: (opts: {
    scenarioId: string | null | undefined
    currentAnalysisHash: string | null | undefined
    currentGraphHash: string | null | undefined
  }) => number
}

const initialGuidanceState: GuidanceState = {
  guidanceItems: [],
  activeGuidanceItemId: null,
  inspectorDeepLinkField: null,
  _sendMessage: null,
  _runAnalysis: null,
  _sendChip: null,
  _scrollToPatch: null,
  _dispatchAction: null,
  _prefillChat: null,
  _registrationToken: null,
}

// ---------------------------------------------------------------------------
// § 2b — Persistence across a reload
//
// THE DEFECT THIS CLOSES. `guidanceItems` was written only from a live turn, so
// a refresh silently emptied the strip, the on-canvas node coaching markers and
// every inspector coaching section. The graph and the transcript both rehydrate
// from localStorage; the user's coaching did not, and nothing said so.
//
// ⚠ THE HARD PART IS NOT PERSISTING — IT IS NOT RESURRECTING STALE COACHING.
// Guidance items carry `valid_while: { analysis_hash?, graph_hash? }`, and
// advice about a model the user has since changed is worse than no advice: it
// is confidently wrong, on a surface whose whole job is to be trusted. So the
// rules a live run obeys (`evictStaleItems`) are applied again at ADOPTION time,
// and they fail CLOSED — an item whose freshness cannot be VERIFIED is dropped,
// never kept on the grounds that it is probably fine.
//
// Two comparators, and they are not the same kind of thing:
//   * `analysis_hash` — compared against `useCanvasStore().results.hash`, the
//     CEE `response_hash`. This one SURVIVES a reload, restored from the
//     autosave by `restoreAnalysisFromAutosave`, so it is a real comparator.
//   * `graph_hash` — the wire value is CEE's ANALYSIS-AFFECTING hash (`aag_v1`).
//     The UI's own `generateGraphHash` is a DIFFERENT algorithm over different
//     inputs (`compare-tab/types.ts` says so explicitly), and no CEE-family
//     graph hash survives a reload at all — `analysisFreshness` is not in the
//     autosave projection. Comparing the two would be the category error that
//     file warns about. So this module NEVER compares a stored `valid_while
//     .graph_hash` against a UI hash. It stamps its OWN UI-side graph hash at
//     WRITE time and compares that against the UI-side hash at READ time: same
//     algorithm both ends, which is the only comparison that means anything.
//     An item constrained by `graph_hash` is adopted only when the graph is
//     byte-identical to the one it was authored against.
//
// Storage: sessionStorage, versioned payload, dotted key — the estate's existing
// feature-store pattern (`strengthenStore`), whose header states the reasoning
// this shares: "survives reloads, dies with the session — matching the
// unpersisted scenario identity's scope". Coaching for a decision is exactly
// that scope. localStorage would outlive the decision it describes.
// ---------------------------------------------------------------------------

const GUIDANCE_STORAGE_KEY = 'guidance.items.v1'

interface PersistedGuidance {
  version: 1
  /** The decision these items were authored for. A blob for another scenario is never adopted. */
  scenarioId: string
  /** UI-side graph hash AT WRITE TIME — compared only against another UI-side hash. */
  graphHashAtWrite: string | null
  items: GuidanceItem[]
}

function readPersistedGuidance(): PersistedGuidance | null {
  try {
    const raw = sessionStorage.getItem(GUIDANCE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedGuidance> | null
    if (!parsed || parsed.version !== 1) return null
    if (typeof parsed.scenarioId !== 'string' || parsed.scenarioId.length === 0) return null
    if (!Array.isArray(parsed.items)) return null
    return {
      version: 1,
      scenarioId: parsed.scenarioId,
      graphHashAtWrite: typeof parsed.graphHashAtWrite === 'string' ? parsed.graphHashAtWrite : null,
      items: parsed.items as GuidanceItem[],
    }
  } catch {
    return null
  }
}

/**
 * Write the current items for `scenarioId`. Called from the same places that
 * mutate `guidanceItems`, via `persistCurrent` below — never on a timer, so the
 * stored blob can never describe a state the store was not in.
 */
function writePersistedGuidance(payload: PersistedGuidance): void {
  try {
    sessionStorage.setItem(GUIDANCE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable or full — guidance degrades to in-memory only,
    // which is exactly the behaviour before this existed. Never throw into a turn.
  }
}

function clearPersistedGuidance(): void {
  try {
    sessionStorage.removeItem(GUIDANCE_STORAGE_KEY)
  } catch {
    /* best-effort */
  }
}

/**
 * The store cannot import the canvas store (cycle), so the two values only IT
 * knows — the current scenario id and the UI-side graph hash — are supplied by a
 * provider the boot path installs. With NO provider installed nothing is ever
 * written: an unidentified blob could be adopted by the wrong decision, and a
 * silent write with a wrong key is worse than no persistence at all.
 */
export interface GuidancePersistenceContext {
  scenarioId: string | null
  graphHash: string | null
}
let guidanceContextProvider: (() => GuidancePersistenceContext) | null = null

/** Install the context provider (called once, from the canvas boot path). */
export function setGuidancePersistenceContext(provider: (() => GuidancePersistenceContext) | null): void {
  guidanceContextProvider = provider
}

/**
 * ⚠ `minting` IS THE WHOLE CORRECTNESS OF THE GRAPH GATE, and the first version
 * of this function did not have it.
 *
 * `graphHashAtWrite` has to mean **"the hash of the graph these items were
 * AUTHORED against"**. The original stamped `ctx.graphHash` on *every* persist,
 * which quietly redefined it as *"the hash at the last persist"* — and any
 * persist that happened after a graph change then LAUNDERED the survivors to the
 * new hash, so the adoption gate compared H2 against H2 and let stale coaching
 * through.
 *
 * That is not a corner case; it is the product's primary path. Accepting an
 * assistant patch calls `clearItemsByTargetIds` under
 * `beginExternalGraphMutation('patch_apply')`, which SUPPRESSES the
 * `clearGuidanceItems()` that a normal edit would fire. So the graph moves
 * H1 → H2, the untargeted items legitimately survive — and re-stamping them at
 * H2 made them look freshly authored. `dismissItem` did the same.
 *
 * Only `setGuidanceItems` — a turn delivering guidance — is authorship. Every
 * other path INHERITS the stamp from the blob already on disk, and where it
 * cannot (no blob, or a blob for another decision) it writes `null`, which the
 * adoption gate treats as unverifiable and therefore stale. Fail closed.
 *
 * Found by review, not by this lane's own corpus, and the reason is worth
 * recording: every fixture here installed a provider returning a CONSTANT graph
 * hash, so the write-side hash could never move between authorship and a later
 * persist. The corpus shared the code's blind spot — it tested the READ hash
 * moving and never the WRITE hash (CLAUDE.md traps 22b/13d). The spec now varies
 * the provider's hash, which is the only shape that can see this.
 */
function persistCurrent(items: GuidanceItem[], opts: { minting: boolean }): void {
  if (!guidanceContextProvider) return
  let ctx: GuidancePersistenceContext
  try {
    ctx = guidanceContextProvider()
  } catch {
    return
  }
  if (!ctx.scenarioId) {
    // No decision identity ⇒ nothing that could be adopted safely later.
    clearPersistedGuidance()
    return
  }
  if (items.length === 0) {
    // An empty store is a REAL state (a structural edit cleared guidance), and
    // it must survive a reload as emptiness. Writing nothing would leave the
    // previous blob on disk for the next boot to adopt — the resurrection this
    // whole section exists to prevent.
    clearPersistedGuidance()
    return
  }

  let graphHashAtWrite: string | null
  if (opts.minting) {
    graphHashAtWrite = ctx.graphHash
  } else {
    const existing = readPersistedGuidance()
    graphHashAtWrite =
      existing && existing.scenarioId === ctx.scenarioId ? existing.graphHashAtWrite : null
  }

  writePersistedGuidance({
    version: 1,
    scenarioId: ctx.scenarioId,
    graphHashAtWrite,
    items,
  })
}

export const useGuidanceStore = create<GuidanceState & GuidanceActions>((set, get) => ({
  ...initialGuidanceState,

  setGuidanceItems: (items) => {
    const { activeGuidanceItemId } = get()
    const newIds = new Set(items.map((i) => i.item_id))
    set({
      guidanceItems: items,
      // Clear stale active ID if it no longer exists in the new array
      activeGuidanceItemId: activeGuidanceItemId && newIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
    // AUTHORSHIP — a turn delivered these items against the graph as it is
    // now, so this is the one call site that mints a new `graphHashAtWrite`.
    persistCurrent(items, { minting: true })
  },

  rehydrateGuidance: ({ scenarioId, currentAnalysisHash, currentGraphHash }) => {
    // Fail closed at every gate below: the cost of adopting stale coaching is a
    // confident lie about the user's model; the cost of adopting nothing is the
    // behaviour that shipped before this existed.
    if (!scenarioId) return 0
    if (get().guidanceItems.length > 0) return 0 // a live turn already won; never overwrite it
    const stored = readPersistedGuidance()
    if (!stored) return 0
    if (stored.scenarioId !== scenarioId) {
      // A blob for a DIFFERENT decision. Drop it rather than leave it to be
      // adopted if the user navigates back — coaching must not outlive the
      // decision boundary.
      clearPersistedGuidance()
      return 0
    }

    const fresh = stored.items.filter((item) => {
      const vw = item.valid_while
      if (!vw) return true // unconstrained by the producer → always valid

      if (vw.analysis_hash !== undefined) {
        // Same rule as `evictStaleItems`: unverifiable is stale.
        if (currentAnalysisHash == null) return false
        if (currentAnalysisHash !== vw.analysis_hash) return false
      }

      if (vw.graph_hash !== undefined) {
        // NOT compared against `vw.graph_hash` — that is CEE's aag_v1 and this
        // is the UI's own algorithm. Compared like-for-like against the UI hash
        // stamped when these items were written.
        if (currentGraphHash == null || stored.graphHashAtWrite == null) return false
        if (currentGraphHash !== stored.graphHashAtWrite) return false
      }

      return true
    })

    if (fresh.length === 0) {
      clearPersistedGuidance()
      return 0
    }
    set({ guidanceItems: fresh, activeGuidanceItemId: null })
    // Re-persist the SURVIVORS, so a second reload cannot resurrect an item this
    // one just evicted (the stored blob must always match the store).
    // NOT authorship: these items were authored by an earlier turn and have
    // just been re-validated. Minting here would stamp them with the CURRENT
    // graph and defeat the gate they were only now allowed through.
    persistCurrent(fresh, { minting: false })
    return fresh.length
  },

  clearGuidanceItems: () => {
    set({ guidanceItems: [], activeGuidanceItemId: null })
    // Structural edits reach here. Clearing on screen but leaving the blob on
    // disk would let the next reload re-adopt advice about the PRE-edit model —
    // the single most damaging thing this store could do.
    persistCurrent([], { minting: false })
  },

  setActiveGuidanceItem: (itemId) => {
    set({ activeGuidanceItemId: itemId })
  },

  registerConversationCallbacks: (sendMessage, scrollToPatch, sendChip, runAnalysis, prefillChat, dispatchAction) => {
    const token = {}
    set({
      _sendMessage: sendMessage,
      _runAnalysis: runAnalysis ?? null,
      _scrollToPatch: scrollToPatch,
      _sendChip: sendChip ?? null,
      _prefillChat: prefillChat ?? null,
      _dispatchAction: dispatchAction ?? null,
      _registrationToken: token,
    })
    return () => {
      // Ownership guard: only clear if OUR registration is still the active
      // one — a newer host's registration must survive an older host's
      // unmount. Compared by a per-registration token, NOT by callback
      // identity: both panel hosts share the singleton conversation's
      // function objects, so callback identity cannot tell them apart.
      if (get()._registrationToken === token) {
        set({
          _sendMessage: null,
          _runAnalysis: null,
          _scrollToPatch: null,
          _sendChip: null,
          _prefillChat: null,
          _dispatchAction: null,
          _registrationToken: null,
        })
      }
    }
  },

  evictStaleItems: ({ currentAnalysisHash, graphChanged = false }) => {
    const { guidanceItems, activeGuidanceItemId } = get()
    if (guidanceItems.length === 0) return

    const surviving = guidanceItems.filter((item) => {
      const vw = item.valid_while
      if (!vw) return true // no constraint → always valid

      // Check graph_hash: if set, evict when the caller reports a graph change.
      if (vw.graph_hash !== undefined) {
        if (graphChanged) return false
        // ⚠ CORRECTED 2026-08-12, derived at the bytes. This note used to read
        // "stale-at-unknown is handled by the fact that graphChanged=true is
        // always passed on model edits". THAT IS FALSE AND WAS TEACHING READERS
        // TO STOP LOOKING (CLAUDE.md trap 14). `evictStaleItems` has exactly ONE
        // production call site — `useAnalysisCompleteEvent.ts:39`, on run
        // completion — and it passes only `currentAnalysisHash`, so
        // `graphChanged` takes its `false` default on every real call and this
        // limb never fires outside tests. Complete manifest, whole repo, at
        // 32c0c517: one production caller, ten test callers.
        //
        // Deliberately NOT "fixed" here: on a local model edit
        // `useGraphEditEvents` already fires `clearGuidanceItems()`, which drops
        // everything, so the limb is redundant rather than load-bearing, and
        // changing eviction breadth reaches every guidance surface. Recorded so
        // the next reader inherits the measurement instead of the claim.
      }

      // Check analysis_hash: evict when currentAnalysisHash differs or is unknown
      if (vw.analysis_hash !== undefined) {
        if (currentAnalysisHash == null) return false // can't verify → stale
        if (currentAnalysisHash !== vw.analysis_hash) return false
      }

      return true
    })

    if (surviving.length === guidanceItems.length) return // nothing to evict

    const survivingIds = new Set(surviving.map((i) => i.item_id))
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId && survivingIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
    persistCurrent(surviving, { minting: false })
  },

  dismissItem: (itemId) => {
    const { guidanceItems, activeGuidanceItemId } = get()
    const surviving = guidanceItems.filter((item) => item.item_id !== itemId)
    if (surviving.length === guidanceItems.length) return
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId === itemId ? null : activeGuidanceItemId,
    })
    // A dismissal the user made must not come back on refresh.
    persistCurrent(surviving, { minting: false })
  },

  clearItemsByTargetIds: (ids) => {
    if (ids.length === 0) return
    const { guidanceItems, activeGuidanceItemId } = get()
    if (guidanceItems.length === 0) return

    const idSet = new Set(ids)
    const CLEARABLE_TYPES = new Set(['node', 'edge'])

    const surviving = guidanceItems.filter((item) => {
      const target = item.target_object
      if (!target) return true // no target → never cleared by this mechanism
      if (!CLEARABLE_TYPES.has(target.type)) return true // only clear node/edge targets
      // Clear if target_object.id matches. Items with clearable type but no
      // target.id are preserved (orphaned/graph-level items should not be
      // cleared by element-specific edits).
      if (target.id && idSet.has(target.id)) return false
      // Also clear if any related_elements[].id matches — prevents stale
      // coaching when a related node/edge is edited (e.g. WEAKLY_CONNECTED_NODE
      // referencing isolated neighbours).
      if (item.related_elements?.some(r => r.id && idSet.has(r.id))) return false
      return true
    })

    if (surviving.length === guidanceItems.length) return // nothing to clear

    const survivingIds = new Set(surviving.map((i) => i.item_id))
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId && survivingIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
    persistCurrent(surviving, { minting: false })
  },
}))

// ---------------------------------------------------------------------------
// § 3 — Selectors
// ---------------------------------------------------------------------------

export const selectGuidanceItems = (state: GuidanceState) => state.guidanceItems

export const selectActiveGuidanceItemId = (state: GuidanceState) => state.activeGuidanceItemId

/** Returns the full GuidanceItem for the active ID, or null. */
export function selectActiveItem(state: GuidanceState): GuidanceItem | null {
  if (!state.activeGuidanceItemId) return null
  return state.guidanceItems.find((i) => i.item_id === state.activeGuidanceItemId) ?? null
}

/** Returns items where target_object.id matches the given targetId. */
export function selectItemsForTarget(state: GuidanceState, targetId: string): GuidanceItem[] {
  return state.guidanceItems.filter((i) => i.target_object?.id === targetId)
}

/**
 * Severity rank for the four-value producer `category` (Stage 2). Lower =
 * shown first: must_fix, then should_fix, could_fix, technique. An ABSENT
 * category sorts into ONE trailing bucket — the producer owns this field, so
 * the UI never invents a severity for items it did not categorise; those keep
 * their existing rank/urgency order among themselves.
 */
export function guidanceCategoryRank(cat: GuidanceItem['category']): number {
  switch (cat) {
    case 'must_fix': return 0
    case 'should_fix': return 1
    case 'could_fix': return 2
    case 'technique': return 3
    default: return 4 // absent — honest, never invented
  }
}

/** DS v5 state channel a guidance item's `category` rides. */
export type GuidanceTone = 'danger' | 'info'

/**
 * The single source of truth for the display TONE (colour = state, DS v5) of a
 * guidance item's four-value producer `category`. Every surface that colours a
 * guidance element MUST derive from this — the inspector cards and the on-canvas
 * node coaching marker share it so the marker's tint matches the card it opens
 * (derive, don't mirror). must_fix / should_fix ride the danger channel;
 * could_fix / technique — and items the producer never categorised — ride the
 * info channel (honest absence → info, never a synthesised severity).
 */
export function guidanceCategoryTone(cat: GuidanceItem['category']): GuidanceTone {
  switch (cat) {
    case 'must_fix':
    case 'should_fix':
      return 'danger'
    default:
      return 'info' // could_fix, technique, or absent — low-urgency info channel
  }
}

/**
 * The single source of truth for a guidance item's display ICON + tint, paired
 * with `guidanceCategoryTone` above (icon = affordance / colour = state, DS v5).
 * Every surface that shows a guidance icon — the inspector card
 * (`InspectorGuidanceSection`) and the on-canvas node coaching marker
 * (`NodeCoachingMarker`) — derives from THIS, so the marker's icon always
 * matches the card it opens (derive, don't mirror). Tone decides both: the
 * danger channel (must_fix / should_fix) shows AlertTriangle in `text-danger`;
 * the info channel (could_fix, technique, and items the producer never
 * categorised) shows Lightbulb in `text-info`. An uncategorised item therefore
 * shows the info Lightbulb EVERYWHERE — honest absence → info, never a missing
 * icon and never a synthesised severity.
 */
export function guidanceCategoryIcon(
  cat: GuidanceItem['category'],
): { Icon: LucideIcon; tintClass: string } {
  return guidanceCategoryTone(cat) === 'danger'
    ? { Icon: AlertTriangle, tintClass: 'text-danger' }
    : { Icon: Lightbulb, tintClass: 'text-info' }
}

/**
 * THE display-order doctrine for guidance items, in one place (0.19.0
 * contract; UI-SEM-085 narrowed; Stage 2 severity-major).
 *
 * PRIMARY: the producer's `category` severity (must_fix → should_fix →
 * could_fix → technique). This is the user-facing hierarchy — a must_fix
 * finding outranks a should_fix one whatever their ranks. Items the producer
 * did not categorise fall into one trailing bucket (honest absence, never a
 * synthesised severity).
 *
 * WITHIN a category (and among uncategorised items): producer-ranked items
 * come first, in ASCENDING `priorityRank` order (lower = shown first — verbatim
 * wire semantics, never inverted). Equal ranks are producer-order ties:
 * `Array.prototype.sort` is stable, so wire arrival order holds, which is
 * exactly what the contract prescribes. Unranked items follow, ordered by
 * descending coarse `priority` (the legacy urgency fallback — the contract
 * gives us nothing better for items the producer did not rank).
 *
 * Every surface that orders or tops guidance items MUST use this comparator
 * (selectTopItem, GuidanceStrip, DecisionOverviewCard, inspector sections)
 * — two hand-rolled conventions in the same pipe is how the coaching band
 * collapsed.
 */
export function compareGuidanceDisplayOrder(a: GuidanceItem, b: GuidanceItem): number {
  const catDelta = guidanceCategoryRank(a.category) - guidanceCategoryRank(b.category)
  if (catDelta !== 0) return catDelta
  const aRank = typeof a.priorityRank === 'number' ? a.priorityRank : undefined
  const bRank = typeof b.priorityRank === 'number' ? b.priorityRank : undefined
  if (aRank !== undefined && bRank !== undefined) return aRank - bRank
  if (aRank !== undefined) return -1
  if (bRank !== undefined) return 1
  return b.priority - a.priority
}

/**
 * Returns the single item the display-order doctrine puts FIRST (or null if
 * empty): the highest-severity `category` (must_fix first), then the lowest
 * producer `priorityRank`, then the highest coarse `priority`. Full ties keep
 * the earliest-arrival item.
 */
export function selectTopItem(state: GuidanceState): GuidanceItem | null {
  if (state.guidanceItems.length === 0) return null
  return state.guidanceItems.reduce((best, item) =>
    compareGuidanceDisplayOrder(item, best) < 0 ? item : best,
  )
}

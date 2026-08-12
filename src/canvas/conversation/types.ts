/**
 * A.5+ Conversation Panel — Type Definitions
 *
 * Defines all types for the orchestrator-backed conversation surface:
 * messages, blocks, chips, turn requests/responses, and system events.
 */

import type { StageType } from '@talchain/schemas/boundary'
import type { CEEAnalysisReady, CEEGoalConstraint, CEEInterventionV3 } from '../../adapters/cee/types'
import type { AnswerShape } from './answerShape'

// ---------------------------------------------------------------------------
// § 1 — Conversation messages
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  blocks?: ConversationBlock[]
  actionChips?: ActionChip[]
  timestamp: Date
  /** Echoed from request for deduplication */
  clientTurnId?: string
  /** Whether this is a synthetic UI-only message (e.g. welcome, error) */
  synthetic?: boolean
  /** Track 3: Session boundary divider text (rendered as centred divider, not a chat bubble) */
  sessionDivider?: string
  /** Visible text in conversation bubble (may differ from submittedPrompt for chip-originated turns) */
  displayContent?: string
  /** Actual prompt sent to orchestrator (stored for retry). Absent on assistant messages. */
  submittedPrompt?: string
  /** Track 3: Thread hydration metadata (present only on messages hydrated from persisted thread) */
  _threadMeta?: {
    entryId: string
    origin: string
    entryStatus: string
    redactionState: string
  }
  /** True while the message is being progressively streamed (text_delta events arriving) */
  isStreaming?: boolean
  /** True during tool-backed turns until turn_complete — pre-tool prose may change */
  isProvisional?: boolean
  /** Inline status text shown during tool execution (e.g. "Running simulations...") */
  toolLoadingState?: string | null
  /** Deterministic CEE insights — rendered between assistant_text and chips */
  insights?: Insight[]
  /** When true, this user message was initiated by a pill/chip click.
   *  Renders as a compact action indicator instead of a full user bubble. */
  chipInitiated?: boolean
  /**
   * T6 (Stop button): set on the streaming assistant message when the user
   * clicks Stop and the AbortController fires. Once set, the indicator must
   * persist — late chunks arriving after abort MUST NOT clear it.
   */
  stoppedByUser?: boolean
  /**
   * ROADMAP 1.42 (Show-reasoning progressive disclosure — verbatim, labelled):
   * CEE's `_reasoning` additive-extension sidecar field, verbatim plain text.
   * Only populated when VITE_FEATURE_REASONING_DISCLOSURE is on and the field
   * is a non-empty string (length-capped, see useConversation). Never fed into
   * `content` — rendered separately, unprocessed, behind a collapsed toggle.
   * Ephemeral: excluded from thread persistence (session-only).
   */
  reasoning?: string
  /**
   * F1 (Paul's #1, answer-shape progressive disclosure): CEE's answer-shape
   * sidecar (confirmed contract — top-level `_answer_shape` on the V5 body,
   * { headline, bullets, detail }), parsed + fail-closed by
   * `extractAnswerShapeSidecar` (answerShape.ts). When present the bubble
   * renders a concise headline + ≤3 bullets with the long tail behind a
   * "Show more" toggle; when absent the bubble renders `content` exactly as
   * today (no regression). No flag — auto-lights-up when the sidecar lands on
   * the wire. Ephemeral: derived from the live turn, NOT persisted — hydrated
   * history falls back to the full-text render (same treatment as `reasoning`).
   */
  answerShape?: AnswerShape
  /**
   * Transcript honesty (dress-rehearsal trust item #3, 2026-07-20): delivery
   * state of a visible user send on the LIVE V5 path.
   *   - 'pending': dispatched, turn unresolved. Not yet persisted.
   *   - 'sent':    the turn resolved with a server response — normal history.
   *   - 'failed':  the turn produced no assistant response AND non-delivery is
   *     VERIFIED — the dispatch threw before anything left the client, or the
   *     fetch itself never produced a response. Renders the "Not delivered"
   *     marker + retry affordance and is NEVER persisted — a turn the server
   *     never served must not be committed as if it happened.
   *   - 'unconfirmed': ROADMAP 2.665 — the client stopped waiting, or a proxy
   *     timeout body arrived, and the turn's fate is genuinely UNKNOWN. CEE
   *     runs a turn to completion and COMMITS it whether or not the browser is
   *     still listening (live-witnessed: client gave up at 60.0s, server
   *     returned 200 at 123.1s with the turn rows written), and this client has
   *     no way to check — no status route exists and `v5_conversation_turns`
   *     has zero readers here. So 'failed' would be a claim we cannot support
   *     and 'sent' would be a claim we cannot support either. This third state
   *     exists so the bubble can say what is true. It renders an
   *     outcome-unknown marker, NOT "Not delivered", and offers no retry —
   *     retrying duplicates, because CEE keys commits on its own per-request
   *     id, not on `payload.turn_id`.
   *
   *     PERSISTENCE, stated precisely because the two stores differ and an
   *     imprecise sentence here would be the same defect this state exists to
   *     fix. `utils/transcriptStore.ts` — the local-first store that actually
   *     runs (staging is `VITE_AUTH_MODE=guest`, so Supabase persistence is
   *     inactive) — KEEPS an unconfirmed send: it excludes only 'failed' and
   *     'pending', and the user's own words are worth keeping when the server
   *     most likely holds the turn too. `hooks/useThreadPersistence.ts` DROPS
   *     it: its resolution pass persists only 'sent', so anything else is
   *     discarded like a failure. That asymmetry is left as-is deliberately —
   *     that path is flag-gated, its `scenarios.thread` column does not exist
   *     on the live database, and changing an inert writer cannot be witnessed.
   * `undefined` = legacy/delivered (assistant messages, V4 path, hydrated
   * history) — treated as sent everywhere.
   */
  deliveryState?: 'pending' | 'sent' | 'failed' | 'unconfirmed'
}

// ---------------------------------------------------------------------------
// § 2 — Inline blocks (rendered inside assistant messages)
// ---------------------------------------------------------------------------

/** Action chip rendered below an artefact block */
export interface ArtefactAction {
  label: string
  message: string
}

/** AI-generated interactive HTML content rendered in a sandboxed iframe */
export interface ArtefactBlock {
  type: 'artefact'
  artefact_type: string
  title: string
  description?: string
  /** Raw HTML string rendered inside a sandboxed iframe */
  content: string
  actions?: ArtefactAction[]
}

export type ConversationBlock =
  | CommentaryBlock
  | ReviewCardBlock
  | FactBlock
  | GraphPatchBlock
  | FramingBlock
  | BriefBlock
  | ModelReceiptBlockType
  | EvidenceBlock
  | ArtefactBlock
  | ComparisonBlock
  | PremortemBlock
  | FlipAnalysisBlock
  | ProposalBlock
  | ExerciseBlock
  | V5AnalysisResultBlock
  | V5GraphPatchBlock
  | V5ExplanationBlock
  | V5ComparisonBlock
  | V5FlipAnalysisBlock
  | V5ReviewCardBlock
  | V5CoachingBlock
  | V5EvidenceBlock
  | V5ExerciseBlock
  | V5HeldProposalBlock
  | V5UnsupportedBlock

/**
 * V5 block kinds (v5-ui-exclusive-path brief, Phase 5).
 *
 * These mirror the V5 OlumiResponse block types (analysis_result, graph_patch,
 * explanation, comparison, flip_analysis) so the UI can render CEE V5 output
 * without reshaping through the V4 block taxonomy. Distinct kinds avoid
 * conflicts with the V4 graph_patch / comparison / flip_analysis blocks that
 * have different shapes and state machines.
 */
export interface V5AnalysisResultBlock {
  type: 'v5_analysis_result'
  summary: string
  leading_option_id: string | null
  win_probabilities?: Record<string, number>
  enrichment?: Record<string, unknown>
}

export interface V5GraphPatchBlock {
  type: 'v5_graph_patch'
  status: 'applied' | 'noop'
  operation: 'set_factor_value' | 'add_constraint' | 'adjust_edge_strength'
  target_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface V5ExplanationBlock {
  type: 'v5_explanation'
  narrative: string
  referenced_option_ids: string[]
  enrichment?: Record<string, unknown>
}

export interface V5ComparisonBlockOption {
  option_id: string
  label: string
  win_probability?: number
  attributes?: Record<string, unknown>
}

export interface V5ComparisonBlock {
  type: 'v5_comparison'
  options: V5ComparisonBlockOption[]
  narrative?: string
}

export interface V5FlipScenario {
  factor_id: string
  current_value: number | null
  flip_threshold: number | null
  from_option_id: string | null
  to_option_id: string | null
  fragile: boolean
}

export interface V5FlipAnalysisBlock {
  type: 'v5_flip_analysis'
  narrative: string
  flip_scenarios: V5FlipScenario[]
  enrichment?: Record<string, unknown>
}

/**
 * Target reference carried on 0.13.x Phase 3 blocks (review_card /
 * coaching). Fields are the producer's typed shape verbatim; `kind` is
 * widened to string so future producer kinds pass through without a UI
 * release (unknown kinds render the label exactly the same way).
 */
export interface V5BlockTargetRef {
  id: string
  label: string
  kind: string
}

/** 0.13.x Phase 3 block freshness enum (producer-owned). */
export type V5Phase3Freshness = 'fresh' | 'stale' | 'pending' | 'failed'

/**
 * Track C slice 1 (D-5): typed review_card conversation block mirroring the
 * 0.13.x ReviewCardBlockSchema render-relevant fields EXACTLY. All copy
 * (title, body, target_refs labels, action_label) is producer-owned and
 * rendered verbatim — the UI adds no labels and no interpretation
 * (provisional_doctrine_v0). Distinct from the legacy `review_card`
 * ConversationBlock, which carries the V4-era tone/variant shape.
 */
export interface V5ReviewCardBlock {
  type: 'v5_review_card'
  block_id: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  card_kind: string
  target_refs: V5BlockTargetRef[]
  priority_rank: number
  freshness: V5Phase3Freshness
  action_intent?: string
  action_label?: string
}

/**
 * Track C slice 1 (D-5): typed coaching conversation block mirroring the
 * 0.13.x CoachingBlockSchema render-relevant fields EXACTLY. Same
 * verbatim-copy contract as V5ReviewCardBlock (provisional_doctrine_v0).
 *
 * priority_rank / freshness are OPTIONAL: producer-adapted blocks always
 * carry them (adaptTypedCoachingBlock fails closed without them), but the
 * UI-side draft bias-signal bridge (draftBiasSignalBlocks.ts) builds
 * v5_coaching blocks from wire coaching.bias_signals, which carry neither —
 * requiring them here forced the bridge to FABRICATE both (review-folds
 * 2026-07-17, Conv1). Absent values render nothing (no data-freshness
 * attribute) and sort after every ranked block.
 */
export interface V5CoachingBlock {
  type: 'v5_coaching'
  block_id: string
  title: string
  body: string
  coaching_kind: string
  source: string
  target_refs: V5BlockTargetRef[]
  priority_rank?: number
  freshness?: V5Phase3Freshness
  action_intent?: string
  action_label?: string
  /**
   * The PRODUCER-AUTHORED turn text this block's action chip dispatches
   * VERBATIM (schemas 0.31.0 `CoachingBlockSchema.action_prompt`; ROADMAP
   * 2.225). PRESENCE is what makes the pill interactive — absence renders
   * the display-only pill, and the UI never composes a prompt from
   * `action_label` or `action_intent`. Carried only on CoachingBlock:
   * 0.31.0 deliberately withholds it from ReviewCardBlock/EvidenceBlock.
   */
  action_prompt?: string
  /**
   * ── PR3 (living reasoning workspace): the IMPORTANCE / EVIDENCE signals ──
   *
   * All five are producer-owned, all OPTIONAL, all fail-closed. They already
   * existed on the wire (schemas 0.19.0 / 0.20.0 / 0.39.0) and already reach
   * the guidance store via `deriveGuidance`, which is why the guidance strip,
   * the inspector and the Strengthen panel can rank and ground a suggestion.
   * `adaptTypedCoachingBlock` simply never read them, so the CHAT card — the
   * surface a user actually reads first — was the one consumer that threw the
   * whole importance channel away. Carrying them here removes a lossy hop; it
   * does NOT introduce a second source of truth.
   */
  /**
   * The producer's four-value guidance class. The ONLY producer-owned
   * severity signal on a coaching block (unlike ReviewCardBlock there is no
   * `severity` field). Code-keyed: the consumer owns the display copy.
   * ABSENT = the producer classified nothing → render NO badge, and never a
   * fabricated "normal"/"unknown" tier.
   */
  category?: 'must_fix' | 'should_fix' | 'could_fix' | 'technique'
  /**
   * COARSE 0–100 urgency for cross-surface budgeting, HIGHER = more urgent.
   * Band-granular (derived 1:1 from `category` producer-side), so ties are
   * expected and normal. ⚠ NOT a display order — order by `priority_rank`
   * ascending, which `composePhase3BridgedBlocks` already does.
   */
  priority?: number
  /**
   * The producer's STABLE machine-readable detector-class code
   * (SCREAMING_SNAKE, e.g. `MISSING_BASE_RATE`). Open vocabulary, producer-
   * owned. Rides as a data-* attribute for downstream readers and is NEVER
   * rendered as copy — it is an id, not a sentence.
   */
  signal_code?: string
  /**
   * The producer's SHORT display line stating what TRIGGERED this item
   * (≤140 on the wire). Producer prose, rendered verbatim — this is the
   * field that lets a reader tell an evidence-backed signal from a passing
   * note, and the UI must never compose a substitute for it.
   */
  signal?: string
  /** Absent = this card claims no cited DSK claim. Never "unknown claim". */
  dsk_claim_provenance?: V5DskClaimProvenance
  /**
   * CEE's `aag_v1` graph hash AT THE MOMENT THIS CARD WAS WRITTEN.
   *
   * This is what lets a card in the transcript notice that the model moved
   * underneath it. `freshness` cannot: the producer stamps it at emission
   * (wire-measured `'fresh'` on 13/13 blocks, 2026-08-12) and a rendered
   * transcript block is immutable, so CEE can never re-stamp a card the user
   * is already reading. Compared at RENDER time against
   * `analysisFreshness.currentGraphHash` — see `coachingCurrency.ts`.
   *
   * ⚠ CEE-PRODUCED, AND ONLY EVER COMPARABLE WITH ANOTHER CEE HASH. The UI's
   * `generateGraphHash` is a different algorithm over different inputs
   * (`guidanceStore.ts` §2b); comparing the two is a category error.
   *
   * Optional because the producer omits it on some paths (4/13 wire-measured,
   * all draft-path). Absent ⇒ cannot-confirm, never "current".
   */
  graph_hash_at_generation?: string
}

/**
 * Track C slice 2 (Lane UI-W4 C): typed evidence conversation block
 * mirroring the 0.13.1 EvidenceBlockSchema render-relevant fields EXACTLY.
 * Same verbatim-copy contract as V5ReviewCardBlock
 * (provisional_doctrine_v0): every rendered string is the producer's;
 * `current_confidence` is a pass-through discriminator (data-* only, not
 * enum-narrowed so future producer values ride through); `severity` drives
 * the visual channel only and stays enum-narrowed. Distinct from the
 * legacy V4-era `EvidenceBlock` ConversationBlock (different shape).
 * `factor_ref` is optional here (render-relevant naming comes from
 * `factor_label` / target_refs per §1.3 — renderers prefer the primary
 * factor target_refs label on conflict).
 */
export interface V5EvidenceBlock {
  type: 'v5_evidence'
  block_id: string
  factor_label: string
  factor_ref?: V5BlockTargetRef
  target_refs: V5BlockTargetRef[]
  current_confidence: string
  evidence_gap: string
  suggested_technique: string
  impact_if_gathered: string
  priority_rank: number
  severity: 'info' | 'warning' | 'critical'
  freshness: V5Phase3Freshness
  action_intent?: string
  action_label?: string
}

/**
 * Track C slice 2 (Lane UI-W4 C): typed exercise conversation block
 * mirroring the 0.13.1 ExerciseBlockSchema render-relevant fields EXACTLY.
 * Per the v1.3 contract the exercise block carries NO priority_rank (not
 * hero eligible) and NO title — every prose field is optional and rendered
 * producer-verbatim when present; the adapter fails closed when none is.
 * `exercise_kind` is a pass-through discriminator (data-* only). Distinct
 * from the legacy V4-era `ExerciseBlock` ConversationBlock.
 */
/**
 * 0.37.0 — the canonical DSK protocol an exercise card is an instance of,
 * mirroring schemas' `DskProtocolProvenanceSchema`. ATOMIC by contract: the id
 * never travels without the title and strength that make it checkable against
 * `data/dsk/v1.json`. The adapter enforces the same rule independently, because
 * it parses the raw wire payload rather than the Zod schema.
 */
export interface V5DskProtocolProvenance {
  protocol_id: string
  protocol_title: string
  evidence_strength: 'strong' | 'medium' | 'weak' | 'mixed'
}

/**
 * 0.39.0 `DskClaimProvenanceSchema` — the decision-science CLAIM a coaching
 * card is grounded in. The CLAIM sibling of `V5DskProtocolProvenance` above.
 *
 * ⚠ ATOMIC TRIPLE, NEVER FLAT SIBLINGS — the contract's doctrine of record
 * (CEE #830): an id must never travel without the title and strength that
 * make it verifiable against `data/dsk/v1.json`. Three sibling optionals
 * would let a producer emit a claim id alone — an authority claim with
 * nothing a consumer can check it against. Do not "flatten it for
 * consistency": the adapter admits all three members or none.
 *
 * ABSENCE SEMANTICS: absent means "not grounded in a cited DSK claim", and
 * the card renders NO grounding badge. Absence is never a default and never
 * "unknown claim" — no consumer may infer one.
 */
export interface V5DskClaimProvenance {
  claim_id: string
  claim_title: string
  evidence_strength: 'strong' | 'medium' | 'weak' | 'mixed'
  protocol_id?: string
}

export interface V5ExerciseBlock {
  type: 'v5_exercise'
  block_id: string
  exercise_kind: string
  /** Absent = this exercise claims no DSK protocol. Never "unknown protocol". */
  dsk_provenance?: V5DskProtocolProvenance
  failure_scenario?: string
  warning_signs?: string[]
  mitigation?: string
  reference_class?: string
  counter_case?: string
  review_trigger?: string
  target_element_ref?: V5BlockTargetRef
  target_refs: V5BlockTargetRef[]
  freshness: V5Phase3Freshness
}

/**
 * Placeholder for V5 block kinds the UI doesn't render yet (explanation,
 * comparison, flip_analysis render full blocks; this is reserved for future
 * CEE block types to land safely without UI crashing).
 */
export interface V5UnsupportedBlock {
  type: 'v5_unsupported'
  blockType: string
  raw: unknown
}

/**
 * R8 (seamless-workspace, roadmap 2.27): a held CEE graph mutation surfaced
 * as an honest, non-error-styled card (0.18.0 HeldProposalBlockSchema). CEE's
 * graph-management referee gate holds a structural/tunable mutation pending
 * the user's go-ahead and emits this block INSTEAD of the error-styled block
 * the 1.43 fix retired.
 *
 * Render-relevant fields only. `summary` is CEE's display-safe description of
 * the change (rendered verbatim). `reason_code` is code-keyed by design —
 * mapped to the UI's OWN user-facing copy so the internal-doctrine-prose leak
 * 1.43 flagged cannot recur; widened to `string` here so a future
 * held-reachable code passes through to the generic copy without a UI release
 * (same forward-compat rule as V5BlockTargetRef.kind).
 *
 * `confirm` / `decline` are RESOLVED at map time from the response's top-level
 * `suggested_actions[]` (the schema's `confirm_action_id` / `decline_action_id`
 * are refs into that array; the block never embeds its own action objects).
 * The card dispatches `confirm.message` through the existing chip-send seam —
 * the change is applied by CEE server-side on that turn (single-writer
 * doctrine, post-#364), never by a client-minted mutation path. `decline` is
 * optional: CEE does not emit a dedicated decline chip today (the decline path
 * is free-text), so its absence drives a local-only dismiss.
 *
 * Internal identifiers (`proposal_id`, `mutation_class`, `reason_code`, the
 * `held_proposal` type token) NEVER render as user-facing copy.
 */
export interface V5HeldProposalAction {
  /** Producer-owned chip label (rendered verbatim on the confirm affordance). */
  label: string
  /** Message dispatched to CEE when the affordance is taken (the apply turn). */
  message: string
  /**
   * 0.19.0 `Action.detail` — the producer's COMPLETE sentence, emitted exactly
   * when it had to clamp `label` to chip length, and absent when `label`
   * already says everything. It is the consent record and the accessible name
   * for a held proposal: a control the user consents through may not be named
   * by a string that stops mid-word (ROADMAP 2.474 residual (a)).
   */
  detail?: string
}

export interface V5HeldProposalBlock {
  type: 'v5_held_proposal'
  /** CEE-internal held handle (gmh_…). Carried for telemetry/data-* only, never rendered. */
  proposal_id: string
  summary: string
  mutation_class: 'structural' | 'tunable'
  reason_code: string
  confirm: V5HeldProposalAction
  decline?: V5HeldProposalAction
}

// ---------------------------------------------------------------------------
// Citation marker (optional on CommentaryBlock)
// ---------------------------------------------------------------------------

export interface CitationRef {
  /** 1-based superscript index in the text */
  index: number
  /** Source description shown in legend / tooltip */
  source: string
}

/** Deterministic CEE structured section within a commentary block */
export interface CommentarySection {
  heading?: string
  content?: string
  items?: string[]
}

export interface CommentaryBlock {
  type: 'commentary'
  text: string
  tone?: 'neutral' | 'warning' | 'positive'
  /** Optional title — shown as header when commentary is collapsed */
  title?: string
  /** Optional citation markers; rendered as numbered legend below text */
  citations?: CitationRef[]
  /** Deterministic CEE: structured sections (heading + content + bullet items) */
  sections?: CommentarySection[]
}

export interface ReviewCardBlock {
  type: 'review_card'
  title: string
  body: string
  /** 'info' = coaching/facilitator (left 3px info border), 'alert' = challenger/danger (top 3px danger border) */
  variant: 'info' | 'alert'
  /**
   * Orchestrator tone from v2.1 prompt.
   * 'challenger' → alert variant (top danger border).
   * 'facilitator' → info variant (left info border, coaching default).
   * Takes precedence over variant when present.
   */
  tone?: 'challenger' | 'facilitator'
  /** Optional priority badge — sentence case */
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

// ---------------------------------------------------------------------------
// FactBlock — simple backward-compat shape plus optional template fields
// ---------------------------------------------------------------------------

export interface FactEntry {
  label: string
  value: string | number
  /** Reference line for bar rendering */
  baseline?: number
}

export type FactType =
  | 'simple'           // default — renders label/value/source
  | 'option_comparison'
  | 'sensitivity'
  | 'robustness'
  | 'constraint'

export interface FactLineage {
  n_samples?: number
  source?: string
}

export interface FactBlock {
  type: 'fact'
  /** Kept required for backward compat with existing tests */
  label: string
  /** Kept required for backward compat with existing tests */
  value: string
  source?: string
  /** absent = 'simple' */
  fact_type?: FactType
  /** Template data for non-simple fact_types */
  facts?: FactEntry[]
  lineage?: FactLineage
}

export interface PatchOperation {
  op: 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge' | 'update_edge'
  target_id: string
  data: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Block action (CEE-provided action buttons for graph_patch)
// ---------------------------------------------------------------------------

export interface BlockAction {
  action_type: 'accept' | 'dismiss' | 'view_details' | string
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface ProposalReviewItem {
  description: string
  elementLabel?: string
  changeLabel?: string
}

export interface RelatedElementRef {
  node_id?: string
  edge_id?: string
  label?: string
  type?: string
}

export interface GraphPatchBlock {
  type: 'graph_patch'
  patch_id: string
  summary: string
  /**
   * Past-tense summary emitted by CEE for accepted/auto-applied cards.
   * When present, supersedes `summary` once the card transitions to applied.
   */
  applied_summary?: string
  operations: PatchOperation[]
  target_graph_hash: string
  status?: string
  /**
   * When true, CEE has already applied the graph via envelope side_effects.
   * Render as applied state immediately — no Accept/Dismiss, no system event.
   */
  auto_apply?: boolean
  /** CEE patch classification — 'full_draft' for initial graph generation, 'incremental' for targeted edits */
  patch_type?: 'full_draft' | 'incremental'
  /** CEE-provided action buttons; overrides default Accept/Dismiss when present */
  actions?: BlockAction[]
  /** Canonical block identifier from CEE */
  block_id?: string
  /**
   * Graph hash captured when this block was received by the UI.
   * Used to detect staleness: if the graph changes after proposal,
   * a warning is shown before accepting.
   */
  graph_hash_at_proposal?: string
  /**
   * CEE-provided analysis_ready payload on full_draft patches.
   * When present, used directly for setCeeAnalysisReady instead of
   * edge-based synthesis fallback.
   */
  analysis_ready?: CEEAnalysisReady
  /**
   * Goal constraints from CEE response root, forwarded via graph_patch block.
   * Passed to PLoT /v2/run for multi-constraint analysis.
   */
  goal_constraints?: CEEGoalConstraint[]
  related_elements?: RelatedElementRef[]
  proposal_items?: ProposalReviewItem[]
  proposal_items_source?: 'backend' | 'derived_ops'
  /** Per-operation metadata from CEE edit_graph (impact + rationale) */
  operation_meta?: Array<{ impact: string; rationale: string }>
}

// ---------------------------------------------------------------------------
// New block types (A.1)
// ---------------------------------------------------------------------------

export interface FramingBlock {
  type: 'framing'
  goal: string
  options: string[]
  constraints?: string[]
  key_risks?: string[]
}

export interface BriefBlock {
  type: 'brief'
  title: string
  summary: string
  brief_url?: string
}

// Evidence block — research findings from orchestrator
export interface EvidenceFinding {
  text: string
  source_url?: string
  confidence?: number
}

export interface EvidenceBlock {
  type: 'evidence'
  title?: string
  findings: EvidenceFinding[]
  query: string
}

// Phase 2B: Model receipt block — structured summary after graph generation.
// F1 PR B: action-first pre-analysis card. `coachingSummary` is the CEE-owned
// (analysis_ready.coaching_summary) main content; DGAI adds only static chrome.
export interface ModelReceiptBlockType {
  type: 'model_receipt'
  factorCount: number
  edgeCount: number
  optionCount: number
  goalLabel: string | null
  coachingSummary: string | null
  topInsight: string | null
  topEvidenceGap: string | null
  readiness: 'ready' | 'blocked' | 'incomplete' | 'unknown'
  adjustments: Array<{ label: string; action: string; before?: string; after?: string; reason?: string }>
}

// ---------------------------------------------------------------------------
// Deterministic CEE block types (architecture v3)
// ---------------------------------------------------------------------------

export interface ComparisonBlock {
  type: 'comparison'
  narrative?: string
  options: Array<{
    id?: string
    label: string
    probability?: number
    rank?: number
    strengths?: string[]
    weaknesses?: string[]
    key_differentiators?: string[]
  }>
}

export interface PremortemBlock {
  type: 'premortem'
  target_option?: { id: string; label: string }
  narrative?: string
  risk_paths: Array<{
    path?: string[]
    description: string
    influence?: number
    likelihood?: string
    mitigation?: string
  }>
}

export interface FlipAnalysisBlock {
  type: 'flip_analysis'
  current_winner?: { id: string; label: string; probability?: number }
  narrative?: string
  flip_conditions: Array<{
    assumption: string
    current_value?: string
    flip_threshold: string
    direction: string
    alternative_winner?: string
  }>
}

export interface ProposalBlock {
  type: 'proposal'
  action_type: string
  description: string
  proposal_id: string
  changes: Array<{ operation: string; target: string; detail: string }>
  consequences?: string[]
  confirmation_required?: boolean
}

export interface ExerciseBlock {
  type: 'exercise'
  exercise_type: string
  title: string
  instructions: string
  content?: string
}

// ---------------------------------------------------------------------------
// Deterministic CEE insights
// ---------------------------------------------------------------------------

export interface Insight {
  type: string
  description: string
  severity?: 'info' | 'warning' | 'important'
  target_id?: string
  science_concept?: string
}

// ---------------------------------------------------------------------------
// § 3 — Action chips
// ---------------------------------------------------------------------------

export interface ActionChip {
  id: string
  label: string
  intent: 'primary' | 'secondary' | 'undo'
  /** Message sent to orchestrator when chip is tapped */
  message?: string
  /**
   * v2.1 chip role from <role> tag in orchestrator output.
   * Determines the colour dot rendered inside the chip.
   * Missing or unrecognised values render chip without a dot (graceful fallback).
   */
  role?: 'facilitator' | 'challenger' | 'scientist' | string
  /** Prompt text (deterministic format — mapped to message in validateResponse) */
  prompt?: string
  /** Action classification for deterministic routing */
  action_type?: string
  /** Structured parameters for action execution */
  parameters?: Record<string, unknown>
}

/** Max chips per assistant turn (coaching + suggested actions combined) */
export const MAX_CHIPS_PER_TURN = 4

/** Max suggested-action chips within the total budget (coaching fills first). v2.1: 0-3 default, 4 max. */
export const MAX_SUGGESTED_ACTIONS = 3

/** Max visible blocks per assistant turn before "Show more" toggle */
export const MAX_VISIBLE_BLOCKS_PER_TURN = 4

/**
 * UI-SEM-084: ratified cap — at most two bias-signal coaching cards render
 * budget-exempt per turn (display budget only; never transforms a value).
 *
 * Defined HERE, alongside the other render budgets, because it has two
 * consumers that must not import each other: the draft bridge
 * (draftBiasSignalBlocks, which stops emitting past the cap) and the render
 * layer (phase3Pacing/InlineBlocks, which exempts only the first N from the
 * visibility budgets). Before /simplify item 5 the cap lived only in the
 * bridge, so PRODUCER bias blocks — which the bridge stands down for — were
 * exempt from both budgets and capped by nothing.
 */
export const DRAFT_BIAS_SIGNAL_CARD_CAP = 2

// ---------------------------------------------------------------------------
// § 4 — System events (type-defined now, wired in follow-up PR)
// ---------------------------------------------------------------------------

/**
 * Event types accepted by CEE's v3 Zod schema — safe to send over the wire.
 *
 * DERIVED, NOT MIRRORED (CLAUDE.md trap 12). This const array is the SINGLE
 * source: the `WireSystemEventType` union below is derived from it, and
 * `systemEvents.ts` builds its send-allowlist Set from the same array rather
 * than re-typing the members. Before ROADMAP 1.346 those were two hand-kept
 * lists, and the runtime one was the silent one — an event type present in the
 * union but missing from the Set is dropped BEFORE the network by
 * `serializeSystemEvent`, with a DEV-only console warning and no test failure.
 * That is precisely the drift that reads as green. One array, one truth.
 */
export const WIRE_SYSTEM_EVENT_TYPES = [
  'direct_graph_edit',
  'direct_analysis_run',
  'patch_accepted',
  'patch_dismissed',
  'feedback_submitted',
  // ROADMAP 1.346 — the value-carrying inspector edit. A SIBLING of
  // direct_graph_edit, not a value on it: direct_graph_edit's target_id is a
  // representative singular (the first changed id in a batch), so keying a
  // mutation on it would mutate whichever node sorted first.
  'factor_value_edit',
  // P4 transport (schemas 0.34.0) — the two human-judgement signals that
  // previously terminated in the client store: the ContestedEdgeCard verdict
  // (ModelTabBody.handleResolveContested) and the inspector prior-range edit
  // (useInspectorMutations.setPriorRange). Carry-only: CEE persists each as a
  // typed turn fact and writes NO graph. ⚠ Reader-first: CEE's 0.34.0 leg
  // deploys BEFORE these emitters — an older pin rejects the whole turn.
  'edge_adjudication',
  'prior_range_edit',
] as const

/** Event types accepted by CEE's v3 Zod schema — safe to send over the wire. */
export type WireSystemEventType = (typeof WIRE_SYSTEM_EVENT_TYPES)[number]

/** Event types used only within the UI — never sent to CEE. */
export type InternalSystemEventType = 'session_resume' | 'undo_draft'

/** All system event types (wire + internal). */
export type SystemEventType = WireSystemEventType | InternalSystemEventType

/** Wire-safe system event — the only shape accepted by sendSystemEvent. */
export interface WireSystemEvent {
  type: WireSystemEventType
  payload?: Record<string, unknown>
}

/** Any system event (wire or internal). */
export interface SystemEvent {
  type: SystemEventType
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// § 5 — Orchestrator turn request
// ---------------------------------------------------------------------------

export interface AnalysisInputOption {
  id: string
  option_id: string
  label: string
  interventions: Record<string, CEEInterventionV3>
}

export interface OrchestratorTurnRequest {
  scenario_id: string
  message?: string
  conversation_history: ConversationTurnPair[]
  graph_state?: {
    nodes: unknown[]
    edges: unknown[]
  }
  analysis_state?: {
    analysis_status: string
    meta: { response_hash: string; [key: string]: unknown }
    [key: string]: unknown
  }
  selected_elements?: {
    node_ids?: string[]
    edge_ids?: string[]
  }
  /**
   * Analysis inputs from ceeAnalysisReady — options with resolved interventions
   * and goal_node_id. Present only when ceeAnalysisReady is available with options.
   * Allows the orchestrator to pass goal/options directly to PLoT for run_analysis
   * rather than inferring from graph structure alone.
   */
  analysis_inputs?: {
    options: AnalysisInputOption[]
    goal_node_id: string
  }
  /** Signal for CEE V2 deterministic draft routing. Set to true on explicit_generate turns. */
  generate_model?: boolean
  /** System event in CEE v3 wire format (SystemEventWire). Always serialized via serializeSystemEvent(). */
  system_event?: unknown
  /** Nonce for idempotency */
  turn_nonce?: string
  client_turn_id: string
  /** Request-builder turn discriminator, stripped before network send. */
  _turn_type?:
    | 'conversation'
    | 'explicit_generate'
    | 'run_analysis'
    | 'system_event'
    | 'patch_followup'
    | 'explain'
    | 'clarification_response'
}

/** A user+assistant turn pair for conversation_history (max 5 pairs sent) */
export interface ConversationTurnPair {
  role: 'user' | 'assistant'
  content: string
}

/** Max turn pairs sent in conversation_history */
export const MAX_HISTORY_PAIRS = 5

// ---------------------------------------------------------------------------
// § 6 — Orchestrator response envelope
// ---------------------------------------------------------------------------

/**
 * CEE stage_indicator wire format — may be a plain string or an object.
 * The object form includes confidence and source metadata from the orchestrator.
 *
 * The stage vocabulary here is the CANONICAL WIRE enum `StageType` from
 * `@talchain/schemas` (`frame | analyse | decide | review`) — NOT the UI/DB
 * lifecycle enum `ScenarioStage` (`frame | ideate | evaluate | decide |
 * optimise`, pinned by the `scenarios.stage` CHECK constraint). The two
 * vocabularies overlap only on `frame` and `decide`.
 *
 * This was previously declared as `ScenarioStage` — a hand-maintained mirror
 * that mis-stated the producer's enum. Because the wrong type still
 * type-checked at the ingestion call site, it SILENCED the compiler at the
 * one place that needed to map, letting the raw wire value be written into
 * the store unmapped. Schemas 0.19.0 documents this exact drift on the
 * `Stage` enum: consumers MUST derive from `StageType`, never re-declare.
 *
 * Translate to/from `ScenarioStage` via `src/v5/stageMapper.ts`.
 */
export type StageIndicatorWire =
  | StageType
  | { stage: StageType; confidence?: string; source?: string }

export interface OrchestratorResponseEnvelopeV2 {
  /** Response format version. 2 = deterministic (plain text, typed blocks). Absent = legacy XML path. */
  response_version?: number
  /** Main response text. Null on graph-only responses (e.g. initial draft). */
  assistant_text: string | null
  /** Deterministic CEE insights — supplementary observations */
  insights?: Insight[]
  blocks?: ConversationBlock[]
  proposed_changes?: unknown[]
  suggested_actions?: ActionChip[]
  /** Plain string or object with .stage field — normalised in handleEnvelope */
  stage_indicator?: StageIndicatorWire
  /** Guidance items for cross-surface display (strip, inspector, canvas highlight) */
  guidance_items?: import('../stores/guidanceStore').GuidanceItem[]
  /** Debug/trace field — not displayed to user */
  turn_plan?: unknown
  /** Echoed client_turn_id for deduplication */
  client_turn_id?: string
  /**
   * A.9: Full V2RunResponse when the orchestrator executed run_analysis.
   * Present only on analysis turns; absent on all other turns.
   * The UI must write this to the results store so the panel updates
   * without a direct /v2/run call.
   */
  analysis_response?: import('../../adapters/plot/v2/types').V2RunResponse
  /**
   * A.9: Error produced by run_analysis on the CEE side.
   * Present only when analysis was attempted but failed.
   */
  analysis_error?: { code: string; message: string }
  /**
   * Goal constraints from CEE response root.
   * The orchestrator may forward these at the envelope root level
   * when the CEE draft includes goal_constraints outside block.data.
   */
  goal_constraints?: import('../../adapters/cee/types').CEEGoalConstraint[]
  /**
   * CEE routing metadata — present when CEE lands support.
   * Includes the resolved LLM model and provider used to serve the request.
   * Read-only debug metadata; never displayed to users.
   */
  _route_metadata?: {
    resolved_model?: string | null
    resolved_provider?: string | null
    [key: string]: unknown
  }
  /**
   * CEE diagnostic trace — present when CEE_DIAGNOSTIC_TRACE_ENABLED is on.
   * Contains LLM call details, prompt identity, provider resolution, fallback
   * traces, and streaming metrics. Passthrough only — UI must not transform.
   * Read-only debug metadata; never displayed to users or sent back to CEE.
   */
  _diagnostic_trace?: {
    llm_calls?: unknown[]
    prompt_identity?: unknown[]
    zone2_assembly?: unknown
    tool_policy?: unknown
    provider_resolution?: unknown[]
    structured_output_config?: unknown
    streaming_metrics?: unknown
    fallback_trace?: unknown[]
    [key: string]: unknown
  } | null
  /**
   * CEE pipeline outcome — present when CEE includes pipeline metadata.
   * Read-only debug metadata; passthrough to debug bundle.
   */
  _pipeline_outcome?: unknown
  /**
   * Opaque session state from CEE. Store as-is, send back on the next turn
   * request as `session_state`. Enables session-level coaching (chip
   * suppression, play deduplication, convergence detection, calibration
   * tracking). Never persist to message history or analytics — transient
   * orchestration context only.
   */
  updated_session_state?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// § 7 — Orchestrator SSE stream events
// ---------------------------------------------------------------------------

/**
 * Discriminated union of SSE events emitted by POST /orchestrate/v1/turn/stream.
 * Each event carries a monotonically increasing `seq` for ordering.
 * Canonical schema — must match CEE's streaming wire format exactly.
 */
export type OrchestratorStreamEvent =
  | { type: 'turn_start'; seq: number; turn_id: string; routing: 'deterministic' | 'llm'; stage: string }
  | { type: 'text_delta'; seq: number; delta: string }
  | { type: 'tool_start'; seq: number; tool_name: string; long_running: boolean }
  | { type: 'block'; seq: number; block: ConversationBlock }
  | { type: 'tool_result'; seq: number; tool_name: string; success: boolean; duration_ms?: number }
  | { type: 'turn_complete'; seq: number; envelope: OrchestratorResponseEnvelopeV2 }
  | { type: 'error'; seq: number; error: { code: string; message: string }; recoverable: boolean }
  | { type: 'progress'; seq: number; message?: string }

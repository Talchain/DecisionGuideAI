/**
 * Model tab v2 — the structured model editor. TYPE SKELETON ONLY.
 *
 * ⚠ NOTHING IN THIS DIRECTORY IS MOUNTED. There is no route, no tab
 * registration, no component and no runtime value here — these are type
 * declarations that pin the contracts in `docs/Design/MODEL-EDITOR-V2.md` (capital
 * D — the lowercase path does not exist and resolves only on macOS) so
 * the write-authority lane (Codex) and the dock lane (PX-A) have something
 * concrete to bind to. Integration/mounting is the technical lead's call, and
 * the design is Paul-vetoable before any of it is built.
 *
 * WHY TYPES AND NOT PROSE. Three of the twelve defects the design documents are
 * hand-maintained mirrors (a dead search prop, a dead `isContested` prop, a
 * hand-copied band-threshold table). A contract expressed as prose becomes the
 * next one. Expressed as a total union it is a type error instead.
 *
 * ⚠ WHEN THIS DIRECTORY BECOMES LIVE, EXTEND THE RAW-WRITE GUARD.
 * `src/canvas/components/model-tab/__tests__/modelTabNoRawStoreWrites.sourceScan.spec.ts`
 * scans `src/canvas/components/model-tab/` ONLY. A v2 component tree living
 * here is therefore UNGUARDED against raw `updateNode` / `updateEdge` /
 * `updateEdgeData` calls — the exact class that guard exists to prevent, and the
 * exact way it was re-opened last time (the inspector was fixed, the Model tab
 * kept its own hand-rolled writes, and the killed class stayed live through a
 * different door). Widen its scope in the same PR that mounts anything here.
 */

// NOTE: this module deliberately imports NOTHING. Provenance travels as the raw
// source literal and is classified at the point of render by the one shared
// classifier (`classifyValueProvenance`), so no second mapping exists here to
// drift out of step with it.

// ── Disclosure ───────────────────────────────────────────────────────────────

/**
 * The ONE detail tier. See design §4.3.
 *
 * ⚠ THIS IS A CONTENT SWITCH, NEVER A LAYOUT SWITCH — the whole point of the
 * v2 tier. Today's `expertMode` drives both the scientific detail AND the
 * accordion mode (`ModelTabBody.tsx:116-122` vs `:761`), so a non-scientist who
 * merely wants two sections open at once has to turn on the scientist view.
 * A tier value must never decide how many groups are open, how rows are
 * ordered, or which rows are selected.
 */
export type DetailTier = 'plain' | 'advanced'

/**
 * The seven groups of the outline, in render order. Total by construction:
 * a `Record<ModelGroupId, …>` cannot silently omit one.
 */
export const MODEL_GROUP_IDS = [
  'goal',
  'options',
  'factors',
  'outcomes-risks',
  'relationships',
  'assumptions-provenance',
  'evidence-review',
] as const

export type ModelGroupId = (typeof MODEL_GROUP_IDS)[number]

/** Element kind — drives the row glyph. Mirrors the canvas node kinds + edges. */
export type ModelElementKind =
  | 'goal'
  | 'decision'
  | 'option'
  | 'factor'
  | 'risk'
  | 'outcome'
  | 'relationship'

// ── The edit three-beat ──────────────────────────────────────────────────────

/**
 * The state of one editable value in one row. See design §5.1.
 *
 * ⚠ `applied` IS REACHABLE ONLY FROM A RECEIPT. That is the point of the union.
 * Today a Model-tab edit to an edge strength, an option's intervention value or
 * the goal target is a LOCAL STORE WRITE that never reaches CEE, while a factor
 * value edit is a real turn — and the two are indistinguishable on screen
 * (design §2, F6). A row that can only render `applied` when an authority says
 * so cannot reproduce that.
 *
 * `refused` is deliberately a first-class state, not an error toast: a declined
 * edit must be visible in the row that caused it, in words, with the value
 * reverted. A refusal that looks like nothing happened is the same defect as a
 * silent local write, one step later.
 */
export type EditCommitState =
  /** No edit in progress; the row shows the model's value. */
  | { phase: 'idle' }
  /** The user is typing. Nothing has been stated yet. */
  | { phase: 'editing'; draft: string }
  /**
   * The user has stated an intent. THE MODEL IS UNCHANGED and the previous
   * value stays visible beside the proposed one until it is confirmed.
   */
  | { phase: 'proposed'; from: string; to: string }
  /** Dispatched to the write authority. Not re-editable until it settles. */
  | { phase: 'inflight'; from: string; to: string }
  /**
   * A receipt came back. The provenance chip flips on this transition.
   *
   * ⚠ BOTH FIELDS COME FROM THE RECEIPT, not from what the row sent. A row that
   * echoed its own typed value here would render "applied" with the number it
   * hoped for rather than the number the authority stored — which is the silent
   * local write of design §2 F6 wearing a receipt's clothes. `provenanceSource`
   * is the authority's raw stamp (`EditProposalHandle.receipt.provenanceLiteral`),
   * classified for display by the one shared classifier.
   */
  | { phase: 'applied'; value: string; provenanceSource: string }
  /** The authority declined. `reason` is user-facing prose, not a code. */
  | { phase: 'refused'; from: string; attempted: string; reason: string }

// ── Rows ─────────────────────────────────────────────────────────────────────

/**
 * Why a row is asking for the user's attention. Drives both the row marker and
 * the header chip counts — ONE predicate, counted once and rendered twice, so
 * the badge and the queue can never disagree (today's "N to verify" badge and
 * `countFactorsToVerify` already share a predicate; this generalises that rule
 * rather than inventing a second one).
 */
export type AttentionReason =
  /** No value is set at all. Today this row offers no editor — design F9. */
  | 'no-value'
  /** An AI estimate nobody has ratified (`source` absent or `cee_inference`). */
  | 'unconfirmed-estimate'
  /** Two validator passes disagree; hosted by the existing ContestedEdgeCard. */
  | 'contested'
  /** Robustness says this edge could flip the result. */
  | 'fragile'
  /** An option has no intervention value for a factor it should change. */
  | 'missing-intervention'

/**
 * One element of the model, as one row. The SAME anatomy for every kind — that
 * uniformity is what makes tab-through-and-fix possible and what lets a queue
 * be a filtered view of the outline rather than a second rendering of it.
 */
export interface ModelRow {
  /** ID-ADDRESSED. Never a label — a label retargets on rename (trap 19). */
  id: string
  kind: ModelElementKind
  group: ModelGroupId
  label: string
  /**
   * The value shown in the row, ALREADY RESOLVED FOR DISPLAY and in PLAIN
   * language ("Strong positive effect", "45 days"). `null` means nothing is
   * stated — which is a fact to render, never a zero to invent.
   */
  primaryValue: string | null
  /**
   * The RAW provenance stamp as the model recorded it (`'brief_extraction'`,
   * `'cee_inference'`, `'user_confirmed'`, …) — NOT a classified kind.
   *
   * ⚠ CORRECTED FROM THE FIRST DRAFT, which typed this as `ValueProvenanceKind`.
   * `SourceProvenancePill` takes the LITERAL and classifies it itself. Handing it
   * a kind would force an inverse kind→literal map here, which is (a) lossy —
   * several literals classify to one kind, so the inverse has no single answer —
   * and (b) a second hand-maintained mirror of the classifier, which is the exact
   * defect that pill's own header records: it once keyed on three literals,
   * missed `user_confirmed`, and rendered "Not set" over a value the user had
   * explicitly confirmed. Carry the literal; let the one classifier classify.
   *
   * Absent when nothing states a provenance. That is a fact to render as
   * absence, never a default to invent.
   */
  provenanceSource?: string
  /** Empty when the row needs nothing. */
  attention: readonly AttentionReason[]
  /** False for rows that are genuinely read-only (e.g. an audit figure). */
  editable: boolean
}

/** One labelled value in the detail region. Both sides already display-ready. */
export interface DetailField {
  label: string
  /** `null` renders as an explicit absence. Never a zero, never an em dash alone. */
  value: string | null
}

/**
 * Everything the detail region shows for ONE selected row (design §4.4).
 *
 * ⚠ `rowId` IS LOAD-BEARING, NOT BOOKKEEPING. The detail region asserts it
 * against the row it was asked to describe and refuses to render on a mismatch.
 * A detail pane silently showing another element's provenance and parameters is
 * the worst failure available to this surface — it is confident, wrong, and
 * indistinguishable from correct. Binding by identity rather than by position is
 * the same rule the estate learned when a spec found a factor BY VALUE and
 * passed against a different factor entirely.
 */
export interface ModelRowDetail {
  rowId: string
  /** §4.4.1 "What this is". */
  description: string | null
  /** §4.4.2 "Its value" — secondary values that are STILL PLAIN (baseline, direction…). */
  secondaryValues: readonly DetailField[]
  /** §4.4.3 "Where it came from" — the basis sentence, in the user's language. */
  basis: string | null
  /**
   * §4.4.3 — what Olumi adjusted and why. Text must already be through the
   * existing `sanitiseDetail`, which strips engine field paths out of
   * user-facing copy; this surface does not sanitise a second time and must not
   * be handed raw engine prose.
   */
  adjustments: readonly string[]
  /** §4.4.4 "What it affects" — related elements, ID-addressed for navigation. */
  affects: readonly { id: string; label: string }[]
  /**
   * §4.4.5 — the ONE Advanced block. ⚠ ABSENT ENTIRELY IN PLAIN, and never
   * mixed inline beside a plain value (design §4.3 rule 2). If a "parameter"
   * has to be visible in Plain to make sense of a value — a unit, say — it is
   * not a parameter and does not belong in here.
   */
  advancedParameters: readonly DetailField[]
}

/**
 * A repair queue = a FILTERED VIEW OF THE SAME OUTLINE, entered from an
 * attention chip. Deliberately not a modal and not a separate screen: one
 * rendering of a row, one state, and the user never loses their place.
 */
/**
 * One item in a repair queue — a row of the outline, seen through the queue.
 *
 * ⚠ `rowId` IS THE SAME ID AS THE OUTLINE ROW'S, deliberately. A queue is a
 * FILTERED VIEW of the outline, not a second rendering of it: same identity,
 * same value, one place where the truth lives. The moment a queue carries its
 * own copy of an element, the two can disagree, and the user is looking at two
 * screens that both claim to describe one factor.
 */
export interface RepairQueueItem {
  rowId: string
  label: string
  /** What the model says now. `null` when nothing is set — the F9 case. */
  currentValue: string | null
  /**
   * The value the queue would apply — e.g. a factor's baseline prefilled as an
   * option's intervention. ⚠ A SUGGESTION, NOT A FACT: it has not been applied,
   * and until the user confirms it the model does not contain it.
   */
  suggestedValue: string | null
  /** Why this value is suggested, in the user's language. */
  basis: string | null
}

export interface RepairQueue {
  id: 'set-option-values' | 'confirm-estimates' | 'contested' | 'no-value'
  /** The reason whose rows this queue collects. */
  reason: AttentionReason
  /** Sentence-case, British English, states the count and the action. */
  title: string
  /**
   * Whether an "Apply all shown" affordance is offered. It requires the write
   * authority's BATCH form — N separate turns would mean N undo steps and N
   * analysis invalidations for one user gesture.
   */
  supportsApplyAll: boolean
}

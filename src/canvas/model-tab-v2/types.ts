/**
 * Model tab v2 — the structured model editor. The type contracts.
 *
 * MOUNTED since the 16 Aug 2026 mount train: `ModelTabV2Panel` hosts the
 * outline + detail region on the Model tab (via `ModelTabBody`), with factor
 * value edits riding the canonical `factor_value_edit` transaction through
 * `useModelEditAuthority`. These declarations pin the contracts in
 * `docs/Design/MODEL-EDITOR-V2.md` (capital D — the lowercase path does not
 * exist and resolves only on macOS). The design's §7 KEEP/CUT removal review
 * still awaits Paul's verdict — the mount is ADDITIVE and removed nothing.
 *
 * WHY TYPES AND NOT PROSE. Three of the twelve defects the design documents are
 * hand-maintained mirrors (a dead search prop, a dead `isContested` prop, a
 * hand-copied band-threshold table). A contract expressed as prose becomes the
 * next one. Expressed as a total union it is a type error instead.
 *
 * THE RAW-WRITE GUARD IS WIDENED (the obligation the pre-mount header carried):
 * `modelTabNoRawStoreWrites.sourceScan.spec.ts` now scans this directory too,
 * and `modelTabV2Boundary.sourceScan.spec.ts` pins the mount path, bans direct
 * writes in every file here, and pins the mount host's foreign hooks to the
 * one authority seam.
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
   * True when this row's LABEL is an unconfirmed extract from the user's brief
   * (CEE `provenance: 'from_brief'`), resolved by the one predicate in
   * `domain/goalLabelProvenance`. Distinct from `provenanceSource` below, which
   * is about the VALUE — two different questions, deliberately not sharing a
   * field.
   */
  labelFromBrief?: boolean
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
  /**
   * Empty when the row needs nothing.
   *
   * ⚠ DEFERRING DOES NOT EMPTY THIS. A deferred row keeps reporting its gap —
   * see `deferred` below.
   */
  attention: readonly AttentionReason[]
  /**
   * Present when a human has explicitly chosen to leave this row unresolved.
   *
   * ⚠ THIS SITS BESIDE `attention`, IT NEVER CLEARS IT. The two answer different
   * questions — *does this need attention?* and *has a human ruled that it can
   * wait?* — and a row that stopped reporting its gap once deferred would be
   * hiding it, which is the dismiss button this design cut.
   */
  deferred?: DeferralRecord
  /** False for rows that are genuinely read-only (e.g. an audit figure). */
  editable: boolean
}

/**
 * A recorded decision to leave something unresolved (design §5.3, Paul's ruling
 * 16 Aug 2026). **THIS IS NOT A DISMISSAL.**
 *
 * The dismiss `×` on the defaulted-factor coaching card is cut, and stays cut,
 * because it makes a real gap invisible. Deferral is its opposite and differs by
 * exactly two properties, BOTH of which are load-bearing:
 *
 *   1. the item NEVER LEAVES THE SURFACE — it moves to a de-emphasised "Left
 *      unresolved" group inside the same queue, never out of it;
 *   2. it CARRIES PROVENANCE — who decided, and when.
 *
 * ⚠ BOTH FIELDS ARE REQUIRED, DELIBERATELY. An anonymous or undated deferral is
 * indistinguishable from a row a bug dropped, and the honest state — "a human
 * chose to leave this unresolved" — collapses into "this was never a gap" the
 * moment you cannot say who chose or when. Optional provenance is how the
 * dismiss button would grow back wearing a better name.
 */
export interface DeferralRecord {
  /** The person who chose to defer. Never blank, never "system". */
  by: string
  /** When they chose it. ISO 8601. */
  at: string
}

/** One labelled value in the detail region. Both sides already display-ready. */
export interface DetailField {
  label: string
  /** `null` renders as an explicit absence. Never a zero, never an em dash alone. */
  value: string | null
}

/**
 * ONE factor an option would move, and the target it would move it to
 * (design §4.4.2, rehomed from `OptionsSection`'s intervention rows 18 Aug 2026).
 *
 * ⚠ `factorLabel` IS ALWAYS A HUMAN LABEL, NEVER THE ID. The v1 rows fell back
 * to `factorId` when the lookup missed (`factorNode?.data?.label ?? factorId`),
 * which put a raw wire id on screen for exactly the factors a user is least
 * able to identify. The projection resolves through the one label policy and
 * names an unresolvable endpoint `UNNAMED_ELEMENT_LABEL` instead.
 *
 * ⚠ `value` AND `numericValue` ANSWER DIFFERENT QUESTIONS and are deliberately
 * both present. `value` is what the row DISPLAYS — it may be a CEE-authored
 * `display_value` string that no arithmetic produced. `numericValue` is what an
 * editor SEEDS FROM, and it is `null` whenever no finite number is stated, so a
 * display string can never be silently reinterpreted as a number the user then
 * appears to have typed.
 */
export interface OptionInterventionField {
  factorId: string
  factorLabel: string
  value: string | null
  numericValue: number | null
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
   * §4.4.2 — for an OPTION, the factors it would move and the targets it sets.
   * Empty for every other kind, and empty for an option that sets none: an
   * option with no interventions reports that through its row's
   * `missing-intervention` attention, not by this list quietly meaning two
   * different things.
   */
  interventions: readonly OptionInterventionField[]
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
  /**
   * Present when the user chose to leave this item unresolved (§5.3).
   *
   * ⚠ A DEFERRED ITEM IS STILL IN THE QUEUE. It renders in the de-emphasised
   * "Left unresolved" group, and it is EXCLUDED from "Apply all shown" — a batch
   * that swept deferred items back in would silently overrule a recorded human
   * decision, which is the one thing a repair queue must never do.
   */
  deferred?: DeferralRecord
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

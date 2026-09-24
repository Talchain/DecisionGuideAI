/**
 * THE MODEL-WIDE REVIEW QUEUE — one list of the things in this model worth a
 * second look, built from data the tab already holds. Nothing here is new data.
 *
 * ## Why it exists
 *
 * The only review affordance on the Reasoning tab was the model strip's
 * "N to verify" count, and that counts FACTORS ONLY (`factorIsConfirmable`,
 * `buildModelStrip.ts` `needsCheck`). The engine's own findings about framing,
 * relationships, alternatives and evidence lived in a separate wall of cards
 * (`sections/StrengthenTheReasoning.tsx`). This joins the two into ONE queue,
 * so the reader has one place to review the model.
 *
 * ## The two sources, and nothing else
 *
 * 1. `vm.strengthen.interventions` — the engine's recommendations, VERBATIM and
 *    in the engine's own priority order (`strengthen/buildRecommendations.ts`).
 *    One may be excluded by id: the one another surface already promotes.
 * 2. The model strip's verify worklist — `buildModelStrip(nodes)`'s factor row
 *    filtered by `needsCheck`, the SAME builder and the SAME predicate the
 *    strip's "N to verify" toggle uses, in the same order. It is called here,
 *    not re-derived, so the two counts cannot disagree about a factor.
 *
 * ⚠ NO MATERIALITY ORDER. `materialParametersAwaitingUser.ts` publishes its set
 * in GRAPH ORDER and ranks nothing, and says a surface may never present a
 * member as the one to do first. So the factors keep the strip's order.
 *
 * ## Dedupe
 *
 * An intervention and a verify-list factor about the SAME node are one item:
 * the intervention keeps its place and its reason, and carries the factor's
 * value and provenance. Two interventions about one node stay two items: they
 * are two findings with two different reasons, and folding them would drop one.
 *
 * ## Kinds are READ, never guessed
 *
 * A kind label is shown only where a field says it: the recommendation's id
 * family (the engine's own trigger), the producer's `signal_code`, the engine's
 * `helpType`, or a target that is an edge. Anything else is `unclassified` and
 * reads as a neutral word. See `reviewKindFor`.
 */

import type { AskOlumiPayload } from '../coaching/askOlumiStore'
import { REVIEW_BRIEF_ASK } from '../decision-overview/actionsCatalogue'
import { attentionNoteForRecommendation } from '../strengthen/recommendationAttention'
import type { Recommendation } from '../strengthen/strengthenTypes'
import {
  classifyValueProvenance,
  VALUE_PROVENANCE_LABEL,
  type ValueProvenanceKind,
} from '../../../canvas/domain/valueProvenance'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../canvas/domain/vocabulary'
import { ANALYSIS_NEW_COPY } from './analysisNewCopy'
import { buildModelStrip, type StripNode } from './buildModelStrip'

// ── Copy (this file owns it; nothing here is respelled from elsewhere) ────────

export const REVIEW_TOOL_COPY = {
  toReview: (n: number) => `${n} to review`,
  /** Contains the visible text, so the control keeps label-in-name. */
  toReviewName: (n: number) => `${n} to review. Open the review of this model`,
  entryTip: 'Framing, assumptions, relationships and values. Reviewing is not evidence validation.',
  askFraming: 'Ask Olumi to check the whole framing',
  heading: 'Review the thinking',
  pager: (k: number, n: number) => `${k} / ${n}`,
  previous: 'Previous review item',
  next: 'Next review item',
  close: 'Close the review',
  inspect: 'Inspect in Model',
  focus: 'Focus on canvas',
  ask: 'Ask Olumi about this item',
  more: 'More actions for this item',
  edit: 'Edit this item',
  addContext: 'Add evidence or context',
  addContextTip: 'Olumi discusses it with you. Nothing you add is stored as verified evidence.',
  confirm: 'Confirm as my estimate',
  confirmTip: 'Confirming makes this your estimate. It does not verify the evidence behind it.',
  confirmed: 'Recorded as your estimate. The evidence behind it is still not verified.',
  confirmRefused: 'Nothing changed. There is no number here to confirm.',
  yourValue: 'Your value',
  olumiEstimate: 'Olumi estimate',
  unnamedFactor: 'A factor with no name',
  askFactorDraft: (name: string) =>
    `Help me check the estimate for ${name}. What would support it, and what would change it?`,
  addContextDraft: (name: string) => `Here is evidence or context about ${name}: `,
} as const

// ── Kinds ─────────────────────────────────────────────────────────────────────

export type ReviewKind =
  | 'framing'
  | 'assumption'
  | 'relationship'
  | 'value'
  | 'alternatives'
  | 'evidence'
  | 'unclassified'

/**
 * The word each kind wears. TOTAL over `ReviewKind`, so a new kind is a type
 * error here rather than a blank label.
 *
 * ⚠ `unclassified` IS A NEUTRAL WORD, NOT A GUESS. Every item in this queue is
 * about the reasoning; saying so claims nothing about which part.
 */
export const REVIEW_KIND_LABEL: Readonly<Record<ReviewKind, string>> = Object.freeze({
  framing: 'Framing',
  assumption: 'Assumption',
  relationship: 'Relationship',
  value: 'Value',
  alternatives: 'Alternatives',
  evidence: 'Evidence',
  unclassified: 'Reasoning',
})

/** Which field said the kind. Rendered as `data-kind-basis`, never as copy. */
export type ReviewKindBasis =
  | 'id-family'
  | 'signal-code'
  | 'help-type'
  | 'edge-target'
  | 'verify-list'
  | 'none'

/**
 * The engine's own trigger families (`strengthen/buildRecommendations.ts`),
 * each with the field in that trigger that SAYS the kind:
 *
 *   success-measure → framing       sourceLine "your goal has no success threshold": it defines the goal
 *   next-input      → value         title "Give {factor} a value of your own"
 *   lehi            → evidence      signal "High influence, low evidence."
 *   flip            → relationship  targetId is a fragile EDGE; whyNow "This single relationship…"
 *   broaden         → alternatives  title "Find a route that works differently"; helpType 'broaden'
 *
 * ⚠ DELIBERATELY ABSENT: `voi` ("Investigate {factor}…"), `robustness`
 * ("Pressure-test…") and `commit` ("Record the decision…"). None of their
 * fields names one of the kinds, so they read as `unclassified`.
 *
 * Matched as the exact id or the id followed by `:`, so `strengthen:flip:e1`
 * matches `strengthen:flip` and nothing matches by accident of a shared stem.
 */
const KIND_BY_ID_FAMILY: ReadonlyArray<readonly [string, ReviewKind]> = [
  ['strengthen:success-measure', 'framing'],
  ['strengthen:next-input', 'value'],
  ['strengthen:lehi', 'evidence'],
  ['strengthen:flip', 'relationship'],
  ['strengthen:broaden', 'alternatives'],
]

/**
 * The producer's `signal_code`, where the code NAMES the kind. Exact match on
 * the producer's SCREAMING_SNAKE vocabulary, like `HELP_TYPE_BY_SIGNAL_CODE`.
 *
 * ⚠ SHORT ON PURPOSE. `PRE_MORTEM`, `FRAGILE_RESULT`, `COGNITIVE_BIAS`,
 * `CALIBRATION_PROMPT`, `STRENGTHEN_ITEM`, `ANALYSIS_NARRATIVE`,
 * `DEFAULT_NODE_CONFIDENCE` and `FLIP_THRESHOLD` name a move or a check, not
 * one of these kinds. An unknown code is an unknown kind.
 */
const KIND_BY_SIGNAL_CODE: Readonly<Record<string, ReviewKind>> = Object.freeze({
  ASSUMPTION_CHECK: 'assumption',
  EVIDENCE_GAP: 'evidence',
  LOW_OPTION_COUNT: 'alternatives',
})

function idFamilyKind(id: string): ReviewKind | null {
  for (const [family, kind] of KIND_BY_ID_FAMILY) {
    if (id === family || id.startsWith(`${family}:`)) return kind
  }
  return null
}

/**
 * The kind of one recommendation, and the field that said it.
 *
 * Precedence: the engine's trigger family, then the producer's code, then the
 * help type, then an edge target. The first field that SAYS a kind wins; one
 * that says nothing is skipped rather than read as a hint.
 */
export function reviewKindFor(
  rec: Pick<Recommendation, 'id' | 'helpType' | 'signalCode' | 'targetId'>,
  edgeIds: ReadonlySet<string>,
): { kind: ReviewKind; basis: ReviewKindBasis } {
  const byFamily = idFamilyKind(rec.id)
  if (byFamily) return { kind: byFamily, basis: 'id-family' }
  const byCode = rec.signalCode ? KIND_BY_SIGNAL_CODE[rec.signalCode] : undefined
  if (byCode) return { kind: byCode, basis: 'signal-code' }
  if (rec.helpType === 'broaden') return { kind: 'alternatives', basis: 'help-type' }
  if (rec.targetId && edgeIds.has(rec.targetId)) return { kind: 'relationship', basis: 'edge-target' }
  return { kind: 'unclassified', basis: 'none' }
}

// ── Items ─────────────────────────────────────────────────────────────────────

/** The factor an item is about, exactly as the model strip reads it. */
export interface ReviewFactor {
  nodeId: string
  /** `''` when the node has no label; never an id. */
  label: string
  /** `factorDisplayText`, via the strip. `null` = no text to display. */
  valueText: string | null
  /** Whether the factor carries a value at all (the strip's `hasValue`). */
  hasValue: boolean
  /** `observed_state.source`, verbatim. */
  valueSource: string | undefined
  /** `factorIsConfirmable` — the strip's "to verify" predicate, and Confirm's gate. */
  needsCheck: boolean
}

export interface ReviewQueueItem {
  /** Stable identity: the recommendation id, or `factor:<nodeId>`. */
  key: string
  /** What the item is called: the finding's title, or the factor's label. */
  name: string
  targetId: string | null
  kind: ReviewKind
  kindBasis: ReviewKindBasis
  /** ONE line: the finding's `whyNow`, else its `signal`, verbatim. */
  reason: string | null
  /** Where the finding came from, verbatim. `null` for a verify-list factor. */
  sourceLine: string | null
  recommendation: Recommendation | null
  factor: ReviewFactor | null
}

export interface ReviewQueueInputs {
  /** `vm.strengthen.interventions`, in engine order. */
  interventions: readonly Recommendation[]
  /** The recommendation another surface promotes; excluded here. */
  excludeId?: string | null
  /** The canvas nodes, as the model strip reads them. */
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>
  /** The canvas edge ids, so an edge target can be told from a node target. */
  edgeIds?: Iterable<string>
}

function toReviewFactor(node: StripNode): ReviewFactor {
  return {
    nodeId: node.id,
    label: node.label,
    valueText: node.valueText,
    hasValue: node.hasValue,
    valueSource: node.valueSource,
    needsCheck: node.needsCheck,
  }
}

export function buildReviewQueue(inputs: ReviewQueueInputs): ReviewQueueItem[] {
  const edgeIds = new Set(inputs.edgeIds ?? [])
  const strip = buildModelStrip(inputs.nodes)
  const factorNodes = strip.rows.find((r) => r.kind === 'factor')?.nodes ?? []
  const factorById = new Map(factorNodes.map((n) => [n.id, n]))

  const recs = inputs.interventions.filter((r) => r.id !== inputs.excludeId)
  const items: ReviewQueueItem[] = recs.map((rec) => {
    const { kind, basis } = reviewKindFor(rec, edgeIds)
    const factorNode = rec.targetId ? factorById.get(rec.targetId) : undefined
    return {
      key: rec.id,
      name: rec.title,
      targetId: rec.targetId,
      kind,
      kindBasis: basis,
      reason: rec.whyNow || rec.signal || null,
      sourceLine: rec.sourceLine || null,
      recommendation: rec,
      factor: factorNode ? toReviewFactor(factorNode) : null,
    }
  })

  const covered = new Set(recs.map((r) => r.targetId).filter((id): id is string => !!id))
  for (const node of factorNodes) {
    if (!node.needsCheck || covered.has(node.id)) continue
    items.push({
      key: `factor:${node.id}`,
      name: node.label || REVIEW_TOOL_COPY.unnamedFactor,
      targetId: node.id,
      kind: 'value',
      kindBasis: 'verify-list',
      // The product's own label for exactly this predicate state. It says
      // nobody has confirmed the number; it does not say who wrote it.
      reason: UNCONFIRMED_ESTIMATE_LABEL,
      sourceLine: null,
      recommendation: null,
      factor: toReviewFactor(node),
    })
  }
  return items
}

// ── Provenance words ──────────────────────────────────────────────────────────

/**
 * Whose value this is, in this panel's words. `null` renders nothing.
 *
 * ⚠⚠ AN ABSENT SOURCE IS SILENCE, NOT "Olumi estimate". `factorNeedsVerification`
 * joins a value the model invented with a value that arrived with no source at
 * all, and `canvas/domain/vocabulary.ts` says in so many words that the state
 * is not an authorship claim. The reason line already says "Estimate not yet
 * confirmed", which is the true part. An unknown literal is silence too, for
 * the reason `classifyValueProvenance` gives.
 */
const PROVENANCE_WORD: Readonly<Record<ValueProvenanceKind, string>> = Object.freeze({
  confirmed: REVIEW_TOOL_COPY.yourValue,
  edited: REVIEW_TOOL_COPY.yourValue,
  assumption: REVIEW_TOOL_COPY.yourValue,
  human: REVIEW_TOOL_COPY.yourValue,
  ai: REVIEW_TOOL_COPY.olumiEstimate,
  brief: VALUE_PROVENANCE_LABEL.brief,
  panel: VALUE_PROVENANCE_LABEL.panel,
})

export function reviewValueProvenance(factor: ReviewFactor | null): string | null {
  if (!factor || !factor.hasValue) return null
  const cls = classifyValueProvenance(factor.valueSource)
  return cls === null ? null : PROVENANCE_WORD[cls.kind]
}

/** The value line's text, or `null` when there is nothing to display. */
export function reviewValueText(factor: ReviewFactor | null): string | null {
  if (!factor) return null
  if (factor.valueText !== null) return factor.valueText
  // A value the shared formatter declines to render is NOT "no value".
  return factor.hasValue ? null : ANALYSIS_NEW_COPY.modelStrip.noValue
}

// ── Ask payloads (the drawer's own shape; the caller opens it) ────────────────

/**
 * "Ask Olumi to check the whole framing" — the estate's existing shared
 * payload, `REVIEW_BRIEF_ASK`, exactly as the Actions menu and the overview
 * card send it. No new prompt.
 */
export const WHOLE_FRAMING_ASK: AskOlumiPayload = Object.freeze({ ...REVIEW_BRIEF_ASK, source: 'chip' })

/**
 * Ask about one item.
 *
 * ⚠ A RECOMMENDATION ASKS THE WAY THE TAB'S OWN INTERVENTION ROUTE DOES
 * (`AnalysisNewTabBody.tsx` `runIntervention`): its `parameters` carry the
 * producer's `block_id` — the only thing on the wire that says WHICH finding —
 * and its attention note carries it to "Focus on canvas". Dropping either is
 * the defect `everyAskCarriesItsBlockId.spec.ts` exists for.
 *
 * A verify-list factor has no producer record, so it carries NO `parameters`,
 * for the reason `askOlumiAbout` gives: an invented identifier is a claim
 * nothing upstream authored.
 */
export function reviewItemAskPayload(item: ReviewQueueItem): AskOlumiPayload {
  const rec = item.recommendation
  if (rec) {
    return {
      context: rec.whyNow || rec.signal,
      draft: rec.action.prompt ?? rec.tryThis ?? rec.title,
      label: rec.action.label,
      ...(rec.targetId ? { targetId: rec.targetId } : {}),
      ...(rec.action.parameters ? { parameters: rec.action.parameters } : {}),
      attentionNote: attentionNoteForRecommendation(rec),
    }
  }
  return {
    context: factorContext(item),
    draft: REVIEW_TOOL_COPY.askFactorDraft(item.name),
    label: REVIEW_TOOL_COPY.ask,
    ...(item.targetId ? { targetId: item.targetId } : {}),
  }
}

/**
 * "Add evidence or context" — there is NO model-level evidence store, so this
 * is an ask, never a form. The draft opens for the user to finish; nothing is
 * recorded as evidence.
 */
export function reviewItemContextPayload(item: ReviewQueueItem): AskOlumiPayload {
  const rec = item.recommendation
  return {
    context: rec ? rec.whyNow || rec.signal : factorContext(item),
    draft: REVIEW_TOOL_COPY.addContextDraft(item.name),
    label: REVIEW_TOOL_COPY.addContext,
    ...(item.targetId ? { targetId: item.targetId } : {}),
    ...(rec?.action.parameters ? { parameters: rec.action.parameters } : {}),
    ...(rec ? { attentionNote: attentionNoteForRecommendation(rec) } : {}),
  }
}

function factorContext(item: ReviewQueueItem): string {
  const value = reviewValueText(item.factor)
  const parts = [value ? `${item.name}: ${value}.` : `${item.name}.`]
  if (item.reason) parts.push(`${item.reason}.`)
  return parts.join(' ')
}

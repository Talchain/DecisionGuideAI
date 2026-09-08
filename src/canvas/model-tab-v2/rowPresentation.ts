/**
 * Model tab v2 — how a row's kind and its attention reasons are PRESENTED.
 *
 * ⚠ BOTH MAPS ARE TOTAL BY CONSTRUCTION (`Record<Union, …>`). That is the whole
 * reason they live in one small module instead of inline in the row component:
 * adding a member to `ModelElementKind` or `AttentionReason` becomes a TYPE
 * ERROR here rather than a silently blank glyph or an unlabelled marker on
 * screen. Three of the twelve defects the design documents are hand-maintained
 * mirrors that failed exactly this way — a dead search prop, a dead `isContested`
 * prop, and a hand-copied band-threshold table (design §2, F3/F12).
 *
 * NOTHING HERE IS MOUNTED. See `types.ts` for the directory-level statement.
 */

import type {
  AttentionReason,
  DeferralRecord,
  ModelElementKind,
  ModelGroupId,
  RepairQueue,
} from './types'
import { DECISION_NODE_LABEL, UNCONFIRMED_ESTIMATE_LABEL } from '../domain/vocabulary'
import { AlertTriangle, CircleDashed, HelpCircle, Split, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * How a deferral reads on screen (design §5.3, Paul's ruling 16 Aug 2026).
 *
 * ⚠ ONE IMPLEMENTATION, SHARED BY THE ROW AND THE QUEUE. Both surfaces show a
 * deferral and both must say the same thing about it; two copies of this
 * sentence would be the hand-maintained mirror that is this codebase's dominant
 * defect class, and the failure mode is ugly — the same deferral described two
 * different ways on two screens the user can see at once.
 *
 * ⚠ THE PERSON AND THE DATE ARE ALWAYS BOTH PRINTED. "Left unresolved" alone
 * would be indistinguishable from a row that vanished for some other reason; the
 * whole point of a deferral is that it says WHO decided.
 */
export function deferralLabel(deferral: DeferralRecord): string {
  return `Left unresolved by ${deferral.by}, ${formatDeferralDate(deferral.at)}`
}

/**
 * An unparseable timestamp renders VERBATIM rather than as "Invalid Date" or a
 * silently-omitted date. If the stored value is wrong, the surface should show
 * what is actually stored — that is a visible defect someone can chase, whereas
 * a swallowed date is a deferral that has quietly lost half its provenance.
 */
function formatDeferralDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The seven group headings, mapping 1:1 onto the brief's IA (design §4.1).
 * Total over `ModelGroupId` — a new group cannot render as an untitled section.
 */
/**
 * THE FOUR REPAIR QUEUES, TOTAL BY CONSTRUCTION (design §5.3).
 *
 * ⚠ A `Record` over `RepairQueue['id']`, for the same reason as every other map
 * in this file: adding a queue id becomes a TYPE ERROR here rather than a queue
 * that renders with no title. The definitions were previously inline in the
 * queue's own spec — i.e. the only place a queue existed was a test fixture,
 * which is how a surface stays unmountable without anyone noticing.
 *
 * ⚠ `supportsApplyAll` IS A CLAIM ABOUT THE BATCH CARRIER, NOT A PREFERENCE.
 * It stays `true` where the design wants the affordance; the affordance itself
 * still renders DISABLED until `proposeBatch` exists, because N single
 * proposals is N turns, N undo steps and N analysis invalidations for one
 * gesture (`contracts.ts` §1).
 */
export const REPAIR_QUEUE: Record<RepairQueue['id'], RepairQueue> = {
  'confirm-estimates': {
    id: 'confirm-estimates',
    reason: 'unconfirmed-estimate',
    title: 'Confirm estimates',
    supportsApplyAll: true,
  },
  'set-option-values': {
    id: 'set-option-values',
    reason: 'missing-intervention',
    title: 'Set option values',
    supportsApplyAll: true,
  },
  contested: {
    id: 'contested',
    reason: 'contested',
    title: 'Contested relationships',
    supportsApplyAll: false,
  },
  'no-value': {
    id: 'no-value',
    reason: 'no-value',
    title: 'Factors with no value',
    supportsApplyAll: false,
  },
}

export const GROUP_TITLE: Record<ModelGroupId, string> = {
  goal: 'Goal',
  options: 'Options',
  factors: 'Factors',
  'outcomes-risks': 'Outcomes & risks',
  relationships: 'Relationships',
  'assumptions-provenance': 'Assumptions & provenance',
  'evidence-review': 'Evidence & review state',
}

/**
 * The row glyph. Deliberately reuses the shapes `EntityBar` already teaches, so
 * the outline and the canvas name the same kinds the same way — the v2 outline
 * replaces that bar's decorative segments, not its vocabulary (design §7.0 A1).
 */
export const KIND_GLYPH: Record<ModelElementKind, string> = {
  goal: '◇',
  decision: '□',
  option: '○',
  factor: '●',
  risk: '▲',
  outcome: '★',
  relationship: '→',
}

/** Screen-reader/tooltip name for the glyph. A glyph alone is not a label. */
export const KIND_LABEL: Record<ModelElementKind, string> = {
  goal: 'Goal',
  decision: DECISION_NODE_LABEL,
  option: 'Option',
  factor: 'Factor',
  risk: 'Risk',
  outcome: 'Outcome',
  relationship: 'Relationship',
}

/**
 * What each attention marker SAYS.
 *
 * British English, sentence case, and each states a fact about the model rather
 * than an instruction — the row marker and the header chip are rendered from the
 * SAME predicate (design §4.2), so a count and its rows can never disagree the
 * way today's "N to verify" badge and its unreachable factors do.
 */
/**
 * ⭐ THE MARK FOR EACH REASON — the SHAPE that carries the meaning.
 *
 * Before this, all five reasons drew `⚠`. Two of them co-occur on producible
 * rows (`contested` + `fragile` on a relationship; `no-value` +
 * `unconfirmed-estimate` on a factor), so a row could show two identical marks
 * and name neither. Distinct shapes make the row readable at rest, which a
 * `title` cannot do — a tooltip is unreachable by touch and by keyboard, and
 * asking a reader to hover three rows in turn to tell them apart is the defect,
 * not its remedy.
 *
 * ⚠ DERIVED FROM THE ENUM, so adding an `AttentionReason` is a TYPE ERROR here
 * rather than a silent fallback to somebody else's icon. That is the whole
 * reason this is a `Record<AttentionReason, …>` and not a lookup with a
 * default — a hand-maintained mark set that quietly reuses one shape is exactly
 * what was being fixed.
 */
/**
 * Is this row still carrying its TYPE's default name rather than one a person
 * wrote?
 *
 * Witnessed on deployed `a9c2e050`: a row in the Goal group read "Question"
 * beside what looked like an empty checkbox. Both halves are correct on their
 * own — `Question` is `DECISION_NODE_LABEL`, whose own doc argues it "invites
 * the user to write theirs", and the box is `'□'`, the decision kind glyph. The
 * defect is that the invitation is drawn in exactly the treatment an authored
 * label gets, so nothing distinguishes "not written yet" from "named Question".
 *
 * ⚠ COMPARED BY VALUE AGAINST THE CONSTANT, NOT BY KIND. Muting every decision
 * row would grey out every question a user HAS written — the failure mode that
 * makes this worse than the defect. The estate's precedent is
 * `utils/ghostTiers.ts:302`, which refuses a label equal to the unnamed
 * fallback for the same reason: a producer default is not a name a user typed.
 */
export function labelIsTypeDefault(row: { kind: ModelElementKind; label: string }): boolean {
  return row.kind === 'decision' && row.label.trim() === DECISION_NODE_LABEL
}

/** What a placeholder name says it is, for hover and assistive tech. */
export const UNWRITTEN_QUESTION_TITLE =
  'Your question is not written yet — open this to write it.'

export const ATTENTION_MARK: Record<AttentionReason, LucideIcon> = {
  'no-value': CircleDashed,
  'unconfirmed-estimate': HelpCircle,
  contested: Split,
  fragile: AlertTriangle,
  'missing-intervention': Target,
}

/**
 * Which reasons colour as a WARNING rather than as a note.
 *
 * ⚠ SEVERITY, NOT CATEGORY. `fragile` is the only reason that says the ANSWER
 * could change; the others say the model is incomplete, which is worth knowing
 * and is not an alarm. Colouring all five identically is what made the row read
 * as five alarms and taught a reader to ignore the colour.
 */
export const ATTENTION_IS_SEVERE: ReadonlySet<AttentionReason> = new Set<AttentionReason>([
  'fragile',
])

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  'no-value': 'No value set',
  // ⚠ THE STRING LIVES IN `domain/vocabulary` NOW, NOT HERE. The model strip
  // names the same state off the same predicate, and this directory is
  // sealed — see the constant's own note for why it moved rather than
  // being copied.
  'unconfirmed-estimate': UNCONFIRMED_ESTIMATE_LABEL,
  contested: 'Two passes disagree',
  fragile: 'Could flip the result',
  'missing-intervention': 'No target value for this option',
}

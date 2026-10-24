import { cardMark, type CardMarkId } from './cardMarks'
import { BottomCardMark } from './CardMark'
import { typography } from '../../../styles/typography'
import { SOURCE_MARK_GLYPH_CLASSES, SourceMark } from './EstimateMarker'
import { OlumiMergedMark, useOlumiMarkAsk, useOlumiMarkSlot } from './olumiMarkGroup'
import {
  classifyInterventionProvenance,
  classifyNodeProvenance,
  classifyObservedValueProvenance,
  factorValueIsUnconfirmedEstimate,
  VALUE_PROVENANCE_LABEL,
  type ValueProvenanceKind,
} from '../../domain/valueProvenance'
import { isStatedTargetValue, resolveGoalTarget, type GoalTargetSource } from '../../domain/goalTarget'

/**
 * ⭐ WHERE A NUMBER ON A CARD CAME FROM — marked on the face, never implied.
 *
 * Paul 23 Sep contract feedback point 1: *"Mark Olumi estimates explicitly …
 * User-set/evidence-backed values get their own provenance. Do not rely on
 * 'unmarked = Olumi' — too easy to misread in screenshots/shared views."*
 * Point 7: an option's `8% → 7%` *"must make clear whether 7% came from you /
 * Olumi / brief / evidence."*
 *
 * Every value carries one source glyph, explained in the Key, with the existing
 * precise source words on hover and in its accessible name (Paul, 7 Oct).
 *
 *   · `est.`  — Olumi's estimate (the existing served token, unchanged)
 *   · `you`   — a person set or confirmed it
 *   · `brief` — lifted from the user's own brief
 *   · `panel` — a named colleague's elicited answer, adopted by the owner
 *
 * ⚠ THERE IS NO `evidence` MARK, deliberately. Neither value vocabulary
 * (`observed_state.source`, `interventions[*].source`) carries a literal that
 * means "backed by evidence", and inventing one from a proxy would be the
 * invented-science claim the contract forbids. When a producer stamps one, it
 * becomes a fifth kind here and a type error everywhere it is not handled.
 *
 * ⚠ CLASSIFICATION IS NOT RE-DERIVED. The kinds come from the estate's two
 * existing owners (`classifyValueProvenance`, `classifyInterventionProvenance`)
 * and the existing `est.` gate (`factorValueIsUnconfirmedEstimate`); this module
 * only orders them and collapses the seven kinds into the four words a card has
 * room for. The hover/assistive label keeps the precise kind.
 */
export type ValueSourceMarkKind = 'olumi' | 'you' | 'brief' | 'panel' | 'unverified_brief' | 'unknown' | 'basis' | 'asked'

/** The visible word per mark. `est.` is the existing token, not a new spelling. */
export const VALUE_SOURCE_MARK_TOKEN: Readonly<Record<ValueSourceMarkKind, string>> = Object.freeze({
  olumi: cardMark('source-olumi').words,
  you: cardMark('source-you').words,
  brief: cardMark('source-brief').words,
  panel: cardMark('source-panel').words,
  unknown: cardMark('source-unknown').words,
  unverified_brief: cardMark('source-unverified_brief').words,
  basis: cardMark('source-basis').words,
  asked: cardMark('source-asked').words,
})

/** The accessible name per mark (screen readers, and the hover title). */
export const VALUE_SOURCE_MARK_LABEL: Readonly<Record<ValueSourceMarkKind, string>> = Object.freeze({
  olumi: cardMark('source-olumi').ariaWords,
  you: cardMark('source-you').ariaWords,
  brief: cardMark('source-brief').ariaWords,
  panel: cardMark('source-panel').ariaWords,
  unknown: cardMark('source-unknown').ariaWords,
  unverified_brief: cardMark('source-unverified_brief').ariaWords,
  basis: cardMark('source-basis').ariaWords,
  asked: cardMark('source-asked').ariaWords,
})

function markForKind(kind: ValueProvenanceKind): ValueSourceMarkKind {
  switch (kind) {
    case 'confirmed':
    case 'edited':
    case 'assumption':
    case 'human':
      return 'you'
    case 'unverified_brief':
      return 'unverified_brief'
    case 'brief':
      return 'brief'
    case 'panel':
      return 'panel'
    case 'ai':
    case 'accepted':
      return 'olumi'
  }
}

/**
 * The hover/assistive label for a classified kind. The four collapsed labels,
 * except where the precise act is worth saying: a confirmation is not an edit
 * (`valueProvenance.ts` header), and an assumption is the user's own framing.
 */
function labelForKind(kind: ValueProvenanceKind): string {
  if (kind === 'confirmed' || kind === 'assumption' || kind === 'accepted') return VALUE_PROVENANCE_LABEL[kind]
  return VALUE_SOURCE_MARK_LABEL[markForKind(kind)]
}

export interface FactorValueSourceMark {
  kind: ValueSourceMarkKind
  /** Precise hover/assistive label, e.g. "Confirmed by you" rather than "Set by you". */
  label: string
}

/**
 * The mark for a FACTOR's own value. Never for its range: see
 * `PRIOR_RANGE_SOURCE_MARK`.
 *
 * ORDER IS LOAD-BEARING:
 *   1. A user-owned or panel `source` stamp wins — a person's number must never
 *      wear `est.` because a stale `extractionType: 'inferred'` survived it
 *      (`FactorNode.anEditedValueIsNotAnEstimate.spec.tsx`).
 *   2. The existing `est.` gate — unchanged, one owner, three readers.
 *   3. A brief stamp (`source` classifies `brief`, or `extractionType:
 *      'explicit'`, which CEE writes beside `brief_extraction`) — UNLESS the
 *      marker is withdrawn: only an edit does that, so it is rule 4's pending
 *      edit, never the brief's number (`valueSourceMark.editOverBriefValue.spec.ts`).
 *   4. ⚠ `source` still says Olumi but the writer has WITHDRAWN `extractionType`
 *      — the signature `setObservedValue` leaves when a person types over an
 *      estimate, before the receipt stamps `user_override`. Marked `unknown`
 *      ("no source"): the record contradicts itself and claiming either author
 *      would be a guess, but an unmarked number would break point 1 (Codex
 *      #1919 5802926467). Transient by construction (the receipt resolves it
 *      to `you`).
 *      ⭐ WITHDRAWN IS A PRESENT KEY, NOT AN ABSENT ONE. Both writers
 *      (`setObservedValue`, `applyV5State`'s set-factor-value path) write
 *      `extractionType: undefined`, so the key is there. A value the producer
 *      drafted without the marker has NO key: served on CEE `9417228` (the
 *      OpenAI draft, `source: 'cee_inference'`, node `provenance:
 *      'ai_inferred'`), where rule 4 used to mark four first-pass values
 *      "no source" while the assistant called them Olumi assumptions (reviewer
 *      5827605617). That value's own `source` names its author, so it is
 *      Olumi's estimate, as the Model tab already reads it
 *      (`usePreAnalysisData.ts`: "CEE may omit extractionType while still
 *      setting source to an AI value").
 *   5. Anything else — no stamp, or a literal nobody classifies — is marked
 *      `unknown` ("no source" / "Source not recorded"). Still never unmarked
 *      (Paul 23 Sep contract feedback point 1: never "unmarked = Olumi"), but
 *      never relabelled as Olumi's either: Codex #63 5801529767, "keep the
 *      canonical classifier's unknown result honest". `you` is never inferred
 *      from an absence.
 */
export function factorValueSourceMark(data: unknown): FactorValueSourceMark | null {
  return resolveFactorValueSource(data).mark
}

/**
 * ⭐ IS THIS VALUE A PERSON'S EDIT STILL WAITING FOR ITS RECEIPT? — exactly
 * rule 4 above, read off the store's own record, and nothing else.
 *
 * The inspector's context pill reads THIS (independent review, PR #2046,
 * 5840944379), not a memory of its own last commit. A panel-held outcome — in
 * component state or a module-level map keyed by node id — did not survive a
 * reload (the pill credited Olumi with the user's unsent number while this
 * mark said "no source"), was never cleared when ANOTHER seam earned the
 * receipt, and leaked onto a same-id factor in a different scenario. The
 * record already carries the signature, and it survives serialisation (the
 * writers withdraw with `null`, see `extractionMarkerWithdrawn`), so pill and
 * card now answer from one owner: the same rule chain, in the same order.
 */
export function factorValueAwaitsReceipt(data: unknown): boolean {
  return resolveFactorValueSource(data).awaitingReceipt
}

function resolveFactorValueSource(data: unknown): {
  mark: FactorValueSourceMark
  awaitingReceipt: boolean
} {
  const d = data as Record<string, unknown> | undefined
  const provenance = typeof d?.provenance === 'string' ? d.provenance : null
  const nodeClass = classifyNodeProvenance(provenance)
  if (nodeClass?.kind === 'unverified_brief') {
    return { mark: { kind: 'unverified_brief', label: VALUE_SOURCE_MARK_LABEL.unverified_brief }, awaitingReceipt: false }
  }
  if (provenance && !nodeClass) {
    return { mark: { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }, awaitingReceipt: false }
  }
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  // The WHOLE observed state, not the stamp alone: `user_assumption` + the adoption's review is Olumi's figure, accepted
  // (kind `accepted`, `classifyObservedValueProvenance`); the bare literal is still the user's assumption.
  const stamped = classifyObservedValueProvenance(obs)

  // ⭐ An ACCEPTED Olumi figure is stated before the unconfirmed-estimate rule: Olumi's token, AIQ's words ("Olumi's
  // estimate · you accepted it", 5921018606) — accepted, so never "not yet confirmed", and never "you".
  if (stamped && (stamped.userOwned || stamped.kind === 'panel' || stamped.kind === 'accepted')) {
    return { mark: { kind: markForKind(stamped.kind), label: labelForKind(stamped.kind) }, awaitingReceipt: false }
  }
  if (factorValueIsUnconfirmedEstimate(data)) {
    return { mark: { kind: 'olumi', label: VALUE_SOURCE_MARK_LABEL.olumi }, awaitingReceipt: false }
  }
  if (stamped?.kind === 'brief' && extractionMarkerWithdrawn(obs)) {
    // Rule 4 over a BRIEF value — only an edit withdraws the marker, so this is
    // a person's number awaiting its receipt, not the brief's. Before this
    // check, rule 3 credited the typed number to the brief on card and pill.
    return { mark: { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }, awaitingReceipt: true }
  }
  if (stamped?.kind === 'brief' || obs?.extractionType === 'explicit' || d?.extractionType === 'explicit') {
    return { mark: { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }, awaitingReceipt: false }
  }
  if (stamped?.kind === 'ai' && !extractionMarkerWithdrawn(obs)) {
    // Rule 4a — the producer drafted this value and never wrote a marker: its
    // own `source` names the author.
    return { mark: { kind: 'olumi', label: VALUE_SOURCE_MARK_LABEL.olumi }, awaitingReceipt: false }
  }
  if (stamped?.kind === 'ai') {
    // Rule 4 — the writer withdrew the estimate claim (a dispatched edit keeps
    // the OLD `cee_inference` source and clears both extraction markers until
    // the receipt). Neither author is established yet, so the visible number
    // says so: `no source` — never `you` before acknowledgement, never the old
    // value's `est.` (Codex #1919 5802926467: every shown value has a source word).
    // The ONE rule that answers `factorValueAwaitsReceipt`.
    return { mark: { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }, awaitingReceipt: true }
  }
  // Rule 5a: no author stamp, but CEE says how the model sets this figure (`value_basis`, S3 23 Oct): worked out from
  // other figures, fixed by how the model is built, or waiting for the person's answer. Its words, verbatim.
  const basis = servedValueBasis(d)
  if (basis) return { mark: basis, awaitingReceipt: false }
  return { mark: { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }, awaitingReceipt: false }
}

const VALUE_BASIS_KINDS: Readonly<Record<string, 'basis' | 'asked'>> = { worked_out: 'basis', structure: 'basis', waiting_for_answer: 'asked' }
/** CEE's `value_basis` as a mark, or null when absent, of an unknown kind, or without words. */
function servedValueBasis(d: Record<string, unknown> | undefined): FactorValueSourceMark | null {
  const basis = d?.value_basis as { kind?: unknown; words?: unknown } | null | undefined
  const kind = typeof basis?.kind === 'string' ? VALUE_BASIS_KINDS[basis.kind] : undefined
  const words = typeof basis?.words === 'string' ? basis.words.trim() : ''
  return kind && words !== '' ? { kind, label: words } : null
}

/**
 * True when a writer WITHDREW the extraction marker (the key is present and
 * holds no value), as opposed to a producer that never wrote one (the key is
 * absent). See rule 4 above. Both writers clear BOTH spellings, so the
 * `observedState` one (the one rule 4 reads `source` from) is sufficient.
 *
 * ⚠⚠ BOTH `undefined` AND `null` COUNT (independent review, PR #2046
 * Blocking 2). The writers used to clear with `extractionType: undefined`,
 * which `JSON.stringify` DROPS — so the withdrawal did not survive the
 * autosave round trip or a boot restore with no server readback, and this
 * function read the key as ABSENT (never written) rather than WITHDRAWN
 * (pending), sending a user's own unconfirmed edit to rule 4a's "Olumi
 * estimate" instead of rule 4's "no source". The writers now clear with
 * `null`, which survives serialisation; `undefined` stays accepted here too,
 * for the in-session write before any round trip and for any caller this
 * function does not control.
 */
function extractionMarkerWithdrawn(obs: Record<string, unknown> | undefined): boolean {
  return (
    obs !== undefined &&
    'extractionType' in obs &&
    (obs.extractionType === undefined || obs.extractionType === null)
  )
}

/**
 * The mark for an option's TARGET value (`interventions[factorId].source`).
 *
 * NEVER null: every change row says where its target came from (point 7). An
 * absent or unrecognised literal is marked `unknown` ("no source"), never as
 * Olumi's estimate and never as the user's (Codex #63 5801529767: unknown must
 * never acquire human confirmation, an evidence binding, or an asserted AI
 * origin). The canonical classifier is not widened to make it answer.
 */
export function interventionTargetSourceMark(
  source: string | null | undefined,
  stamps: { userMaterialUnverified?: boolean } = {},
): FactorValueSourceMark {
  const stamped = classifyInterventionProvenance(source ?? null, stamps)
  if (!stamped) return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
  return { kind: markForKind(stamped.kind), label: labelForKind(stamped.kind) }
}

/**
 * The mark for a factor's PRIOR RANGE when it is the card's only figure.
 *
 * Always `unknown`: nothing on the node records who set a range. The inspector's
 * quick-set (`useInspectorMutations.setPriorRange`) writes `prior` alone, with no
 * provenance stamp, so the VALUE's mark (`factorValueSourceMark`, which reads
 * `observed_state.source` / `extractionType`) says nothing about the range, and
 * borrowing it put `est.` over a range the user set (reviewer blocker on Paul
 * 23 Sep contract feedback point 1). When a range-level stamp exists, classify
 * it here.
 */
export const PRIOR_RANGE_SOURCE_MARK: FactorValueSourceMark = Object.freeze({
  kind: 'unknown',
  label: VALUE_SOURCE_MARK_LABEL.unknown,
})

/**
 * The goal target's source mark. Only the target's own stamp credits the brief
 * or an editor; node quotes and the CURRENT level's source cannot attest it.
 * Declared inferred/proxy targets stay Olumi's even beside a quote.
 */
export function goalTargetSourceMark(
  data: (GoalTargetSource & { provenance?: unknown }) | null | undefined,
): FactorValueSourceMark {
  const target = resolveGoalTarget(data)
  if (target && isStatedTargetValue(target.raw)) {
    if (target.source === 'user') return { kind: 'you', label: VALUE_SOURCE_MARK_LABEL.you }
    if (target.source === 'brief') {
      return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }
    }
    if (target.source === 'olumi' || data?.provenance === 'inferred' || data?.provenance === 'proxy') {
      return { kind: 'olumi', label: 'Olumi’s estimate' }
    }
  }
  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
}

/** Source glyphs use the product registry; names and inspector routes are unchanged. */
export function ValueSourceMark({
  mark,
  testId,
  title,
  subject,
  onOpenSource,
  olumiGroupNoun,
  inline = false,
}: {
  mark: FactorValueSourceMark
  testId?: string
  /** Hover/focus text; defaults to the mark's label. */
  title?: string
  /** What the value is ("Monthly price target") — prefixed to the hover label, as v3.1 `prov()` does. */
  subject?: string
  /** The card's route to its source detail (v3.1 pt 1). Absent → a static mark. */
  onOpenSource?: () => void
  /**
   * ⭐ ONE OLUMI SPARKLE PER CARD (Paul, 14 Oct 2026; `olumiMarkGroup.tsx`): the singular noun this value is counted
   * as ("target value") when an Olumi mark joins the card's one merged sparkle. Absent → this mark never merges.
   */
  olumiGroupNoun?: string
  /**
   * Vision spec §2a (23 Oct): the author glyph sits BEFORE its figure, in the value's own line, rather than in the
   * card's marks band. An inline mark never joins the merged Olumi mark: it belongs to one figure.
   */
  inline?: boolean
}) {
  const tip = title ?? (subject ? `${subject}: ${mark.label}` : mark.label)
  const definition = cardMark(`source-${mark.kind}` as CardMarkId)
  const Icon = definition.Icon
  const slot = useOlumiMarkSlot(mark.kind === 'olumi' && olumiGroupNoun && !inline
    ? { role: 'estimate', text: olumiGroupNoun, accepted: mark.label === VALUE_PROVENANCE_LABEL.accepted, onOpen: onOpenSource }
    : null)
  // On a card the band's Olumi glyph asks Olumi about the card (`OlumiAskMark`, Paul 24 Oct). An INLINE mark belongs to
  // one figure and keeps its route to that figure's source detail.
  const ask = useOlumiMarkAsk()
  if (slot.render === 'none') return null
  if (slot.render === 'merged') return <BottomCardMark><OlumiMergedMark label={slot.label} estimateCount={slot.estimateCount} onOpen={slot.onOpen} /></BottomCardMark>
  const hoverTip = `${definition.words} · ${title ? `${mark.label} · ${tip}` : tip}`
  const asks = mark.kind === 'olumi' && !inline && ask !== null
  const body = (
    <SourceMark cardMarkId={definition.id} testId={testId} tip={hoverTip} ariaLabel={asks ? ask.text : tip} ariaDescription={asks ? hoverTip : mark.label} onOpen={asks ? ask.ask : onOpenSource} dataValueSource={mark.kind}>
      <span role="img" aria-label={definition.words}><Icon aria-hidden="true" strokeWidth={1.8} className={SOURCE_MARK_GLYPH_CLASSES} data-source-glyph={mark.kind === 'you' ? 'person' : undefined} /></span>
      <span className={typography.screenReaderOnly}>{mark.label}</span>
    </SourceMark>
  )
  return inline ? body : <BottomCardMark>{body}</BottomCardMark>
}

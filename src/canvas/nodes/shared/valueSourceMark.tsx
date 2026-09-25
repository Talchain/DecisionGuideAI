import { typography } from '../../../styles/typography'
import {
  classifyInterventionProvenance,
  classifyValueProvenance,
  factorValueIsUnconfirmedEstimate,
  VALUE_PROVENANCE_LABEL,
  type ValueProvenanceKind,
} from '../../domain/valueProvenance'
import { UNCONFIRMED_ESTIMATE_LABEL, UNCONFIRMED_ESTIMATE_TOKEN } from '../../domain/vocabulary'
import { isStatedTargetValue, type GoalTargetSource } from '../../domain/goalTarget'

/**
 * ⭐ WHERE A NUMBER ON A CARD CAME FROM — marked on the face, never implied.
 *
 * Paul 23 Sep contract feedback point 1: *"Mark Olumi estimates explicitly …
 * User-set/evidence-backed values get their own provenance. Do not rely on
 * 'unmarked = Olumi' — too easy to misread in screenshots/shared views."*
 * Point 7: an option's `8% → 7%` *"must make clear whether 7% came from you /
 * Olumi / brief / evidence."*
 *
 * So every value a factor card or an option change row prints carries ONE short
 * visible word saying whose it is. Words, not colour: the mark is legible in a
 * screenshot, needs no hover, and reads the same in greyscale (point 12).
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
export type ValueSourceMarkKind = 'olumi' | 'you' | 'brief' | 'panel' | 'unknown'

/** The visible word per mark. `est.` is the existing token, not a new spelling. */
export const VALUE_SOURCE_MARK_TOKEN: Readonly<Record<ValueSourceMarkKind, string>> = Object.freeze({
  olumi: UNCONFIRMED_ESTIMATE_TOKEN,
  you: 'you',
  brief: 'brief',
  panel: 'panel',
  unknown: 'no source',
})

/** The accessible name per mark (screen readers, and the hover title). */
export const VALUE_SOURCE_MARK_LABEL: Readonly<Record<ValueSourceMarkKind, string>> = Object.freeze({
  olumi: `Olumi estimate — ${UNCONFIRMED_ESTIMATE_LABEL.toLowerCase()}`,
  you: 'Set by you',
  brief: 'From your brief',
  panel: VALUE_PROVENANCE_LABEL.panel,
  /**
   * ⭐ UNKNOWN STAYS UNKNOWN (Codex #63 5801529767). A missing or unrecognised
   * source is not relabelled as Olumi's estimate or as the user's: it says,
   * in words, that nobody recorded where the number came from.
   */
  unknown: 'Source not recorded',
})

function markForKind(kind: ValueProvenanceKind): ValueSourceMarkKind {
  switch (kind) {
    case 'confirmed':
    case 'edited':
    case 'assumption':
    case 'human':
      return 'you'
    case 'brief':
      return 'brief'
    case 'panel':
      return 'panel'
    case 'ai':
      return 'olumi'
  }
}

/**
 * The hover/assistive label for a classified kind. The four collapsed labels,
 * except where the precise act is worth saying: a confirmation is not an edit
 * (`valueProvenance.ts` header), and an assumption is the user's own framing.
 */
function labelForKind(kind: ValueProvenanceKind): string {
  if (kind === 'confirmed' || kind === 'assumption') return VALUE_PROVENANCE_LABEL[kind]
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
 *      'explicit'`, which CEE writes beside `brief_extraction`).
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
  const d = data as Record<string, unknown> | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  const source = typeof obs?.source === 'string' ? obs.source : null
  const stamped = classifyValueProvenance(source)

  if (stamped && (stamped.userOwned || stamped.kind === 'panel')) {
    return { kind: markForKind(stamped.kind), label: labelForKind(stamped.kind) }
  }
  if (factorValueIsUnconfirmedEstimate(data)) {
    return { kind: 'olumi', label: VALUE_SOURCE_MARK_LABEL.olumi }
  }
  if (stamped?.kind === 'brief' || obs?.extractionType === 'explicit' || d?.extractionType === 'explicit') {
    return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }
  }
  if (stamped?.kind === 'ai' && !extractionMarkerWithdrawn(obs)) {
    // Rule 4a — the producer drafted this value and never wrote a marker: its
    // own `source` names the author.
    return { kind: 'olumi', label: VALUE_SOURCE_MARK_LABEL.olumi }
  }
  if (stamped?.kind === 'ai') {
    // Rule 4 — the writer withdrew the estimate claim (a dispatched edit keeps
    // the OLD `cee_inference` source and clears both extraction markers until
    // the receipt). Neither author is established yet, so the visible number
    // says so: `no source` — never `you` before acknowledgement, never the old
    // value's `est.` (Codex #1919 5802926467: every shown value has a source word).
    return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
  }
  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
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
export function interventionTargetSourceMark(source: string | null | undefined): FactorValueSourceMark {
  const stamped = classifyInterventionProvenance(source ?? null)
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
 * The mark for a GOAL's target line (Paul 23 Sep contract feedback point 1 —
 * the v3.1 contract: "Factor, option-target, outcome and goal values carry
 * marks").
 *
 * Follows `statedGoalTargetRaw` exactly: the card prints `success_threshold`
 * only when `threshold_source === 'user'` attests it, and that is the ONE case
 * marked `you`. Every other printed target is CEE's `goal_threshold_raw`, and
 * nothing on the node says whether CEE lifted it from the brief or inferred it
 * (the market-entry starter carries `goal_threshold_raw: 11` "£M ARR" that its
 * brief never states). The node's `provenance` is about the NODE, not the number
 * (`valueProvenance.ts`, trap 21), so it cannot answer either. So the mark is
 * `unknown` — "no source" / "Source not recorded": never unmarked, never
 * relabelled as the user's or the brief's, and never an asserted Olumi origin
 * (Codex #63 5801529767). When the producer stamps the threshold's origin,
 * classify it here.
 */
export function goalTargetSourceMark(data: GoalTargetSource | null | undefined): FactorValueSourceMark {
  if (data?.threshold_source === 'user' && isStatedTargetValue(data.success_threshold)) {
    return { kind: 'you', label: VALUE_SOURCE_MARK_LABEL.you }
  }
  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
}

/**
 * The visible mark. Not focusable (like `EstimateMarker`): the same fact is
 * reachable by keyboard through the node's details. The token is hidden from
 * assistive technology and the full label is given instead, so a screen reader
 * hears "Set by you", not "you".
 */
export function ValueSourceMark({
  mark,
  testId,
  title,
}: {
  mark: FactorValueSourceMark
  testId?: string
  /** Hover text; defaults to the mark's label. */
  title?: string
}) {
  return (
    <span
      // Upright, regular weight (contract v3.1 `.prov`; NODE-ANATOMY v3.2): an
      // italic 11px mark at landing zoom rendered thin and off the value's
      // baseline. One visual for every mark kind.
      className={`${typography.edgeLabel} text-text-light`}
      title={title ?? mark.label}
      data-testid={testId}
      data-value-source={mark.kind}
    >
      <span aria-hidden="true">{VALUE_SOURCE_MARK_TOKEN[mark.kind]}</span>
      <span className={typography.screenReaderOnly}>{mark.label}</span>
    </span>
  )
}

import { User } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SOURCE_MARK_GLYPH_CLASSES, SourceMark } from './EstimateMarker'
import {
  classifyInterventionProvenance,
  classifyValueProvenance,
  factorValueIsUnconfirmedEstimate,
  VALUE_PROVENANCE_LABEL,
  type ValueProvenanceKind,
} from '../../domain/valueProvenance'
import { UNCONFIRMED_ESTIMATE_LABEL, UNCONFIRMED_ESTIMATE_TOKEN } from '../../domain/vocabulary'
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
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  const source = typeof obs?.source === 'string' ? obs.source : null
  const stamped = classifyValueProvenance(source)

  if (stamped && (stamped.userOwned || stamped.kind === 'panel')) {
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
  return { mark: { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }, awaitingReceipt: false }
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
 * classify it in `resolveGoalTarget` — this mark reads it from there.
 */
export function goalTargetSourceMark(data: GoalTargetSource | null | undefined): FactorValueSourceMark {
  // ⭐ ONE AUTHORITY (DESIGN-GAP-v31 #22): the source is `resolveGoalTarget`'s,
  // the resolver the Reasoning strip and the goal inspector read, so the card
  // and those surfaces cannot give two answers for one node. `isStatedTargetValue`
  // keeps this mark on exactly the figure the card prints (`statedGoalTargetRaw`
  // refuses a NaN/Infinity user threshold and prints the raw instead).
  const target = resolveGoalTarget(data)
  if (target?.source === 'user' && isStatedTargetValue(target.raw)) {
    return { kind: 'you', label: VALUE_SOURCE_MARK_LABEL.you }
  }
  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }
}

/**
 * ⭐ THE VISIBLE MARK — contract v3.1 `.prov` (point 1; DESIGN-GAP-v31 #21).
 *
 *   · Olumi → `est.`, the brief → `brief`, a panel → `panel`, unknown →
 *     `no source`: words, so the mark survives screenshots and greyscale.
 *   · a PERSON → the person glyph (v3.1 `prov('user')` renders `icon('user')`,
 *     no word): "you" was a word where the contract draws a glyph.
 *   · evidence → the evidence glyph, WHEN a producer stamps it. No value
 *     vocabulary carries an evidence literal today (see the header of this
 *     file), so `ValueSourceMarkKind` has no `evidence` member and none is
 *     invented here.
 *
 * The token is hidden from assistive technology and the full label is given
 * instead, so a screen reader hears "Set by you", not "you". Where the card
 * hands the mark its route (`onOpenSource`), the mark is a focusable button
 * labelled on hover AND focus that opens the source detail (`SourceMark`);
 * otherwise it is the static mark it always was.
 */
export function ValueSourceMark({
  mark,
  testId,
  title,
  subject,
  onOpenSource,
}: {
  mark: FactorValueSourceMark
  testId?: string
  /** Hover/focus text; defaults to the mark's label. */
  title?: string
  /** What the value is ("Monthly price target") — prefixed to the hover label, as v3.1 `prov()` does. */
  subject?: string
  /** The card's route to its source detail (v3.1 pt 1). Absent → a static mark. */
  onOpenSource?: () => void
}) {
  const tip = title ?? (subject ? `${subject}: ${mark.label}` : mark.label)
  return (
    <SourceMark testId={testId} tip={tip} onOpen={onOpenSource} dataValueSource={mark.kind}>
      {mark.kind === 'you' ? (
        <User aria-hidden="true" strokeWidth={1.8} className={SOURCE_MARK_GLYPH_CLASSES} data-source-glyph="person" />
      ) : (
        <span aria-hidden="true">{VALUE_SOURCE_MARK_TOKEN[mark.kind]}</span>
      )}
      <span className={typography.screenReaderOnly}>{mark.label}</span>
    </SourceMark>
  )
}

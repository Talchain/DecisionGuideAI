/**
 * V12 VIEW FIELDS (lane sx-fields, 17 Nov 2026). One adapter per additive field core adds to the canvas View (olumi.view/3), with the
 * exact meanings the DL ruled on 16 Nov (claude-checks/restructure-20261115/lanes/VIEW-FIELDS-FOR-UI-20261116.md), and the shapes the
 * producer builds: olumi-core 993eb784 ("view/3: the canvas face's typed fields (six of seven; card.row not built)", src/view/schema.ts
 * CardV3 / LinkV3 / ModelV3, src/view/canvas-fields.ts) and 90c32ad8 (a need that waits on a figure's unit has no number editor):
 *   card.kind + card.aim, card.title_short + card.description, link.direction + link.confidence (no weight), card.needs, headline.of,
 *   model.first_draft. card.row is NOT built by the producer ("the View holds no rule for those rows"): `cardRow` answers from bandOf.
 * Where the producer differs from the ruling file, the producer is followed and the difference is said at the field.
 *
 * Each adapter reads core's field when it is sent and says so (`source: 'view'`). Where an older core does not send it, it falls back to
 * the rule the face uses today, by CALLING that rule where one is exported (`cardKindOf`, `bandOf`, `linkRole`, `askKindOf`), and says so
 * (`source: 'inferred'`). Every wire value is checked against its closed set: a value this page was not built for is never taken for one
 * it was (a bad kind or row answers as an older core would; an unknown direction or confidence is `'unknown'`, never a sign).
 *
 * `state` says what the wire held: a value from the set (`present`), an explicit `null`, nothing at all (`absent`), or a value outside the
 * set (`unrecognised`). Explicit null and absent are kept apart everywhere: null is core's answer, absent is an older core.
 *
 * Pure: no React, no store, no words of the page's own. The new fields' types are declared HERE, intersected with the generated View types,
 * so nothing in client.ts, types.ts or the schema changes until core's own types land.
 */
import type { View, ViewCard, ViewLink, ViewModel } from '../../client'
import { askKindOf } from '../../layout'
import { bandOf, type BandId } from '../bands/bands'
import { cardKindOf, type CardShape } from '../cards/kind'
import { linkRole, type LinkRole } from '../contract'

// ─── The additive wire fields (declared locally) ─────────────────────────────────────────────────────────────────────────────────────

export const CARD_KINDS = ['option', 'driver', 'result', 'risk', 'aim', 'position', 'note'] as const
export type CardKindName = (typeof CARD_KINDS)[number]
export const AIM_KINDS = ['goal', 'limit'] as const
export type AimKind = (typeof AIM_KINDS)[number]
export const CARD_ROWS = ['options', 'drives', 'happens', 'aims'] as const
export type CardRow = (typeof CARD_ROWS)[number]
export const DIRECTIONS = ['raises', 'lowers', 'depends', 'disputed', 'unknown'] as const
export type Direction = (typeof DIRECTIONS)[number]
export const CONFIDENCES = ['likely', 'unsure', 'unknown'] as const
export type Confidence = (typeof CONFIDENCES)[number]

/** A figure's editor as the View already types it (`figure.edit`, a worked step's `edit`). */
export type FigureEditWire = NonNullable<NonNullable<ViewCard['figure']>['edit']>
/** One thing a figure waits on: the record to give, core's label for it, and its editor where core offers one. */
export interface NeedWire { readonly id: string; readonly label: string; readonly edit: FigureEditWire | null }

/**
 * The card fields core adds, as the producer types them (993eb784 schema.ts CardV3). Every one is optional (a v3 View made before them).
 *  - `kind`: never null. `aim`: 'goal' or 'limit' on an aim, null on every other card (a goal and a limit are both kind `aim`).
 *  - `title_short` / `description`: null on a record that holds only a sentence (a claim, an assumption, a relation, ...).
 *  - `needs`: never null; `[]` where the card waits on nothing. An item's `edit` is null where it is not answered here, or where what it
 *    waits on is its unit, which `run.ask` asks once (90c32ad8).
 *  - `row`: NOT built by the producer. Typed here from the ruling (item 3) only so a later core lights it up; no View sends it today.
 */
export type CardFields = {
  kind?: CardKindName
  aim?: AimKind | null
  row?: CardRow | null
  title_short?: string | null
  description?: string | null
  needs?: readonly NeedWire[]
}
export type FieldCard = ViewCard & CardFields
/** The link fields core adds (993eb784 schema.ts LinkV3): both null on every line that is not ONE causal belief (a calculation, an option's
 *  setting, a reason line, a fold). There is no `weight`: LinkV3 is strict and has none (ruling item 4, NOT YET). */
export type LinkFields = { direction?: Direction | null; confidence?: Confidence | null }
export type FieldLink = ViewLink & LinkFields
/** The headline field core adds (993eb784): what a chance is of, in run.aim's words. Never null: sent on a `chance` headline only, absent on
 *  a `fixed` or `none` one. */
export type ViewHeadline = NonNullable<ViewCard['headline']>
export type HeadlineFields = { of?: string }
export type FieldHeadline = ViewHeadline & HeadlineFields
/** The model field core adds (993eb784: `first_draft: v.version === null`, never null). */
export type ModelFields = { first_draft?: boolean }

// ─── Shared reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Where an answer came from: core's own field, or today's rule on a View from an older core. */
export type FieldSource = 'view' | 'inferred'
/** What the wire held for a field: a value from its set, an explicit null, nothing, or a value outside its set. */
export type FieldState = 'present' | 'null' | 'absent' | 'unrecognised'

const oneOf = <T extends string>(set: readonly T[]) => (v: unknown): v is T => typeof v === 'string' && (set as readonly string[]).includes(v)
const isCardKind = oneOf(CARD_KINDS), isAimKind = oneOf(AIM_KINDS), isCardRow = oneOf(CARD_ROWS)
const isDirection = oneOf(DIRECTIONS), isConfidence = oneOf(CONFIDENCES)
/** A string with something in it: an empty or blank string is not a title or a description. */
const isWords = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** The field's state on this record: an own key holding `undefined` counts as absent (it is what an older core's JSON never sends). */
function stateOf(record: object, key: string, ok: (v: unknown) => boolean): FieldState {
  const v = (record as Record<string, unknown>)[key]
  if (v === undefined) return 'absent'
  if (v === null) return 'null'
  return ok(v) ? 'present' : 'unrecognised'
}
const valueOf = (record: object, key: string): unknown => (record as Record<string, unknown>)[key]

// ─── 1. card.kind ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Today's shape (cards/kind.ts `cardKindOf`) mapped to the ruled kinds, for a View from an older core.
 *
 *   cardKindOf shape | kind     | why
 *   -----------------|----------|-------------------------------------------------------------------------------------------------------
 *   option           | option   | the same thing
 *   input            | driver   | a figure that is not worked out from others
 *   calculated       | result   | a figure worked out from others (its own working, a wait on an input, a relation into it, the outcome
 *                    |          | tier). GAP: the ruling also makes a figure `result` when an AIM MEASURES it; `cardKindOf` does not test
 *                    |          | that, so a figure an aim measures with no relation into it falls to `driver` here. Core's kind closes it.
 *   aim              | aim      | an aim or a limit (`aim` below says which, where the family tells)
 *   risk             | risk     | the same thing
 *   assumption       | note     | a premise in words, not a figure (the producer: any other reasoning card is a note)
 *   other            | note     | claims, evidence, conditions, left-out records, relations: a note, as the producer kinds them
 *   other + family   | position | the one family rule the shape cannot carry, taken from the producer (993eb784 canvas-fields.ts kindsOf:
 *   `dissent`        |          | "a dissent is a position"). No other family is read.
 *
 * Checked against the producer on its own studio golden with the new keys stripped (spec cardFields): every card agrees but `members`,
 * which an aim measures (producer `result`, fallback `driver`): the gap above.
 */
export const KIND_OF_SHAPE: Readonly<Record<CardShape, CardKindName>> = {
  option: 'option', input: 'driver', calculated: 'result', aim: 'aim', risk: 'risk', assumption: 'note', other: 'note',
}
/** Today's shape as a kind, with the producer's dissent rule on an `other` card. */
const kindOfShape = (card: ViewCard, shape: CardShape): CardKindName => (shape === 'other' && card.family === 'dissent' ? 'position' : KIND_OF_SHAPE[shape])

export interface CardKindAnswer {
  readonly kind: CardKindName
  /** For kind `aim`: a goal or a limit. Core's `card.aim` where sent, else the family by `askKindOf` (layout.ts); null where neither tells. */
  readonly aim: AimKind | null
  readonly aimSource: FieldSource | null
  readonly source: FieldSource
  /** What the wire held for `card.kind`. */
  readonly state: FieldState
  /** The legacy shape the kind was mapped from; null when core sent the kind. */
  readonly shape: CardShape | null
}

/** The family's aim kind by the existing rule (layout.ts askKindOf: `limit` is a constraint, `goal` a goal); null for any other family. */
function aimOfFamily(card: ViewCard): AimKind | null {
  const k = askKindOf(card.family)
  return k === 'constraint' ? 'limit' : k === 'goal' ? 'goal' : null
}

function aimOf(card: ViewCard): { aim: AimKind | null; aimSource: FieldSource | null } {
  const wire = valueOf(card, 'aim')
  if (isAimKind(wire)) return { aim: wire, aimSource: 'view' }
  const inferred = aimOfFamily(card)
  return { aim: inferred, aimSource: inferred === null ? null : 'inferred' }
}

/** The card's semantic kind: core's `card.kind` (993eb784), else today's shape mapped (`KIND_OF_SHAPE`). `model` and `view` go to `cardKindOf`
 *  as given. A null kind (never sent by the producer) is answered as an older core would, and its state says null. */
export function cardKind(card: ViewCard, model: ViewModel | null, view: View | null = null): CardKindAnswer {
  const state = stateOf(card, 'kind', isCardKind)
  if (state === 'present') {
    const kind = valueOf(card, 'kind') as CardKindName
    return { kind, ...(kind === 'aim' ? aimOf(card) : { aim: null, aimSource: null }), source: 'view', state, shape: null }
  }
  const shape = cardKindOf(card, model, view).shape
  const kind = kindOfShape(card, shape)
  return { kind, ...(kind === 'aim' ? aimOf(card) : { aim: null, aimSource: null }), source: 'inferred', state, shape }
}

// ─── 2. card.row ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Today's band (bands/bands.ts `bandOf`) mapped to the ruled rows. The ruling: "from the rule the bands already use", so the map is 1:1.
 * FALLBACK-ONLY FOR NOW: the producer did not build `card.row` (993eb784: no code in core names those rows; its placement rule is the
 * layout's column), so every View today answers `source: 'inferred'` from `bandOf`. The reader for `card.row` stays, checked against the
 * ruled set, so a later core that sends it is read without a change here.
 *
 *   bandOf band | row      | what stands there today
 *   ------------|----------|-----------------------------------------------------------------------------------------------------------
 *   options     | options  | options
 *   inputs      | drives   | every figure that is not an outcome, and every card that is not an option, outcome, risk or aim
 *               |          | (claims, evidence, conditions, assumptions, notes)
 *   outcomes    | happens  | outcomes (worked out) AND risks
 *   aims        | aims     | aims and limits
 *
 * `bandOf` never answers `ideas` for a model card (kept ideas are the lane's own nodes), so no row stands for it.
 * Kind and row come from two different existing rules and can disagree on an older View (a quantity with a bound is kind `aim` by
 * `cardKindOf` but sits in a figure band by `bandOf`); they are not reconciled here.
 */
export const ROW_OF_BAND: Readonly<Record<Exclude<BandId, 'ideas'>, CardRow>> = { options: 'options', inputs: 'drives', outcomes: 'happens', aims: 'aims' }

export interface CardRowAnswer {
  readonly row: CardRow
  readonly source: FieldSource
  readonly state: FieldState
  /** The legacy band the row was mapped from; null when core sent the row. */
  readonly band: Exclude<BandId, 'ideas'> | null
}

/** The row the card stands in: core's `card.row`, else today's band mapped (`ROW_OF_BAND`). `bandOf` reads the model only, so no view. */
export function cardRow(card: ViewCard, model: ViewModel): CardRowAnswer {
  const state = stateOf(card, 'row', isCardRow)
  if (state === 'present') return { row: valueOf(card, 'row') as CardRow, source: 'view', state, band: null }
  const band = bandOf(card, model)
  return { row: ROW_OF_BAND[band], source: 'inferred', state, band }
}

// ─── 3. card.title_short and card.description ────────────────────────────────────────────────────────────────────────────────────────

export interface CardTitleAnswer {
  /** Core's short title, else the card's whole heading. Never cut here: clipping a heading is a display matter. */
  readonly title: string
  /** True when `title` is the heading standing in (no short title sent, or core sent null): the face may clip it, never call it a title. */
  readonly titleIsHeading: boolean
  /** Core's description, or null. Never filled from `heading` or `detail`. */
  readonly description: string | null
  readonly source: 'title_short' | 'heading'
  readonly titleShortState: FieldState
  readonly descriptionState: FieldState
}

/** The card's title and description (ruling item 1). An empty or blank string is `unrecognised`, and is neither a title nor a description. */
export function cardTitle(card: ViewCard): CardTitleAnswer {
  const titleShortState = stateOf(card, 'title_short', isWords), descriptionState = stateOf(card, 'description', isWords)
  const short = titleShortState === 'present' ? (valueOf(card, 'title_short') as string) : null
  return {
    title: short ?? card.heading,
    titleIsHeading: short === null,
    description: descriptionState === 'present' ? (valueOf(card, 'description') as string) : null,
    source: short === null ? 'heading' : 'title_short',
    titleShortState, descriptionState,
  }
}

// ─── 4. link.direction, link.confidence, link.weight ─────────────────────────────────────────────────────────────────────────────────

/**
 * Which of today's rules decided an inferred look (canvas/edges/ViewLinkEdge.tsx, the one place that draws a link; no pure helper exports
 * the decision, so the pieces it calls are called here: `linkRole`, and the typed `causal` record read as the edge reads it):
 *   - `reason`: a reason link (`kind` or role `reason`): drawn in ink, never as an effect. Not a causal belief.
 *   - `role-line`: role input, size, measures or target: drawn as that role's line, never as an effect. Not a causal belief.
 *   - `calculation`: a `through` line (an option's setting or a calculation's term). Today's edge draws one with role `effect` in its sign's
 *     colour, but the producer says it is not a causal belief (993eb784 canvas-fields.ts beliefOf: null on a calculation or a setting), and
 *     the producer is followed: no direction, even where a typed sign rides on it.
 *   - `typed-causal`: core's typed `causal` record: a modelled effect; its direction from `causal.sign` ONLY (increases raises, decreases
 *     lowers, anything else unknown), as beliefOf reads it. `causal.disputed` is NOT read: the producer's studio golden carries it true on a
 *     line whose direction is `depends`, and false on another `depends` line (app-launch), so it says neither `disputed` nor `depends`.
 *     Never a wrong sign on an influence: core's influenceSignOf (993eb784 causal.ts) gives increases or decreases only where the influence's
 *     own direction is up or down; a conditional, disputed or unknown one is `unknown` (or `none` when sized at zero).
 *   - `effect-role`: role `effect` on a line that is not `through`, with no typed `causal`: drawn as an effect in the neutral colour, so the
 *     direction is `unknown`.
 *   - `legacy-label`: no typed `causal`, no role, core's `+` or `−` label (a View from before typed links): drawn in the sign's colour.
 *   - `untyped`: no typed `causal`, no role, no sign label (route lines to an aim, risk lines to an option on today's Views): the edge does
 *     not draw it as a modelled effect, so it is not read as a causal belief. The ruling says route comparison lines are never causal.
 * Checked against the producer on its bakery and studio goldens with the new keys stripped (spec viewFields): every line agrees but the one
 * `depends` line, which the legacy record cannot tell from `unknown` (and is read `unknown`, never a sign). Across all seven 993eb784 v3
 * goldens (a script restating this rule, 17 Nov, not this module), only 4 lines are causal beliefs: 2 agree (raises) and 2 `depends` read
 * `unknown`; the other 147 are null on both sides.
 */
export type LinkBasis = 'reason' | 'role-line' | 'calculation' | 'typed-causal' | 'effect-role' | 'legacy-label' | 'untyped'

export interface LinkLookAnswer {
  /** The direction of the causal belief; null where the link is not a causal belief. */
  readonly direction: Direction | null
  /** How sure the belief is, as core sends it; null where core sends null or nothing (an older core sends nothing: there is no legacy
   *  confidence). Never read from `doubt` (DL 12 Nov: dashed means provisional) nor from `causal.strength.state` (that is sizing). */
  readonly confidence: Confidence | null
  /** Always null: core does not size links for width (ruling item 4, NOT YET; 993eb784 sends no weight). Null weight is a real state,
   *  never a default strength. */
  readonly weight: null
  /** Whether the link is a causal belief (`direction` is not null). */
  readonly causal: boolean
  /** Where `direction` came from. */
  readonly source: FieldSource
  readonly directionState: FieldState
  readonly confidenceState: FieldState
  /** What the wire held for `weight`: `ignored` when something was sent, which this page does not draw until the ruling changes. */
  readonly weightState: 'absent' | 'null' | 'ignored'
  /** The legacy rule that decided an inferred direction; null when core sent the direction. */
  readonly basis: LinkBasis | null
}

/** A typed sign mapped to the ruled direction, as the producer maps it (beliefOf): increases raises, decreases lowers, anything else
 *  (`unknown`, and `none`, core's "no effect", which has no ruled counterpart) reads `unknown`, never a sign. */
const DIRECTION_OF_SIGN: Readonly<Record<string, Direction>> = { increases: 'raises', decreases: 'lowers', unknown: 'unknown', none: 'unknown' }
/** The roles that draw their own line and are never an effect (v12/links/styles.ts LINK_STYLES, less `effect`). */
const ROLE_LINES: ReadonlySet<LinkRole> = new Set<LinkRole>(['input', 'size', 'measures', 'target'])

function inferredDirection(link: ViewLink): { direction: Direction | null; basis: LinkBasis } {
  const role = linkRole(link)
  if (link.kind === 'reason' || role === 'reason') return { direction: null, basis: 'reason' }
  if (role !== null && ROLE_LINES.has(role)) return { direction: null, basis: 'role-line' }
  if (link.kind === 'through') return { direction: null, basis: 'calculation' }
  const causal = link.causal ?? null
  if (causal !== null) return { direction: DIRECTION_OF_SIGN[causal.sign] ?? 'unknown', basis: 'typed-causal' }
  if (role === 'effect') return { direction: 'unknown', basis: 'effect-role' }
  // ViewLinkEdge.tsx legacyStroke: the exact glyphs the edge colours (U+002B plus, U+2212 minus); any other label is no sign.
  if (link.label === '+') return { direction: 'raises', basis: 'legacy-label' }
  if (link.label === '−') return { direction: 'lowers', basis: 'legacy-label' }
  return { direction: null, basis: 'untyped' }
}

/** How a link is drawn by meaning (ruling item 4): core's direction and confidence where sent (993eb784), else today's rule (`LinkBasis`). */
export function linkLook(link: ViewLink): LinkLookAnswer {
  const directionState = stateOf(link, 'direction', isDirection), confidenceState = stateOf(link, 'confidence', isConfidence)
  const w = valueOf(link, 'weight'), weightState = w === undefined ? 'absent' : w === null ? 'null' : 'ignored'
  const confidence = confidenceState === 'present' ? (valueOf(link, 'confidence') as Confidence) : confidenceState === 'unrecognised' ? 'unknown' : null
  if (directionState === 'absent') {
    const { direction, basis } = inferredDirection(link)
    return { direction, confidence, weight: null, causal: direction !== null, source: 'inferred', directionState, confidenceState, weightState, basis }
  }
  // Core sent the field: a value from the set, null (not a causal belief), or a value this page does not know (a belief of unknown direction).
  const direction = directionState === 'present' ? (valueOf(link, 'direction') as Direction) : directionState === 'null' ? null : 'unknown'
  return { direction, confidence, weight: null, causal: direction !== null, source: 'view', directionState, confidenceState, weightState, basis: null }
}

// ─── 5. card.needs ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface NeedsAnswer {
  readonly needs: readonly NeedWire[]
  readonly source: FieldSource
  readonly state: FieldState
}

const isEdit = (v: unknown): v is FigureEditWire | null =>
  v === null || (typeof v === 'object' && typeof (v as { prompt?: unknown }).prompt === 'string' && typeof (v as { ask?: unknown }).ask === 'string')
const isNeed = (v: unknown): v is NeedWire =>
  typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'string' && typeof (v as { label?: unknown }).label === 'string' && isEdit((v as { edit?: unknown }).edit)
const isNeeds = (v: unknown): v is readonly NeedWire[] => Array.isArray(v) && v.every(isNeed)

/**
 * What the producer sends (993eb784 view.ts): on an option with no chance for its headline's aim, what that headline waits on; on a
 * worked-out figure, the inputs its working waits on; `[]` otherwise. The fallback reads the second only in part and does not attempt the
 * first (an option's `none` rows may carry `blocked_by` refs, which this does not read), so an inferred `[]` on an option means "not known",
 * not "waits on nothing".
 *
 * Today's "what this figure waits on", for an older core: a figure core holds as waiting (`figure.state === 'waits'`) lists the operands of
 * its own working (`card.worked.steps`, and an effect term's `coefficient`), in core's order, as v12/cards/MadeOf.tsx lists them under the
 * card. It OVER-lists: core's working names every operand, not only the missing one, and which one is missing is said only in core's words
 * (`figure.text`), which are never parsed here. A waiting figure with no working gives none. Any other card gives none.
 */
function inferredNeeds(card: ViewCard): NeedWire[] {
  if (card.figure?.state !== 'waits' || card.worked == null) return []
  const form = card.worked.form
  return card.worked.steps.flatMap((s) => [
    { id: s.id, label: s.label, edit: s.edit },
    ...(form === 'effect' && s.coefficient != null ? [{ id: s.coefficient.id, label: s.coefficient.label, edit: s.coefficient.edit }] : []),
  ])
}

/** What the card's result waits for (ruling item 5, 993eb784 + 90c32ad8): core's `card.needs`, else today's operands. A null (never sent by
 *  the producer) is `[]` with state null, not the inferred operands. */
export function needsOf(card: ViewCard): NeedsAnswer {
  const state = stateOf(card, 'needs', isNeeds)
  if (state === 'present') return { needs: valueOf(card, 'needs') as readonly NeedWire[], source: 'view', state }
  if (state === 'null') return { needs: [], source: 'view', state }
  return { needs: inferredNeeds(card), source: 'inferred', state }
}

// ─── 6. headline.of ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface HeadlineOfAnswer {
  /** Core's plain words for what the chance is of; null where core sends none. Never composed by the page. */
  readonly of: string | null
  /** What the wire held for `headline.of`; `no-headline` where the card carries no headline at all. */
  readonly state: FieldState | 'no-headline'
  readonly source: 'view' | 'absent'
}

/**
 * What an option's chance is of (ruling item 6), from the option card's own headline (`card.headline`; the View has one per option card,
 * not one for the scenario). No inference anywhere: where core does not send the words the answer is null and the face must not write them.
 * The producer (993eb784) sends `of` on a `chance` headline only, so `absent` is ALSO its own answer on a `fixed` or `none` headline, not
 * only an older core's. It never sends null (a null is kept as state null).
 */
export function headlineOf(headline: ViewHeadline | null | undefined): HeadlineOfAnswer {
  if (headline == null) return { of: null, state: 'no-headline', source: 'absent' }
  const state = stateOf(headline, 'of', isWords)
  return { of: state === 'present' ? (valueOf(headline, 'of') as string) : null, state, source: state === 'present' || state === 'null' ? 'view' : 'absent' }
}

// ─── 7. model.first_draft ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FirstDraftAnswer {
  /** True while nothing in the scenario has been approved; null where the View holds no model (nothing to draw it on). */
  readonly firstDraft: boolean | null
  readonly source: FieldSource | null
  readonly state: FieldState | 'no-model'
}

/**
 * Whether the model is a first draft (ruling item 7): core's `model.first_draft`, else today's rule, which is the producer's own rule
 * (993eb784 view.ts: `first_draft: v.version === null`). An explicit null (never sent by the producer) is treated as absent (its state
 * still says null). Today's rule (ViewCanvas.tsx boardSeenOf / aimAfterFirstApproval, ViewWelcome.tsx, ViewChat.tsx takesBrief):
 * an approval makes a version, so a View with a model and no version number has had nothing approved. It is read here as boardSeenOf reads
 * it (`typeof version.n === 'number'`); that module is the React canvas and is not imported into a pure one.
 */
export function firstDraft(view: View): FirstDraftAnswer {
  const model = view.model
  if (model == null) return { firstDraft: null, source: null, state: 'no-model' }
  const state = stateOf(model, 'first_draft', (v) => typeof v === 'boolean')
  if (state === 'present') return { firstDraft: valueOf(model, 'first_draft') as boolean, source: 'view', state }
  return { firstDraft: typeof view.version?.n !== 'number', source: 'inferred', state }
}

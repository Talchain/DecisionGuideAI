/**
 * Grounded-selection sidecar — WHICH model elements this turn's answer was
 * grounded on (CEE hop 4b, ROADMAP 2.1250-family).
 *
 * This module is the SINGLE typed accessor for that sidecar:
 *   - parseGroundedSelection():          defensive validation of the wire shape
 *   - extractGroundedSelectionSidecar(): the wire binding, fail-closed
 *
 * ── WIRE CONTRACT (DERIVED AT THE PRODUCER'S BYTES, CEE `bf4a1d28`) ─────────
 * Read from `src/orchestrator-v5/context/grounded-selection.ts` and
 * `src/orchestrator/route-v2.ts` — never from this repo's reading of what the
 * field "ought" to mean (CLAUDE.md trap 13c: a mutant kit validates
 * sensitivity, never a wrong oracle).
 *
 * FIELD: a top-level `_grounded_selection` key on the CEE V5 response BODY
 *   (leading underscore). NOT declared in `@talchain/schemas` at 0.40.0 —
 *   `OlumiResponseSchema` is `.strict()`, so CEE strips the key before egress
 *   validation and re-attaches it after (`route-v2.ts:1543`). Same mechanic and
 *   the same class as `_reasoning` and `_answer_shape`.
 *
 * SHAPE (`GroundedSelection`, grounded-selection.ts:50-81): {
 *   element_ids: readonly string[]   // canonical canvas ids
 *   unresolved:  'none' | 'not_in_model' | 'could_not_check'
 * }
 *
 * ⭐ WHAT THE FIELD CLAIMS, AND IT IS NARROWER THAN THE NAME SUGGESTS
 * (grounded-selection.ts:4-12, quoted): it answers *"Which model elements was
 * THIS turn's answer grounded on?"* — a producer-side fact about the answer's
 * CONTEXT (the elements CEE placed in the routing prompt's `focus` section). It
 * is **deliberately NOT a claim that the answer's TEXT mentions each one**; no
 * code on either side reads the model's output. Our copy therefore says the
 * answer was *answered using* these elements, and never that the answer
 * *discusses*, *names* or *is about* them — that would be an over-claim the
 * producer explicitly refuses to make.
 *
 * ⭐⭐ `not_in_model` AND `could_not_check` MUST NOT COLLAPSE. The producer is
 * emphatic (grounded-selection.ts:71-79, context-pack-assembler.ts:830-833):
 * `not_in_model` = the graph WAS read and does not contain it (showing nothing
 * is honest). `could_not_check` = the graph could NOT be read, so we do not
 * KNOW whether it is there. *"A consumer that renders that as 'not found'
 * reintroduces the conflation hop 3 and hop 4 spent their whole design keeping
 * apart."* This module keeps them as distinct values and
 * `GroundedOnNotice` renders two different sentences; both are pinned.
 *
 * EMPTY `element_ids` IS MEANINGFUL AND HONEST, not a malformed payload
 * (grounded-selection.ts:64-66): the turn pointed at something and nothing
 * resolvable came back — `unresolved` says why. Witnessed in the producer's own
 * suite (`grounded-selection-route-level.test.ts:295-296`: `element_ids: []`
 * with `unresolved: 'not_in_model'`). So emptiness must NOT fail the parse; it
 * must render the disclosure alone, with no grounding claim.
 *
 * ABSENCE IS THE UNGROUNDED SIGNAL. `projectGroundedSelection` returns `null`
 * for an ungrounded turn and route-v2 attaches nothing, so the KEY IS ABSENT —
 * never `_grounded_selection: null` (grounded-selection.ts:86-89). A turn with
 * no selection is byte-identical to every pre-hop-4b turn. This module returns
 * `null` for that case and the bubble renders exactly as today. **No grounding
 * claim may ever be made on a turn that carried no sidecar** — that is the
 * fabrication this consumer's guards exist to prevent.
 *
 * EMITTED UNCONDITIONALLY on the success path — `if (egress.ok &&
 * ctx.groundedSelection)` (route-v2.ts:1543): no flag, no debug token, and so
 * no UI flag here either (Paul's standing ruling: ship capabilities ON). The
 * typed fallback envelope never carries it, because an egress-violation body is
 * not an answer about the user's selected element.
 *
 * ORDER IS PERSISTED-GRAPH ORDER, not request order (grounded-selection.ts:54-62)
 * — identical to the order the elements appear in the prompt's `focus` section.
 * We render in the order received and never re-sort, so what the user reads
 * matches what the model was given.
 *
 * WHERE IT SURFACES ON THE UI SIDE: `_grounded_selection` is not a declared
 * top-level key, so `responseParser`'s `splitAdditiveExtensions` demotes it into
 * the non-enumerable `__additive__` sidecar — exactly as it does `_reasoning`
 * and `_answer_shape`. We read it there, and ALSO probe the SAME
 * `_grounded_selection` key at the top level as a defensive fallback (guards a
 * future parser change that leaves the underscore key un-demoted). That
 * fallback does NOT catch a formal schema promotion: a real promotion drops the
 * underscore (→ `grounded_selection`), which neither probe names.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

/**
 * Why anything the turn pointed at is missing — the producer's CLOSED ENUM,
 * copied verbatim from `ContextPackFocus['unresolved']`
 * (context-pack-assembler.ts:834). Never widened here, and never collapsed.
 */
export type GroundedUnresolved = 'none' | 'not_in_model' | 'could_not_check'

/** The three members, as data, so the parse and its guard cannot drift apart. */
const UNRESOLVED_VALUES: ReadonlySet<string> = new Set<GroundedUnresolved>([
  'none',
  'not_in_model',
  'could_not_check',
])

export interface GroundedSelection {
  /**
   * Canonical canvas ids of the elements the answer was grounded on, in
   * persisted-graph order. MAY BE EMPTY — see the file header; emptiness is a
   * meaningful state, not a malformed one.
   */
  element_ids: string[]
  /** Why anything is missing. Read WITH `element_ids`, never without it. */
  unresolved: GroundedUnresolved
}

/**
 * Defensive validation of the producer's shape.
 *
 * FAIL-CLOSED, and the two fields fail closed for DIFFERENT reasons:
 *
 *   · `unresolved` must be one of the three known members. An unrecognised
 *     value means the wire is not what this consumer was written against, and
 *     the honest response is silence: we cannot interpret it, and rendering the
 *     grounding half of an uninterpretable payload is precisely how the
 *     `not_in_model`/`could_not_check` conflation would creep back in. A fourth
 *     member arriving is a contract change that requires an explicit edit here.
 *
 *   · `element_ids` must be an ARRAY (absence or a non-array is malformed), but
 *     an EMPTY array is valid and preserved. Non-string / blank entries are
 *     dropped rather than failing the whole payload — safe ONLY because this
 *     consumer never states a COUNT of grounded elements, so a shortened list
 *     can never become a false quantity claim. Do not add a count without
 *     revisiting this.
 */
export function parseGroundedSelection(raw: unknown): GroundedSelection | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const unresolved = o.unresolved
  if (typeof unresolved !== 'string' || !UNRESOLVED_VALUES.has(unresolved)) return null

  if (!Array.isArray(o.element_ids)) return null
  const element_ids = o.element_ids
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim())

  return { element_ids, unresolved: unresolved as GroundedUnresolved }
}

/**
 * The producer's field name. A leading underscore because it is a CEE-internal
 * sidecar rather than a declared contract field.
 */
const GROUNDED_SELECTION_FIELD = '_grounded_selection' as const

/**
 * Wire binding. Reads the grounded-selection sidecar off a live CEE turn
 * response. Mirrors `extractAnswerShapeSidecar`: the additive-extensions
 * sidecar the parser demotes unknown keys into, then the same
 * `_grounded_selection` key at the top level as a defensive fallback.
 *
 * Fail-closed through `parseGroundedSelection` — an absent or malformed payload
 * yields `null`, and the caller then renders the bubble with NO grounding claim
 * of any kind.
 */
export function extractGroundedSelectionSidecar(response: unknown): GroundedSelection | null {
  if (!response || typeof response !== 'object') return null
  const r = response as Record<string, unknown>
  const additive = (response as OlumiResponseWithExtensions)?.[ADDITIVE_EXTENSIONS_KEY] as
    | Record<string, unknown>
    | undefined

  return (
    parseGroundedSelection(additive?.[GROUNDED_SELECTION_FIELD]) ??
    parseGroundedSelection(r[GROUNDED_SELECTION_FIELD])
  )
}

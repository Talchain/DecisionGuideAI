/**
 * Answer-shape sidecar — concise headline + ≤3 bullets + progressive-disclosure
 * detail (F1, Paul's #1, DEVELOPMENT-PLAN-2026-07-21).
 *
 * CEE ships an answer-shape sidecar so an assistant answer can render as a
 * concise headline + a few bullets, with the long tail behind a "Show more".
 * This module is the SINGLE typed accessor for that sidecar:
 *   - parseAnswerShape():          defensive validation of the wire shape
 *   - extractAnswerShapeSidecar(): the wire binding, fail-closed
 *
 * ── WIRE CONTRACT (CONFIRMED by the orchestrator at CEE bytes, 2026-07-21) ──
 * FIELD: a top-level `_answer_shape` key on the CEE V5 response BODY (leading
 *   underscore). It is CEE-INTERNAL — NOT declared in @talchain/schemas, so
 *   there is no schemas type for it; this LOCAL typed accessor is the contract
 *   on the UI side.
 * SHAPE: {
 *   headline: string  // exactly ONE non-blank sentence (rendered verbatim —
 *                     // we never split/truncate it; CEE owns the one-sentence
 *                     // guarantee)
 *   bullets:  string[] // max 3, MAY BE EMPTY
 *   detail:   string  // non-blank — the full supporting explanation (the long
 *                     // tail revealed behind "Show more")
 * }
 *
 * WHERE IT SURFACES ON THE UI SIDE: `_answer_shape` is not a known top-level
 * key, so the V5 response parser (splitAdditiveExtensions, responseParser.ts)
 * demotes it into the non-enumerable additive-extensions sidecar on the parsed
 * response — EXACTLY as it does the `_reasoning` sidecar. There is no retained
 * pre-parse raw body on the success path (V5ParseResult carries only the parsed
 * `response`), so `response[ADDITIVE_EXTENSIONS_KEY]._answer_shape` IS the wire
 * value. We read it there, and ALSO probe the SAME `_answer_shape` key at the
 * top level as a defensive fallback (guards a future parser change that leaves
 * the underscore key un-demoted). NOTE: this fallback does NOT catch a formal
 * schema promotion — a real promotion (as 0.15.0 did for `reasoning`) drops the
 * underscore, exposing `answer_shape`, which NEITHER probe reads. Lighting that
 * up would require an explicit edit here (a new field name), not just this read.
 *
 * FAIL-SAFE: parseAnswerShape returns null on anything malformed, so before
 * CEE's unconditional emit lands (the CEE lane deleting the flag + pinning the
 * contract is in flight) NOTHING renders and NOTHING regresses — the bubble
 * keeps rendering `content` as today — and the moment a well-formed sidecar
 * arrives on the wire it lights up on its own. No flag, no further UI change.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export interface AnswerShape {
  /** One non-blank sentence, rendered verbatim. Load-bearing — no headline ⇒ not well-formed. */
  headline: string
  /** Supporting points, may be empty. Producer caps at ≤3; UI re-clamps at render (UI-SEM-090). */
  bullets: string[]
  /** The full supporting explanation, revealed behind "Show more". Non-blank per the contract. */
  detail: string
}

/**
 * A string trimmed to its content, or '' for a non-string or blank value.
 * Shared by the three field reads in parseAnswerShape so "is this a usable
 * string?" is expressed once rather than hand-rolled per field.
 */
const nonBlank = (v: unknown): string => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : '')

/**
 * Defensive validation of the confirmed shape { headline, bullets, detail }.
 *
 * Fail-closed. Returns null unless BOTH the load-bearing fields are present:
 *   - `headline` is a non-blank string, AND
 *   - `detail`   is a non-blank string (the full explanation — its presence is
 *     also the no-content-loss guard: the structured view only replaces the
 *     free-text body when we actually hold the long tail to put behind "Show
 *     more", so a thin/degenerate sidecar can never SUPPRESS a longer answer).
 *
 * `bullets` may be empty (a legitimate shape → headline + Show-more detail, no
 * bullet list). Non-string / blank bullets are dropped; the ≤3 clamp is applied
 * at the display boundary (UI-SEM-090), not here.
 *
 * Never fabricates structure: strings are read and trimmed, never invented and
 * never split out of free text (no client-side sentence-splitting into bullets).
 */
export function parseAnswerShape(raw: unknown): AnswerShape | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const headline = nonBlank(o.headline)
  if (headline.length === 0) return null

  const detail = nonBlank(o.detail)
  if (detail.length === 0) return null

  const bullets = Array.isArray(o.bullets)
    ? o.bullets.map(nonBlank).filter((b) => b.length > 0)
    : []

  return { headline, bullets, detail }
}

/**
 * Confirmed wire field name (2026-07-21). We read it from the additive-
 * extensions sidecar (where the parser demotes it today) AND, as a defensive
 * fallback, from the SAME `_answer_shape` key at the top level. That fallback
 * does NOT catch a formal schema promotion — a real promotion drops the
 * underscore (→ `answer_shape`), which this constant does not name.
 */
const ANSWER_SHAPE_FIELD = '_answer_shape' as const

/**
 * Wire binding. Reads the answer-shape sidecar off a live CEE turn response.
 * Mirrors extractReasoningSidecar: reads the additive-extensions sidecar the
 * parser demotes unknown keys into, and also the same `_answer_shape` key at
 * the top level as a defensive fallback (NOT a schema-promotion catch — see
 * ANSWER_SHAPE_FIELD). Fail-closed through parseAnswerShape — any absent/
 * malformed shape yields null, and the caller then renders the free-text body
 * unchanged.
 */
export function extractAnswerShapeSidecar(response: unknown): AnswerShape | null {
  if (!response || typeof response !== 'object') return null
  const r = response as Record<string, unknown>
  const additive = (response as OlumiResponseWithExtensions)?.[ADDITIVE_EXTENSIONS_KEY] as
    | Record<string, unknown>
    | undefined

  return parseAnswerShape(additive?.[ANSWER_SHAPE_FIELD]) ?? parseAnswerShape(r[ANSWER_SHAPE_FIELD])
}

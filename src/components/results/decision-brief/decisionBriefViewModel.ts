/**
 * Read-only projection of the CEE-carried Decision Brief.
 *
 * The browser does not receive the complete PLoT DecisionBriefV1 on a
 * withheld run: CEE deliberately removes leader-designating members while
 * retaining non-designating reasoning content. The shared response boundary
 * is also intentionally opaque (`object().passthrough()`), so this module
 * validates only the live-attested projection it renders. It never rebuilds a
 * leader, recommendation, confidence judgement, or robustness verdict.
 */

import { RAW_ID_PATTERN } from '@/canvas/conversation/friendlyOperation'
import { containsBannedTerm } from '../utils/glossaryCheck'

export interface DecisionBriefDriverView {
  /** Producer label, preserved verbatim. */
  label: string
}

/**
 * One factor the analysis had to default because the user had not supplied a
 * value, carrying the PRODUCER'S OWN sentence about it.
 *
 * The label is the anchor; the `note` is the content. Rendering the labels
 * alone would reproduce the duplication this category was created to fix —
 * `key_assumptions` is a SUBSET of `top_drivers` on every capture measured, so
 * a second list of factor names can never be a distinct answer. The prose is.
 */
export interface DecisionBriefDefaultedView {
  factorLabel: string
  note: string
}

export interface DecisionBriefViewModel {
  topDrivers: DecisionBriefDriverView[]
  keyAssumptions: string[]
  whatWouldChange: string[]
  defaultedAssumptions: DecisionBriefDefaultedView[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// PLoT currently falls back from absent display labels to model-element IDs in
// some brief members. The projected object carries no flag that distinguishes
// that fallback, so an ID-shaped member fails its whole ordered category
// closed; the UI never prettifies an identifier into an invented name. Reuse
// the canonical UI leak guard and supplement it for persisted ID shapes that
// guard intentionally does not cover.
const SUPPLEMENTAL_RAW_IDENTIFIER_RE = new RegExp([
  UUID_RE.source.replace(/^\^|\$$/g, ''),
  '\\bgc-[0-9a-f-]{8,}\\b',
  '\\b[0-9a-f]{8,64}\\b',
].join('|'), 'i')

const MAX_TOP_DRIVERS = 5
const MAX_KEY_ASSUMPTIONS = 10
const MAX_WHAT_WOULD_CHANGE = 10
const MAX_LABEL_LENGTH = 300
const MAX_NOTE_LENGTH = 600
const MAX_DEFAULTED_ASSUMPTIONS = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNonBlankString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  if (value.trim().length === 0 || value.length > maxLength || value.includes('\0')) return null
  return value
}

function isValidIsoInstant(value: string): boolean {
  if (!ISO_INSTANT_RE.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

function containsRawIdentifier(value: string): boolean {
  return RAW_ID_PATTERN.test(value) || SUPPLEMENTAL_RAW_IDENTIFIER_RE.test(value)
}

function readStringList(
  value: unknown,
  maxItems: number,
  rejectRawIdentifiers = false,
): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  // ⭐ CAP BEHAVIOUR. This used to be `value.length > maxItems -> return []`, so a
  // producer that exceeded its OWN declared maximum emptied the whole category:
  // eleven assumptions rendered as zero. The cap is the producer's contract, not
  // a validity test — honour it by TRUNCATING to it, never by discarding the lot.
  const capped = value.slice(0, maxItems)

  // ⭐ POISON-ROW BEHAVIOUR. Ordering is meaningful on these producer arrays, so a
  // malformed row may not simply be filtered out — dropping a middle row silently
  // re-ranks everything after it, which is a quieter lie than showing less. But
  // emptying the category suppresses valid siblings for one bad row. The honest
  // response is a PREFIX: every row shown holds its true rank, and nothing after
  // the first unusable row is claimed.
  const out: string[] = []
  for (const item of capped) {
    const s = readNonBlankString(item, MAX_LABEL_LENGTH)
    if (s === null) break
    if (rejectRawIdentifiers && containsRawIdentifier(s)) break
    out.push(s)
  }
  return out
}

function readTopDrivers(value: unknown): DecisionBriefDriverView[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  // Cap truncates (see readStringList); a malformed row ends the prefix rather
  // than emptying a ranked category.
  const drivers: DecisionBriefDriverView[] = []
  for (const item of value.slice(0, MAX_TOP_DRIVERS)) {
    if (!isRecord(item)) break
    const label = readNonBlankString(item.factor_label, MAX_LABEL_LENGTH)
    const sensitivity = item.sensitivity
    const direction = item.direction
    if (
      label === null
      || containsRawIdentifier(label)
      || typeof sensitivity !== 'number'
      || !Number.isFinite(sensitivity)
      || sensitivity < 0
      || (direction !== 'positive' && direction !== 'negative')
    ) {
      break
    }
    // Sensitivity and direction validate that this is a producer driver row,
    // but stay off-screen: V1 does not license a new UI confidence or causal
    // magnitude interpretation here.
    drivers.push({ label })
  }
  return drivers
}

/**
 * ⭐ The producer's own honesty prose about values it had to default.
 *
 * PROSE SAFETY (brief §6) — VET, NEVER REWRITE. The note interpolates a
 * USER-AUTHORED factor label, and the analysis-surface glossary bans ordinary
 * business vocabulary (`variance`, `intervention`, `blocked`, `win rate`). The
 * repo's existing helper for this is `safeInterpolatedLabel`, which SUBSTITUTES
 * a fallback — and substituting into a producer sentence changes what the
 * producer said. So this reader proves the guard is an IDENTITY on the exact
 * string it is about to render, and WITHHOLDS the row when it is not. A withheld
 * row is an absence; a repaired row would be a fabrication.
 *
 * Measured against every capture available: 0 of 17 distinct notes and 0 of 15
 * distinct factor labels trip the guard today. The collision is REACHABLE, not
 * live — "Budget Variance" is an entirely ordinary factor name — so it is pinned
 * by test rather than left to be discovered on a user's screen.
 *
 * Unlike the ranked arrays above, this is an unordered SET of factors, so an
 * unusable row is skipped rather than ending a prefix: there is no rank to lie
 * about, and the remaining rows are each independently true.
 */
function readDefaultedAssumptions(value: unknown): DecisionBriefDefaultedView[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  const out: DecisionBriefDefaultedView[] = []
  for (const item of value.slice(0, MAX_DEFAULTED_ASSUMPTIONS)) {
    if (!isRecord(item)) continue
    // The producer's own token for "we defaulted this". Anything else is a row
    // this surface has no licence to describe.
    if (item.source !== 'value_defaulted') continue

    const factorLabel = readNonBlankString(item.factor_label, MAX_LABEL_LENGTH)
    const note = readNonBlankString(item.note, MAX_NOTE_LENGTH)
    if (factorLabel === null || note === null) continue
    if (containsRawIdentifier(factorLabel) || containsRawIdentifier(note)) continue

    // The identity proof. Both the anchor and the whole rendered join must pass
    // unchanged, or the row does not appear at all.
    if (containsBannedTerm(factorLabel) || containsBannedTerm(note)) continue

    out.push({ factorLabel, note })
  }
  return out
}

/**
 * Parse the CEE-projected DecisionBriefV1 members that are licensed for this
 * surface. Missing or malformed categories do not suppress valid siblings.
 */
export function readDecisionBriefViewModel(raw: unknown): DecisionBriefViewModel | null {
  if (!isRecord(raw) || raw.version !== '1') return null

  const briefId = readNonBlankString(raw.brief_id, 64)
  const createdAt = readNonBlankString(raw.created_at, 64)
  if (
    briefId === null
    || !UUID_RE.test(briefId)
    || createdAt === null
    || !isValidIsoInstant(createdAt)
  ) {
    return null
  }

  const topDrivers = readTopDrivers(raw.top_drivers)
  const keyAssumptions = readStringList(
    raw.key_assumptions,
    MAX_KEY_ASSUMPTIONS,
    true,
  )
  const whatWouldChange = readStringList(
    raw.what_would_change,
    MAX_WHAT_WOULD_CHANGE,
    true,
  )
  const defaultedAssumptions = readDefaultedAssumptions(raw.defaulted_assumptions)

  if (
    topDrivers.length === 0
    && keyAssumptions.length === 0
    && whatWouldChange.length === 0
    && defaultedAssumptions.length === 0
  ) {
    return null
  }

  return { topDrivers, keyAssumptions, whatWouldChange, defaultedAssumptions }
}

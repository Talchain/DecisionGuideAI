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

export interface DecisionBriefDriverView {
  /** Producer label, preserved verbatim. */
  label: string
}

export interface DecisionBriefViewModel {
  topDrivers: DecisionBriefDriverView[]
  keyAssumptions: string[]
  whatWouldChange: string[]
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
  if (!Array.isArray(value) || value.length > maxItems) return []

  const strings = value.map(item => readNonBlankString(item, MAX_LABEL_LENGTH))
  // Ordering is meaningful on all three producer arrays. If any row is
  // malformed, fail the category closed instead of silently changing ranks.
  if (strings.some(item => item === null)) return []
  if (rejectRawIdentifiers && strings.some(item => containsRawIdentifier(item!))) return []
  return strings as string[]
}

function readTopDrivers(value: unknown): DecisionBriefDriverView[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > MAX_TOP_DRIVERS) return []

  const drivers: DecisionBriefDriverView[] = []
  for (const item of value) {
    if (!isRecord(item)) return []
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
      return []
    }
    // Sensitivity and direction validate that this is a producer driver row,
    // but stay off-screen: V1 does not license a new UI confidence or causal
    // magnitude interpretation here.
    drivers.push({ label })
  }
  return drivers
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

  if (
    topDrivers.length === 0
    && keyAssumptions.length === 0
    && whatWouldChange.length === 0
  ) {
    return null
  }

  return { topDrivers, keyAssumptions, whatWouldChange }
}

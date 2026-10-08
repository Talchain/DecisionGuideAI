/**
 * The one line a factor shows when OLUMI chose its scale.
 *
 * CEE stamps `observed_state.frame_source: 'olumi_convention'` beside the cap it picked for a factor whose
 * figure arrived with no range (CEE #2848). Any write that changes the cap deletes the stamp, so a present stamp
 * always means the cap is still Olumi's. This module reads that stamp and never re-derives it.
 *
 * Words approved by Science (CEE #2848, comment 6060704017), with the example filled in:
 *   "Olumi reads ‘Pro plan price’ on a scale of £0 to £98 a month: a scale for reading sizes, not a forecast or a limit."
 *
 * The range is written once, so "£0 to £98 a month" rather than "£0 / month to £98 / month". It's built from the stored
 * unit with plain string steps, never a regex. A unit this can't read (empty after the currency, too long, or
 * unusual) falls back to the bare unit after the upper end, and anything longer than a real unit renders nothing.
 */
import { formatNumber } from '../utils/formatValueWithUnit'

export const OLUMI_CONVENTION_FRAME_SOURCE = 'olumi_convention'

/** Longer than any real unit (the longest stored is "GBP per subscriber per month"): never read, never shown. */
const MAX_UNIT_LENGTH = 60

const SYMBOLS = ['£', '$', '€'] as const
const CODES = ['GBP', 'USD', 'EUR'] as const
const PERIODS: Readonly<Record<string, string>> = {
  hour: 'an hour', day: 'a day', week: 'a week', month: 'a month', quarter: 'a quarter', year: 'a year',
}

/** " a month" for a bare period word, else " per <words>"; empty input → "". */
function perPhrase(period: string): string {
  const p = period.trim()
  if (p === '') return ''
  const single = PERIODS[p.toLowerCase()]
  return single !== undefined ? ` ${single}` : ` per ${p}`
}

/** "/month", " per month", "per subscriber per month" → the trailing phrase after the upper end. */
function trailingOf(rest: string): string {
  const r = rest.trim()
  if (r === '') return ''
  if (r.startsWith('/')) return perPhrase(r.slice(1))
  if (r.toLowerCase().startsWith('per ')) return perPhrase(r.slice(4))
  return ` ${r}`
}

/** "£0 to £98 a month", "0% to 13%", "0 to 40 hours a week"; null when the unit can't be read. */
export function olumiScaleRangeText(cap: number, unit: string | null | undefined): string | null {
  if (!Number.isFinite(cap) || cap <= 0) return null
  const u = typeof unit === 'string' ? unit.trim() : ''
  if (u.length > MAX_UNIT_LENGTH) return null
  const hi = formatNumber(cap)
  if (u === '') return `0 to ${hi}`
  if (u === '%') return `0% to ${hi}%`
  for (const s of SYMBOLS) {
    if (u.startsWith(s)) return `${s}0 to ${s}${hi}${trailingOf(u.slice(s.length))}`
  }
  for (const c of CODES) {
    const next = u.charAt(c.length)
    if (u.startsWith(c) && (next === '' || next === ' ' || next === '/')) return `${c} 0 to ${c} ${hi}${trailingOf(u.slice(c.length))}`
  }
  // A counted unit with a period ("hours/week", "tickets/month"): the noun after the upper end, then the period.
  const slash = u.indexOf('/')
  if (slash > 0) return `0 to ${hi} ${u.slice(0, slash).trim()}${perPhrase(u.slice(slash + 1))}`
  return `0 to ${hi} ${u}`
}

export interface OlumiScaleInput {
  readonly label: string
  readonly observedState: unknown
}

/** The approved sentence, or null when Olumi did not choose this factor's scale (or it can't be said truthfully). */
export function olumiScaleSentence(input: OlumiScaleInput): string | null {
  const os = input.observedState
  if (os === null || typeof os !== 'object') return null
  const { frame_source: source, cap, unit } = os as { frame_source?: unknown; cap?: unknown; unit?: unknown }
  if (source !== OLUMI_CONVENTION_FRAME_SOURCE) return null
  if (typeof cap !== 'number') return null
  const label = input.label.trim()
  if (label === '') return null
  const range = olumiScaleRangeText(cap, typeof unit === 'string' ? unit : null)
  if (range === null) return null
  return `Olumi reads ‘${label}’ on a scale of ${range}: a scale for reading sizes, not a forecast or a limit.`
}

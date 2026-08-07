/**
 * How a run is named on screen — ROADMAP 2.113a slice 2.
 *
 * One place, because the picker's `<option>` text and the side-by-side column
 * heading must name the same run the same way; two formatters would drift and
 * the drift would read as two different runs.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * `"22 Jul"`, in UTC, or **null** when the stamp cannot be parsed.
 *
 * UTC and a fixed month table rather than `toLocaleDateString`, so the string a
 * test asserts is the string a user sees regardless of the machine's timezone
 * or ICU build. Null rather than "Invalid Date": a run whose timestamp is
 * unreadable is named by its number alone, never by a broken date.
 */
export function formatRunDate(timestamp: string): string | null {
  const t = Date.parse(timestamp)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** `"Run 3 · 22 Jul"`, degrading to `"Run 3"` when the stamp is unreadable. */
export function runLabel(runNumber: number, timestamp: string): string {
  const when = formatRunDate(timestamp)
  return when ? `Run ${runNumber} · ${when}` : `Run ${runNumber}`
}

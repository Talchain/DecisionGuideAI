/**
 * Deterministic relative time formatter for the Journey timeline.
 *
 * Unlike src/utils/formatRelativeTime.ts (which uses Date.now() internally),
 * this accepts a `now` parameter so tests can pass a fixed value.
 *
 * Rules:
 * - <1 hour:      "3 min ago"
 * - Same day:     "14:22"
 * - Older:        "6 Mar, 14:22"
 */

const MINUTE = 60
const HOUR = 3600

/**
 * Format a timestamp relative to `now` for the Journey timeline.
 *
 * @param timestamp  ISO-8601 timestamp string
 * @param now        Reference date (component passes new Date(); tests pass fixed value)
 */
export function formatJourneyTime(timestamp: string, now: Date): string {
  const date = new Date(timestamp)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Future or just happened
  if (seconds < MINUTE) return 'just now'

  // Under 1 hour: relative
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min ago`

  // Same calendar day: time only
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const time = formatTime(date)

  if (sameDay) return time

  // Older: "6 Mar, 14:22"
  const day = date.getDate()
  const month = SHORT_MONTHS[date.getMonth()]
  return `${day} ${month}, ${time}`
}

/** Zero-padded HH:MM */
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

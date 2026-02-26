/**
 * Lightweight relative time formatter — no external dependencies.
 *
 * Returns human-readable strings like "just now", "5m ago", "2h ago",
 * "Yesterday", "3 days ago", "2 weeks ago".
 */

const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const WEEK = 604800

export function formatRelativeTime(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)

  if (seconds < 0) return 'just now'
  if (seconds < MINUTE) return 'just now'
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`
  if (seconds < DAY * 2) return 'Yesterday'
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)} days ago`
  if (seconds < WEEK * 2) return '1 week ago'
  if (seconds < DAY * 30) return `${Math.floor(seconds / WEEK)} weeks ago`
  if (seconds < DAY * 60) return '1 month ago'

  return new Date(dateString).toLocaleDateString()
}

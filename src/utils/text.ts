export function truncateToSize(text: string, maxSize: number, suffix: string): string {
  if (text.length <= maxSize) return text
  const keep = Math.max(0, maxSize - suffix.length)
  return text.slice(0, keep) + suffix
}

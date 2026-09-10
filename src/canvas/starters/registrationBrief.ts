import manifest from './starters.manifest.json'

/** Recover the original context from the graph's durable saved-example stamp.
 * Never use a previous scenario's brief or private, unsent composer text.
 * An evolved example may have new unstamped nodes; conflicting/unknown origins
 * are ambiguous and must not seed a permanent scenario brief.
 */
export function resolveStarterRegistrationBrief(
  nodes: ReadonlyArray<{ data?: Record<string, unknown> }>,
): string | undefined {
  const ids = new Set(nodes.flatMap((node) => {
    const id = node.data?.starterId
    return typeof id === 'string' && id.length > 0 ? [id] : []
  }))
  if (ids.size !== 1) return undefined
  const starter = manifest.starters.find((entry) => ids.has(entry.id))
  if (!starter?.brief.trim()) return undefined

  // Attribution remains in canonical context, even for consumers reading only
  // brief_text. Preserve the captured words, including historical dates: this
  // is an example's original brief, not a newly authored current-user claim.
  return `Saved example: ${starter.title} (${starter.id}; captured ${starter.provenance.capturedAt}). Original brief:\n\n${starter.brief}`
}

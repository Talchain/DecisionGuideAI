/**
 * Triage queue dedup — pure helper extracted from DecisionConfidencePanel
 * (Brief 5.8B hotfix follow-up).
 *
 * Same factor can surface as both an evidence gap and a next action — the per-
 * card `key` strings (`gap-{factorId}-{i}` vs `action-{i}`) never collide, so
 * the queue used to render two cards for the same factor. We dedup by
 * canonical identity (`targetNodeId`) with a normalised-title fallback for
 * items that lack a target.
 *
 * Title normalisation: trim → lowercase → collapse internal whitespace runs
 * to a single space. Catches obvious near-duplicates like "Foo  Bar" vs
 * "Foo Bar" and "FOO BAR" vs "Foo Bar".
 */

export interface DedupableTriageItem {
  targetNodeId?: string | null
  title?: string | null
}

/**
 * Returns the canonical identity used for dedup. Prefers `targetNodeId` when
 * present, falls back to a normalised title, returns null when neither yields
 * a usable key (caller should keep the item in that case).
 */
export function triageItemIdentity(item: DedupableTriageItem): string | null {
  const target = item.targetNodeId?.trim()
  if (target) return target
  const normTitle = (item.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return normTitle.length > 0 ? `title:${normTitle}` : null
}

/**
 * Filters a list of triage items by canonical identity, keeping the first
 * occurrence of each. Items with no derivable identity are kept (we can't
 * dedup safely without one).
 */
export function dedupTriageItems<T extends DedupableTriageItem>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const identity = triageItemIdentity(item)
    if (identity == null) return true
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

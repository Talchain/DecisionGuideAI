/**
 * applyStrengthenOverlay — Brief 5.8A D3b.
 *
 * Strict overlay: when a strengthen_item label matches a triage item label
 * via normalised case-insensitive trim, attach the strengthen_item.detail
 * as a coaching sub-copy and the strengthen_item.actionType as a passive
 * label. No fuzzy matching. No partial matching. If multiple strengthen
 * items share a normalised label, skip the overlay for that item and
 * surface a console.warn so duplicates are visible during development.
 *
 * Pure function — render layer applies the returned overlay alongside the
 * original triage card.
 */

export interface StrengthenItemLike {
  /** Free-form label as supplied by CEE */
  label: string
  /** Coaching detail to overlay onto the matching triage item */
  detail: string
  /** Optional passive action-type token (e.g. "set_value"); rendered as a 9px pill */
  actionType?: string
}

export interface TriageItemLike {
  /** Triage item label — typically the factor or relationship name */
  title: string
}

export interface StrengthenOverlay {
  /** Coaching detail to render as the triage card's sub-copy */
  detail: string
  /** Sentence-case action-type label, or null when the strengthen item omits it */
  actionTypeLabel: string | null
}

const SENTENCE_CASE_LOG_PREFIX = '[5.8a]'

function normaliseLabel(s: string): string {
  return s.trim().toLowerCase()
}

/** Convert a snake_case actionType token into a sentence-case display label. */
export function tokenToActionLabel(token: string): string {
  const cleaned = token.trim().replace(/_/g, ' ')
  if (!cleaned) return token
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}

/**
 * Build a label → strengthen overlay map from the strengthen items list.
 *
 * Multiple items sharing a normalised label collide; the affected label is
 * marked as "ambiguous" and excluded from the map so consumers silently skip
 * the overlay. A single console.warn is logged per ambiguous label so
 * duplicates surface during development without spamming the console.
 *
 * @returns A map keyed by normalised label, value is the structured overlay.
 *          Labels that resolved to a single strengthen item are present;
 *          ambiguous labels are absent.
 */
export function buildStrengthenOverlayMap(
  strengthenItems: readonly StrengthenItemLike[] | null | undefined,
  warn: (msg: string, label: string) => void = (msg, label) => console.warn(msg, label),
): Map<string, StrengthenOverlay> {
  const map = new Map<string, StrengthenOverlay>()
  if (!strengthenItems || strengthenItems.length === 0) return map

  // Two-pass build: first count occurrences per normalised label so we can
  // reject duplicates without losing the first-arrival overlay.
  const counts = new Map<string, number>()
  for (const item of strengthenItems) {
    const key = normaliseLabel(item.label)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const warnedLabels = new Set<string>()
  for (const item of strengthenItems) {
    const key = normaliseLabel(item.label)
    if (!key) continue
    if ((counts.get(key) ?? 0) > 1) {
      if (!warnedLabels.has(key)) {
        warn(`${SENTENCE_CASE_LOG_PREFIX} strengthen_items has duplicate label match for triage item:`, item.label)
        warnedLabels.add(key)
      }
      continue
    }
    if (!item.detail.trim()) continue
    map.set(key, {
      detail: item.detail,
      actionTypeLabel: item.actionType ? tokenToActionLabel(item.actionType) : null,
    })
  }
  return map
}

/**
 * Look up an overlay for a single triage item title via the prebuilt map.
 * Returns null when no exact normalised match exists.
 */
export function findStrengthenOverlay(
  triage: TriageItemLike,
  overlayMap: Map<string, StrengthenOverlay>,
): StrengthenOverlay | null {
  const key = normaliseLabel(triage.title)
  if (!key) return null
  return overlayMap.get(key) ?? null
}

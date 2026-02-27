/**
 * linkifyCoachingText — Wrap known option/factor names in GraphLink components.
 *
 * Takes sanitized coaching text and an entity lookup array, returns ReactNode[]
 * with matching names wrapped in <GraphLink>.
 *
 * Constraints:
 * - Max 4 GraphLinks per call (prevents over-linkification)
 * - Skip matches inside parentheses (belt-and-braces for encoding artefacts)
 * - Skip matches adjacent to digits/units (e.g. "Growth: 0.45")
 * - Longest-first matching to avoid partial substitutions
 * - Word-boundary matching to prevent "Cost" matching inside "Costly"
 */

import type { ReactNode } from 'react'
import { GraphLink } from '../GraphLink'

export interface LinkEntity {
  label: string
  nodeId?: string
  edgeId?: string
}

const MAX_LINKS = 4

/**
 * Check whether a match at `index` in `text` is surrounded by parentheses
 * or immediately preceded/followed by a digit, colon+space, or decimal.
 */
function isInsideParens(text: string, start: number, end: number): boolean {
  // Scan backwards for unmatched '('
  let depth = 0
  for (let i = start - 1; i >= 0; i--) {
    if (text[i] === ')') depth++
    if (text[i] === '(') {
      if (depth === 0) return true
      depth--
    }
  }
  return false
}

function isAdjacentToNumber(text: string, start: number, end: number): boolean {
  // Check char before match: digit, '.', or ':'
  if (start > 0) {
    const before = text[start - 1]
    if (/[\d.:]/.test(before)) return true
  }
  // Check char after match: digit or '.'
  if (end < text.length) {
    const after = text[end]
    if (/[\d.]/.test(after)) return true
  }
  return false
}

function isWordBoundary(text: string, pos: number): boolean {
  if (pos <= 0 || pos >= text.length) return true
  const ch = text[pos - 1]
  // Word boundary: not a letter, digit, or hyphen
  return !/[\w-]/.test(ch)
}

function isWordBoundaryEnd(text: string, pos: number): boolean {
  if (pos >= text.length) return true
  const ch = text[pos]
  return !/[\w-]/.test(ch)
}

/**
 * Linkify coaching text by wrapping known entity names in GraphLink components.
 *
 * @param text - Sanitized coaching text (apply sanitizeCoachingText first)
 * @param entities - Known options/factors with their IDs
 * @returns ReactNode[] ready to render
 */
export function linkifyCoachingText(
  text: string,
  entities: LinkEntity[],
): ReactNode[] {
  if (!text || entities.length === 0) return [text]

  // Filter to entities with at least one ID and non-empty label
  const valid = entities.filter(e => e.label && (e.nodeId || e.edgeId))
  if (valid.length === 0) return [text]

  // Sort by label length descending (longest first for greedy matching)
  const sorted = [...valid].sort((a, b) => b.label.length - a.label.length)

  // Find all matches with positions
  interface Match {
    start: number
    end: number
    entity: LinkEntity
  }

  const matches: Match[] = []
  let linkCount = 0

  for (const entity of sorted) {
    if (linkCount >= MAX_LINKS) break

    let searchFrom = 0
    while (searchFrom < text.length && linkCount < MAX_LINKS) {
      const idx = text.indexOf(entity.label, searchFrom)
      if (idx === -1) break

      const end = idx + entity.label.length

      // Skip if not at word boundaries
      if (!isWordBoundary(text, idx) || !isWordBoundaryEnd(text, end)) {
        searchFrom = idx + 1
        continue
      }

      // Skip if inside parentheses
      if (isInsideParens(text, idx, end)) {
        searchFrom = end
        continue
      }

      // Skip if adjacent to numbers/units
      if (isAdjacentToNumber(text, idx, end)) {
        searchFrom = end
        continue
      }

      // Check for overlap with existing matches
      const overlaps = matches.some(m =>
        (idx >= m.start && idx < m.end) || (end > m.start && end <= m.end)
      )
      if (overlaps) {
        searchFrom = end
        continue
      }

      matches.push({ start: idx, end, entity })
      linkCount++
      searchFrom = end
    }
  }

  if (matches.length === 0) return [text]

  // Sort matches by position for left-to-right assembly
  matches.sort((a, b) => a.start - b.start)

  // Build result nodes
  const result: ReactNode[] = []
  let cursor = 0

  for (const match of matches) {
    // Text before this match
    if (match.start > cursor) {
      result.push(text.slice(cursor, match.start))
    }

    // GraphLink for the match
    result.push(
      <GraphLink
        key={`gl-${match.start}`}
        nodeId={match.entity.nodeId}
        edgeId={match.entity.edgeId}
        label={match.entity.label}
      >
        {match.entity.label}
      </GraphLink>
    )

    cursor = match.end
  }

  // Remaining text after last match
  if (cursor < text.length) {
    result.push(text.slice(cursor))
  }

  return result
}

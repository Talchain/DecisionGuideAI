/**
 * ceeTextGuard — runtime protection for CEE-authored strings rendered in the
 * v3 panel (hero coaching, bias rows, narrow-framing swaps, readiness
 * explanations).
 *
 * DGAI-authored copy is glossary-scanned at test time, but CEE text arrives
 * at runtime and has been observed leaking internal vocabulary
 * ("authority-labelled nodes", "decision graph"). This guard composes the
 * canonical glossary matcher (no fork) with a small CEE-specific extension
 * for terms the canonical list scopes only as phrases (bare node/edge and
 * the spelled-out value-of-information).
 *
 * Unsafe text is never rendered raw: each surface degrades to a safe
 * coaching fallback (or to its deterministic copy), and DEV builds log the
 * original for diagnosis.
 */

import { containsBannedTerm } from '../../../../components/results/analysisHeroV17/glossaryCheck'

/**
 * Terms the canonical list does not catch bare (it scopes 'nodes and edges'
 * as a phrase only). Single words are word-boundary wrapped below; phrases
 * match literally, case-insensitive — so "nodes" trips but "nodebook" or a
 * factor named "Anode capacity" does not.
 */
const CEE_EXTRA_TERMS = [
  'node',
  'nodes',
  'edge',
  'edges',
  'graphs',
  'decision graph',
  'value of information',
] as const

let cachedExtraRegex: RegExp | null = null

function extraTermRegex(): RegExp {
  if (cachedExtraRegex) return cachedExtraRegex
  const patterns = CEE_EXTRA_TERMS.map(t => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return /^[a-z]+$/i.test(t) ? `\\b${escaped}\\b` : escaped
  })
  cachedExtraRegex = new RegExp(`(?:${patterns.join('|')})`, 'i')
  return cachedExtraRegex
}

/** True when CEE text is safe to render verbatim in user-facing coaching. */
export function isSafeCeeText(text: string): boolean {
  return !containsBannedTerm(text) && !extraTermRegex().test(text)
}

export interface GuardedCeeText {
  text: string
  /** True when the original was replaced by the fallback. */
  degraded: boolean
}

/**
 * Render-or-degrade: returns the original when safe, otherwise the supplied
 * fallback (which must itself be glossary-safe coaching copy — pinned by the
 * guard's tests).
 */
export function guardCeeText(text: string, fallback: string): GuardedCeeText {
  if (isSafeCeeText(text)) return { text, degraded: false }
  if (import.meta.env.DEV) {
    console.warn('[pre-analysis-v3] CEE text degraded by glossary guard:', text)
  }
  return { text: fallback, degraded: true }
}

/**
 * Nullable variant for render-if-live fields: unsafe text degrades to null
 * so the deterministic copy beneath renders instead (used for the
 * narrow-framing swap, where the deterministic option-breadth line is the
 * better fallback than a generic sentence).
 */
export function guardCeeTextOrNull(text: string | null): string | null {
  if (text === null) return null
  if (isSafeCeeText(text)) return text
  if (import.meta.env.DEV) {
    console.warn('[pre-analysis-v3] CEE text suppressed by glossary guard:', text)
  }
  return null
}

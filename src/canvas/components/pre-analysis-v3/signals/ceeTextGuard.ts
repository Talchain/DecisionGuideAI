/**
 * ceeTextGuard — runtime protection for CEE-authored strings rendered in the
 * v3 panel (hero coaching, bias rows, narrow-framing swaps, readiness
 * explanations). Applies to panel-only coaching text, NEVER to option/factor/
 * risk labels (those are shared graph data — fixing them here would diverge
 * the panel from the canvas and inspector; that belongs in the draft_graph
 * prompt/glossary lane).
 *
 * DGAI-authored copy is glossary-scanned at test time, but CEE text arrives
 * at runtime and has been observed leaking internal vocabulary
 * ("authority-labelled nodes", "decision graph"). The guard prefers SAFE
 * IN-PLACE SUBSTITUTION (decision graph → decision model, nodes → factors,
 * edges → connections) so useful meaning survives, and only falls back to a
 * safe coaching line when a residual term has no approved user-facing
 * substitute (EVPI, value of information, elasticity, …).
 *
 * Matching is whole-word / phrase-aware (reuses the canonical glossary matcher,
 * no fork) so "telegraph" or a factor named "Anode capacity" never trip.
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

/**
 * Whole-word / phrase substitutions that preserve coaching meaning. Ordered
 * most-specific first (phrases before the bare words they contain). Only terms
 * with a faithful user-facing equivalent appear here; terms without one
 * (EVPI, value of information, elasticity, DAG, …) are deliberately absent so
 * they trigger the category-aware fallback instead of a misleading rewrite.
 */
const SAFE_CEE_SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bdecision graphs\b/gi, 'decision models'],
  [/\bdecision graph\b/gi, 'decision model'],
  [/\bgraphs\b/gi, 'models'],
  [/\bgraph\b/gi, 'model'],
  [/\bnodes\b/gi, 'factors'],
  [/\bnode\b/gi, 'factor'],
  [/\bedges\b/gi, 'connections'],
  [/\bedge\b/gi, 'connection'],
]

/** Echo the matched token's capitalisation onto the replacement. */
function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return replacement.toUpperCase()
  }
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/**
 * Apply the safe substitutions in place. Pure: returns a new string, never
 * mutates anything (callers pass CEE response strings, never graph data).
 */
export function sanitiseCeeText(text: string): string {
  let out = text
  for (const [re, rep] of SAFE_CEE_SUBSTITUTIONS) {
    out = out.replace(re, m => matchCase(m, rep))
  }
  return out
}

export interface GuardedCeeText {
  text: string
  /** True when the original was replaced by the fallback. */
  degraded: boolean
  /** True when safe substitutions were applied and the result rendered. */
  sanitised: boolean
}

/**
 * Render-or-sanitise-or-degrade. Safe text renders verbatim; unsafe text is
 * sanitised in place and rendered if that makes it safe; only text that still
 * carries an unsubstitutable term degrades to the supplied fallback (which
 * must itself be glossary-safe coaching copy — pinned by the guard's tests).
 */
export function guardCeeText(text: string, fallback: string): GuardedCeeText {
  if (isSafeCeeText(text)) return { text, degraded: false, sanitised: false }
  const cleaned = sanitiseCeeText(text)
  if (isSafeCeeText(cleaned)) {
    if (import.meta.env.DEV) {
      // DEV diagnostic so the active branch (sanitised vs fallback) is visible.
      console.warn('[pre-analysis-v3] CEE text sanitised in place:', { original: text, cleaned })
    }
    return { text: cleaned, degraded: false, sanitised: true }
  }
  if (import.meta.env.DEV) {
    console.warn('[pre-analysis-v3] CEE text degraded (no safe substitution):', text)
  }
  return { text: fallback, degraded: true, sanitised: false }
}

/**
 * Nullable variant for render-if-live fields: safe (or sanitisable) text is
 * returned; otherwise null so the deterministic copy beneath renders instead
 * (used for the narrow-framing swap, where the deterministic option-breadth
 * line is the better fallback than a generic sentence).
 */
export function guardCeeTextOrNull(text: string | null): string | null {
  if (text === null) return null
  if (isSafeCeeText(text)) return text
  const cleaned = sanitiseCeeText(text)
  if (isSafeCeeText(cleaned)) return cleaned
  if (import.meta.env.DEV) {
    console.warn('[pre-analysis-v3] CEE text suppressed (no safe substitution):', text)
  }
  return null
}

/** Coaching theme used to pick a category-aware hero fallback. */
export type CoachingCategory = 'framing' | 'assumption' | 'comparison' | 'generic'

/**
 * Best-effort theme of a coaching string, from its wording. Used only to
 * choose a more specific fallback line when sanitisation cannot preserve the
 * original — never to assert a verdict.
 */
export function categoriseCoaching(text: string): CoachingCategory {
  const t = text.toLowerCase()
  if (/\bfram(e|es|ed|ing)\b|\breframe|\bnarrow\b/.test(t)) return 'framing'
  if (/\bassum(e|es|ed|ption|ptions|ing)\b/.test(t)) return 'assumption'
  if (/\bcompar(e|es|ed|ison|ing)\b|\balternativ|\btrade.?off|\boption\b/.test(t)) return 'comparison'
  return 'generic'
}

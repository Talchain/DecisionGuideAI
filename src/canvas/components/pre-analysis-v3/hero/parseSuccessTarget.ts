/**
 * parseSuccessTarget — honest numeric extraction for the Hero Success field.
 *
 * UI-SEM-086: success-target prose extraction. The Success field accepts both
 * bare numbers ("500000", "£500k", "15%") and full sentences ("Reach £500k
 * incremental ARR within 12 months of launch" — the sentence is ALSO sent
 * verbatim to CEE as an add_constraint chip, so prose is a designed input,
 * not user error). The previous parser stripped every non-numeric character
 * and concatenated whatever digits survived — "£500k … 12 months" became
 * 50012 (the "k" multiplier lost, the timeframe fused on), which then
 * rendered as "Target: 50,012" on the goal node and "5,001,200% likelihood"
 * in the Model tab (dress-rehearsal 2026-07-20 finding).
 *
 * Rules (fail closed — return null rather than fabricate):
 * - A bare numeric token (optional £/$/€ prefix, thousands separators,
 *   optional k/m/bn/thousand/million/billion multiplier, optional %) parses
 *   to its full value: "£500k" → 500000, unit '£'.
 * - In prose, numbers followed by a timeframe word (days/weeks/months/
 *   quarters/years) are treated as timeframes, never as the target.
 * - In prose, a single currency- or percent-marked amount wins over bare
 *   numbers ("£500k" beats the "12" in "12 months").
 * - Otherwise the number is committed only when it is the ONLY candidate.
 *   Two competing candidates ("grow from 200 to 400") → null.
 */

export interface ParsedSuccessTarget {
  value: number
  /** Currency symbol or '%' when the user's own text carried one. */
  unit: string | null
}

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
}

/** A number immediately described by one of these is a timeframe, not a target. */
const TIMEFRAME_WORD_RE = /^(?:day|week|month|quarter|year|yr|mo)s?\b/i

// symbol? number multiplier? percent?  — the (?![a-zA-Z0-9]) guard stops the
// multiplier group matching the "m" of "months".
const TOKEN_RE =
  /([£$€])\s*(-?\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|b|thousand|million|billion)?(?![a-zA-Z0-9])\s*(%)?|(-?\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|b|thousand|million|billion)?(?![a-zA-Z0-9])\s*(%)?/gi

interface Token {
  value: number
  unit: string | null
  /** Carried an explicit currency symbol or % — a strong "this is the target" signal. */
  marked: boolean
  isTimeframe: boolean
  start: number
  end: number
}

function tokenise(input: string): Token[] {
  const tokens: Token[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(input)) !== null) {
    const symbol = m[1] ?? null
    const numberText = m[2] ?? m[5]
    const multiplier = (m[3] ?? m[6])?.toLowerCase() ?? null
    const percent = (m[4] ?? m[7]) != null
    if (numberText == null) continue
    const base = Number.parseFloat(numberText.replace(/,/g, ''))
    if (!Number.isFinite(base)) continue
    const value = base * (multiplier ? MULTIPLIERS[multiplier] : 1)
    const following = input.slice(m.index + m[0].length).trimStart()
    tokens.push({
      value,
      unit: symbol ?? (percent ? '%' : null),
      marked: symbol != null || percent,
      isTimeframe: symbol == null && !percent && !multiplier && TIMEFRAME_WORD_RE.test(following),
      start: m.index,
      end: m.index + m[0].length,
    })
  }
  return tokens
}

export function parseSuccessTarget(raw: string): ParsedSuccessTarget | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const tokens = tokenise(trimmed)
  if (tokens.length === 0) return null

  // Whole input is a single numeric token → take it as typed.
  if (tokens.length === 1) {
    const t = tokens[0]
    const outside = (trimmed.slice(0, t.start) + trimmed.slice(t.end)).trim()
    if (outside === '') return { value: t.value, unit: t.unit }
  }

  // Prose: prefer the single explicitly-marked amount; otherwise only a
  // lone unambiguous candidate. Timeframes never qualify.
  const candidates = tokens.filter(t => !t.isTimeframe)
  const marked = candidates.filter(t => t.marked)
  if (marked.length === 1) return { value: marked[0].value, unit: marked[0].unit }
  if (marked.length === 0 && candidates.length === 1) {
    return { value: candidates[0].value, unit: candidates[0].unit }
  }
  return null
}

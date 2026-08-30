/**
 * Malformed short-display-text detector for the shipped starters.
 *
 * WHY THIS EXISTS. A starter is the first model a colleague ever opens, and the
 * strings it renders on that first view — node labels, a factor's baseline
 * `display_value`, and the two intervention display mirrors — are read before
 * the reader has formed any view of whether the reasoning is any good. A string
 * like
 *
 *   "No in-house build pursued in-house build not active)  "
 *
 * (shipped in `build-vs-buy` from the 2026-07-24 capture: doubled phrasing, an
 * orphan closing bracket, and a trailing double space) does not read as a rough
 * edge. It reads as unfinished.
 *
 * WHAT THIS IS NOT. It is not a prose critic. Every rule below is a defect of
 * FORM that no correct producer emits — a bracket that never opened, a run of
 * words repeated back to back, whitespace at the edges. Long coaching prose is
 * deliberately OUT of the guarded surface (see the spec): a rule loose enough to
 * judge a paragraph is a rule that fails on legitimate writing.
 *
 * WRITTEN AGAINST THE SPEC, NOT THE SYMPTOM (CLAUDE.md trap 13d). The shipped
 * defect happens to trip four of these rules at once; each rule is nonetheless
 * stated as a property a well-formed display string has, not as a description of
 * that one string. `unbalanced-brackets` is symmetric — it fires on a `(` with
 * no `)` exactly as it fires on the shipped `)` with no `(` — because the spec
 * is "brackets balance", not "the shipped string had a spare closer".
 */

/** A single formal defect found in a display string. */
export interface TextDefect {
  readonly rule:
    | 'EMPTY'
    | 'UNBALANCED_BRACKETS'
    | 'UNTERMINATED_BRACKET'
    | 'EMPTY_BRACKETS'
    | 'REPEATED_RUN'
    | 'MULTIPLE_SPACES'
    | 'EDGE_WHITESPACE'
  /** Human-readable reason, for the assertion message. */
  readonly detail: string
}

/** Words, for the repeated-run rule. Keeps hyphens and apostrophes inside a word. */
function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9'’-]+/g) ?? []
}

/**
 * A run of >= 2 words repeated back to back, allowing ONE intervening word.
 *
 * The gap tolerance is what catches the shipped string: "in-house build" recurs
 * with "pursued" between the two copies. Without it the rule sees nothing, and
 * with a larger gap it starts firing on legitimate prose that names the same
 * entity twice in a sentence.
 */
function repeatedRun(text: string): string | null {
  const w = words(text)
  for (let n = 2; n <= 5; n++) {
    for (let i = 0; i + 2 * n <= w.length + 1; i++) {
      for (const gap of [0, 1]) {
        const a = w.slice(i, i + n)
        const b = w.slice(i + n + gap, i + 2 * n + gap)
        if (a.length === n && b.length === n && a.every((x, k) => x === b[k])) {
          return a.join(' ')
        }
      }
    }
  }
  return null
}

/**
 * Every formal defect in one short display string. `[]` means well-formed.
 *
 * Returns ALL defects rather than the first, so a fix that removes one and
 * leaves another cannot read green.
 */
export function findTextDefects(text: string): TextDefect[] {
  const found: TextDefect[] = []

  if (text.trim() === '') {
    // An empty display string is its own defect: the surface renders a blank
    // where a value belongs, which reads as broken rather than as unknown.
    return [{ rule: 'EMPTY', detail: 'the string is empty or whitespace only' }]
  }

  for (const [open, close] of [
    ['(', ')'],
    ['[', ']'],
  ] as const) {
    const opens = text.split(open).length - 1
    const closes = text.split(close).length - 1
    if (opens !== closes) {
      found.push({
        rule: 'UNBALANCED_BRACKETS',
        detail: `${opens} "${open}" against ${closes} "${close}"`,
      })
    }
  }

  // An opener with no closer anywhere after it — the mid-token truncation shape.
  if (/\([^)]*$/.test(text) || /\[[^\]]*$/.test(text)) {
    found.push({ rule: 'UNTERMINATED_BRACKET', detail: 'a bracket opens and never closes' })
  }

  if (/\(\s*\)|\[\s*\]/.test(text)) {
    found.push({ rule: 'EMPTY_BRACKETS', detail: 'an empty parenthetical — a substitution produced nothing' })
  }

  const run = repeatedRun(text)
  if (run !== null) {
    found.push({ rule: 'REPEATED_RUN', detail: `"${run}" appears twice back to back` })
  }

  if (text.includes('  ')) {
    found.push({ rule: 'MULTIPLE_SPACES', detail: 'runs of consecutive spaces' })
  }

  if (text !== text.trim()) {
    found.push({ rule: 'EDGE_WHITESPACE', detail: 'leading or trailing whitespace' })
  }

  return found
}

/** One line naming where a defect is and what it is, for an assertion message. */
export function formatTextDefect(where: string, text: string, defects: TextDefect[]): string {
  return `${where}: ${JSON.stringify(text)} — ${defects.map((d) => `${d.rule} (${d.detail})`).join('; ')}`
}

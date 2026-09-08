/**
 * THE REASONING TAB DOES NOT SAY "WINNER", OR ANYTHING WEARING ITS CLOTHES.
 *
 * Paul, 7 Sep 2026, having said it — his words — "numerous times":
 *
 *   "We should never really be saying 'winner' anyway. There's never a winner.
 *    I feel like we've been through the terminology conversation numerous
 *    times."
 *
 * The product answers three questions, and copy on this surface should trace to
 * one of them: what the most likely outcome is, on the data so far · how
 * confident we can be in it · which option is most likely to serve the goal.
 * It exists to enhance critical and creative thinking, not to report a contest.
 *
 * ⚠⚠ WHY A GUARD AND NOT JUST AN EDIT — THIS IS THE POINT OF THE FILE.
 * It keeps coming back because the WIRE vocabulary is winner-shaped:
 * `leading_option_id`, `alternative_winner_label`, `recommended_option_id`. Any
 * surface that renders a field faithfully inherits the framing, so fixing one
 * component's strings fixes one component and the next consumer reintroduces
 * it. That is a hand-maintained mirror in the copy layer, and the estate's
 * answer to those is a derived guard that fails loud (trap 12).
 *
 * ⚠ WIRE IDENTIFIERS ARE NOT COPY. This scans STRING LITERALS a user could
 * read, with comments stripped first — a `winner` inside a capture filename or
 * a paragraph of prose is a record, not a claim, and rewriting those would
 * falsify the history they hold (trap 14b).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// cwd-relative: `import.meta.url` is not a file: URL under this vitest config,
// and a spec that cannot read its subject reports a clean sweep of nothing.
const COPY_FILE = resolve(process.cwd(), 'src/components/results/analysisNew/analysisNewCopy.ts')

/** Blank comments so a mention in prose is never counted as copy. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')

/** Every string literal in the file, comments already removed. */
function literals(src: string): string[] {
  const out: string[] = []
  // ⚠⚠ NO UPPER BOUND, AND THE 120 THAT WAS HERE WAS A SILENT HOLE.
  // An independent reviewer put `the current leading option` back into an
  // IN-SCOPE file at 126 characters and this spec stayed GREEN 10/10. The
  // prompt this guard was written to protect is EXACTLY 120 characters — zero
  // headroom — and 6 literals in the in-scope files already exceed the old cap,
  // one of them about "any ordering you see is unconfirmed". A guard that stops
  // looking at a length is a guard you evade by writing a longer sentence.
  // The lower bound of 2 stays: single characters are punctuation, not copy.
  const re = /'([^'\n\\]{2,})'|"([^"\n\\]{2,})"|`([^`\n\\]{2,})`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(interpolationsRemoved(m[1] ?? m[2] ?? m[3] ?? ''))
  return out
}

/**
 * ⭐ A TEMPLATE VARIABLE'S NAME IS CODE, NOT COPY — the user reads its VALUE.
 *
 * `` `${leader.label} currently scores higher` `` is CORRECT copy under the
 * ruling: it says "scores higher", the ruled frequency framing. Only the
 * identifier `leader.label` carries the banned token, and no user ever sees it.
 * Flagging it would push an author to rename a variable to satisfy a copy guard
 * — pure noise, and how a guard earns a blanket disable.
 *
 * ⚠ REPLACED WITH A SPACE, NOT DELETED. Splicing the halves together would
 * manufacture adjacencies that were never written — `${a}leader` becoming a word
 * boundary the source does not contain — which is a false POSITIVE generator in
 * a function written to remove false positives.
 */
function interpolationsRemoved(s: string): string {
  return s.replace(/\$\{[^}]*\}/g, ' ')
}

/**
 * Contest framing. `rank`/`ranked` is deliberately ABSENT from this list:
 * factors genuinely are ranked by influence, and that is a measurement rather
 * than a contest between the user's options.
 */
const BANNED =
  /\b(winner|winners|winning|wins|won|leading option|leads on|ahead in|came out ahead|beats|best option|top option)\b/i

/** Identifiers and paths are not copy — a user never reads them. */
/**
 * Identifiers and paths are not copy — a user never reads them.
 *
 * ⚠ THE LAST ALTERNATIVE IS A BARE LOWERCASE TOKEN, and it is principled rather
 * than convenient. User-facing copy is a PHRASE: it has a space or a capital.
 * `'leader'` in this tree is `{ id: 'leader', code: leaderCode }`
 * (`buildAnalysisNewViewModel.ts:2480`) — the KEY the copy is looked up by, and
 * the thing `COPY.checks[item.code].label` renders is the label, not the key.
 * Flagging it would demand renaming a discriminant to satisfy a copy guard.
 *
 * ⚠ IT CANNOT SWALLOW A REAL VIOLATION: every banned phrase this guard exists
 * for contains a space ("the leading option", "came out ahead") or begins with a
 * capital, so none of them can match this shape. Pinned as a control below.
 */
const NOT_COPY =
  /^(src\/|https?:|data-|aria-|analysis-new-|model-row|insight:|strengthen:|[a-z_]+\.(ts|tsx|json)$)|^[a-z][a-z0-9_]*([:-][a-z0-9]+)*$/

describe('the Reasoning tab does not frame the analysis as a contest', () => {
  const raw = readFileSync(COPY_FILE, 'utf8')
  const code = stripComments(raw)
  const strings = literals(code).filter(s => !NOT_COPY.test(s))

  it('PRECONDITION: the scan reaches real copy — it is not reading an empty file', () => {
    // 144 at the time of writing. The floor is well below it: this guards
    // against a stripper that blanked the file, not against the copy growing.
    expect(strings.length).toBeGreaterThan(100)
    // CONTRAST CONTROL: a word VERIFIED present in this file's literals (10
    // occurrences), not one assumed to be. My first attempt used "confidence"
    // — which appears in this file only inside COMMENTS, so the control would
    // have failed for a reason that had nothing to do with the sweep working.
    expect(strings.some(s => /analysis/i.test(s)), 'the scan found no copy at all').toBe(true)
  })

  it('PRECONDITION: the stripper works in BOTH directions', () => {
    expect(stripComments("// the winner was named")).not.toMatch(/winner/)
    expect(stripComments("/* a winner here */")).not.toMatch(/winner/)
    expect(stripComments("const a = 'winner'")).toMatch(/winner/)
  })

  it('FABRICATED CONTROL: the matcher does fire — otherwise every result is vacuous', () => {
    expect(BANNED.test('Leading option')).toBe(true)
    expect(BANNED.test('Ahead in 99% of simulated futures')).toBe(true)
    expect(BANNED.test('Most likely to serve your goal')).toBe(false)
    expect(BANNED.test('Scored highest in 99% of simulated futures')).toBe(false)
  })

  it('NO user-facing string frames the result as a contest', () => {
    const offenders = strings.filter(s => BANNED.test(s))
    expect(
      offenders,
      `contest framing in user-facing copy:\n  ${offenders.join('\n  ')}\n` +
        'Say what is most likely and how confident we are — not who won.',
    ).toEqual([])
  })

  /**
   * ⚠ SCOPED TO WHAT THIS FILE OWNS. Two of the three questions are answerable
   * from this copy; CONFIDENCE is composed elsewhere in the tab
   * (`buildAnalysisNewViewModel`, `previewComposition`) and this file's
   * literals contain no confidence wording at all — measured, not assumed.
   * Asserting it here would fail for a reason unrelated to the framing.
   */
  it('and the reframe kept the MEANING — it removed the metaphor, not the answer', () => {
    expect(strings.some(s => /most likely/i.test(s)), 'nothing states what is most likely').toBe(true)
    expect(strings.some(s => /goal/i.test(s)), 'nothing ties the answer to the goal').toBe(true)
  })
})

/**
 * ⭐⭐ THE SCOPE FIX — THE GUARD ABOVE FAILED ON SCOPE, NOT ON RIGOUR.
 *
 * Measured 8 Sep 2026 by a five-angle sweep: **12 live user-facing race-framing
 * strings reach the Reasoning tab, and the guard above caught 0 of them** — not
 * because its matcher is weak (it was executed against all 12 and its own
 * fabricated control fires), but because it reads ONE FILE.
 *
 * ⚠ THE DIRECTORY IS NOT THE SURFACE, and that is the durable lesson here.
 * Only 2 of the 12 lived under `analysisNew/`. The other 10 sat in two files the
 * tab RUNS but does not own:
 *   · `strengthen/buildRecommendations.ts` — called at useAnalysisNewViewModel.ts:83
 *   · `decision-overview/actionsCatalogue.ts` — reached via analysisNew/recommendationMethod.ts
 * A sweep confined to the tab's own directory returns 2 findings and reads like
 * a clean surface. That is exactly the shape of a guard that agrees with itself.
 *
 * ⚠ VOCABULARY: DESIGNATING FORMS, NOT BARE TOKENS. Bare `lead`/`leads` is
 * deliberately NOT banned — it would fire on "technical leads" (a job title) and
 * "leads to" (causation), which the ruling does not target. What is banned is a
 * DEFINITE reference to an option's placing. Adding bare tokens would trade this
 * guard's precision for noise and get it disabled, which is how guards die.
 */
const REACHED_COPY_FILES: ReadonlyArray<readonly [string, string]> = [
  ['analysisNewCopy.ts', 'src/components/results/analysisNew/analysisNewCopy.ts'],
  ['strengthen/buildRecommendations.ts', 'src/components/results/strengthen/buildRecommendations.ts'],
  ['decision-overview/actionsCatalogue.ts', 'src/components/results/decision-overview/actionsCatalogue.ts'],
  // ⭐ ADDED after a reviewer showed this file's fix was UNGUARDED: reverting
  // `buildAnalysisNewViewModel.ts:385` left 1146 tests green. It was outside the
  // scope while carrying one of the twelve strings this PR fixed.
  ['analysisNew/buildAnalysisNewViewModel.ts', 'src/components/results/analysisNew/buildAnalysisNewViewModel.ts'],
]

/** Designating placings the 8 Sep ruling retired, over and above BANNED. */
const RETIRED_DESIGNATIONS =
  /\bleading option\b|\bthe current lead\b|\ba fragile lead\b|\bcrown a winner\b|(?<!market )(?<!technical )(?<!team )\bleaders?\b/i

/**
 * ⚠ THE NEGATIVE LOOKBEHINDS ARE NOT TIDINESS. A reviewer measured that a bare
 * `\bleaders?\b` fires on "market leader" (a market position), "technical
 * leaders" (people) and on a sentence DEBUNKING the race reading. Each is a
 * different noun wearing the banned word, and flagging them would push an author
 * to reword correct copy — which is how a guard earns a blanket disable.
 *
 * ⚠ AND THE LIMIT, STATED: this is a NET, not a completeness proof. The same
 * reviewer found 16 ordinary race constructions the vocabulary still misses. It
 * catches the forms this estate has actually shipped; it does not claim to
 * enumerate English.
 */

describe('no contest framing in ANY copy the Reasoning tab renders', () => {
  it('PRECONDITION: every file in scope is readable and carries copy', () => {
    for (const [name, rel] of REACHED_COPY_FILES) {
      const strings = literals(stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8')))
        .filter(s => !NOT_COPY.test(s))
      // A file that reads as zero literals is an unreadable path or a broken
      // stripper — either way the sweep below would pass by testing nothing.
      expect(strings.length, `${name} produced no literals — the sweep would be vacuous`).toBeGreaterThan(10)
    }
  })

  it('FABRICATED CONTROL: the widened matcher fires, and does NOT fire on the false positives', () => {
    expect(RETIRED_DESIGNATIONS.test('Pressure-test the leading option')).toBe(true)
    expect(RETIRED_DESIGNATIONS.test('The current lead does not hold up')).toBe(true)
    expect(RETIRED_DESIGNATIONS.test('Challenge the leader')).toBe(true)
    // ⚠ THE CASE MY FIRST REGEX MISSED, PINNED SO IT CANNOT RE-OPEN. I wrote
    // `\bthe (current )?leader\b`, which does not match "No clear leader" —
    // and a mutation putting that exact string back left this guard GREEN.
    // That is the same short-hand-maintained-list defect this file exists to
    // catch, occurring inside the catcher. Found by mutating, not by reading.
    expect(RETIRED_DESIGNATIONS.test('No clear leader')).toBe(true)
    // ⚠ NOUNS THAT WEAR THE WORD WITHOUT CLAIMING A PLACING — measured false
    // positives from an independent review. Flagging these would push an author
    // to reword correct copy, which is how a guard gets disabled.
    expect(RETIRED_DESIGNATIONS.test('the market leader in this segment')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('Interview technical leaders')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('brief the team leader')).toBe(false)
    // ⭐ `winning` — absent from a ban list in a file called noWinnerVocabulary.
    expect(BANNED.test('the winning option')).toBe(true)
    // ⚠ CODE IS NOT COPY — the three measured false positives from adding the
    // fourth file. Each is an identifier or a template variable NAME.
    expect(RETIRED_DESIGNATIONS.test(interpolationsRemoved('${leader.label} currently scores higher'))).toBe(false)
    expect(NOT_COPY.test('insight:conditional-winner:x')).toBe(true)
    expect(NOT_COPY.test('leader')).toBe(true) // `{ id: 'leader' }` — a lookup key
    // ⚠ AND THE BARE-TOKEN RULE MUST NOT SWALLOW A REAL VIOLATION. Every banned
    // phrase has a space or a capital, so none can wear this shape.
    expect(NOT_COPY.test('the leading option')).toBe(false)
    expect(NOT_COPY.test('Leading option not assessed')).toBe(false)
    // ⚠ AND THE STRIPPER MUST NOT GO BLIND: real copy AROUND an interpolation
    // still reads, or the exclusion above would hide every templated violation.
    expect(RETIRED_DESIGNATIONS.test(interpolationsRemoved('${x} is the leading option'))).toBe(true)
    // ⚠ NOR MANUFACTURE ONE: a space, not a splice.
    expect(interpolationsRemoved('${a}leader')).toBe(' leader')
    // ⚠ THE FALSE POSITIVES, PINNED. These must stay legal or the guard starts
    // corrupting correct copy — each was measured on the live wire, 8 Sep 2026.
    expect(RETIRED_DESIGNATIONS.test('Interview technical leads or consult partners')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('a fragile edge leads to a different outcome')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('win_probability')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('Scored highest in 73% of runs')).toBe(false)
  })

  it.each(REACHED_COPY_FILES)('%s frames no result as a contest', (name, rel) => {
    const strings = literals(stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8')))
      .filter(s => !NOT_COPY.test(s))
    const offenders = strings.filter(s => BANNED.test(s) || RETIRED_DESIGNATIONS.test(s))
    expect(
      offenders,
      `contest framing in ${name}:\n  ${offenders.join('\n  ')}\n` +
        'Ruled 8 Sep 2026: say "scored highest in N% of runs" — never a placing.',
    ).toEqual([])
  })
})

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
  const re = /'([^'\n\\]{2,120})'|"([^"\n\\]{2,120})"|`([^`\n\\]{2,120})`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

/**
 * Contest framing. `rank`/`ranked` is deliberately ABSENT from this list:
 * factors genuinely are ranked by influence, and that is a measurement rather
 * than a contest between the user's options.
 */
const BANNED = /\b(winner|winners|wins|won|leading option|leads on|ahead in|came out ahead|beats|best option|top option)\b/i

/** Identifiers and paths are not copy — a user never reads them. */
const NOT_COPY = /^(src\/|https?:|data-|aria-|analysis-new-|model-row|[a-z_]+\.(ts|tsx|json)$)/

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
    expect(BANNED.test('Scored highest against your goal in 99% of simulated futures')).toBe(false)
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
]

/** Designating placings the 8 Sep ruling retired, over and above BANNED. */
const RETIRED_DESIGNATIONS =
  /\bleaders?\b|\bleading option\b|\bthe current lead\b|\ba fragile lead\b|\bcrown a winner\b/i

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
    // ⚠ THE FALSE POSITIVES, PINNED. These must stay legal or the guard starts
    // corrupting correct copy — each was measured on the live wire, 8 Sep 2026.
    expect(RETIRED_DESIGNATIONS.test('Interview technical leads or consult partners')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('a fragile edge leads to a different outcome')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('win_probability')).toBe(false)
    expect(RETIRED_DESIGNATIONS.test('Scored highest against your goal in 73% of runs')).toBe(false)
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

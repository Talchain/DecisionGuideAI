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
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'
// ⚠ A REAL IMPORT, not another text read. The honesty assertions below bind
// to the two check codes BY IDENTITY (trap 19); a value predicate over the
// extracted literals could be satisfied by a different string in the file.
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'

// cwd-relative: `import.meta.url` is not a file: URL under this vitest config,
// and a spec that cannot read its subject reports a clean sweep of nothing.
const COPY_FILE = resolve(process.cwd(), 'src/components/results/analysisNew/analysisNewCopy.ts')

/** Blank comments so a mention in prose is never counted as copy. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')

/**
 * ⭐⭐ A BAN LIST QUOTES THE BANNED WORD — IT DOES NOT USE IT.
 *
 * The same declaration-versus-quotation distinction `stripComments` already
 * makes for prose, applied to code. `glossaryCheck.ts` exports
 * `ANALYSIS_HERO_BANNED_TERMS = ['winner', 'winning', 'chance of winning', …]`
 * — a sibling vocabulary guard, reached from this tab. Widening the scope
 * without this made THIS guard fire on THAT guard's ban list: a false positive
 * whose only available fix is to stop declaring banned words, which is absurd.
 *
 * Measured, not supposed: before this blanker the derived sweep reported
 * `chance of winning` in `utils/glossaryCheck.ts` as user-facing copy.
 *
 * ⚠ SCOPED BY THE IDENTIFIER'S NAME, so it cannot swallow ordinary copy: only
 * an array literal assigned to a name containing BANNED / RETIRED / FORBIDDEN /
 * DISALLOWED / BLOCKLIST is blanked. A copy catalogue is not named that, and
 * the control below proves a real violation in an ordinary array still reads.
 */
const banListsBlanked = (src: string): string =>
  src.replace(
    /[A-Za-z0-9_]*(?:BANNED|RETIRED|FORBIDDEN|DISALLOWED|BLOCKLIST)[A-Za-z0-9_]*\s*(?::[^=]*?)?=\s*\[[\s\S]*?\]/g,
    ' ',
  )

/** Comments blanked, then sibling ban lists blanked. Both are quotation. */
const readableCopy = (raw: string): string => banListsBlanked(stripComments(raw))

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
  /\b(winner|winners|winning|wins|won(?!['\u2019]t)|leading option|leads on|ahead in|came out ahead|beats|best option|top option)\b/i

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
  /^(src\/|https?:|data-|aria-|analysis-new-|model-row|insight:|strengthen:|\[[a-z0-9][a-z0-9 _-]*\]\s|[a-z_]+\.(ts|tsx|json)$)|^[a-z][a-z0-9_]*([:-][a-z0-9]+)*$/

describe('the Reasoning tab does not frame the analysis as a contest', () => {
  const raw = readFileSync(COPY_FILE, 'utf8')
  const code = readableCopy(raw)
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
 * ⚠ THE DIRECTORY IS NOT THE SURFACE. Only 2 of the 12 lived under
 * `analysisNew/`; the other 10 sat in two files the tab RUNS but does not own.
 *
 * ⭐⭐⭐ AND THE FIX FOR THAT WAS ITSELF A HAND-MAINTAINED MIRROR — CLOSED HERE,
 * 9 Sep 2026. The scope became a literal list of four paths, sitting inside the
 * file whose own header calls a hand-maintained list "the estate's answer to
 * those is a derived guard that fails loud (trap 12)". A fifth file joining the
 * surface was covered by nobody, and its arrival produced NO RED anywhere —
 * the drift-reads-as-green failure mode, one level up from the one it fixed.
 *
 * ── WHAT THE SCOPE IS NOW ──────────────────────────────────────────────────
 * DERIVED, by walking the import graph from the tab's MOUNTED RENDER ROOT —
 * `AnalysisNewTabBody.tsx`, mounted at `canvas/components/OutputsDock.tsx:3613`
 * — and keeping what lands under `src/components/results/`. Measured at the
 * time of writing: **88 files, 1,919 literals, against a hand-list of 4.**
 * A new import from this tab into a new copy file is in scope the moment it is
 * written, with nothing for anyone to remember.
 *
 * ⚠⚠ THE CLAIM TYPE, STATED PRECISELY, BECAUSE IT IS NOT WHAT THE HEADING SAYS.
 * This is IMPORT-REACHABLE copy, which is a SUPERSET of RENDER-reachable copy.
 * Import closure is not render reachability. The scope is deliberately the
 * superset: excluding a file needs positive proof it never renders, which
 * nothing here supplies, and the dangerous direction for a guard is the one
 * that looks clean because it stopped looking.
 *
 * ⭐ EXCEPT THROUGH A BARREL, WHERE THE SUPERSET GETS ABSURD — measured, and
 * this is why `namesFrom` exists. `AnalysisNewTabBody.tsx:52` imports three
 * bindings from the `../modals` barrel; a naive walk then drags in all twelve
 * modules that barrel re-exports, including `HowComputedModal.tsx`, which this
 * tab never renders and whose copy would have been flagged. A barrel is
 * followed only into the modules that export a name actually imported through
 * it. Pinned by the contrast controls below.
 */
const TAB_RENDER_ROOT = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'
const COPY_SCOPE_PREFIX = 'src/components/results/'
const MODULE_EXT = ['.ts', '.tsx', '.js', '.jsx'] as const

/**
 * `undefined` = the specifier named something this resolver could not find, and
 * that is a HARD ERROR below rather than a silent skip. A resolver that drops
 * what it cannot resolve shrinks the swept corpus invisibly — the exact shape
 * of every false zero in this estate.
 * `null` = a bare package specifier, correctly out of scope.
 */
function resolveSpec(spec: string, fromFile: string): string | null | undefined {
  let base: string
  if (spec.startsWith('@/')) base = join(process.cwd(), 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const e of MODULE_EXT) if (existsSync(base + e) && statSync(base + e).isFile()) return base + e
  if (existsSync(base) && statSync(base).isDirectory())
    for (const e of MODULE_EXT) {
      const i = join(base, 'index' + e)
      if (existsSync(i)) return i
    }
  if (existsSync(base) && statSync(base).isFile()) return base
  return undefined
}

interface Edge { spec: string; names: string[] | null; wildcard: boolean }

/** Every import/export edge out of a file, WITH the names it carries. */
function edgesOf(file: string): Edge[] {
  const src = readFileSync(file, 'utf8')
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const out: Edge[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const spec = m[2] ?? m[3]
    if (!spec) continue
    const clause = m[1] ?? ''
    const brace = clause.match(/\{([\s\S]*?)\}/)
    const names = brace
      ? brace[1]
          .split(',')
          .map((s) => s.replace(/\btype\b/g, '').split(/\s+as\s+/)[0]!.trim())
          .filter(Boolean)
      : null
    out.push({ spec, names, wildcard: /\*/.test(clause) && !brace })
  }
  return out
}

const isBarrel = (f: string): boolean => /^index\.(ts|tsx|js|jsx)$/.test(basename(f))

/** Files whose specifiers could not be resolved — asserted EMPTY below. */
const unresolvedSpecs: string[] = []

function renderPathClosure(): Set<string> {
  const seen = new Set<string>()
  const queue: Array<{ file: string; names: string[] | null }> = [
    { file: join(process.cwd(), TAB_RENDER_ROOT), names: null },
  ]
  while (queue.length > 0) {
    const { file, names } = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const es = edgesOf(file)
    // A barrel is a re-export table, not a surface: follow only what was asked
    // for. `export *` defeats that, so such a barrel is walked in full.
    const selective = isBarrel(file) && names !== null && !es.some((e) => e.wildcard)
    for (const e of es) {
      if (!e.spec.startsWith('.') && !e.spec.startsWith('@/')) continue
      if (selective && (e.names === null || !e.names.some((n) => names!.includes(n)))) continue
      const r = resolveSpec(e.spec, file)
      if (r === undefined) {
        unresolvedSpecs.push(`${e.spec}  <-  ${file.replace(process.cwd() + '/', '')}`)
        continue
      }
      if (r !== null && !seen.has(r)) queue.push({ file: r, names: e.names })
    }
  }
  return seen
}

/** The swept corpus: copy files this tab's render root can reach. */
const REACHED_COPY_FILES: readonly string[] = [...renderPathClosure()]
  .map((f) => f.replace(process.cwd() + '/', ''))
  .filter(
    (r) =>
      r.startsWith(COPY_SCOPE_PREFIX) &&
      !/__tests__|__fixtures__|\.spec\.|\.test\.|\.stories\./.test(r),
  )
  .sort()

/**
 * The four paths the hand-list carried, kept as a POSITIVE CONTROL rather than
 * as the scope. If the derivation ever stops reaching one of them it has gone
 * blind, and a blind walker returns a clean sweep of almost nothing.
 */
const HISTORICALLY_SWEPT = [
  'src/components/results/analysisNew/analysisNewCopy.ts',
  'src/components/results/strengthen/buildRecommendations.ts',
  'src/components/results/decision-overview/actionsCatalogue.ts',
  'src/components/results/analysisNew/buildAnalysisNewViewModel.ts',
] as const

/**
 * ⭐ CONTRAST CONTROLS — absence is only evidence when something else is
 * present. A walker that returned "every file under results/" would pass every
 * assertion above and be worthless, so these three must be OUT:
 *  · `ResultsBody.tsx` — the Analysis tab's root, a different surface;
 *  · `ConditionalWinnerCards.tsx` — carries the banned word in its own NAME, so
 *    an over-broad walker would not merely include it, it would RED on it;
 *  · `HowComputedModal.tsx` — reachable ONLY through the modals barrel, and
 *    never rendered by this tab. It is the barrel-transparency discriminator.
 */
const MUST_NOT_BE_IN_SCOPE = [
  'src/components/results/ResultsBody.tsx',
  'src/components/results/ConditionalWinnerCards.tsx',
  'src/components/results/modals/HowComputedModal.tsx',
] as const

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
  /**
   * ⚠⚠ THE OLD PRECONDITION WAS A PER-FILE FLOOR OF TEN LITERALS, AND IT
   * CANNOT SURVIVE A DERIVED SCOPE — measured: 54 of the 88 reached files hold
   * ten or fewer, several hold ZERO (`voi/decisionVoi.ts`, `leaderDesignation.ts`
   * — pure logic, no copy, correctly so). The floor only ever passed because
   * the hand-list happened to name four unusually copy-dense files. Keeping it
   * would have forced the scope back down to whatever satisfied the check,
   * which is the mirror re-forming around its own guard.
   *
   * What replaces it guards the same failure — "the sweep read nothing" —
   * against the DERIVATION rather than against each file.
   */
  it('PRECONDITION: the derivation resolved every specifier it met', () => {
    // A resolver that silently drops what it cannot find shrinks the corpus
    // with no symptom. This is the single most load-bearing assertion here.
    expect(unresolvedSpecs, `unresolved specifiers:\n  ${unresolvedSpecs.join('\n  ')}`).toEqual([])
  })

  it('PRECONDITION: the scope is derived, non-trivial, and reaches known copy', () => {
    // Floor well under the 88 measured — this catches a walker that stopped,
    // not scope growth.
    expect(REACHED_COPY_FILES.length).toBeGreaterThan(40)
    // POSITIVE CONTROL: everything the hand-list named is still reached.
    for (const known of HISTORICALLY_SWEPT) {
      expect(REACHED_COPY_FILES, `${known} is no longer reached — the walk went blind`).toContain(known)
    }
    // And the corpus actually holds copy: 1,919 at the time of writing.
    const total = REACHED_COPY_FILES.reduce(
      (n, rel) => n + literals(readableCopy(readFileSync(resolve(process.cwd(), rel), 'utf8'))).filter(s => !NOT_COPY.test(s)).length,
      0,
    )
    expect(total, 'the sweep found almost no copy — it is reading nothing').toBeGreaterThan(800)
  })

  it('CONTRAST CONTROL: the walk DISCRIMINATES — it is not "everything under results/"', () => {
    // Without this, every assertion above is satisfied by a walker that returns
    // the whole directory, which is the failure this file exists to prevent in
    // the other direction. 88 reached of 186 tracked; these three are excluded
    // for three DIFFERENT reasons, so one broken rule cannot pass all three.
    for (const out of MUST_NOT_BE_IN_SCOPE) {
      expect(REACHED_COPY_FILES, `${out} is not rendered by this tab and must not be swept`).not.toContain(out)
    }
  })

  /*
   * ⭐ THE INSTRUMENT'S OWN BLIND SPOT, PINNED — because it had one, and the
   * only reason we know is that a reviewer WROTE THE EVASION AND RAN IT.
   *
   * The extractor used to stop at 120 characters. A retired string put back
   * into an in-scope file at 126 characters left this spec GREEN 10/10, and
   * nothing in the suite could see it: the literal count silently dropped by
   * one and the only assertion on it was `> 10`.
   *
   * Removing the cap closes the demonstrated evasion. These two cases stop it
   * SILENTLY RETURNING. They test the EXTRACTOR, not the corpus, so they cannot
   * drift as the copy files change — the failure mode being guarded is "the
   * sweep stopped looking", which is invisible to every count-based check.
   */
  it('THE EXTRACTOR HAS NO LENGTH BOUND — a longer sentence cannot evade the sweep', () => {
    const long = 'x'.repeat(300)
    // Positive control first: the extractor sees an ORDINARY literal, so a hit
    // below is the absence of a bound and not an extractor that sees anything.
    expect(literals("const a = 'ordinary copy'")).toContain('ordinary copy')
    expect(literals(`const a = '${long}'`)).toContain(long)
  })

  it("THE REVIEWER'S 126-CHARACTER EVASION IS NOW CAUGHT", () => {
    const evasion =
      'Build the strongest honest case AGAINST the current leading option. ' +
      'What evidence or reasoning would genuinely change my mind?'
    // PRECONDITION PINNED IN-TEST: this string really is past the old cap, so
    // a RED below is the cap's removal and not a shorter string sneaking in.
    expect(evasion.length).toBeGreaterThan(120)
    const seen = literals(`const a = '${evasion}'`).filter((x) => !NOT_COPY.test(x))
    expect(seen.some((x) => RETIRED_DESIGNATIONS.test(x))).toBe(true)
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

  /**
   * ⭐⭐ THE THREE FALSE-POSITIVE CLASSES THE WIDENING EXPOSED — each MEASURED
   * on the derived corpus, none of them visible from a hand-list of four files.
   *
   * A guard that reddens on correct copy gets a blanket disable, so widening
   * the scope without these three would have destroyed the guard rather than
   * strengthened it. They are precision fixes ONLY: no banned form was
   * un-banned, and the rate-bearing forms the 8 Sep ruling deliberately
   * PERMITS ("was the stronger option 31% of the time") stay permitted — pinned
   * at the end of this test.
   */
  it("PRECISION: the widened sweep does not fire on correct copy", () => {
    // ── 1. `won` fired on every "won't" in the estate. ─────────────────────
    // Measured: three files one import-hop out (canvas/conversation,
    // canvas/mutations, canvas/validation) carry ordinary future-negative copy
    // and read as contest framing. `\bwon\b` matches "won" in "won't" because
    // an apostrophe is a word boundary.
    expect(BANNED.test("It isn't saved to the model yet — it won't be there.")).toBe(false)
    expect(BANNED.test("The analysis won't be able to evaluate it.")).toBe(false)
    expect(BANNED.test('this won’t resend your brief')).toBe(false) // curly apostrophe
    // ⚠ AND THE BAN MUST SURVIVE THE FIX — a lookahead that swallowed the real
    // form would be worse than the false positive it removed.
    expect(BANNED.test('Adopt Segment won the comparison')).toBe(true)
    expect(BANNED.test('the option that won')).toBe(true)

    // ── 2. A bracketed diagnostic tag is not copy. ─────────────────────────
    // `useResultsSectionData.ts:4014` is a console.warn argument. A user-facing
    // sentence does not open with "[brief-4]".
    expect(NOT_COPY.test('[brief-4] fragile edge dropped — no alternative winner label resolved')).toBe(true)
    // ⚠ AND IT MUST NOT SWALLOW A SENTENCE THAT MERELY CONTAINS BRACKETS.
    expect(NOT_COPY.test('Adopt Segment [revised] is the leading option')).toBe(false)

    // ── 3. A ban list QUOTES the banned word. ──────────────────────────────
    const siblingGuard = "export const ANALYSIS_HERO_BANNED_TERMS = [\n  'winner', 'winning', 'chance of winning',\n]"
    expect(literals(readableCopy(siblingGuard)).filter(s => !NOT_COPY.test(s)).some(s => BANNED.test(s))).toBe(false)
    // ⚠ AND AN ORDINARY ARRAY IS STILL READ — the blanker keys on the NAME, so
    // a violation in a copy catalogue cannot hide by living in a list.
    const ordinaryArray = "export const HEADINGS = [\n  'Pressure-test the leading option',\n]"
    expect(
      literals(readableCopy(ordinaryArray)).filter(s => !NOT_COPY.test(s)).some(s => RETIRED_DESIGNATIONS.test(s)),
    ).toBe(true)

    // ── THE RULING IS UNCHANGED, NOT WIDENED. ─────────────────────────────
    // The permitted rate-bearing forms stay permitted; this PR widened WHERE we
    // look, never WHAT is banned.
    for (const permitted of [
      'Consolidate was the stronger option 31% of the time',
      'Scored highest in 66% of simulated futures',
      'Most likely to serve your goal',
    ]) {
      expect(BANNED.test(permitted) || RETIRED_DESIGNATIONS.test(permitted), permitted).toBe(false)
    }
  })

  it.each(REACHED_COPY_FILES)('%s frames no result as a contest', (rel) => {
    const strings = literals(readableCopy(readFileSync(resolve(process.cwd(), rel), 'utf8')))
      .filter(s => !NOT_COPY.test(s))
    const offenders = strings.filter(s => BANNED.test(s) || RETIRED_DESIGNATIONS.test(s))
    expect(
      offenders,
      `contest framing in ${rel}:\n  ${offenders.join('\n  ')}\n` +
        'Ruled 8 Sep 2026: say "scored highest in N% of runs" — never a placing.',
    ).toEqual([])
  })
})

/**
 * ⭐⭐ AND IT DOES NOT SPEAK AS AN ORACLE EITHER.
 *
 * Paul, 10 Sep 2026: the analysis is a THINKING TOOL, NOT AN ORACLE. Copy
 * conditions on the data available, in the register "on the data so far". The
 * human is the author and the decision-maker.
 *
 * "the result" is the specific referent ruled out, because it speaks as though
 * the run produced a verdict the reader should accept. It is a DIFFERENT harm
 * from the contest framing above and it lives in its own describe for that
 * reason (trap 21): the sweep above answers "does this copy award a placing?"
 * and this one answers "does it speak as though it had the answer?". Collapsing
 * them under one name would leave two questions sharing one predicate, which is
 * the shape this estate keeps paying for.
 *
 * ── THE IRONY THAT CONSTRAINED THE FIX ─────────────────────────────────────
 * Both witnessed strings are HONESTY copy: they exist to say robustness was NOT
 * assessed, and that the silence is not an all-clear. The fix was therefore not
 * to soften them. It swapped the oracle referent and left every other clause
 * standing, so "did not test" and "nothing here says it would hold" both
 * survive. A guard that pushed an author to weaken these would be worse than no
 * guard at all.
 *
 * ── SCOPE ─────────────────────────────────────────────────────────────────
 * ⚠⚠ SUPERSEDED 11 Sep 2026 — the paragraph that stood here said this guard
 * pinned ONE FILE (`analysisNewCopy.ts`), that the derived corpus carried 14
 * occurrences of `the result` with only 2 of them in that file, and that
 * widening was "a measured piece of work with 12 known strings in it". It is
 * kept rather than deleted because it correctly PRICED the work, and the price
 * was right: the widening lands here, and the 12 were the 12.
 *
 * THE SCOPE IS NOW `REACHED_COPY_FILES` — the same DERIVED import closure the
 * contest sweep above walks, from the tab's mounted render root. Measured at
 * the time of writing: 93 files, 2,014 literals. There is no second scope to
 * keep in step with the first, and a new copy file joining the surface is
 * swept the moment it is imported.
 *
 * ⚠ THE CLAIM TYPE IS UNCHANGED AND IS STILL A SUPERSET: this is
 * IMPORT-reachable copy, not RENDER-reachable copy. Two of the 12 were traced
 * to surfaces this tab does not itself render (`fragileEdgeCopy` renders in
 * `FragileEdgeGroupCard` on the Analysis tab). They are swept anyway, because
 * excluding a file needs positive proof it never renders and the dangerous
 * direction for a guard is the one that looks clean because it stopped looking.
 */
const ORACLE_FRAMING = /\bthe results?\b/i

describe('the Reasoning tab does not speak as an oracle', () => {
  const raw = readFileSync(COPY_FILE, 'utf8')
  const strings = literals(readableCopy(raw)).filter(s => !NOT_COPY.test(s))

  it('PRECONDITION: the scan reaches real copy, it is not reading an empty file', () => {
    // Without this, a stripper that blanked the file reports a clean sweep of
    // nothing and this spec passes forever (trap 13).
    expect(strings.length, 'the scan found no string literals at all').toBeGreaterThan(100)
    expect(strings.some(s => /analysis/i.test(s)), 'the scan found no copy at all').toBe(true)
  })

  it('PRECONDITION: the widened scope is the SAME derived closure, not a second list', () => {
    // ⚠ THE FAILURE THIS EXISTS FOR is a scope that drifts apart from the one
    // above. There is exactly one derivation and both describes consume it, so
    // this asserts identity rather than agreement between two lists.
    expect(REACHED_COPY_FILES.length).toBeGreaterThan(40)
    expect(REACHED_COPY_FILES).toContain(COPY_FILE.replace(process.cwd() + '/', ''))
    // The five files this widening actually had to repair — a POSITIVE CONTROL
    // on the walk, not the scope. If the derivation stops reaching one of them
    // it has gone blind, and a blind walker returns a clean sweep of nothing.
    for (const repaired of [
      'src/components/results/analysisNew/buildAnalysisNewViewModel.ts',
      'src/components/results/strengthen/buildRecommendations.ts',
      'src/components/results/useResultsSectionData.ts',
      'src/components/results/utils/evidenceGapConfidenceDisplay.ts',
      'src/components/results/utils/fragileEdgeCopy.ts',
    ]) {
      expect(REACHED_COPY_FILES, `${repaired} is no longer reached — the walk went blind`).toContain(repaired)
    }
  })

  it('POSITIVE CONTROL: the pipeline flags every string this ruling has removed', () => {
    // ⭐ THE LOAD-BEARING CONTROL, and it is fed the REAL sentences rather than
    // a fabricated one. The verdict below is an ABSENCE claim, worth nothing
    // until the probe has been shown detecting a PRESENCE, and the presence it
    // must detect is the one that shipped. Both go through the whole pipeline
    // (strip -> ban-lists -> extract -> NOT_COPY -> match), so a break anywhere
    // reds here instead of quietly manufacturing a clean sweep.
    //
    // ⚠ APPEND-ONLY. These are sentences the product ACTUALLY EMITTED on dated
    // builds (trap 14b). Rewriting one would falsify the record it holds; a
    // later removal adds a row and never edits one.
    const WITHDRAWN = [
      // 10 Sep 2026 — analysisNewCopy.ts
      'This run did not test how the result behaves when the assumptions change, so nothing here says it would hold.',
      'No robustness verdict came back with this run, so the result has not been shown to survive a change in the assumptions.',
      // 11 Sep 2026 — the widening
      'Chance the result flips',
      'This relationship is one the result is sensitive to.',
      'The result held up under stress-testing.',
      'Improving this factor could change the result.',
      'Add the missing elements below before relying on the result.',
      'Are these 2 relationships that could flip the result to Plan B reliable?',
    ] as const
    for (const sentence of WITHDRAWN) {
      const seen = literals(readableCopy(`const a = '${sentence}'`)).filter(s => !NOT_COPY.test(s))
      expect(seen, `the extractor lost this sentence: ${sentence}`).toContain(sentence)
      expect(
        seen.some(s => ORACLE_FRAMING.test(s)),
        `the guard cannot see the oracle framing it was written to catch: ${sentence}`,
      ).toBe(true)
    }
  })

  it('PRECISION: it does not fire on words that merely contain the token', () => {
    // ⚠ Measured, not supposed: this file's own prose carries "the resulting
    // error" and `missingResultLabels`. A matcher that fired on those would
    // push an author to rename correct copy, which is how a guard earns a
    // blanket disable.
    expect(ORACLE_FRAMING.test('carries the resulting error as BASELINED DEBT')).toBe(false)
    expect(ORACLE_FRAMING.test('missingResultLabels')).toBe(false)
    // ⚠ AND IT MUST NOT SWALLOW THE REAL FORM WHILE DOING SO.
    expect(ORACLE_FRAMING.test('so the result has not been shown')).toBe(true)
    expect(ORACLE_FRAMING.test('The results are in')).toBe(true)
    // The replacements themselves must be legal, or the fix cannot land.
    for (const replacement of [
      'This run did not test how these numbers behave when the assumptions change, so nothing here says they would hold.',
      'No robustness verdict came back with this run, so nothing here has been shown to survive a change in the assumptions.',
      'Chance the answer changes',
      'These numbers are sensitive to this relationship.',
      'On the data so far, these numbers held up under stress-testing.',
      'Improving this factor could change the answer.',
      'Add the missing elements below before relying on the analysis.',
      'Are these 2 relationships that could flip the answer to Plan B reliable?',
    ]) {
      expect(ORACLE_FRAMING.test(replacement), replacement).toBe(false)
    }
  })

  /**
   * ⭐⭐ THE EXTRACTOR'S OWN BLIND SPOT, PINNED RATHER THAN LEFT INVISIBLE.
   *
   * MEASURED 11 Sep 2026, and it is worse than "escaped literals are skipped".
   * `literals()` excludes a backslash from every literal body, so on
   *
   *   'The breakdown of which causal pathways drive the result didn\'t run. …'
   *
   * the regex fails at the escape, RESYNCHRONISES on the `'` inside `\'`, and
   * returns a misaligned fragment beginning `"t run. …"`. The leading half —
   * the half carrying "the result" — is dropped silently, and the surviving
   * fragment says "Your results", which this matcher correctly does not flag.
   * So the sweep reads CLEAN on a file that violates the ruling.
   *
   * ⚠ THE LIVE INSTANCE: `src/components/results/utils/humaniseCritique.ts:513`
   * is in `REACHED_COPY_FILES` and carries exactly this shape.
   *
   * It is not fixed here because when this lane started that file was owned by
   * another lane; #1472 has since landed and removed its em dash, leaving BOTH
   * the bare "the result" and the escaped `didn\'t` in place. Re-derived after
   * that merge, so this is measured at the current tip and not inherited.
   *
   * ⭐ SO THE GAP IS PINNED AS A GAP: this test asserts the blindness EXACTLY as
   * measured. It goes RED the moment someone repairs the extractor — which is
   * the point. Whoever repairs it must repair `humaniseCritique.ts:513` in the
   * same change, and this test is what tells them so. A gap recorded in the
   * suite is honest; a gap invisible to it is how it survives another month.
   *
   * ⭐ AND THE FOLLOW-UP IS PRICED: an escape-safe tokenizer run over all 93
   * closure files, no length floor, surfaces EXACTLY ONE offender — that string.
   * So the repair is the extractor plus one sentence, with no other fallout.
   */
  it('KNOWN GAP: an escaped quote misaligns the extractor and hides the string after it', () => {
    const escaped = String.raw`const a = 'drive the result didn\'t run. Your results stand.'`
    const seen = literals(readableCopy(escaped))
    // PRECONDITION PINNED IN-TEST: the extractor really did return something,
    // so a pass below is the MISALIGNMENT and not an extractor that saw nothing.
    expect(seen.length, 'the extractor returned nothing at all — this gap has changed shape').toBe(1)
    expect(seen[0], 'the extractor no longer resynchronises after the escape').toBe(
      't run. Your results stand.',
    )
    // The half that carried the violation is gone, so the sweep reads clean.
    expect(seen.some(s => ORACLE_FRAMING.test(s))).toBe(false)
    // ⚠ AND THE UNESCAPED TWIN MUST STILL BE CAUGHT, or this test would be
    // describing a matcher that never worked rather than an extractor gap.
    const plain = literals(readableCopy(`const a = 'drive the result and stop'`))
    expect(plain.some(s => ORACLE_FRAMING.test(s))).toBe(true)
  })

  it('and the reframe kept the HONESTY: these rows still refuse to read as an all-clear', () => {
    // ⭐ THE HALF A DASH-OR-VOCABULARY HUNT CAN DESTROY. Both sentences exist to
    // say robustness was NOT assessed. A future edit could satisfy the sweep
    // above by deleting the clause instead of rewording the referent, and
    // nothing else here would notice. Bound by IDENTITY to the two keys (trap
    // 19), never by a value predicate another string could satisfy.
    const notAssessed = ANALYSIS_NEW_COPY.checks.robustness_not_assessed.meaning
    const unknown = ANALYSIS_NEW_COPY.checks.robustness_unknown.meaning
    expect(notAssessed, 'the row stopped saying the run did not test it').toMatch(/did not test/i)
    expect(notAssessed, 'the row stopped refusing to vouch for what is on screen').toMatch(/nothing here/i)
    expect(unknown, 'the row stopped saying no verdict came back').toMatch(/no robustness verdict came back/i)
    // ⚠ THE NEGATION IS CARRIED BY "nothing here", NOT BY A "not" ON THE VERB.
    // Pinned as written rather than as assumed: a first attempt asserted
    // /has not been shown/ and this test went RED on correct copy.
    expect(unknown, 'the row stopped refusing to vouch for what is on screen').toMatch(
      /nothing here has been shown/i,
    )
    // And neither may quietly reacquire the referent.
    expect(ORACLE_FRAMING.test(notAssessed)).toBe(false)
    expect(ORACLE_FRAMING.test(unknown)).toBe(false)
  })

  it.each(REACHED_COPY_FILES)('%s does not speak as an oracle', (rel) => {
    const found = literals(readableCopy(readFileSync(resolve(process.cwd(), rel), 'utf8')))
      .filter(s => !NOT_COPY.test(s))
    const offenders = found.filter(s => ORACLE_FRAMING.test(s))
    expect(
      offenders,
      `oracle framing in ${rel}:\n  ${offenders.join('\n  ')}\n` +
        'Condition on the data and on what this run did. Do not add an exemption.',
    ).toEqual([])
  })
})

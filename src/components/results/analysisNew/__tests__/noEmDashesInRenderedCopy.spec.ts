/**
 * NO EM DASHES IN THE PRODUCT'S RENDERED COPY.
 *
 * Paul, 10 Sep 2026: no em dashes in product content. It is where a hedge gets
 * bolted on. Split into sentences or cut; copy must be tight, not waffly.
 *
 * ── THE WITNESSED DEFECT ───────────────────────────────────────────────────
 * Driving a real analysis to completion as a guest, the Reasoning tab rendered
 * two of them in one block, the comparison row that cannot name a most likely
 * option:
 *
 *     label:   "Which option is most likely — not confirmed"
 *     meaning: "… any ordering you see is unconfirmed — it is not a
 *               finding that the options are level."
 *
 * A sweep of the same file then found seven more in strings that reach a user.
 * Nine is not a slip; it is the house style of a file nobody was checking.
 *
 * ── WHY A GUARD AND NOT JUST AN EDIT ───────────────────────────────────────
 * The same reason `noWinnerVocabulary.spec.ts` gives for its own existence: an
 * edit fixes today's nine and the next sentence written into this file
 * reintroduces the tenth, with no red anywhere. That is the hand-maintained
 * mirror this estate keeps paying for (CLAUDE.md trap 12), and the answer to
 * those is a derived guard that fails loud.
 *
 * ── ⭐⭐⭐ AND THIS GUARD WAS ITSELF ONE — CLOSED HERE, 11 Sep 2026 ──────────
 * THE LOAD-BEARING CHANGE. It is a correction, not a tidy-up.
 *
 * On 10 Sep the scope was widened from one hand-listed file to TWO hand-listed
 * files, under a header that calls a hand-maintained list "the estate's answer
 * to those is a derived guard that fails loud". A list of two is a list.
 *
 * Measured at `18d681c2`, the build serving staging: this spec was GREEN,
 * 13/13, while the Reasoning tab rendered, inside
 * `data-testid="comparison-scope-note-analysisNew"`:
 *
 *     "Comparing 4 of your 8 options — Buy an AI Triage Tool, Hire Six More
 *      Agents and 2 others were left out."
 *
 * ⚠ THE EXTRACTOR WAS NOT THE GAP, AND THE OBVIOUS HYPOTHESIS WAS WRONG.
 * The offender is a TEMPLATE LITERAL WITH INTERPOLATIONS
 * (`utils/goalAnchorCopy.ts`, `COMPARISON_SCOPE_COPY.sentence`), which is the
 * shape an extractor classically cannot see — so "the template arm is missing"
 * is the natural diagnosis. It is false. The parser below already walked
 * template spans, and the interpolated-template control below already PASSED.
 * Fed that exact file, the unchanged extractor returns the offending span.
 *
 * The gap was SCOPE, and only scope: `goalAnchorCopy.ts` was not one of the two
 * names. Derived at the same commit, the tab's import closure reaches **94**
 * copy files carrying **16** em-dash offenders in **10** files. The hand-list
 * saw 0 of the 16. A guard can be correct, controlled, and pointed at the wrong
 * bytes (CLAUDE.md trap 22).
 *
 * ⚠ THAT FIGURE READ **93** UNTIL THE WALK WAS CORRECTED, AND THE OFFENDER
 * COUNTS DID NOT MOVE WITH IT. The first version of the walk marked a file seen
 * on pop and then used the barrel name set it was popped with, so the second of
 * five arrivals at the `../modals` barrel was discarded unread and
 * `modals/analysedOptions.ts` — a DIRECT dependency of the render root — was
 * never swept. Re-derived at the same commit with the union-corrected walk: 94
 * files, still 16 offenders in 10 files, because the dropped file happens to
 * carry none. That is exactly why nothing here could see it, and it is the
 * reason the walk now has a guard of its own at
 * `src/test/helpers/__tests__/reasoningTabCopyScope.spec.ts`, bound by file
 * identity to a module reachable only through a second visit to a barrel.
 *
 * So the scope is now DERIVED, by `src/test/helpers/reasoningTabCopyScope.ts`,
 * from the tab's mounted render root. A new copy file imported by this tab is
 * in scope the moment it is written, with nothing for anyone to remember.
 *
 * ── THE EXTRACTOR IS THE PARSER, NOT A REGEX (10 Sep 2026) ─────────────────
 * This guard used to find literals with
 *     /'([^'\n\\]{2,})'|"([^"\n\\]{2,})"|`([^`\n\\]{2,})`/g
 * whose character classes EXCLUDE a backslash. `humaniseCritique.ts` is full of
 * `didn\'t` / `wasn\'t` / `factor\'s`, so on that file the regex could not match
 * those strings from their real opening quote. It resynchronised on the escaped
 * apostrophe instead and captured MANGLED FRAGMENTS.
 *
 * Measured, on the same bytes: the regex reported **16** offenders where the
 * parser reported **21**. Worse than the undercount is its shape — whether a
 * dash survives into a fragment depends on WHICH SIDE of the dash the escape
 * falls. For `'foo — bar\'s baz'` the resynchronised capture is `s baz`, and
 * THE EM DASH IS GONE. So the old extractor could report a clean file that was
 * not clean, and which strings it lost was arbitrary.
 *
 * ⚠ That undercount escaped into the estate as fact: a brief in circulation on
 * 10 Sep put this file at "15, down from 16". Those are precisely the regex's
 * numbers. A holed instrument does not announce itself; it publishes a smaller,
 * plausible number that nobody re-derives.
 *
 * TypeScript's own parser is used instead. It is not an approximation of the
 * grammar that has to be kept in step with it — it IS the grammar, which is the
 * point (CLAUDE.md trap 12: derive, do not mirror). It also handles template
 * literals, interpolation and multi-line strings, all of which the regex
 * silently dropped.
 *
 * ⚠ THE ESCAPED-QUOTE GAP IS REPAIRED, NOT PINNED — AND THE PIN IS GONE WITH
 * IT. The 10 Sep change replaced the regex with the parser, which is what
 * closed it; the two controls below that exercise `didn\'t` and `bar\'s` are
 * that repair's evidence and they pass. There is no live KNOWN-GAP assertion
 * left for it anywhere in this spec, so nothing here asserts a gap that no
 * longer exists.
 *
 * ── COMMENTS ARE QUOTATION, NOT COPY ───────────────────────────────────────
 * Comments are trivia to the parser and are never string-literal nodes, so they
 * are excluded STRUCTURALLY rather than by a stripping pass that could get it
 * wrong. This matters here more than anywhere: of `humaniseCritique.ts`'s 84 em
 * dashes, **62 live in comments**, and several QUOTE sentences the product once
 * emitted on dated builds. Those are records; rewriting them would falsify the
 * history they hold (CLAUDE.md trap 14b), and Paul's ruling is about product
 * content. The control below proves the exclusion rather than assuming it.
 *
 * ── AND SO IS A `console.*` ARGUMENT (added 11 Sep 2026, with the widening) ─
 * The derived scope brought in three DEV-only diagnostics, e.g.
 * `console.warn('[Strengthen] dispatchAction unregistered — degrading to …')`.
 * No user reads those, and rewriting a developer's log line to satisfy a copy
 * ruling is noise of the kind that earns a guard a blanket disable.
 *
 * ⚠ EXCLUDED STRUCTURALLY, BY THE CALL IT SITS IN — never by the shape of the
 * string. A regex over bracketed prefixes was the alternative and it is the
 * weaker instrument twice over: `noWinnerVocabulary`'s equivalent is
 * lowercase-only, so it would not have matched `[Strengthen]` at all, and any
 * such pattern can be satisfied by ordinary copy that happens to open with a
 * bracket. "Is this literal an argument to `console.X(...)`?" is a question the
 * AST answers exactly. The discrimination pair below proves it cannot swallow
 * real copy.
 *
 * ── THE ONE DEFERRAL, AND WHY IT IS NOT AN IGNORE LIST ─────────────────────
 * The previous header said, correctly, that there is NO ignore list:
 * "the first inconvenient sentence gets added to it and the guard stops meaning
 * anything. If a string genuinely needs a dash, that is a finding to raise."
 * That ruling stands, and nothing below exempts a string on the grounds that it
 * needs a dash.
 *
 * `HANDED_OFF` is a different object and answers a different question (trap 21):
 * not "may this sentence keep its dash?" but "who is holding this file right
 * now?". `AtAGlance.tsx:992` renders `{' — '}` between an option's label and its
 * not-analysed badge. It is a real live defect. It was NOT fixed here because a
 * concurrent seat is editing that file for a suppressed scope note, and two
 * lanes editing one file is how the estate loses work.
 *
 * It is asserted EXACTLY — the verdict REDs if the set GROWS (new drift) and
 * REDs if it SHRINKS (the other seat landed; delete the row). That is the
 * honest way to ship a known gap (CLAUDE.md trap 22f), and it is the opposite
 * of an exemption list, which fails in neither direction.
 *
 * ── THE HALF THIS GUARD DOES NOT OWN ───────────────────────────────────────
 * A dash hunt can be satisfied by DELETING a clause rather than resplitting
 * one, and the witnessed sentence was carrying real weight: an unconfirmed
 * ordering is NOT a finding that the options are level. That claim is pinned,
 * with its own reasoning, by `withheldIsNotUnassessed.spec.ts` and
 * `theComparisonSaysWhyItCannotCompare.spec.tsx`. One owner, not two: this
 * file answers "is there a dash?" and those answer "does the sentence still
 * say what it must?" (CLAUDE.md trap 21).
 *
 * The same division applies to the copy widened in on 10 and 11 Sep. Several of
 * those sentences carry a warning or a reassurance AFTER the dash ("Your
 * results stand", "the value is still used as you confirmed it", "anything
 * downstream of it may be unreliable"). Splitting must keep them. That
 * obligation is pinned by `humaniseCritique.criticalClausesSurvive.spec.ts` and
 * `comparisonScopeClauseBounded.spec.ts`, not here.
 *
 * ⚠ JSX TEXT REMAINS INVISIBLE TO THIS EXTRACTOR, AND IS NOT CLAIMED.
 * A dash written as bare JSX text (`<span>a — b</span>`) is a `JsxText` node,
 * not a string literal, and nothing below sees it. `AtAGlance.tsx:992` is
 * caught only because it is written `{' — '}`, an expression container holding
 * a real literal. This is a stated limit of the claim, not a silent one: the
 * verdict below is about STRING LITERALS reachable from this tab, and a JSX-text
 * arm is separate, measured work.
 *
 * ── ⚠⚠ AND THE LARGER LIMIT: THE VERDICT COVERS ONE DIRECTORY, NOT THE WALK ─
 * STATED HERE ON PURPOSE. It was previously written only in the helper, and a
 * limit that lives in the helper is inherited silently by whoever reads THIS
 * file's verdict — which is the sentence a reviewer believes.
 *
 * The walk reaches far more than this guard sweeps. `COPY_SCOPE_PREFIX` keeps
 * only `src/components/results/`; everything else is reached, resolved, and
 * then DISCARDED before a single literal is read. Measured at `f6f960b6`: the
 * walk reaches **350** non-test files, sweeps the **94** under that prefix, and
 * drops **256**. Those 256 carry **84 em-dash string literals across 24 files**,
 * and they are not all developer trivia — `v5/failureTypeRetryability.ts`
 * carries user-facing error sentences and `lib/mappers/constants.ts` carries
 * result strings, both with dashes.
 *
 * ⚠ WHAT IS AND IS NOT CLAIMED ABOUT THOSE 84. Whether any of them renders on
 * THIS tab is a SEPARATE question that nothing here has measured, in either
 * direction. So this file's verdict is not "the Reasoning tab has no em dashes";
 * it is "no string literal under `src/components/results/` reachable from this
 * tab has one". The two are different sentences and only the second is
 * evidenced. Widening the prefix is real, separate work: it would need each new
 * directory's render-reachability established rather than assumed, and a guard
 * that is widened faster than it is understood is how an ignore list gets born.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { reasoningTabCopyScope } from '../../../../test/helpers/reasoningTabCopyScope'

const EM_DASH = '—'

/**
 * The swept corpus, DERIVED. cwd-relative, exactly as `noWinnerVocabulary`:
 * `import.meta.url` is not a file: URL under this vitest config, and a spec
 * that cannot read its subject reports a clean sweep of nothing.
 */
const { files: COVERED_FILES, unresolved: UNRESOLVED_SPECS } = reasoningTabCopyScope()

/**
 * The four paths the older hand-lists carried, kept as a POSITIVE CONTROL
 * rather than as the scope. If the derivation ever stops reaching one of them
 * it has gone blind, and a blind walker returns a clean sweep of almost
 * nothing. `goalAnchorCopy.ts` is in this list because it is the file the
 * hand-list missed — its presence is the proof the widening did the job.
 */
const MUST_BE_IN_SCOPE = [
  'src/components/results/analysisNew/analysisNewCopy.ts',
  'src/components/results/utils/humaniseCritique.ts',
  'src/components/results/utils/goalAnchorCopy.ts',
  'src/components/results/analysisNew/buildAnalysisNewViewModel.ts',
] as const

/**
 * ⭐ CONTRAST CONTROLS — absence is only evidence when something else is
 * present. A walker that returned "every file under results/" would satisfy
 * every assertion above and be worthless, so these must be OUT:
 *  · `ResultsBody.tsx` — the Analysis tab's root, a different surface;
 *  · `HowComputedModal.tsx` — reachable ONLY through the modals barrel and
 *    never rendered by this tab. It is the barrel-transparency discriminator.
 */
const MUST_NOT_BE_IN_SCOPE = [
  'src/components/results/ResultsBody.tsx',
  'src/components/results/modals/HowComputedModal.tsx',
] as const

/**
 * A live defect held by another seat. NOT an exemption — see the header.
 * Asserted exactly: this REDs if it grows AND if it shrinks.
 */
const HANDED_OFF: ReadonlyArray<{ file: string; text: string; why: string }> = [
  {
    file: 'src/components/results/analysisNew/sections/AtAGlance.tsx',
    text: ' — ',
    why:
      'Renders between an option label and its not-analysed badge (AtAGlance.tsx:992). ' +
      'A concurrent seat holds this file for a suppressed scope note; two lanes in one ' +
      'file is how work gets lost. Fix it there, then DELETE this row — leaving it will ' +
      'RED this guard.',
  },
]

/** True when this literal sits inside a `console.X(...)` call. */
const isConsoleCall = (n: ts.Node): boolean =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  ts.isIdentifier(n.expression.expression) &&
  n.expression.expression.text === 'console'

/**
 * Every string literal in the source, derived by TypeScript's own parser.
 *
 * Covers plain strings, template literals with no substitution, and every
 * static span of an interpolated template (head + each span's literal). The
 * interpolated EXPRESSIONS are code and are correctly not returned.
 *
 * ⚠ NO LENGTH CAP. `noWinnerVocabulary` shipped one at 120 characters and it
 * was a silent hole: a violation was reinstated at 126 and the guard stayed
 * green 10/10. The two dashes witnessed here sit in strings of 44 and 150
 * characters, so a cap in either direction would have missed one of them.
 */
function literals(src: string, fileName = 'scan.ts'): string[] {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (n: ts.Node, inConsole: boolean): void => {
    const nowInConsole = inConsole || isConsoleCall(n)
    if (!nowInConsole) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        out.push(n.text)
      } else if (ts.isTemplateExpression(n)) {
        out.push(n.head.text)
        for (const span of n.templateSpans) out.push(span.literal.text)
      }
    }
    ts.forEachChild(n, c => visit(c, nowInConsole))
  }
  visit(sf, false)
  return out
}

/** The whole pipeline, so a control exercises what the verdict exercises. */
const offendersIn = (raw: string, fileName?: string): string[] =>
  literals(raw, fileName).filter(s => s.includes(EM_DASH))

describe('rendered product copy carries no em dashes', () => {
  describe('the instrument itself', () => {
    it('POSITIVE CONTROL: the pipeline fires on a real em dash in a real literal', () => {
      // ⭐ THE LOAD-BEARING CONTROL. The verdicts below are ABSENCE claims, and
      // an absence claim is worth nothing until the probe has been shown
      // detecting a PRESENCE. Fed through `offendersIn` rather than tested
      // against the matcher alone, so a break anywhere in parse -> extract ->
      // detect reds here instead of quietly manufacturing a clean sweep.
      const fabricated = `const a = 'Sent to Olumi ${EM_DASH} the shared model updates when it answers.'`
      expect(offendersIn(fabricated), 'the guard cannot see a dash it was written to catch').toEqual([
        `Sent to Olumi ${EM_DASH} the shared model updates when it answers.`,
      ])
    })

    it('POSITIVE CONTROL: it sees a dash in a string that also carries a BACKSLASH ESCAPE', () => {
      // ⭐ THE REGRESSION THAT MOTIVATED THE PARSER. The previous regex
      // extractor excluded backslashes from its character classes, so on a
      // string like this one it resynchronised on the escaped apostrophe and
      // captured a fragment. Both orderings are asserted, because which side of
      // the dash the escape falls on decided whether the dash survived at all:
      // in the second case the old extractor returned `s baz` and reported the
      // file CLEAN. These two are the repair's evidence; there is no live
      // KNOWN-GAP assertion for the escaped-quote case anywhere in this spec.
      expect(offendersIn(`const a = 'It didn\\'t run ${EM_DASH} your results stand.'`)).toEqual([
        `It didn't run ${EM_DASH} your results stand.`,
      ])
      expect(offendersIn(`const a = 'foo ${EM_DASH} bar\\'s baz'`)).toEqual([`foo ${EM_DASH} bar's baz`])
    })

    it('DISCRIMINATION: an INTERPOLATED TEMPLATE is seen in copy and NOT in a comment', () => {
      // ⭐⭐ THE PAIR THAT PINS THE WITNESSED DEFECT'S SHAPE. The live offender
      // is an interpolated template (`COMPARISON_SCOPE_COPY.sentence`), and the
      // natural diagnosis for a guard that missed it is "the template arm is
      // missing". It was not: this arm predates the widening and passed then
      // too. Asserting only the positive half would leave that confusion in
      // place, so the negative half is asserted beside it — the same dash, the
      // same interpolation, written as a comment, must NOT be reported.
      const copy = 'const a = `${scope.phrase} ' + EM_DASH + ' ${scope.clause}.`'
      expect(offendersIn(copy), 'a dash in an interpolated product template is invisible').toEqual([
        ` ${EM_DASH} `,
      ])
      const comment = '// const a = `${scope.phrase} ' + EM_DASH + ' ${scope.clause}.`'
      expect(offendersIn(comment), 'a quoted template in a comment was treated as copy').toEqual([])
    })

    it('DISCRIMINATION: comments are excluded and copy is included, in BOTH directions', () => {
      // One direction alone is not enough: an extractor that returned nothing
      // would pass the comment cases, and one that returned raw source would
      // pass the literal case. Both are asserted so neither failure reads as
      // success. This is the pair that separates a historic record in a comment
      // from a sentence a user reads.
      expect(offendersIn(`// a dash ${EM_DASH} in prose`)).toEqual([])
      expect(offendersIn(`/* a dash ${EM_DASH} in prose */`)).toEqual([])
      expect(offendersIn(`/** JSDoc quoting "was withheld ${EM_DASH} rather than guessed" */\nconst a = 1`)).toEqual([])
      expect(offendersIn(`const a = 'a dash ${EM_DASH} in copy'`)).toEqual([`a dash ${EM_DASH} in copy`])
    })

    it('DISCRIMINATION: a `console.*` argument is excluded, the SAME sentence in copy is not', () => {
      // ⭐ The pair that stops the console arm becoming a hole. The identical
      // string is fed twice; only the call it sits in differs. If the exclusion
      // were written over the string's SHAPE rather than its position, both
      // would be dropped and the second assertion would red.
      const sentence = `[Strengthen] dispatchAction unregistered ${EM_DASH} degrading to sendMessage`
      expect(offendersIn(`console.warn('${sentence}')`), 'a DEV log line is being treated as copy').toEqual([])
      expect(offendersIn(`console.error('${sentence}')`)).toEqual([])
      expect(
        offendersIn(`const label = '${sentence}'`),
        'the console exclusion is swallowing ordinary copy',
      ).toEqual([sentence])
      // And it does not leak out of the call it belongs to.
      expect(offendersIn(`console.warn('x'); const b = 'after ${EM_DASH} the call'`)).toEqual([
        `after ${EM_DASH} the call`,
      ])
    })

    it('PRECONDITION: a file that fails to parse cannot report a clean sweep', () => {
      // `createSourceFile` is error-tolerant and returns a partial tree rather
      // than throwing, so a mangled file could yield zero literals and read as
      // green. The corpus-wide literal-count precondition below is what catches
      // that; this pins the reason it is there.
      expect(literals('const a = ')).toEqual([])
    })
  })

  describe('the derived scope', () => {
    it('PRECONDITION: every specifier resolved — an unresolved one shrinks the sweep silently', () => {
      // A resolver that drops what it cannot find returns the same clean output
      // as one that looked and found nothing. Hard error, never a skip.
      expect(UNRESOLVED_SPECS, `unresolved import specifiers:\n  ${UNRESOLVED_SPECS.join('\n  ')}`).toEqual([])
    })

    it('PRECONDITION: the walk reaches a real corpus, not a handful of files', () => {
      // 94 at the time of writing, against a hand-list of 2. The floor is well
      // below it: this guards against a walker that stopped, not against the
      // surface shrinking. ⚠ It is also why the walk needs its OWN guard: a
      // floor of 50 is satisfied by 93 and by 94 alike, so this assertion was
      // fully green while a direct dependency of the render root sat outside
      // the corpus. See `test/helpers/__tests__/reasoningTabCopyScope.spec.ts`,
      // which binds by file identity instead of by a count.
      expect(COVERED_FILES.length, 'the import walk collapsed').toBeGreaterThan(50)
    })

    it('POSITIVE CONTROL: the walk reaches the files we already know are copy', () => {
      for (const f of MUST_BE_IN_SCOPE) {
        expect(existsSync(resolve(process.cwd(), f)), `covered file is missing: ${f}`).toBe(true)
        expect(COVERED_FILES, `derivation no longer reaches ${f}`).toContain(f)
      }
    })

    it('CONTRAST CONTROL: it does NOT reach a different surface, or through a barrel', () => {
      // Without this, "every file under results/" would pass everything above.
      for (const f of MUST_NOT_BE_IN_SCOPE) {
        expect(COVERED_FILES, `walk is over-broad: it reached ${f}`).not.toContain(f)
      }
    })

    it('PRECONDITION: the scan reaches real copy — it is not reading empty files', () => {
      // Without this, an extractor that returned nothing would report a clean
      // sweep of nothing and this spec would pass forever (CLAUDE.md trap 13).
      const all = COVERED_FILES.flatMap(rel => literals(readFileSync(resolve(process.cwd(), rel), 'utf8'), rel))
      expect(all.length, 'the scan found no string literals at all').toBeGreaterThan(1000)
      // CONTRAST CONTROL, verified present rather than assumed.
      expect(all.some(s => /analysis/i.test(s)), 'the scan found no copy').toBe(true)
    })

    it('CONTRAST CONTROL: the corpus is dash-rich in PROSE, so a clean verdict is discrimination', () => {
      // ⭐ The strongest available control, and the one that separates "the
      // literals are clean" from "the probe is blind" (CLAUDE.md trap 13e). The
      // swept files' PROSE carries hundreds of em dashes. If the sweep below
      // returns near-empty because the instrument stopped seeing the character,
      // this assertion goes red first and names the reason.
      const dashes = COVERED_FILES.reduce(
        (n, rel) => n + (readFileSync(resolve(process.cwd(), rel), 'utf8').split(EM_DASH).length - 1),
        0,
      )
      expect(dashes, 'no em dash anywhere in the corpus: suspect the probe, not the copy').toBeGreaterThan(50)
    })
  })

  describe('the verdict', () => {
    const found = COVERED_FILES.flatMap(rel =>
      offendersIn(readFileSync(resolve(process.cwd(), rel), 'utf8'), rel).map(text => ({ file: rel, text })),
    )

    it('NO user-facing string carries an em dash, except the rows explicitly handed off', () => {
      const unexpected = found.filter(
        o => !HANDED_OFF.some(h => h.file === o.file && h.text === o.text),
      )
      expect(
        unexpected.map(o => `${o.file}: ${JSON.stringify(o.text)}`),
        'em dashes in rendered copy:\n  ' +
          unexpected.map(o => `${o.file}: ${JSON.stringify(o.text)}`).join('\n  ') +
          '\nSplit it into two sentences, or cut the clause. Do not add an exemption.',
      ).toEqual([])
    })

    it('and the HAND-OFF set is exactly as recorded — it reds if it grows OR shrinks', () => {
      // ⭐ The half that stops `HANDED_OFF` decaying into an ignore list. A row
      // whose defect has been fixed makes this red just as loudly as a new
      // offender does, so the list cannot outlive its reason.
      const stillPresent = HANDED_OFF.filter(h =>
        found.some(o => o.file === h.file && o.text === h.text),
      )
      expect(
        stillPresent.map(h => `${h.file}: ${JSON.stringify(h.text)}`),
        'a handed-off row no longer matches a live offender. If the owning seat fixed it, ' +
          'DELETE the row from HANDED_OFF:\n  ' +
          HANDED_OFF.map(h => `${h.file}: ${JSON.stringify(h.text)}\n    ${h.why}`).join('\n  '),
      ).toEqual(HANDED_OFF.map(h => `${h.file}: ${JSON.stringify(h.text)}`))
    })
  })
})

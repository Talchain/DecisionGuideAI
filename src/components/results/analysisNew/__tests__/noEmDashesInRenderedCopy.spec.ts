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
 * ── SCOPE, WIDENED 10 Sep 2026 — AND THE MEASUREMENT THAT JUSTIFIED IT ─────
 * This guard covered ONE file, `analysisNewCopy.ts`, and its own header said
 * widening was "a separate, measured piece of work". This is that work, and the
 * measurement is why the answer is yes.
 *
 * `humaniseCritique.ts` sits one directory away, renders into the same results
 * surface, and had accumulated **21 em-dash-bearing product strings** while
 * this guard watched its neighbour. It was never checked, so it drifted — the
 * same mechanism the "WHY A GUARD" section above describes, playing out in the
 * file next door. The one string cleared from it on 10 Sep was cleared
 * INCIDENTALLY, by a PR (#1466) fixing an unrelated over-claim, which is not a
 * mechanism.
 *
 * The original scope note was right that a guard wider than its evidence writes
 * a false all-clear. The evidence is now here: both covered files were scanned
 * with the parser below AND with an independent lexical state machine, and the
 * two instruments agreed exactly on every count.
 *
 * ── THE EXTRACTOR IS THE PARSER, NOT A REGEX (changed 10 Sep 2026) ─────────
 * ⭐ THE LOAD-BEARING CHANGE, and it is a correction, not a tidy-up.
 *
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
 * silently dropped. `import ts from 'typescript'` is already the established
 * pattern for guards in this repo, including two in this directory
 * (`staleReason.spec.ts`, `actionColourMeansPressable.spec.ts`).
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
 * ── AND THERE IS NO IGNORE LIST ────────────────────────────────────────────
 * Deliberately. An exemption list is the mirror one level up: the first
 * inconvenient sentence gets added to it and the guard stops meaning anything.
 * If a string genuinely needs a dash, that is a finding to raise, not a row to
 * append here.
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
 * The same division applies to the copy widened in on 10 Sep. Several of those
 * sentences carry a warning or a reassurance AFTER the dash ("Your results
 * stand", "the value is still used as you confirmed it", "anything downstream
 * of it may be unreliable"). Splitting must keep them. That obligation is
 * pinned by `humaniseCritique.criticalClausesSurvive.spec.ts`, not here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// cwd-relative, exactly as `noWinnerVocabulary.spec.ts`: `import.meta.url` is
// not a file: URL under this vitest config, and a spec that cannot read its
// subject reports a clean sweep of nothing.
const COVERED_FILES = [
  'src/components/results/analysisNew/analysisNewCopy.ts',
  'src/components/results/utils/humaniseCritique.ts',
] as const

const EM_DASH = '—'

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
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      out.push(n.text)
    } else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text)
      for (const span of n.templateSpans) out.push(span.literal.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** The whole pipeline, so a control exercises what the verdict exercises. */
const offendersIn = (raw: string): string[] => literals(raw).filter(s => s.includes(EM_DASH))

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
      // file CLEAN.
      expect(offendersIn(`const a = 'It didn\\'t run ${EM_DASH} your results stand.'`)).toEqual([
        `It didn't run ${EM_DASH} your results stand.`,
      ])
      expect(offendersIn(`const a = 'foo ${EM_DASH} bar\\'s baz'`)).toEqual([`foo ${EM_DASH} bar's baz`])
    })

    it('POSITIVE CONTROL: it sees a dash in an INTERPOLATED template span', () => {
      // The old regex excluded newlines and could not follow `${...}` at all,
      // so a dash in a template span was invisible. One of the 21 strings
      // widened in on 10 Sep is exactly this shape.
      // `offendersIn` filters to dash-bearing spans, so the empty template head
      // before `${label}` is correctly absent from the result.
      expect(offendersIn('const a = `${label} has no value ' + EM_DASH + ' add one.`')).toEqual([
        ` has no value ${EM_DASH} add one.`,
      ])
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

    it('PRECONDITION: a file that fails to parse cannot report a clean sweep', () => {
      // `createSourceFile` is error-tolerant and returns a partial tree rather
      // than throwing, so a mangled file could yield zero literals and read as
      // green. The per-file literal-count precondition below is what catches
      // that; this pins the reason it is there.
      expect(literals('const a = ')).toEqual([])
    })
  })

  describe.each(COVERED_FILES)('%s', rel => {
    const abs = resolve(process.cwd(), rel)

    it('PRECONDITION: the file exists and is where this guard thinks it is', () => {
      // A guard whose subject has been moved or renamed sweeps nothing and says
      // so cheerfully. Named explicitly so a rename reds here with the reason.
      expect(existsSync(abs), `covered file is missing: ${rel}`).toBe(true)
    })

    it('PRECONDITION: the scan reaches real copy, it is not reading an empty file', () => {
      // Without this, an extractor that returned nothing would report a clean
      // sweep of nothing and this spec would pass forever (CLAUDE.md trap 13).
      const strings = literals(readFileSync(abs, 'utf8'), rel)
      expect(strings.length, 'the scan found no string literals at all').toBeGreaterThan(100)
      // CONTRAST CONTROL, verified present rather than assumed: a word both
      // files' literals really do carry.
      expect(strings.some(s => /analysis/i.test(s)), 'the scan found no copy').toBe(true)
    })

    it('CONTRAST CONTROL: the file is dash-rich in PROSE, so a clean verdict is discrimination', () => {
      // ⭐ The strongest available control, and the one that separates "the
      // literals are clean" from "the probe is blind" (CLAUDE.md trap 13e).
      // Both covered files' PROSE carries well over fifty em dashes (163 and 84
      // as measured on 10 Sep). If the sweep below returns empty because the
      // instrument stopped seeing the character, this assertion goes red first
      // and names the reason.
      const raw = readFileSync(abs, 'utf8')
      expect(
        raw.split(EM_DASH).length - 1,
        'no em dash anywhere in the file: suspect the probe, not the copy',
      ).toBeGreaterThan(50)
    })

    it('NO user-facing string carries an em dash', () => {
      const offenders = offendersIn(readFileSync(abs, 'utf8'))
      expect(
        offenders,
        `em dashes in rendered copy (${rel}):\n  ${offenders.join('\n  ')}\n` +
          'Split it into two sentences, or cut the clause. Do not add an exemption.',
      ).toEqual([])
    })
  })
})

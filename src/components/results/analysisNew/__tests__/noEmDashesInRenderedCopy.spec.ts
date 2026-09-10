/**
 * NO EM DASHES IN THE REASONING TAB'S RENDERED COPY.
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
 * ── SCOPE, STATED ──────────────────────────────────────────────────────────
 * ONE FILE: `analysisNewCopy.ts`. Not the tab, not the directory. The tab runs
 * files it does not own and this guard makes no claim about them: `noWinner`'s
 * own header records that a directory sweep found 2 of 12 violations, and a
 * guard whose scope is wider than its evidence is how a false all-clear gets
 * written. Widening this is a separate, measured piece of work.
 *
 * ── COMMENTS ARE QUOTATION, NOT COPY ───────────────────────────────────────
 * Prose is blanked before the scan. This file's comments are dense with em
 * dashes and several of them QUOTE sentences the product once emitted on dated
 * builds. Those are records; rewriting them would falsify the history they hold
 * (CLAUDE.md trap 14b), and Paul's ruling is about product content.
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
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// cwd-relative, exactly as `noWinnerVocabulary.spec.ts`: `import.meta.url` is
// not a file: URL under this vitest config, and a spec that cannot read its
// subject reports a clean sweep of nothing.
const COPY_FILE = resolve(process.cwd(), 'src/components/results/analysisNew/analysisNewCopy.ts')

const EM_DASH = '—'

/** Blank comments so a dash in prose is never counted as copy. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')

/**
 * Every string literal in the source, comments already removed.
 *
 * ⚠ NO LENGTH CAP. `noWinnerVocabulary` shipped one at 120 characters and it
 * was a silent hole: a violation was reinstated at 126 and the guard stayed
 * green 10/10. The two dashes witnessed here sit in strings of 44 and 150
 * characters, so a cap in either direction would have missed one of them.
 */
function literals(src: string): string[] {
  const out: string[] = []
  const re = /'([^'\n\\]{2,})'|"([^"\n\\]{2,})"|`([^`\n\\]{2,})`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

/** The whole pipeline, so a control exercises what the verdict exercises. */
const offendersIn = (raw: string): string[] =>
  literals(stripComments(raw)).filter(s => s.includes(EM_DASH))

describe('the Reasoning tab renders no em dashes', () => {
  const raw = readFileSync(COPY_FILE, 'utf8')

  it('PRECONDITION: the scan reaches real copy, it is not reading an empty file', () => {
    // Without this, a stripper that blanked the file would report a clean sweep
    // of nothing and this spec would pass forever (CLAUDE.md trap 13).
    const strings = literals(stripComments(raw))
    expect(strings.length, 'the scan found no string literals at all').toBeGreaterThan(100)
    // CONTRAST CONTROL, verified present rather than assumed: a word this file's
    // literals really do carry.
    expect(strings.some(s => /analysis/i.test(s)), 'the scan found no copy').toBe(true)
  })

  it('POSITIVE CONTROL: the pipeline fires on a real em dash in a real literal', () => {
    // ⭐ THE LOAD-BEARING CONTROL. The verdict below is an ABSENCE claim, and an
    // absence claim is worth nothing until the probe has been shown detecting a
    // PRESENCE. Fed through `offendersIn` rather than tested against the
    // matcher alone, so a break anywhere in strip -> extract -> detect reds here
    // instead of quietly manufacturing a clean sweep.
    const fabricated = `const a = 'Sent to Olumi ${EM_DASH} the shared model updates when it answers.'`
    expect(offendersIn(fabricated), 'the guard cannot see a dash it was written to catch').toEqual([
      `Sent to Olumi ${EM_DASH} the shared model updates when it answers.`,
    ])
  })

  it('PRECONDITION: the stripper works in BOTH directions', () => {
    // One direction alone is not enough: a stripper that blanks everything
    // passes the comment case, and one that blanks nothing passes the literal
    // case. Both are asserted so neither failure reads as success.
    expect(stripComments(`// a dash ${EM_DASH} in prose`)).not.toContain(EM_DASH)
    expect(stripComments(`/* a dash ${EM_DASH} in prose */`)).not.toContain(EM_DASH)
    expect(stripComments(`const a = 'a dash ${EM_DASH} in copy'`)).toContain(EM_DASH)
  })

  it('CONTRAST CONTROL: the file itself is dash-rich, so a clean verdict is discrimination', () => {
    // ⭐ The strongest available control, and the one that separates "the
    // literals are clean" from "the probe is blind" (CLAUDE.md trap 13e). This
    // file's PROSE carries well over a hundred em dashes. If the sweep below
    // returns empty because the instrument stopped seeing the character, this
    // assertion goes red first and names the reason.
    expect(raw.split(EM_DASH).length - 1, 'no em dash anywhere in the file: suspect the probe').toBeGreaterThan(50)
  })

  it('NO user-facing string carries an em dash', () => {
    const offenders = offendersIn(raw)
    expect(
      offenders,
      `em dashes in rendered copy:\n  ${offenders.join('\n  ')}\n` +
        'Split it into two sentences, or cut the clause. Do not add an exemption.',
    ).toEqual([])
  })

})

/**
 * EVERY reader of the comparative position must carry the compute-status gate.
 *
 * ## Why this is a DERIVED SCAN and not a list of three tests
 *
 * The review that produced this file found a THIRD reader of the comparative
 * position rendering on a failed option, after two had been gated and after the
 * PR's own comment said there were two. The lesson is not "there were three".
 * It is that the question is a PREDICATE DOMAIN — "which expressions on this
 * card place the option relative to the others" — and a hand-written list of
 * them is the hand-maintained mirror this estate keeps paying for (CLAUDE.md
 * trap 12). A fourth reader added next month would be invisible to a spec that
 * names the three.
 *
 * So this derives the set from the source: any `useMemo` on the option card
 * whose body reads `option_probabilities` or the shared verdict's leader
 * identity is a reader, and must reference the compute-status authority —
 * either the flag directly or `winRate`, the field the hook leaves `null` on
 * the same branch.
 *
 * ## What it does NOT claim
 *
 * It does not claim the gate is correctly PLACED (a reference could sit in a
 * dead branch), and it says nothing about what a user SEES — jsdom applies no
 * stylesheet and this file reads text, not pixels. It is a drift alarm on the
 * one property that went wrong: a reader arriving with no gate at all. The
 * behaviour itself is pinned by `OptionNode.notComputed.spec.tsx` and
 * `BaseNode.lodOptionStanding.spec.tsx`, which render through the real hook.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../OptionNode.tsx'), 'utf8')

/** Strip comments: the prose necessarily QUOTES the shapes it forbids. */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/**
 * Split the component into `useMemo` blocks, keyed by the const they bind.
 * Crude on purpose: the next `const <name> = useMemo` is the terminator, which
 * cannot miss a block and can only ever make a block too LONG — an error in the
 * direction of a false PASS being harder, not easier, to obtain.
 */
function memoBlocks(source: string): Array<{ name: string; body: string }> {
  const starts: Array<{ name: string; index: number }> = []
  const re = /\n\s*const (\w+) = (?:React\.)?useMemo/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) starts.push({ name: m[1], index: m.index })
  return starts.map((s, i) => ({
    name: s.name,
    // ⚠ DEPENDENCY ARRAYS REMOVED, AND THIS IS LOAD-BEARING — the guard did not
    // work until they were. `}, [..., displayMetadata.winComputationFailed])`
    // names the flag without gating on it, so a block whose `if` was deleted
    // still matched `CARRIES_GATE` through its own dep array and the scan
    // reported every reader gated no matter what the code did. The
    // gate-removal control below is the only thing that caught it: it could not
    // turn the manifest red, which is a guard agreeing with itself (CLAUDE.md
    // trap 13b). Keep that control — it is what pins this line.
    body: source
      .slice(s.index, starts[i + 1]?.index ?? source.length)
      .replace(/\}\s*,\s*\[[^\]]*\]\s*\)/g, '}'),
  }))
}

/** Places this option relative to the others, or reads the share it is placed by. */
const READS_COMPARATIVE = /option_probabilities|verdict\.(leaderId|hasLeadingOption)/
/** The one authority on "was anything measured for this option". */
const CARRIES_GATE = /winComputationFailed|displayMetadata\.winRate/

const readers = () =>
  memoBlocks(stripComments(SRC)).filter(b => READS_COMPARATIVE.test(b.body))

describe('OptionNode — the comparative-position reader manifest', () => {
  it('the scan can see the file at all', () => {
    // Trap 13: an absence assertion is vacuous until the instrument is shown
    // capable of a presence. A mis-resolved path or a failed read would make
    // every assertion below pass by measuring nothing.
    expect(SRC.length).toBeGreaterThan(10_000)
    expect(memoBlocks(stripComments(SRC)).length).toBeGreaterThan(10)
  })

  it('finds a plural set of readers — a scan that matched one would prove little', () => {
    // Deliberately a floor and not an equality: pinning the exact count would
    // make every legitimate new reader a red, which trains lanes to bump the
    // number. The property below is what must hold, whatever the count.
    expect(readers().length).toBeGreaterThanOrEqual(3)
  })

  it('⭐ EVERY reader carries the compute-status gate', () => {
    const ungated = readers().filter(b => !CARRIES_GATE.test(b.body)).map(b => b.name)
    expect(
      ungated,
      `these read the comparative position with no compute-status gate: ${ungated.join(', ')}. ` +
        'A failed option arrives with a finite `win_probability: 0` that passes every ' +
        '`typeof === "number"` test, so an ungated reader renders a comparative claim ' +
        'about an option nothing was measured for.',
    ).toEqual([])
  })

  it('POSITIVE CONTROL: an ungated reader IS detected', () => {
    // Without this, `readers()` silently returning `[]` — a regex that stopped
    // matching, a memo syntax the splitter does not recognise — would make the
    // assertion above pass while observing nothing at all.
    //
    // ⚠ ASSERTED AS A DELTA, NOT AS AN EXACT SET. It first read
    // `toEqual(['smugglethis'])`, which silently also asserted that every OTHER
    // reader in the file was gated — so a mutant that ungated `behindReason`
    // reddened this control as well as the assertion above, and a control that
    // fails for reasons other than the one it names cannot tell you which
    // property broke. It now discriminates on the injected block alone.
    const ungatedNames = (s: string) =>
      memoBlocks(stripComments(s))
        .filter(b => READS_COMPARATIVE.test(b.body))
        .filter(b => !CARRIES_GATE.test(b.body))
        .map(b => b.name)
    const injected = `${SRC}\n  const smugglethis = useMemo(() => {\n    return resultsReport?.option_probabilities\n  }, [resultsReport])\n`
    expect(ungatedNames(SRC)).not.toContain('smugglethis')
    expect(ungatedNames(injected)).toContain('smugglethis')
  })

  it('POSITIVE CONTROL: removing a real gate turns the manifest red', () => {
    // Discriminates the other way: proves the assertion is sensitive to the
    // gates that are actually there, not merely to an invented block. Mutating
    // the string rather than the file keeps this inside the test (CLAUDE.md 9g
    // — a mutation that reaches the source tree is the worst instrument
    // failure available).
    const mutated = SRC.replace(
      /if \(displayMetadata\.winComputationFailed === true\) return null/g,
      'if (false) return null',
    )
    expect(mutated, 'the mutation matched nothing — an unapplied mutant is not a survivor').not.toBe(SRC)
    const ungated = memoBlocks(stripComments(mutated))
      .filter(b => READS_COMPARATIVE.test(b.body))
      .filter(b => !CARRIES_GATE.test(b.body))
    expect(ungated.length).toBeGreaterThan(0)
  })

  it('no comment states a gate COUNT — the count is what went stale', () => {
    // The finding, exactly: this file gated two readers, said in a comment that
    // "both gate on the one flag", and a third was rendering `Behind:` on the
    // failed option's own card beside its "Not computed" disclosure. The code
    // was then fixed and THIS SENTENCE WAS NOT — so the file shipped a review
    // finding's own quoted evidence, still true of the prose and no longer true
    // of the code.
    //
    // The fix is not to write "three". A count in a comment is a
    // hand-maintained mirror of a set that grows, and the next reader makes it
    // false again. It is to say what is invariant — that each reader gates —
    // and let this scan be the thing that counts.
    const comments = SRC.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm)?.join('\n') ?? ''
    expect(comments.length, 'comment extraction found nothing to assert against').toBeGreaterThan(1_000)
    expect(comments).not.toMatch(/\bboth gate\b/i)
    expect(comments).not.toMatch(/\b(two|three|four) readers? (of [^.]{0,40})?gate\b/i)
  })
})

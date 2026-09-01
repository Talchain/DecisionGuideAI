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
 * ⚠ KNOWN LIMIT, NAMED RATHER THAN IMPLIED: gating is checked PER BLOCK, so a
 * memo with several arms where only ONE carries the gate reads as gated. That
 * is inherent to block-level gating, not an oversight — tightening the bound to
 * the nearest nested block would red the legitimate shape this file actually
 * uses, where the gate is an early `return null` governing everything after it.
 * The manifest is a drift alarm on a reader arriving with NO gate anywhere, and
 * that is the whole of its claim.
 *
 * It does not claim the gate is correctly PLACED (a reference could sit in a
 * dead branch), and it says nothing about what a user SEES — jsdom applies no
 * stylesheet and this file reads text, not pixels. It is a drift alarm on the
 * one property that went wrong: a reader arriving with no gate at all. The
 * behaviour itself is pinned by `OptionNode.notComputed.spec.tsx`, which
 * renders all three memo readers through the real hook, and — for the low-zoom
 * arm — by `lodMetricLine.spec.ts`.
 *
 * ⚠ THIS SENTENCE PREVIOUSLY NAMED A THIRD SPEC THAT DOES NOT EXIST HERE, and
 * the way it got here is the whole point of this file. `BaseNode.lodOptionStanding.spec.tsx`
 * was created by `69e41a1c`; this guard was written directly on top of it, so
 * the reference was TRUE ON THE BRANCH IT WAS WRITTEN ON. The salvage onto
 * staging correctly declined to bring `69e41a1c` across (its low-zoom work is
 * superseded by `resolveLodMetricLine`) — and carried the prose anyway. A claim
 * true where it was written and false where it landed, reproduced by a
 * cherry-pick, in the header of the guard whose subject is exactly that.
 * Prose does not travel with a commit's guarantees; re-verify every reference
 * a salvage brings across, against the head it lands on.
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
 *
 * ⚠ THE TERMINATOR IS THE MEMO'S OWN DEPENDENCY-ARRAY CLOSE, NOT THE NEXT MEMO,
 * AND THE COMMENT HERE PREVIOUSLY HAD THE DIRECTION OF THE ERROR BACKWARDS. It
 * said a too-LONG block made a false PASS "harder, not easier". The opposite is
 * true: `CARRIES_GATE` is satisfied by a gate ANYWHERE in the block, so every
 * extra line a block absorbs can only supply more gates. Terminating on the
 * next memo made the LAST block run to end-of-file — swallowing the entire
 * ~430-line JSX render, which is precisely where a comparative claim is most
 * likely to be written. An ungated reader placed there was absorbed by
 * `winReadout` and reported as gated. Demonstrated by review, and now pinned by
 * *an ungated reader in the RENDER is detected* below.
 *
 * So blocks end at their own `}, [deps])`. That bounds a memo to its own body,
 * and everything OUTSIDE a memo body — the inter-memo gaps and the JSX render —
 * is scanned by `outsideMemoReaders`, per expression container, because one
 * region checked as a whole would reproduce the same absorption at a larger
 * scale.
 */
function memoBlocks(source: string): Array<{ name: string; body: string }> {
  return memoSpans(source).map(sp => ({
    name: sp.name,
    // ⚠ DEPENDENCY ARRAYS REMOVED, AND THIS IS LOAD-BEARING — the guard did not
    // work until they were. `}, [..., displayMetadata.winComputationFailed])`
    // names the flag without gating on it, so a block whose `if` was deleted
    // still matched `CARRIES_GATE` through its own dep array and the scan
    // reported every reader gated no matter what the code did. The
    // gate-removal control below is the only thing that caught it: it could not
    // turn the manifest red, which is a guard agreeing with itself (CLAUDE.md
    // trap 13b). Keep that control — it is what pins this line.
    body: source.slice(sp.start, sp.end).replace(/\}\s*,\s*\[[^\]]*\]\s*\)/g, '}'),
  }))
}

/** Where a `useMemo` actually ends: its own dependency-array close. Falls back
 *  to the next memo start, so this can only ever SHORTEN a block — never
 *  lengthen one past where it used to end. */
function memoEnd(source: string, start: number, nextStart: number): number {
  const depClose = /\}\s*,\s*\[[^\]]*\]\s*\)/g
  depClose.lastIndex = start
  const m = depClose.exec(source)
  const end = m ? m.index + m[0].length : nextStart
  return Math.min(end, nextStart)
}

/** The balanced `{...}` enclosing `idx` — a JSX expression container in the
 *  render. Bounding each reader by its OWN container is what stops the render
 *  becoming one big region in which any single gate satisfies every reader. */
function enclosingBraces(s: string, idx: number): { start: number; end: number } {
  let depth = 0
  let start = -1
  for (let i = idx; i >= 0; i--) {
    if (s[i] === '}') depth++
    else if (s[i] === '{') {
      if (depth === 0) { start = i; break }
      depth--
    }
  }
  if (start < 0) return { start: 0, end: s.length }
  depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return { start, end: i + 1 }
    }
  }
  return { start, end: s.length }
}

/**
 * Comparative readers living OUTSIDE any memo body — the inter-memo gaps AND
 * the JSX render. Each is bounded by its own `{...}` expression container.
 *
 * ⚠ THIS WAS `renderReaders`, WHICH SCANNED ONLY AFTER THE LAST MEMO — so
 * bounding the blocks correctly left the ~10k characters BETWEEN memos scanned
 * by nothing at all. Closing one blind region opened a smaller one, which is
 * the shape of the defect this whole file is about. Scanning the COMPLEMENT of
 * the memo bodies has no gap by construction: every character is either inside
 * a bounded memo or inside a bounded container here.
 */
function outsideMemoReaders(source: string): Array<{ name: string; body: string }> {
  const spans = memoSpans(source)
  const covered = (i: number) => spans.some(sp => i >= sp.start && i < sp.end)
  const out: Array<{ name: string; body: string }> = []
  const seen = new Set<number>()
  const scan = new RegExp(READS_COMPARATIVE.source, 'g')
  let r: RegExpExecArray | null
  while ((r = scan.exec(source)) !== null) {
    if (covered(r.index)) continue
    const { start, end } = enclosingBraces(source, r.index)
    if (seen.has(start)) continue
    seen.add(start)
    out.push({ name: `outside:${source.slice(0, start).split('\n').length}`, body: source.slice(start, end) })
  }
  return out
}

/** The [start, end) span of every memo, shared by the splitter and the
 *  complement scan so the two cannot disagree about what "inside a memo" means
 *  (CLAUDE.md trap 12 — two copies of one boundary is how they drift). */
function memoSpans(source: string): Array<{ name: string; start: number; end: number }> {
  const starts: Array<{ name: string; index: number }> = []
  const re = /\n\s*const (\w+) = (?:React\.)?useMemo/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) starts.push({ name: m[1], index: m.index })
  return starts.map((st, i) => ({
    name: st.name,
    start: st.index,
    end: memoEnd(source, st.index, starts[i + 1]?.index ?? source.length),
  }))
}

/** Places this option relative to the others, or reads the share it is placed by. */
const READS_COMPARATIVE = /option_probabilities|verdict\.(leaderId|hasLeadingOption)/
/** The one authority on "was anything measured for this option". */
const CARRIES_GATE = /winComputationFailed|displayMetadata\.winRate/

const readersIn = (src: string) =>
  [...memoBlocks(stripComments(src)), ...outsideMemoReaders(stripComments(src))]
    .filter(b => READS_COMPARATIVE.test(b.body))

const readers = () => readersIn(SRC)

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

  it('the four known readers are each still FOUND — a count cannot notice one vanishing', () => {
    // ⚠ A FLOOR CANNOT SEE A READER DISAPPEAR. Review demonstrated the route:
    // an array literal placed before a comparative read truncates its block at
    // the `}, [...])` regex, the read vanishes with the truncation, the manifest
    // drops 4 → 3, and `>= 3` still passes — a false PASS, not a false positive.
    // The same hole swallows a reader converted from `useMemo` to a plain
    // function. Binding to the NAMES closes both, because a name is an identity
    // and a count is a value another arrangement can satisfy (CLAUDE.md trap 19).
    //
    // `arrayContaining`, NOT equality — a new legitimate reader must not red
    // this, or it becomes the number-bumping ritual the floor above avoids.
    expect(readers().map(b => b.name)).toEqual(
      expect.arrayContaining(['isRecommended', 'closeCallGapPp', 'goalDecision', 'behindReason']),
    )
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

  it('POSITIVE CONTROL: an ungated reader in the RENDER is detected — with its gated twin', () => {
    // ⚠ THIS IS THE CONTROL THE GUARD SHIPPED WITHOUT, AND THE HOLE IT LEFT WAS
    // THE WHOLE RENDER. Blocks used to terminate on the next memo, so the last
    // one ran to end-of-file and absorbed the ~430-line JSX body. `CARRIES_GATE`
    // is satisfied by a gate ANYWHERE in a block, so an ungated comparative
    // claim written in the render was swallowed by `winReadout`'s gate and
    // reported as gated — a false PASS in the one region where such a claim is
    // most likely to be written.
    //
    // Both directions, because a scan that flagged everything in the render
    // would be just as useless as one that flagged nothing (CLAUDE.md 22b — a
    // corpus that tests one direction is a guard watching one door).
    const ungatedInRender = `${SRC}\n      {resultsReport?.option_probabilities ? <span>Ahead</span> : null}\n`
    const gatedInRender = `${SRC}\n      {displayMetadata.winComputationFailed !== true && resultsReport?.option_probabilities ? <span>Ahead</span> : null}\n`

    // ⚠ SCOPED TO THE RENDER, DELIBERATELY. An unscoped `readersIn` here reddens
    // this control whenever a MEMO gate is removed — so it would fail for a
    // reason other than the one it names, and could not tell you which property
    // broke. That is the same correction the memo control above already carries;
    // it was re-learned here, measured (gate mutants REDded 2 tests, not 1).
    const ungatedNames = (src: string) =>
      readersIn(src)
        .filter(b => b.name.startsWith('outside:'))
        .filter(b => !CARRIES_GATE.test(b.body))
        .map(b => b.name)

    // pristine: nothing in the render is ungated today
    expect(ungatedNames(SRC)).toEqual([])
    // the injected ungated reader IS seen
    expect(
      ungatedNames(ungatedInRender).length,
      'an ungated comparative reader in the JSX render was not detected — the ' +
        'render is being absorbed into a memo block again',
    ).toBeGreaterThan(0)
    // ...and its gated twin is NOT flagged, so the scan discriminates on the
    // gate rather than merely on being in the render
    expect(ungatedNames(gatedInRender)).toEqual([])
  })

  it('memo blocks are bounded by their own deps — the last one does not run to EOF', () => {
    // Pins the mechanism the control above depends on. If a refactor restores
    // next-memo termination, the last block swallows the render again and the
    // control turns into a tautology (CLAUDE.md 13b — a guard whose
    // discrimination rests on something nothing pins).
    const blocks = memoBlocks(stripComments(SRC))
    const last = blocks[blocks.length - 1]
    expect(blocks.length).toBeGreaterThan(10)
    expect(
      last.body.length,
      `the last memo block is ${last.body.length} chars — it is absorbing the render`,
    ).toBeLessThan(4_000)
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

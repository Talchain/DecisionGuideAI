/**
 * ⭐⭐⭐ A BAR WITH NO COLOUR IS THE UI GRADING A PRODUCER'S NUMBER.
 *
 * `DataBar` falls back to `evaluativeToken` when `colour`/`colourVar` is
 * omitted — `>= 70` green, `>= 40` amber, else **red** (`src/styles/evaluative.ts`).
 * Those cutoffs are ours. Applying them to a producer figure tells the reader
 * that 39% is danger and 41% merely a warning, which is a verdict the producer
 * never issued — the same defect as inventing a threshold in words, and harder
 * to notice because it is carried in colour.
 *
 * ## Why this is a GUARD and not just two fixed call sites
 *
 * The identical `0.7 / 0.4` bands were removed from `GoalNode`'s constraint
 * badges on 15 Sep — and the SAME probability was still being graded by an
 * uncoloured bar on two sibling surfaces, because that removal was scoped to
 * the instance in front of it. *The remedy is scoped to the instance and
 * nothing sweeps its siblings* is this estate's named cause of recurrence, so
 * the sweep is mechanical from here.
 *
 * ⚠ THIS DOES NOT BAN THE EVALUATIVE PALETTE. It bans taking it BY DEFAULT. A
 * surface that genuinely means "this value is good or bad" may still say
 * `colour="success"` — it just has to say so, in the diff, where a reviewer can
 * see the claim being made.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')
const SCOPE = ['src/canvas', 'src/components']

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === '__fixtures__' || e === 'node_modules') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(e) && !/\.spec\.|\.stories\./.test(e)) out.push(p)
  }
  return out
}

/**
 * Strip comments before scanning — the same discipline
 * `baselineVocabulary.canvas.spec` records: *"A guard that reds on an
 * explanatory comment is a guard people learn to work around"*, and this one
 * REDed on `DataBar`'s own `@example` docstring on its first run. The ruling is
 * about what the product RENDERS, not how the source describes itself.
 * Line numbers are preserved so a real hit still points at the right line.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

/** Each `<DataBar …>` element's opening tag, with its line. */
function dataBarTags(rawSrc: string): Array<{ line: number; tag: string }> {
  const src = stripComments(rawSrc)
  const out: Array<{ line: number; tag: string }> = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    /**
     * ⚠ A TAG BOUNDARY, NOT A SUBSTRING. `includes('<DataBar')` matched
     * `Record<DataBarColour, string>` — a TYPE PARAMETER, not an element — and
     * reported the component's own file as an offender. "Is a substring of" is
     * not "is this thing".
     */
    if (!/<DataBar(\s|\/|>|$)/.test(lines[i])) continue
    // Accumulate until the tag closes — a call may span many lines.
    let tag = ''
    for (let j = i; j < Math.min(i + 14, lines.length); j++) {
      tag += lines[j] + '\n'
      if (/\/>|>\s*$/.test(lines[j]) && j > i) break
      if (j === i && /\/>/.test(lines[j])) break
    }
    out.push({ line: i + 1, tag })
  }
  return out
}

const files = SCOPE.flatMap((d) => walk(path.join(ROOT, d)))
const tags = files.flatMap((f) =>
  dataBarTags(readFileSync(f, 'utf8')).map((t) => ({ ...t, file: path.relative(ROOT, f) })),
)

describe('a bar states magnitude; it does not grade the number', () => {
  it('the sweep actually finds bars (positive control)', () => {
    // An empty sweep satisfies the absence assertion below (trap 13).
    expect(files.length).toBeGreaterThan(50)
    /**
     * ⚠ THE FLOOR IS MEASURED, NOT GUESSED, AND IT CAUGHT TWO BLIND SPOTS.
     * The render population at the time of writing is FOUR: OutcomePanel,
     * GoalNode, GoalConstraintsSection and GoalPanel. A first cut guessed "> 5"
     * from a `git grep` that had counted test files and type parameters; a
     * second matched `<DataBar[\s/>]` and missed GoalPanel entirely, because
     * its tag sits ALONE AT THE END OF A LINE with nothing after it. Both were
     * caught here rather than by inspection.
     */
    expect(tags.length, 'no <DataBar> found — the sweep is blind').toBeGreaterThanOrEqual(4)
  })

  it('⭐ no render surface takes the evaluative palette BY DEFAULT', () => {
    const uncoloured = tags
      .filter((t) => !/colour=|colourVar=/.test(t.tag))
      .map((t) => `${t.file}:${t.line}`)
    expect(
      uncoloured,
      'a <DataBar> with no colour is graded >= 70 green / >= 40 amber / else RED by ' +
        '`evaluativeToken` — cutoffs the producer never gave us. Pass an explicit ' +
        'colour (e.g. colour="info") to state magnitude, or an evaluative one ' +
        'deliberately so the claim is visible in the diff.',
    ).toEqual([])
  })

  /**
   * ⛔ THE DISCRIMINATING HALF. Without it, a predicate that matched nothing —
   * a typo in the attribute name, a regex that never fires — would satisfy the
   * assertion above and the guard would be decorative.
   */
  it('⛔ CONTRAST: the predicate FIRES on a bar with no colour', () => {
    const sample = `<DataBar value={prob} label="x" size="standard" />`
    expect(/colour=|colourVar=/.test(sample)).toBe(false)
    const coloured = `<DataBar value={prob} label="x" colour="info" />`
    expect(/colour=|colourVar=/.test(coloured)).toBe(true)
    // ⛔ And the tag boundary discriminates a type parameter from an element.
    const TAG = /<DataBar(\s|\/|>|$)/
    expect(TAG.test('const C: Record<DataBarColour, string> = {')).toBe(false)
    expect(TAG.test('<DataBar value={1} />')).toBe(true)
    // ⛔ And the end-of-line form, which a first cut missed entirely.
    expect(TAG.test('                          <DataBar')).toBe(true)
  })
})

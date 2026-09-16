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
/**
 * ⚠ THE HELPERS ARE DERIVED FROM A WIDER TREE THAN THE RENDER SURFACES ARE
 * SCANNED IN, DELIBERATELY. The one this guard missed lives in `src/types/`,
 * which no render-surface sweep would ever have reached.
 */
const HELPER_SCOPE = ['src/types', 'src/styles', 'src/utils', 'src/canvas', 'src/components']

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

/**
 * ⭐⭐⭐ THE SECOND HALF, AND THE REASON IT EXISTS: THIS GUARD WATCHED THE
 * CARRIER, NOT THE BEHAVIOUR.
 *
 * #1593 de-graded two `DataBar`s. **Four lines from one of them**, the
 * percentage beside the bar was still coloured by `constraintConfidenceColour`
 * — `text-success` at >= 0.70, `text-info` at >= 0.40, `text-danger` below.
 * The identical verdict, one channel over, on the same row, and this file went
 * green over it because the offending call is not a `<DataBar>` at all.
 *
 * ⛔ AND IT COULD NOT HAVE BEEN FOUND BY WIDENING THE `<DataBar>` SEARCH. The
 * helper is defined in `src/types/constraints.ts` — outside every render-surface
 * sweep in this repo, including the `uiRendersItDoesNotDecide` scanner's four
 * roots. *A verdict authored in a helper and applied at a render site is
 * invisible to a scan of either one alone.*
 *
 * So the helper set is DERIVED rather than listed: any function that both
 * compares against a number and returns an evaluative colour token is a grading
 * helper. A hand-written list of names is the mirror this estate keeps paying
 * for, and it would have had to be updated by the same person who did not notice
 * the call in the first place.
 *
 * ⛔⛔ BUT IT IS NOT "WHEREVER IT LIVES", AND THAT SENTENCE STOOD HERE UNTIL
 * 16 Sep 2026. An independent review MEASURED the derivation's actual reach and
 * the claim is false in two ways at once:
 *
 *   · SCOPE — `HELPER_SCOPE` is FIVE of the 34 directories under `src/`, and at
 *     this tip the derived set resolves to EXACTLY TWO helpers
 *     (`constraintConfidenceColour`, `getThresholdColour`).
 *   · SHAPE — the matcher needs a bare string-literal return, a body under
 *     1200 chars and no JSX. **A classifier that returns an OBJECT is invisible
 *     to it**, whatever directory it sits in.
 *
 * ⛔ A LIVE COUNTEREXAMPLE INSIDE THE SWEPT DIRECTORIES:
 * `src/lib/stability.ts`'s `getStabilityClassification()` bands a raw number at
 * `>= 0.85 / 0.70 / 0.40` and returns `text-success` / `text-warning` /
 * `text-danger`; `GoalNode.tsx:314` turns it into `stabilityBarColour`, which
 * reaches `<DataBar colour={...}>` at **`GoalNode.tsx:585`**. `robustnessData.level`
 * is nullable, so when the producer sends no level **the UI's own band decides
 * the colour** — the exact defect class this file exists to prevent.
 *
 * ⚠ AND WIDENING THE SCOPE DOES NOT CATCH IT — measured, not assumed. Adding
 * `src/lib` and `src/adapters` to `HELPER_SCOPE` left this sweep GREEN, because
 * the blindness is the SHAPE test, not the directory list.
 *
 * ⭐ WHY THIS SENTENCE MATTERED MORE THAN THE CODE. The production change here
 * is sound and was verified by mutation. What was dangerous was the claim: the
 * next session reads "wherever it lives", believes the class is closed, and
 * stops looking. An overclaim about our own verification is the most expensive
 * kind this estate produces, and it is corrected here rather than quietly.
 *
 * KNOWN UNCOVERED, recorded rather than implied:
 *   `getStabilityClassification` (`src/lib/stability.ts`) → `GoalNode.tsx:585`.
 *   ⚠ Its reachability ON THE WIRE is NOT established — the code path is live
 *   and `level` is nullable, but the producer's output domain was not derived,
 *   so this is "uncovered by the guard", not "confirmed firing for a user".
 */
const EVALUATIVE_TOKEN = /(text|bg|border)-(success|warning|danger)/
const COMPARISON = /[<>]=?[^=]/

/**
 * ⚠ THE FIRST CUT OF THIS DERIVATION WAS USELESS BECAUSE IT WAS TOO SENSITIVE,
 * and that is worth recording rather than quietly fixing. It took "the body" to
 * be everything up to the next `\n}`, which in a `.tsx` file swallows an entire
 * component — so it named `InspectorPanel()`, `ShareDrawer()` and eleven other
 * whole components as grading helpers, because somewhere inside each there is a
 * number compared and somewhere else an evaluative class. A guard that reds on
 * the whole repo is a guard that gets deleted.
 *
 * A grading helper has a narrow shape and the shape is what identifies it:
 * it RETURNS A BARE COLOUR STRING, it BRANCHES ON A COMPARISON, and it renders
 * nothing. So the body is brace-matched, JSX disqualifies it, and the returned
 * value must be a string literal carrying an evaluative token.
 */
function bodyOf(src: string, from: number): string {
  const open = src.indexOf('{', from)
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < src.length && i < open + 4000; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1) }
  }
  return ''
}

function gradingHelpersInSource(rawSrc: string): string[] {
  const src = stripComments(rawSrc)
  const out: string[] = []
  const re = /export\s+(?:function|const)\s+([A-Za-z_$][\w$]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const body = bodyOf(src, m.index)
    if (!body || body.length > 1200) continue
    if (/<\/|\/>/.test(body)) continue // renders JSX — a component, not a lookup
    // ⚠ ONE SPELLING OF THE TOKEN. The inlined duplicate of this pattern was
    // caught by the typecheck gate as an unused `EVALUATIVE_TOKEN` — which is
    // the mirror defect arriving as a lint error rather than as a drift.
    const returned = body.match(/return\s+[`'"][^`'"]*/g) ?? []
    const returnsAToken = returned.some((r) => EVALUATIVE_TOKEN.test(r))
    if (returnsAToken && COMPARISON.test(body)) out.push(m[1])
  }
  return out
}

const gradingHelpersIn = (file: string) => gradingHelpersInSource(readFileSync(file, 'utf8'))

const helperFiles = HELPER_SCOPE.flatMap((d) => walk(path.join(ROOT, d)))
const GRADING_HELPERS = [...new Set(helperFiles.flatMap(gradingHelpersIn))]

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

/**
 * ⭐ A VERDICT IN COLOUR DOES NOT NEED A `DataBar` TO BE A VERDICT.
 */
describe('no canvas surface colours a number by a band it computed', () => {
  it('the derivation actually finds grading helpers (positive control)', () => {
    // A derivation that finds nothing satisfies every absence assertion below.
    expect(helperFiles.length).toBeGreaterThan(50)
    expect(
      GRADING_HELPERS,
      'no grading helper derived — the derivation is blind, so the sweep below proves nothing',
    ).not.toEqual([])
    // ⭐ AND IT MUST FIND THE ONE THAT ACTUALLY HID. Naming it pins the
    // derivation to a case known to be real, so a regex that quietly stops
    // matching reds here rather than passing silently.
    expect(GRADING_HELPERS).toContain('constraintConfidenceColour')
  })

  /**
   * ⛔ THE CONTRAST PAIR, ON THE DERIVATION ITSELF. A set that matched every
   * exported function would satisfy the positive control above and make the
   * sweep below unusable — which is exactly what the first cut did, naming
   * thirteen whole React components as grading helpers.
   */
  it('⛔ CONTRAST: it takes the grader and leaves its neighbours', () => {
    const grader = `export function byBand(p: number) {
      if (p >= 0.7) return 'text-success'
      return 'text-danger'
    }`
    // Selected by IDENTITY, not by a number — the sanctioned shape, and the one
    // the founder's ruling explicitly permits.
    const byIdentity = `export function byKind(kind: string) {
      return kind === 'risk' ? 'text-danger' : 'text-success'
    }`
    // A component that happens to contain both a comparison and a token.
    const component = `export function Panel({ n }: { n: number }) {
      return <div className={n > 3 ? 'text-danger' : ''} />
    }`
    expect(gradingHelpersInSource(grader)).toEqual(['byBand'])
    expect(gradingHelpersInSource(byIdentity)).toEqual([])
    expect(gradingHelpersInSource(component)).toEqual([])
  })

  it('⭐ no canvas render surface applies a grading helper', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (!f.includes(`${path.sep}canvas${path.sep}`)) continue
      const src = stripComments(readFileSync(f, 'utf8'))
      for (const h of GRADING_HELPERS) {
        // A call, not a mention: `name(` at a word boundary. "Is a substring
        // of" is not "is this thing" — the mistake this file already made once.
        if (new RegExp(`\\b${h}\\s*\\(`).test(src)) {
          offenders.push(`${path.relative(ROOT, f)} → ${h}()`)
        }
      }
    }
    expect(
      offenders,
      'a canvas surface is colouring a value by a band it computed. The producer ' +
        'did not issue that verdict. Render the magnitude in the body colour, or ' +
        'take an evaluative colour deliberately and explicitly so the claim is ' +
        'visible in the diff.',
    ).toEqual([])
  })
})

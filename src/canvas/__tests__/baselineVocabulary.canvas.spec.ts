/**
 * ONE WORD FOR THE STATUS-QUO OPTION ON THE CANVAS, AND IT IS "BASELINE".
 *
 * Paul's ruling: the do-nothing option is presented consistently as "Baseline".
 * The canvas was saying three different things at once — the panels badged the
 * option "Baseline" / "Baseline option" while the product's own "add a
 * baseline" affordance minted a node whose visible TITLE was literally
 * "Status Quo", and the node's own chips asked the user about "the status quo"
 * and "doing nothing". Three vocabularies for one object, and the node title is
 * the one the user reads first.
 *
 * WHY A GUARD AND NOT JUST A RENAME. There was no label authority to rename —
 * `baselineDetection.ts` owned DETECTION (14 call sites, all reading
 * `.isBaseline`) while every visible string was hand-written at its render
 * site, and three would-be authorities (`displayLabel`, `getBaselineBadgeProps`,
 * `BASELINE_BADGE_LABEL`) had ZERO non-test consumers. A hand-written string in
 * N places is the drift mechanism, so the fix is a single exported constant and
 * this guard over the canvas render surface.
 *
 * ⚠ TWO DELIBERATE CARVE-OUTS, both derived rather than assumed:
 *
 * 1. "STATUS QUO BIAS" IS A DIFFERENT CONCEPT AND MUST NOT BE RENAMED. It is a
 *    named cognitive bias carried on the wire as `status_quo_bias` and rendered
 *    from `shared/biasSignalTitles.ts`. "Baseline bias" is not a thing, and a
 *    blanket rename would corrupt the CEE bias vocabulary. The sweep below
 *    excludes the bias phrase BY NAME and proves the exclusion is earned.
 *
 * 2. INTERNAL DISCRIMINANTS ARE NOT COPY. `is_baseline`, `status_quo_bias`,
 *    `STATUS_QUO_UNREACHABLE`, `opt_status_quo` and `STATUS_QUO_PATTERNS` are
 *    identifiers, not sentences; renaming them would break the wire. Only
 *    prose is swept.
 *
 * SCOPE, stated so an absence claim means something: `src/canvas/nodes` and
 * `src/canvas/hooks` — the surfaces that mint and render the node itself.
 * Panels and starter fixtures are deliberately NOT in scope here; the shipped
 * starters carry "(Status Quo)" inside captured CEE drafts, and those are
 * recorded evidence rather than fixtures to keep current.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BASELINE_OPTION_LABEL, detectBaseline } from '../utils/baselineDetection'

const ROOT = path.resolve(__dirname, '../../..')
const SCOPE = ['src/canvas/nodes', 'src/canvas/hooks']

/** The bias name, which is a different concept and stays. */
const BIAS_PHRASE = /status[- ]quo bias/i
/** Prose forms of the option's name that the ruling replaces. */
const BANNED = [/\bstatus quo\b/i, /\bdo nothing\b/i, /\bdoing nothing\b/i]

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === '__fixtures__') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(e) && !/\.spec\.|\.stories\./.test(e)) out.push(p)
  }
  return out
}

/**
 * Every quoted string literal, with its line — COMMENTS STRIPPED FIRST.
 *
 * The first version of this swept comments too and flagged eleven sites, of
 * which seven were prose ABOUT the code rather than prose shown to a user. A
 * guard that reds on an explanatory comment is a guard people learn to work
 * around, and the ruling is about what the product SAYS, not about how the
 * source describes itself. (The comments were updated anyway; they are simply
 * not what this pin defends.)
 */
function stringLiterals(src: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = []
  let inBlock = false
  src.split('\n').forEach((raw, i) => {
    let l = raw
    if (inBlock) {
      const end = l.indexOf('*/')
      if (end === -1) return
      l = l.slice(end + 2)
      inBlock = false
    }
    const open = l.indexOf('/*')
    if (open !== -1) { inBlock = l.indexOf('*/', open) === -1; l = l.slice(0, open) + (inBlock ? '' : l.slice(l.indexOf('*/', open) + 2)) }
    const line = l.replace(/\/\/.*$/, '')
    for (const m of line.matchAll(/'([^'\\]{4,})'|"([^"\\]{4,})"|`([^`\\]{4,})`/g)) {
      out.push({ line: i + 1, text: m[1] ?? m[2] ?? m[3] })
    }
  })
  return out
}

describe('canvas baseline vocabulary (Paul, 18 Aug 2026)', () => {
  const files = SCOPE.flatMap((d) => walk(path.join(ROOT, d)))
  const hits = files.flatMap((f) =>
    stringLiterals(readFileSync(f, 'utf8')).map((h) => ({ ...h, file: path.relative(ROOT, f) })),
  )

  it('the sweep actually reads prose (positive control)', () => {
    // An empty sweep satisfies every absence assertion below (trap 13).
    expect(files.length).toBeGreaterThan(20)
    expect(hits.length).toBeGreaterThan(200)
  })

  it('CONTRAST CONTROL: the predicate FIRES, and the bias carve-out is earned', () => {
    // (a) The banned predicate must be shown to fire at all, or the absence
    //     assertion below passes for the wrong reason (trap 13).
    const sample = 'Why does the status quo do better than the other options?'
    expect(BANNED.some((re) => re.test(sample)), 'banned predicate never fires — sweep is blind').toBe(true)

    // (b) The carve-out must be doing real work: the bias phrase is a string the
    //     banned predicate WOULD flag, and the carve-out is what spares it.
    const biasTitle = 'Status quo bias: inaction risks often underestimated.'
    expect(BANNED.some((re) => re.test(biasTitle)), 'carve-out guards nothing').toBe(true)
    expect(BIAS_PHRASE.test(biasTitle), 'carve-out does not match the bias phrase').toBe(true)

    // (c) …and the concept it spares must still EXIST, or the carve-out is a
    //     licence for a phrase nothing uses. Derived from the bias registry,
    //     which is the producer of that title (it is composed into the tooltip
    //     at useScienceIcons.ts, so it is never a literal in this scope).
    const registry = readFileSync(path.join(ROOT, 'src/canvas/shared/biasSignalTitles.ts'), 'utf8')
    expect(registry, 'the status-quo-bias concept has gone — re-derive this carve-out')
      .toMatch(/status_quo_bias:\s*\{\s*title:\s*'Status quo bias'/)
  })

  it('no canvas node copy names the option anything but "Baseline"', () => {
    const offenders = hits
      .filter((h) => !BIAS_PHRASE.test(h.text))
      .filter((h) => BANNED.some((re) => re.test(h.text)))
      .map((h) => `${h.file}:${h.line}  "${h.text.slice(0, 80)}"`)
    expect(offenders, `canvas copy still uses a non-"Baseline" name:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the minted baseline node takes its title from the ONE authority', () => {
    const src = readFileSync(path.join(ROOT, 'src/canvas/hooks/useAddBaseline.ts'), 'utf8')
    expect(src, 'useAddBaseline hardcodes a title instead of importing the constant')
      .toMatch(/label:\s*BASELINE_OPTION_LABEL/)
    expect(src).toMatch(/BASELINE_OPTION_LABEL.*from ['"]\.\.\/utils\/baselineDetection['"]/)
    expect(BASELINE_OPTION_LABEL).toBe('Baseline')
  })

  it('the authority\'s own label is detected as a baseline by the detector', () => {
    // Binds the two halves together: if someone changes the constant to a word
    // `detectBaseline` does not recognise, the product would mint a node its
    // own detector calls a normal option. Pins its own precondition in-test.
    expect(detectBaseline(BASELINE_OPTION_LABEL).isBaseline).toBe(true)
    // Discrimination: the detector is not simply saying yes to everything.
    expect(detectBaseline('Adopt Segment').isBaseline).toBe(false)
  })
})

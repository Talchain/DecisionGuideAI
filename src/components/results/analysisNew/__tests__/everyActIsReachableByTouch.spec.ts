/**
 * EVERY ACT ON THIS PANEL HAS A TOUCH-TARGET GUARANTEE — OR SAYS WHY NOT.
 *
 * ## The gap this closes, measured
 *
 * `everyInlineActIsReachableByTouch` — the sibling guard, which stays — sweeps
 * only files containing `action('inline')`. **Its population is defined by the
 * very thing it enforces**, so a file that opts out of tiers ENTIRELY is
 * invisible to it.
 *
 * Swept 2026-09-19 across `analysisNew`: **17 files render interactive
 * elements, 55 controls between them.** Six files carried NO touch-target
 * geometry at all — `FactorValueControl` (3 controls), `DecisionRecorded` (2),
 * `WhyNoAnalysisYet`, `DeeperAnalysis`, `ArgueTheOpposite`, `SectionShell`.
 * Measured on the deployed build they all PASS 24x24 — **by accident of their
 * content and padding, not by construction.** That is precisely the latent shape
 * that produced the 133x15 review-estimates control and the 22px Strengthen row
 * toggle: both passed until the day their content changed.
 *
 * ## The rule
 *
 * A file rendering an interactive element must EITHER
 *   (a) take its geometry from `action()` — the tier owns it, or
 *   (b) DECLARE `@panel-act-opt-out <reason>` and carry the geometry itself,
 *       in BOTH dimensions.
 *
 * ⚠ THE DECLARATION IS READ FROM THE FILE, NOT FROM A LIST HERE. A hand-kept
 * allowlist is the mirror this estate keeps paying for (trap 12) — it drifts,
 * and the drift reads as green. A file that stops opting out simply stops
 * carrying the marker, and the rule re-applies with no edit to this spec.
 *
 * ⚠⚠ AND IT IS NOT IN CONFLICT WITH THE SIBLING GUARD, though the two look
 * opposed: that one FORBIDS a hand-rolled target, this one PERMITS one. They
 * answer different questions over different populations — *"is the tier still
 * the single owner where it is used?"* versus *"does every act have a guarantee
 * at all?"* Two questions under similar names is this estate's trap 21, so it is
 * named here rather than reconciled. Verified at authoring: the two populations
 * do not overlap on any file carrying hand-rolled geometry.
 *
 * ## Why BOTH dimensions
 *
 * WCAG 2.2 AA §2.5.8 is 24x24. The Strengthen row toggle passed the height and
 * failed the width — `px-1` (4px a side) around a `w-3.5` icon is 22px — which
 * is the signature of an ICON-ONLY control and the case a height-only rule
 * cannot see. `w-full` satisfies the width by construction and is accepted as
 * such, which is the one legitimate exception and is declared in the file.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const PANEL_DIR = path.resolve(__dirname, '..')

const INTERACTIVE = /<button|role="button"|role="radio"|<a\s+href|<input|<select/
const OPT_OUT = /@panel-act-opt-out[ \t]+(\S[^\n*]*)/
const USES_TIER = /action\(\s*'/
const MIN_H = 'min-h-[24px]'
const MIN_W = 'min-w-[24px]'
const FULL_W = 'w-full'

/** Comments carry the marker, so they are stripped ONLY for the code checks. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

interface PanelFile {
  readonly name: string
  readonly raw: string
  readonly code: string
}

function panelFiles(): PanelFile[] {
  const out: PanelFile[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '__tests__' || entry === 'prototype') continue
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (/\.tsx$/.test(full) && !/\.(spec|test)\./.test(full)) {
        const raw = fs.readFileSync(full, 'utf8')
        out.push({ name: path.relative(PANEL_DIR, full), raw, code: stripComments(raw) })
      }
    }
  }
  walk(PANEL_DIR)
  return out
}

const interactiveFiles = () => panelFiles().filter((f) => INTERACTIVE.test(f.code))

describe('every act on the panel has a touch-target guarantee', () => {
  it('PRECONDITION: the sweep reaches the panel and finds acts — otherwise every case is vacuous', () => {
    const all = panelFiles()
    expect(all.length, 'the walker found no panel sources at all').toBeGreaterThan(20)
    // 17 at authoring. A floor well under it: this guards a DEAD walk, not growth.
    expect(interactiveFiles().length, 'no interactive files found — the regex is blind').toBeGreaterThan(10)
  })

  it('⛔ every interactive file uses a tier, or declares why not AND carries the geometry', () => {
    const offenders = interactiveFiles()
      .filter((f) => !USES_TIER.test(f.code))
      .filter((f) => {
        const declared = OPT_OUT.test(f.raw)
        const bothDimensions =
          f.code.includes(MIN_H) && (f.code.includes(MIN_W) || f.code.includes(FULL_W))
        return !(declared && bothDimensions)
      })
      .map((f) => f.name)

    expect(
      offenders,
      'each file must call action(), or carry `@panel-act-opt-out <reason>` AND 24px in both ' +
        'dimensions. A control that passes today by accident of its content is how the 133x15 ' +
        'escape hatch and the 22px row toggle both shipped.',
    ).toEqual([])
  })

  it('⛔ an opt-out states a REASON — a bare marker is a silent exemption', () => {
    const bare = interactiveFiles()
      .filter((f) => OPT_OUT.test(f.raw))
      .filter((f) => (f.raw.match(OPT_OUT)?.[1] ?? '').trim().length < 20)
      .map((f) => f.name)

    expect(bare, 'the marker exists so the exemption is ARGUED, not merely permitted').toEqual([])
  })

  /**
   * ⭐ THE ARM THAT PROVES THIS GUARD CAN FAIL. Without it, a regex that matched
   * nothing would satisfy every assertion above by examining an empty set —
   * the vacuity this estate has shipped more than once.
   */
  it('PRECONDITION: the rule bites on a file that breaks it', () => {
    const broken = {
      name: 'Fake.tsx',
      raw: 'export const X = () => <button className="px-1">go</button>',
      code: 'export const X = () => <button className="px-1">go</button>',
    }
    expect(INTERACTIVE.test(broken.code), 'the detector must see a plain button').toBe(true)
    expect(USES_TIER.test(broken.code), 'and must not mistake it for a tier user').toBe(false)
    expect(OPT_OUT.test(broken.raw), 'and must not find a declaration that is not there').toBe(false)
  })

  /**
   * ⚠ THE TWO GUARDS ANSWER DIFFERENT QUESTIONS AND MUST NOT DRIFT INTO ONE.
   * The sibling FORBIDS hand-rolled geometry where a tier is in use; this one
   * PERMITS it where a tier is declined. They only stay compatible while no file
   * is in both populations with a hand-rolled target — asserted, not assumed.
   */
  it('⛔ no file both uses `action(\'inline\')` and hand-rolls its own target', () => {
    const conflicted = interactiveFiles()
      .filter((f) => f.code.includes("action('inline')") && f.code.includes(MIN_H))
      .map((f) => f.name)

    expect(
      conflicted,
      'such a file would satisfy this guard and RED the sibling — two rules, one file',
    ).toEqual([])
  })
})

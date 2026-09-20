/**
 * ⭐⭐⭐ THE LANE BANDS MUST PAINT BEHIND THE CARDS THEY HOLD.
 *
 * The founder reported it exactly: "all of the nodes are still dulled out
 * because they're behind the panels of the different node type rows". That is
 * what the DOM was doing. `TierLanes` renders through `<ViewportPortal>`, whose
 * target `.react-flow__viewport-portal` is the LAST of React Flow's five
 * viewport children — so the bands composited OVER every card, and the call
 * site's comment confidently said the opposite because it reasoned from JSX
 * order, which a portal makes irrelevant.
 *
 * Cost, measured: the band's box is the union of its tier's card boxes plus
 * padding, so it covers 100% of every card. A 50%-alpha #FEFEFE sheet leaves the
 * card face unchanged and washes everything drawn on it halfway to white — body
 * text #3F3F3E composites to ~#9E9E9E, contrast ~10.4:1 → ~2.66:1, under WCAG
 * SC 1.4.3's 4.5:1 and under the 3:1 large-text floor.
 *
 * ⚠ WHY A SOURCE GUARD AND NOT A RENDER TEST. jsdom computes no stacking and no
 * composite, so it cannot answer this (CLAUDE.md trap 3). A render test would
 * pass on the defect. The honest instrument is to pin the DECLARATION.
 *
 * ⚠⚠ THE STRIPPER IS STILL LOAD-BEARING, THOUGH MY STATED REASON WAS WRONG.
 * I wrote that `TierLanes.tsx`'s own prose names `zIndex: -1`, so a raw-source
 * assertion would be satisfied by the comment. **At this head it does not** —
 * that file carries one literal (the code) and spells the concept "z-index" in
 * prose. Review caught the overstatement; corrected rather than quietly dropped,
 * because a guard justified by a false premise invites someone to remove it.
 *
 * The stripper stays, for the reason that IS true: a comment naming the property
 * is one edit away at any time, and the exact vacuity it prevents shipped in
 * this repo earlier today when a stripper missed TRAILING line comments. It
 * handles block, whole-line and trailing comments, and its positive controls
 * prove each case rather than asserting it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const TIER_LANES = join(ROOT, 'src', 'canvas', 'nodes', 'TierLanes.tsx')

/**
 * Strip block comments, whole-line comments and TRAILING line comments.
 *
 * The trailing case is the one that has already bitten: `foo() // zIndex: -1`
 * keeps the token alive for a naive `toContain` after the code is gone.
 * Deliberately conservative about `//` inside strings by only stripping from a
 * `//` that is not preceded by a `:` (as in `https://`) — and the control below
 * asserts that carve-out actually works.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(line => line.trim().length > 0)
    .join('\n')
}

const tierLanes = readFileSync(TIER_LANES, 'utf8')

describe('the comment stripper is not the vacuity it exists to prevent', () => {
  it('POSITIVE CONTROL: strips block, whole-line AND trailing comments', () => {
    expect(codeOnly('/* zIndex: -1 */\nconst a = 1\n').includes('zIndex')).toBe(false)
    expect(codeOnly('// zIndex: -1\nconst a = 1\n').includes('zIndex')).toBe(false)
    expect(codeOnly('const a = 1 // zIndex: -1\n').includes('zIndex')).toBe(false)
  })

  it('POSITIVE CONTROL: keeps the code it is meant to keep, and spares URLs', () => {
    expect(codeOnly('const z = { zIndex: -1 }\n')).toContain('zIndex: -1')
    expect(codeOnly("const u = 'https://example.com'\n")).toContain('https://example.com')
  })

  it('POSITIVE CONTROL: the file was read and is substantive', () => {
    expect(tierLanes.length, 'TierLanes.tsx read as empty — this guard would pass on a missing file').toBeGreaterThan(1_000)
  })
})

/**
 * Extract the per-band inline style object by BRACE MATCHING from `style={{`,
 * so an assertion can be bound to that object's extent rather than to "anywhere
 * after it". The first version of this guard used `indexOf('left: lane.x')` as a
 * lower bound, which every later line in the file satisfies.
 */
function bandStyleObject(src: string): string {
  const code = codeOnly(src)
  const anchor = code.indexOf('left: lane.x')
  if (anchor === -1) return ''
  const open = code.lastIndexOf('{', anchor)
  let depth = 0
  for (let k = open; k < code.length; k++) {
    if (code[k] === '{') depth++
    else if (code[k] === '}') {
      depth--
      if (depth === 0) return code.slice(open, k + 1)
    }
  }
  return ''
}

describe('the extent extractor binds to the band object only', () => {
  it('POSITIVE CONTROL: it returns a non-empty object containing the band geometry', () => {
    const obj = bandStyleObject(tierLanes)
    expect(obj.length, 'the band style object was not extracted — every assertion below would be vacuous').toBeGreaterThan(40)
    expect(obj).toContain('left: lane.x')
    expect(obj).toContain('top: lane.y')
  })

  it('⭐ DISCRIMINATION: it EXCLUDES content that follows the object', () => {
    // This is the property the first version of this guard lacked. A reviewer
    // showed that moving `zIndex: -1` from the band style to the title span
    // twelve lines below deleted the fix while the guard stayed green.
    const obj = bandStyleObject(tierLanes)
    expect(obj, 'the extractor is swallowing the title span — it is not bound to the band object').not.toContain('tier-lane-${lane.tier}-title')
  })
})

describe('tier lanes paint behind the cards', () => {
  /**
   * ⚠ BOUND BY EXTENT AND COUNT-PINNED, because version one was one-directional.
   *
   * It asserted `code.toMatch(/zIndex: -1/)` plus `indexOf(...) > indexOf('left:
   * lane.x')`. A reviewer's 9-mutant kit passed FIVE arms against that, the worst
   * being: MOVE `zIndex: -1` from the band style object to the title span twelve
   * lines below. The fix is fully deleted, the bands paint over the cards again,
   * and the guard stays GREEN — because everything after `left: lane.x`
   * satisfies a lower-bound test.
   *
   * My own four mutants were all "REMOVE the token". None was "MOVE the token"
   * or "ADD a second one". A corpus that tests one direction cannot see the
   * other (trap 22b), and a positional `>` is a value predicate another object
   * can satisfy (trap 19). It matters here because `TierLanes.tsx` has no render
   * spec at all — this file is the only thing watching.
   */
  it('⭐ the BAND STYLE OBJECT declares a negative z-index, exactly once', () => {
    const obj = bandStyleObject(tierLanes)
    const hits = [...obj.matchAll(/(^|[\s{,])zIndex\s*:\s*-1\s*(,|\}|$)/g)]
    expect(
      hits.length,
      'the tier bands no longer declare `zIndex: -1` INSIDE their own style object. They render through ViewportPortal, which lands LAST in the viewport, so without this they composite OVER every card and wash its text below the WCAG contrast floor. Moving the property elsewhere in the file does not count — the band is the element that must carry it.',
    ).toBe(1)
  })

  it('a negative z-index elsewhere in the file cannot stand in for it', () => {
    // The band object is what paints over the cards. A `zIndex: -1` on the
    // wrapper would be silently ignored (it is `position: static`); one on the
    // title, or on an unused export, changes nothing at all.
    const obj = bandStyleObject(tierLanes)
    const whole = codeOnly(tierLanes)
    const outside = whole.replace(obj, '')
    expect(
      /zIndex\s*:\s*-1/.test(outside),
      'a second `zIndex: -1` exists outside the band style object — if the band ever loses its own, this file would still look correct at a glance',
    ).toBe(false)
  })

  it('the band is not silently flipped positive', () => {
    // `zIndex: 1` with a decoy `-1` later was one of the surviving mutants.
    //
    // ⚠ READ THE VALUE, DO NOT LOOK-AHEAD PAST IT. My first spelling was
    // `/zIndex\s*:\s*(?!-)/`, which is always true: `\s*` backtracks to zero
    // width and the lookahead then inspects the SPACE, which is not `-`. It
    // reported the pristine file as positive. A negative-lookahead after a
    // variable-width match tests the wrong character.
    const obj = bandStyleObject(tierLanes)
    const values = [...obj.matchAll(/zIndex\s*:\s*(-?\d+)/g)].map(m => Number(m[1]))
    expect(values.length, 'no z-index value parsed out of the band object').toBeGreaterThan(0)
    for (const v of values) {
      expect(v, `the band declares z-index ${v} — a non-negative value paints it over the cards`).toBeLessThan(0)
    }
  })

  it('the bands remain non-interactive, so stacking cannot become a click-blocker', () => {
    // Pulling the bands behind the cards must not tempt anyone to drop
    // pointerEvents: a band that paints behind but still takes a pointer would
    // be a worse defect than the one being fixed.
    const code = codeOnly(tierLanes)
    expect((code.match(/pointerEvents:\s*'none'/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

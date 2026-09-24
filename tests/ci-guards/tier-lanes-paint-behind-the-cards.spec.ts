/**
 * ⭐⭐⭐ NOTHING THE TIER LANES DRAW MAY PAINT OVER THE CARDS THEY LABEL.
 *
 * ⚠ 24 Sep 2026 — THE BANDS ARE GONE (Paul: "remove the different colour panels
 * of the different node types. Just leave the normal canvas background as is";
 * NODE-ANATOMY-v32 L1). `TierLanes` now renders labels only. The invariant this
 * guard protects is unchanged — no surface portalled above the cards — and is
 * now pinned as ABSENCE: the file declares no painted surface at all, so a band
 * reintroduced later fails here before it can wash the cards again. The history
 * below is kept because it is WHY this guard exists.
 *
 * (Original header, 19 Sep: THE LANE BANDS MUST PAINT BEHIND THE CARDS.)
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
 * ⭐ LABELS ONLY: NO PAINTED SURFACE (24 Sep, bands removed).
 *
 * A portalled element paints over the cards whatever its JSX position (the
 * history above). With no band there is nothing to order, so the guard pins the
 * absence of every way to paint a surface: a Tailwind background class, an
 * inline background, or a band-sized box. Comment-stripped, so prose naming a
 * token cannot satisfy or trip it.
 */
const SURFACE_TOKENS: ReadonlyArray<[string, RegExp]> = [
  ['a Tailwind background class', /\bbg-[a-z]/],
  ['an inline backgroundColor', /backgroundColor\s*:/],
  ['an inline background', /\bbackground\s*:/],
  ['a band-sized box (lane.width)', /lane\.width/],
  ['a band-sized box (lane.height)', /lane\.height/],
]

function paintedSurfaces(src: string): string[] {
  const code = codeOnly(src)
  return SURFACE_TOKENS.filter(([, re]) => re.test(code)).map(([name]) => name)
}

describe('tier lanes paint no surface that could cover a card', () => {
  it('POSITIVE CONTROL: the labels are still rendered (the file is the labels, not empty)', () => {
    const code = codeOnly(tierLanes)
    expect(code).toContain('tier-lane-${lane.tier}-title')
    expect(code).toContain('ViewportPortal')
  })

  it('⭐ the file declares no painted surface: no bg- class, no inline background, no band-sized box', () => {
    expect(paintedSurfaces(tierLanes), 'TierLanes paints a surface again — portalled, it composites OVER the cards').toEqual([])
  })

  it('DISCRIMINATION: the detector catches a re-added band (the 19 Sep shape)', () => {
    const band = "<div className=\"absolute rounded-2xl bg-panel\" style={{ left: lane.x - 120, width: lane.width + 240, height: lane.height + 96, opacity: 0.5 }} />"
    expect(paintedSurfaces(band)).toEqual(expect.arrayContaining(['a Tailwind background class', 'a band-sized box (lane.width)', 'a band-sized box (lane.height)']))
    expect(paintedSurfaces("<span style={{ backgroundColor: 'var(--bg-panel)' }} />")).toContain('an inline backgroundColor')
  })

  it('DISCRIMINATION: a surface token inside a comment does not trip it', () => {
    expect(paintedSurfaces("const a = 1 // bg-panel backgroundColor: x lane.width\n")).toEqual([])
  })
})

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
 * ⚠⚠ AND THE STRIPPER IS THE LOAD-BEARING PART. This file's own prose names
 * `zIndex: -1`, so an assertion over raw source would be satisfied by the
 * comment explaining the rule while the rule itself was deleted. That exact
 * vacuity shipped in this repo earlier today — a stripper that missed TRAILING
 * line comments let a mutant pass. The stripper below handles block comments,
 * whole-line comments AND trailing comments, and its positive controls prove
 * each case rather than asserting it.
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

describe('tier lanes paint behind the cards', () => {
  it('⭐ the band style declares a negative z-index, in CODE', () => {
    const code = codeOnly(tierLanes)
    expect(
      code,
      'the tier bands no longer declare zIndex: -1. They render through ViewportPortal, which lands LAST in the viewport, so without this they composite OVER every card and wash its text below the WCAG contrast floor.',
    ).toMatch(/zIndex:\s*-1/)
  })

  it('the band is still the element carrying it — not the static wrapper', () => {
    // A z-index on the wrapper div is silently ignored: it is `position: static`.
    // Moving the declaration there would read as a fix and change nothing.
    const code = codeOnly(tierLanes)
    const bandStyleStart = code.indexOf('left: lane.x')
    const bandStyleEnd = code.indexOf('}', code.indexOf('zIndex: -1'))
    expect(bandStyleStart, 'the per-band style object was not found — this guard is reading the wrong shape').toBeGreaterThan(-1)
    expect(
      code.indexOf('zIndex: -1'),
      'zIndex: -1 must sit INSIDE the per-band style object (after `left: lane.x`), not on the static wrapper where it would be ignored',
    ).toBeGreaterThan(bandStyleStart)
    expect(bandStyleEnd).toBeGreaterThan(-1)
  })

  it('the bands remain non-interactive, so stacking cannot become a click-blocker', () => {
    // Pulling the bands behind the cards must not tempt anyone to drop
    // pointerEvents: a band that paints behind but still takes a pointer would
    // be a worse defect than the one being fixed.
    const code = codeOnly(tierLanes)
    expect((code.match(/pointerEvents:\s*'none'/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

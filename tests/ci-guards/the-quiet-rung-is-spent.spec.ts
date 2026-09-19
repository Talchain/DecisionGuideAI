/**
 * ⭐⭐ THE MIDDLE RUNG MUST DO SOMETHING, AND IT MUST NOT MOVE ANY CARD.
 *
 * The ladder declares three rungs and the board rendered two states: `quiet` was
 * visually identical to `full` unless the Graph Lens happened to be dimming
 * nodes, and `cardControlsVisibleAt` — the predicate declared for thinning card
 * controls at `quiet` — had ZERO non-test callers. So the mechanism designed to
 * make the zoom transition gradual existed, was tested, and showed the user
 * nothing. The founder felt the consequence as a single hard flip.
 *
 * ⛔⛔ THE HAZARD THIS FILE EXISTS TO PIN. `showQuickActions` has TWO readers:
 * the chip MOUNT, and the first arm of the card's `padding` disjunction, which
 * reserves `NODE_QUICK_ACTION_BAND_PX` of bottom band. Gating that shared flag
 * on the rung would change card PADDING at a zoom boundary — every card resizes
 * mid-gesture, measure-then-layout fires, and the board re-arranges itself as
 * the user zooms. That is the stale-height defect #1100 was merged to fix,
 * re-introduced as a side effect of a presentation change.
 *
 * So: the SPACE stays reserved at every rung; only the CONTENT goes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cardControlsVisibleAt, selectLodRung } from '../../src/canvas/utils/zoomLegibility'

const ROOT = join(__dirname, '..', '..')
const BASE_NODE = join(ROOT, 'src', 'canvas', 'nodes', 'BaseNode.tsx')

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(l => l.trim().length > 0)
    .join('\n')
}

const baseNode = readFileSync(BASE_NODE, 'utf8')
const code = codeOnly(baseNode)

describe('the stripper and the file', () => {
  it('POSITIVE CONTROL: strips block, line and trailing comments; keeps code', () => {
    expect(codeOnly('/* quickActionsMounted */\nconst a=1\n').includes('quickActionsMounted')).toBe(false)
    expect(codeOnly('const a=1 // quickActionsMounted\n').includes('quickActionsMounted')).toBe(false)
    expect(codeOnly('const quickActionsMounted = x\n')).toContain('quickActionsMounted')
  })
  it('POSITIVE CONTROL: BaseNode.tsx was read and is substantive', () => {
    expect(baseNode.length).toBeGreaterThan(10_000)
  })
})

describe('`quiet` is spent on zoom, not only on the lens', () => {
  it('⭐ cardControlsVisibleAt discriminates the three rungs', () => {
    // If this ever returned true for `quiet`, the wiring below would be a no-op
    // and every other assertion here would still pass.
    expect(cardControlsVisibleAt('full')).toBe(true)
    expect(cardControlsVisibleAt('quiet')).toBe(false)
    expect(cardControlsVisibleAt('line')).toBe(false)
  })

  it('an absent rung degrades to `full`, never to a reduced card', () => {
    expect(selectLodRung({})).toBe('full')
    expect(cardControlsVisibleAt(selectLodRung({}))).toBe(true)
  })

  it('the chip MOUNT is gated on the rung, in code', () => {
    expect(code, 'the quick-action mount no longer consults the rung — `quiet` is a no-op again').toMatch(
      /const\s+quickActionsMounted\s*=\s*showQuickActions\s*&&\s*cardControlsVisibleAt\s*\(\s*lodRung\s*\)/,
    )
    expect(code, 'the mount is not gated on the rung-aware flag').toContain('{quickActionsMounted && (')
  })

  it('⛔ the PADDING must NOT be gated on the rung — that would resize every card', () => {
    // The whole hazard, pinned. `padding:` must still read the rung-INDEPENDENT
    // flag, so the reserved band survives every rung and no card changes height
    // at a zoom boundary.
    const padIdx = code.indexOf('padding: ')
    expect(padIdx, 'the padding expression was not found — this guard is reading the wrong shape').toBeGreaterThan(-1)
    const padExpr = code.slice(padIdx, padIdx + 220)
    expect(
      padExpr,
      'the card padding now depends on the rung — every card would resize mid-zoom, re-triggering measure-then-layout (the #1100 defect)',
    ).not.toContain('quickActionsMounted')
    expect(padExpr, 'the padding no longer reserves the band from the rung-independent flag').toContain('showQuickActions')
  })

  it('the two flags are genuinely different expressions', () => {
    // A rename that collapsed them into one would satisfy both assertions above
    // while destroying the separation they exist for.
    expect(code).toMatch(/const\s+showQuickActions\s*=\s*!lodBodyHidden/)
    expect(code.includes('const quickActionsMounted = showQuickActions')).toBe(true)
  })
})

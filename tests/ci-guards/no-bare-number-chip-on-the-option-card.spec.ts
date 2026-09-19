/**
 * ⭐⭐ NO CHIP ON A NODE CARD CARRIES A BARE NUMBER.
 *
 * The node design system states it twice, and states the reason in the rule:
 *
 *   "Any chip in the header carries a visible word, never a bare number —
 *    a lone '#3' reads as third place."
 *   "No chip carries a bare number. An order-of-creation index is NOT SHOWN AT
 *    ALL, because a lone '#3' beside a card reads as third place HOWEVER THE
 *    TOOLTIP IS WORDED."
 *
 * ⛔ IT WAS NOT HYPOTHETICAL. On the founder's 19 Sep staging run the option
 * cards showed `1` on the option supported at <1% and `2` on the option supported
 * at 67% — a bare numeral CONTRADICTING the support figures printed on the same
 * cards. The badge meant order-of-creation and read as rank.
 *
 * ⚠ AND THE OBVIOUS REPAIR IS THE ONE THE DESIGN REFUSES. The element carried a
 * correct `aria-label` ("…not a ranking"), so a screen-reader user was told the
 * truth while a sighted reader was not. Adding a visible word looks like the fix
 * and is ruled out by "however the tooltip is worded" — plus the option's NAME is
 * the team's handle, and the kind is already carried by the glyph and the lane.
 *
 * This guard pins the ABSENCE, which is the harder direction: an absence assertion
 * with no contrast control is vacuous (trap 13), so it proves it can SEE the
 * header slot before asserting what is not in it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const OPTION_NODE = join(ROOT, 'src', 'canvas', 'nodes', 'OptionNode.tsx')

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(l => l.trim().length > 0)
    .join('\n')
}

const src = readFileSync(OPTION_NODE, 'utf8')
const code = codeOnly(src)

describe('the probe can see what it is asserting about', () => {
  it('POSITIVE CONTROL: the file is substantive and the header slot exists', () => {
    expect(src.length).toBeGreaterThan(10_000)
    expect(code, 'headerSlot not found — this guard would pass on a file it cannot read').toContain('headerSlot=')
  })
  it('POSITIVE CONTROL: the stripper removes prose naming the symbol', () => {
    expect(codeOnly('/* stableOptionNumber */\nconst a=1\n').includes('stableOptionNumber')).toBe(false)
    expect(codeOnly('const a=1 // stableOptionNumber\n').includes('stableOptionNumber')).toBe(false)
    expect(codeOnly('const stableOptionNumber = x\n')).toContain('stableOptionNumber')
  })
})

describe('the option card carries no bare-number chip', () => {
  it('⭐ the order-of-creation index is not rendered, in code', () => {
    expect(
      code,
      'the option card is rendering `stableOptionNumber` again. A lone numeral beside competing options reads as a rank — on the founder\'s own board it showed 1 on the <1% option and 2 on the 67% one. The design rules it out entirely, not just untooltipped.',
    ).not.toContain('stableOptionNumber')
  })

  it('and its accessible-name builder is not re-imported here', () => {
    // Re-importing it is the tell that someone put the badge back with the
    // aria-label that the design explicitly says does not rescue it.
    expect(code).not.toContain('optionOrdinalBadgeAccessibleName')
  })

  it('the header slot still renders the science icons — this removed a chip, not the slot', () => {
    // Without this, deleting headerSlot wholesale would pass every assertion
    // above while silently dropping unrelated affordances.
    expect(code).toContain('scienceIcons.map')
    expect(code).toMatch(/headerSlot=\{scienceIcons\.length > 0/)
  })
})

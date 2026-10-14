/**
 * ⭐ HELD-LINK PARITY (DL 0df0e1 condition 2): the SAME fixture, byte for byte, runs here and in CEE
 * (`src/orchestrator-v5/goal-target/__tests__/fixtures/held-link-parity.json`, `heldLinkOf`). Each repo pins its sha256,
 * so an edit to either copy REDs that repo's CI until both are re-pinned. Check name: "held-link parity fixture digest".
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isHeldUserLink, NO_LINK_ENDS, type LinkEnds } from '../heldUserLink'

// S-DEF (CEE #2739 ← #2665, d5 6011224941): rows gained `ends` (a validated definition holds whoever flagged it).
const FIXTURE_SHA256 = 'a6706a70a9351c9ed13384fcd22345efab6c1b04de74cc552465f175ac0b340b'
const PATH = resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/held-link-parity.json')
const bytes = readFileSync(PATH)
const rows = (JSON.parse(readFileSync(PATH, 'utf8')) as { rows: Array<{ name: string; edge: unknown; ends?: LinkEnds; held: boolean }> }).rows

describe('held-link parity fixture (shared with CEE)', () => {
  it('held-link parity fixture digest: the bytes are the ones CEE pins', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(FIXTURE_SHA256)
  })
  it('every row: isHeldUserLink agrees with CEE heldLinkOf (both directions present)', () => {
    expect(rows.filter((r) => r.held).length).toBeGreaterThan(0)
    expect(rows.filter((r) => !r.held).length).toBeGreaterThan(0)
    for (const r of rows) expect({ name: r.name, held: isHeldUserLink(r.edge, r.ends ?? NO_LINK_ENDS) }).toEqual({ name: r.name, held: r.held })
  })
})

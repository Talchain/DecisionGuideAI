/**
 * ⭐ HELD-LINK PARITY (DL 0df0e1 condition 2): the SAME fixture, byte for byte, runs here and in CEE
 * (`src/orchestrator-v5/goal-target/__tests__/fixtures/held-link-parity.json`, `heldLinkOf`). Each repo pins its sha256,
 * so an edit to either copy REDs that repo's CI until both are re-pinned. Check name: "held-link parity fixture digest".
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isHeldUserLink } from '../heldUserLink'

const FIXTURE_SHA256 = 'dd32c259b407929952f709596158cd5142e53870b339c083b053bb688ac581dd'
const PATH = resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/held-link-parity.json')
const bytes = readFileSync(PATH)
const rows = (JSON.parse(readFileSync(PATH, 'utf8')) as { rows: Array<{ name: string; edge: unknown; held: boolean }> }).rows

describe('held-link parity fixture (shared with CEE)', () => {
  it('held-link parity fixture digest: the bytes are the ones CEE pins', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(FIXTURE_SHA256)
  })
  it('every row: isHeldUserLink agrees with CEE heldLinkOf (both directions present)', () => {
    expect(rows.filter((r) => r.held).length).toBeGreaterThan(0)
    expect(rows.filter((r) => !r.held).length).toBeGreaterThan(0)
    for (const r of rows) expect({ name: r.name, held: isHeldUserLink(r.edge) }).toEqual({ name: r.name, held: r.held })
  })
})

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

const FIXTURE_SHA256 = '294ffd2ac4e69e2020c7a539efa8ec2a382a02db692195c684da7842dceeb3d6'
const bytes = readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/held-link-parity.json'))
const rows = (JSON.parse(bytes.toString('utf8')) as { rows: Array<{ name: string; edge: unknown; held: boolean }> }).rows

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

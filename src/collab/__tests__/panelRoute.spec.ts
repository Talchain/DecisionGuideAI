/**
 * COLLAB — the owner-panel href builder, bound to the REAL route table.
 *
 * The entry point this repo is adding (TopBar → blind panel) must send the
 * owner to the route AppPoC actually declares. A helper tested only against a
 * literal of itself would be a guard agreeing with itself, so the third test
 * DERIVES the expectation from `src/poc/AppPoC.tsx` at this tip: it takes the
 * declared path pattern, substitutes the id, and demands the helper agree.
 * Moving or renaming the route REDs this file rather than silently stranding
 * the entry point on a dead href.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ownerPanelHash } from '../panelRoute'

describe('ownerPanelHash', () => {
  it('builds the hash-router href for the owner panel page', () => {
    expect(ownerPanelHash('scn-1')).toBe('#/scenario/scn-1/panel')
  })

  it('percent-encodes the scenario id so a hostile id cannot change the route', () => {
    expect(ownerPanelHash('a b/c')).toBe('#/scenario/a%20b%2Fc/panel')
  })

  it('agrees with the route AppPoC actually declares (derived, not retyped)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/poc/AppPoC.tsx'), 'utf8')

    // POSITIVE CONTROL: the pattern this test derives from must exist at all.
    const declared = 'path="/scenario/:id/panel"'
    expect(src).toContain(declared)

    const pattern = declared.slice('path="'.length, -1) // "/scenario/:id/panel"
    const substituted = `#${pattern.replace(':id', encodeURIComponent('scn-derived-7'))}`
    expect(ownerPanelHash('scn-derived-7')).toBe(substituted)
  })

  it("DIFFERENT OBJECT: does not build the PARTICIPANT route — '/panel/:round_id' is a different page for a different person", () => {
    // The participant route is public and token-gated; the owner route is
    // auth-guarded. An href that lands an owner on the participant page would
    // fail soft (an error card), which is exactly why it must fail loud here.
    expect(ownerPanelHash('scn-1').startsWith('#/panel/')).toBe(false)
  })
})

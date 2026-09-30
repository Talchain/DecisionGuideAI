/**
 * ⛔⛔ THE FEATURE HAS TWO MOUNT LINES AND NOTHING GUARDED EITHER OF THEM.
 *
 * Every other spec on this capability renders the section directly, or drives the
 * hook and renders its output. All of them stay GREEN if the single line that
 * puts the component on a real surface is deleted — a one-line deletion in each
 * of two files makes the whole capability dark with no red anywhere, which is
 * precisely the renders-nothing class this feature has already been bitten by
 * once (the two-writer hash collision).
 *
 * ⚠ WHY A SOURCE ASSERTION AND NOT A RENDER. Mounting `OutputsDock` in jsdom
 * pulls the entire canvas shell and would be guarding the harness, not the mount.
 * The failure mode being closed here is narrow and mechanical — a deleted line —
 * and a source assertion turns exactly that into a red. It proves the mount
 * EXISTS; the composition spec proves the mount would RENDER. Neither claim
 * substitutes for the other.
 *
 * ⚠ EVERY CASE ASSERTS ITS INPUT IS NON-EMPTY FIRST. A read that silently
 * returns nothing agrees with every absence assertion ever written, and this
 * estate has published a false absence from exactly that twice.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (rel: string): string => {
  const text = readFileSync(resolve(__dirname, rel), 'utf8')
  // ⛔ POSITIVE CONTROL ON THE INSTRUMENT ITSELF.
  expect(text.length).toBeGreaterThan(1000)
  return text
}

describe('⭐ the Reasoning tab mounts the RECEIPT (SC-24 v3, 30 Sep 2026 — the full section moved to Compare)', () => {
  const src = (): string => read('../AnalysisNewTabBody.tsx')

  it('imports the receipt', () => {
    expect(src()).toMatch(/import\s*\{\s*WhatsChangedReceipt\s*\}\s*from\s*'\.\/sections\/WhatsChangedReceipt'/)
  })

  it('⛔ and RENDERS it, fed from the SAME view model the Compare tab reads', () => {
    expect(src()).toMatch(/<WhatsChangedReceipt\s+view=\{vm\.whatsChanged\}/)
  })

  it('contrast — the full section is no longer mounted here, and the probe can tell present from absent', () => {
    expect(src()).not.toMatch(/<WhatsChanged\s+view=/)
    expect(src()).not.toMatch(/<WhatsChangedThatDoesNotExist/)
  })
})

describe('⭐ the Compare tab actually mounts the section', () => {
  const dock = (): string => read('../../../../canvas/components/OutputsDock.tsx')
  const body = (): string => read('../../../../canvas/compare-tab/CompareRunPairBody.tsx')

  it('⛔ the dock renders the Compare body on the compare tab, bound to the displayed analysis hash', () => {
    expect(dock()).toMatch(/import\s*\{\s*CompareRunPairBody\s*\}\s*from\s*'\.\.\/compare-tab\/CompareRunPairBody'/)
    expect(dock()).toMatch(/effectiveActiveTab === 'compare' && \([\s\S]{0,600}?<CompareRunPairBody responseHash=\{results\?\.hash\} \/>/)
  })

  it('⛔ the body renders the section, fed from the ONE shared reader', () => {
    expect(body()).toMatch(/useDisplayedRunDeltaView\(responseHash\)/)
    expect(body()).toMatch(/<WhatsChanged view=\{view\} \/>/)
  })

  it('contrast — the old browser-derived body is off the dock path', () => {
    expect(dock()).not.toMatch(/<CompareTabBodyV2/)
    expect(dock()).not.toMatch(/<CompareRunPairBodyThatDoesNotExist/)
  })
})

describe('⭐ the Model tab actually mounts the pointer', () => {
  const src = (): string => read('../../../../canvas/components/OutputsDock.tsx')

  it('imports the pointer', () => {
    expect(src()).toMatch(/import\s*\{\s*ViewComparisonPointer\s*\}\s*from\s*'\.\/model-tab\/ViewComparisonPointer'/)
  })

  it('⛔ and RENDERS it on the Model tab — whose code id is `diagnostics`, not "model"', () => {
    // The user-facing name is "Model"; the code id is `diagnostics`. They are
    // different strings and conflating them is a standing estate ruling.
    expect(src()).toMatch(/effectiveActiveTab === 'diagnostics' && <ViewComparisonPointer \/>/)
  })

  it('contrast — the probe can tell a present mount from an absent one', () => {
    expect(src()).not.toMatch(/<ViewComparisonPointerThatDoesNotExist/)
  })
})

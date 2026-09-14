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

describe('⭐ the Reasoning tab actually mounts the section', () => {
  const src = (): string => read('../AnalysisNewTabBody.tsx')

  it('imports the component', () => {
    expect(src()).toMatch(/import\s*\{\s*WhatsChanged\s*\}\s*from\s*'\.\/sections\/WhatsChanged'/)
  })

  it('⛔ and RENDERS it, fed from the view model', () => {
    expect(src()).toMatch(/<WhatsChanged\s+view=\{vm\.whatsChanged\}/)
  })

  it('contrast — the probe can tell a present mount from an absent one', () => {
    expect(src()).not.toMatch(/<WhatsChangedThatDoesNotExist/)
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

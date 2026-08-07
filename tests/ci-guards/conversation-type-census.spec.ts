/**
 * Conversation-panel type-scale census guard (lane F3).
 *
 * Runs scripts/conversation-type-census.mjs — which DERIVES every distinct
 * font-size / font-weight / line-height reaching the conversation panel and
 * the V5 block renderers (Tailwind utilities, typography.ts tokens, raw CSS
 * in Conversation.module.css, inline styles) — and pins the result to the
 * ONE type scale ruled by Paul (register 1.69(a), 12-Jul + 16-Jul):
 *
 *   sizes    11 / 12 / 14 px  + the named 24px first-use hero (welcomeHeading)
 *   weights  400 / 500 / 600
 *   leading  1.375 / 1.5 / 1.625
 *
 * Any future raw text-size utility, inline fontSize, or raw px font-size in
 * the CSS module (outside the --conv-type-* token block) turns this spec red.
 * The census script itself fails loud (exit 2) on any mechanism it cannot
 * resolve, so a hit can hide from this pin only by breaking the build.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const SCRIPT = path.resolve(__dirname, '../../scripts/conversation-type-census.mjs')

interface CensusSummary {
  errors: string[]
  files: number
  sizes: number[]
  weights: number[]
  lineHeights: string[]
  counts: { sizes: number; weights: number; lineHeights: number }
  rawMechanismHits: {
    tailwindSize: number
    inlineSize: number
    inlineWeight: number
    cssRawSize: number
    cssRawWeight: number
  }
}

function runCensus(): CensusSummary {
  const out = execFileSync('node', [SCRIPT, '--json'], { encoding: 'utf8' })
  return JSON.parse(out) as CensusSummary
}

describe('conversation-panel type-scale census (F3)', () => {
  const census = runCensus()

  it('census resolves every mechanism (no fail-loud errors)', () => {
    expect(census.errors).toEqual([])
    // Positive control: an empty scan would pass every absence assertion
    // below while testing nothing (trap-13). Prove the census SEES type.
    expect(census.files).toBeGreaterThan(50)
    expect(census.counts.sizes).toBeGreaterThan(0)
    expect(census.counts.weights).toBeGreaterThan(0)
  })

  it('font sizes collapse to the scale: 11 / 12 / 14 (+ named 24px hero)', () => {
    expect(census.sizes).toEqual([11, 12, 14, 24])
    expect(census.counts.sizes).toBeLessThanOrEqual(4)
  })

  it('font weights collapse to 400 / 500 / 600', () => {
    expect(census.weights).toEqual([400, 500, 600])
  })

  it('line-heights collapse to 1.375 / 1.5 / 1.625', () => {
    for (const lh of census.lineHeights) {
      expect(['1.375', '1.5', '1.625']).toContain(lh)
    }
  })

  it('no raw (token-bypassing) size or weight mechanisms remain', () => {
    expect(census.rawMechanismHits).toEqual({
      tailwindSize: 0,
      inlineSize: 0,
      inlineWeight: 0,
      cssRawSize: 0,
      cssRawWeight: 0,
    })
  })
})

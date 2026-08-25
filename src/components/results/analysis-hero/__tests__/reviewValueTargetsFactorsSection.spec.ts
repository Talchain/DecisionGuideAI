/**
 * The act must deep-link to a REAL Model-tab section.
 *
 * ⚠ WRITTEN BECAUSE THE FIRST VERSION PASSED THE WRONG STRING AND NOTHING RED.
 * `requestModelTabSection` takes a section NAME. `MODEL_SECTION_TARGET`
 * (`canvas/components/ModelTabBody.tsx:123`) maps names to testids, and its
 * consumer coalesces a miss to the panel top (`:243`, `?? 'model-tab-v2-panel'`).
 * So passing the TESTID degrades silently rather than throwing: the user lands at
 * the top of the outline with nothing selected — the exact failure the call was
 * added to fix. A silent fallback on a navigation target will do this again, which
 * is why the assertion below is about MEMBERSHIP OF THE DERIVED KEY SET and not
 * about equality with a particular string (a rename would satisfy equality while
 * pointing nowhere).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const CALLER = 'src/components/results/analysis-hero/AnalysisHeroContainer.tsx'
const MAP_HOST = 'src/canvas/components/ModelTabBody.tsx'

describe('the resolve-next act targets a real Model-tab section', () => {
  const caller = readFileSync(CALLER, 'utf8')
  const host = readFileSync(MAP_HOST, 'utf8')

  it('both files are tracked and non-empty (positive control)', () => {
    for (const f of [CALLER, MAP_HOST]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
    }
    expect(caller.length).toBeGreaterThan(1000)
    expect(host.length).toBeGreaterThan(1000)
  })

  /** Keys DERIVED from the host — never restated here (CLAUDE.md trap 12). */
  const sectionKeys = (): string[] => {
    const i = host.indexOf('const MODEL_SECTION_TARGET')
    expect(i, 'MODEL_SECTION_TARGET not found — renamed?').toBeGreaterThan(-1)
    const block = host.slice(i, host.indexOf('}', i))
    return [...block.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1])
  }

  it('derives a plausible key set, and the testid is NOT one of them', () => {
    const keys = sectionKeys()
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('factors')
    // ⚠ THE PREMISE PIN. If the testid ever became a key, this spec's whole
    // reason for existing would be void — it must fail loudly, not pass quietly.
    expect(keys).not.toContain('model-group-v2-factors')
  })

  it('requests the factors section BY KEY', () => {
    const m = caller.match(/requestModelTabSection\(\s*'([^']+)'\s*\)/)
    expect(m, 'no literal requestModelTabSection call found').toBeTruthy()
    const arg = m![1]
    expect(
      sectionKeys(),
      `requestModelTabSection('${arg}') is not a key of MODEL_SECTION_TARGET, so the `
        + "consumer's `?? 'model-tab-v2-panel'` fallback lands the user at the panel top.",
    ).toContain(arg)
    expect(arg).toBe('factors')
  })
})

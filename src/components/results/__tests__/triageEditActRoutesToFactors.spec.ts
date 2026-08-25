/**
 * The triage "edit" act must route to the Model tab's FACTORS group.
 *
 * ⚠ WRITTEN BECAUSE THE FIRST VERSION PASSED THE WRONG STRING AND NOTHING RED.
 * `requestModelTabSection` takes a section NAME; `MODEL_SECTION_TARGET` maps that
 * name to a testid, and its consumer coalesces a miss to the panel top
 * (`ModelTabBody.tsx:243`, `?? 'model-tab-v2-panel'`). So passing the TESTID is
 * silently degrading, never throwing: the user lands at the top of the outline
 * with nothing selected. A silent fallback on a navigation target is exactly the
 * shape that survives a green suite.
 *
 * This asserts the argument is a KEY OF THE MAP — not that it equals a particular
 * string, which a future rename would satisfy while pointing nowhere.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const CALLER = 'src/components/results/TriageActionCardsBody.tsx'
const MAP_HOST = 'src/canvas/components/ModelTabBody.tsx'

describe('the triage edit act targets a real Model-tab section', () => {
  const caller = readFileSync(CALLER, 'utf8')
  const host = readFileSync(MAP_HOST, 'utf8')

  it('both files are tracked and non-empty (positive control)', () => {
    for (const f of [CALLER, MAP_HOST]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
    }
    expect(caller.length).toBeGreaterThan(1000)
    expect(host.length).toBeGreaterThan(1000)
  })

  /** The map's KEYS, derived from the host — never restated here (trap 12). */
  const sectionKeys = (): string[] => {
    const i = host.indexOf('const MODEL_SECTION_TARGET')
    expect(i, 'MODEL_SECTION_TARGET not found — has it been renamed?').toBeGreaterThan(-1)
    const block = host.slice(i, host.indexOf('}', i))
    return [...block.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1])
  }

  it('derives a plausible key set (guards against a blind parse)', () => {
    const keys = sectionKeys()
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('factors')
    // Contrast: the TESTID must NOT be a key. If it ever is, this spec's whole
    // premise is void and it must fail rather than quietly pass.
    expect(keys).not.toContain('model-group-v2-factors')
  })

  it('requests the factors section BY KEY, not by testid', () => {
    const m = caller.match(/requestModelTabSection\(\s*'([^']+)'\s*\)/)
    expect(m, 'no literal requestModelTabSection call found in the caller').toBeTruthy()
    const arg = m![1]
    expect(
      sectionKeys(),
      `requestModelTabSection('${arg}') is not a key of MODEL_SECTION_TARGET, so the `
        + "consumer's `?? 'model-tab-v2-panel'` fallback will land the user at the panel "
        + 'top with nothing selected.',
    ).toContain(arg)
    expect(arg).toBe('factors')
  })
})

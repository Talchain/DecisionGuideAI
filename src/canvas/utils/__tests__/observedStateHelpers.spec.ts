import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'
import { isFactorNeedsInput } from '../observedStateHelpers'

const REPO_ROOT = resolve(__dirname, '../../../..')

/** Every tracked .ts/.tsx under src/, DERIVED from git — never a hand-listed set. */
function trackedSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Convergence guard for normaliseRawFactorValue
// ---------------------------------------------------------------------------
//
// The rule `cap != null && cap > 0 ? rawValue / cap : rawValue` was inlined in
// three components (OutputsDock, PreAnalysisPanel, CalibrateDrillIn) while
// `normaliseRawFactorValue` sat in observedStateHelpers as the supposed single
// home. Its docstring tried to track the copies BY NAME and had already gone
// stale — it listed two of the three, and the one it missed was the triage
// path. That is the hand-maintained-mirror defect: a list a human must
// remember to sync, whose drift always reads as green.
//
// So the list is gone and this guard replaces it. It DERIVES the file set from
// `git ls-files` and FAILS LOUD the moment the rule is re-inlined anywhere,
// including in a file that does not exist today.
describe('normaliseRawFactorValue is the single home for the raw→model-space rule', () => {
  // The literal spelling the three converged copies used. Matching on the
  // source text is the point: this is a copy-paste guard, not a type check.
  const INLINE_RULE = /cap\s*!=\s*null\s*&&\s*cap\s*>\s*0\s*\?[^\n]*\/\s*cap/

  it('POSITIVE CONTROL: the scan can see a rule that IS present', () => {
    // Prove the harness reads real bytes and the pattern can match, otherwise
    // the absence assertion below is vacuous. `normaliseRawFactorValue`'s own
    // body is the one legitimate occurrence of the division.
    const files = trackedSourceFiles()
    expect(files.length).toBeGreaterThan(100)

    const helper = readFileSync(resolve(REPO_ROOT, 'src/canvas/utils/observedStateHelpers.ts'), 'utf8')
    expect(helper).toMatch(/return rawValue \/ cap/)
    // ...and the pattern itself matches a known-positive sample.
    expect('const n = cap != null && cap > 0 ? rawValue / cap : rawValue').toMatch(INLINE_RULE)
  })

  it('finds NO re-inlined copy anywhere in src/', () => {
    const offenders = trackedSourceFiles().filter((file) => {
      // The canonical implementation is allowed to contain the division.
      if (file === 'src/canvas/utils/observedStateHelpers.ts') return false
      // This guard necessarily quotes the pattern it hunts.
      if (file === 'src/canvas/utils/__tests__/observedStateHelpers.spec.ts') return false
      return INLINE_RULE.test(readFileSync(resolve(REPO_ROOT, file), 'utf8'))
    })

    expect(
      offenders,
      `These files re-inline the raw→model-space rule instead of calling `
        + `normaliseRawFactorValue(rawValue, cap) from src/canvas/utils/observedStateHelpers.ts. `
        + `Import the helper — a second copy is how the cap guard drifts.`,
    ).toEqual([])
  })
})

describe('isFactorNeedsInput', () => {
  it('returns true when value, raw_value and display_value are all null', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: null, display_value: null },
      }),
    ).toBe(true)
  })

  it('returns true when observedState is missing entirely', () => {
    expect(isFactorNeedsInput({ category: 'controllable' })).toBe(true)
  })

  it('returns false when only value is set', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: 0.5 },
      }),
    ).toBe(false)
  })

  it('returns false when only raw_value is set (drift guard against value-only check)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: '£50,000' },
      }),
    ).toBe(false)
  })

  it('returns false when only display_value is set (drift guard against value-only check)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: null, display_value: 'High' },
      }),
    ).toBe(false)
  })

  it('returns false for external factors regardless of observed state', () => {
    expect(
      isFactorNeedsInput({
        category: 'external',
        observedState: { value: null, raw_value: null, display_value: null },
      }),
    ).toBe(false)
  })

  it('returns false when a prior range is present (parity with legacy isIncomplete)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { range_min: 100, range_max: 500 },
        observedState: {},
      }),
    ).toBe(false)
  })

  it('still treats partial prior (one bound only) as needs-input', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { range_min: 100 },
        observedState: {},
      }),
    ).toBe(true)
  })

  it('treats undefined fields as null (loose equality)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: {},
      }),
    ).toBe(true)
  })

  it('returns false when value is 0 (zero is a valid value for binary factors)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: 0 },
      }),
    ).toBe(false)
  })
})

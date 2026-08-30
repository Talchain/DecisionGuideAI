import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'
import { hasObservedData, isFactorNeedsInput } from '../observedStateHelpers'
import {
  VALUE_PROVENANCE_SOURCES,
  classifyValueProvenance,
} from '../../domain/valueProvenance'

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

  // ─────────────────────────────────────────────────────────────────────────
  // AN IGNORANCE PRIOR IS NOT EVIDENCE, SO IT MUST NOT INHERIT THE EXEMPTION
  // ─────────────────────────────────────────────────────────────────────────
  //
  // The prior exemption above exists because "a prior range counts as
  // user-supplied evidence". CEE PR #1223 stops substituting a placeholder
  // `0.5` and instead sends `prior: uniform(0,1)` carrying
  // `prior_is_unquantified: true`. Both bounds are non-null, so the exemption
  // fired — and the amber "needs your judgement" affordance stayed dark on
  // precisely the factors that need it.
  //
  // ⚠ THE DISCRIMINATOR IS THE FLAG, NEVER THE RANGE. `{0,1}` from a genuine
  // external prior and `{0,1}` from ignorance are byte-identical and mean
  // opposite things. The twin case below is what proves this predicate
  // discriminates on PROVENANCE rather than on arithmetic — it is the case a
  // "suppress the exemption when the range is (0,1)" fix gets wrong.

  it('⭐ #1223 SHAPE — an ignorance prior does NOT exempt: needs input', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { distribution: 'uniform', range_min: 0, range_max: 1, prior_is_unquantified: true },
      }),
    ).toBe(true)
  })

  it('⭐ THE TWIN — a GENUINE uniform(0,1) prior WITHOUT the flag keeps the exemption', () => {
    // Byte-identical to the case above except for the flag. #1223's own corpus
    // holds real unflagged uniform(0,1) priors (`fac_nrr`,
    // `fac_legal_clearance`), and `fac_weather` in the walk-582 export fixture
    // is another. A range predicate suppresses all of them.
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { distribution: 'uniform', range_min: 0, range_max: 1 },
      }),
    ).toBe(false)
  })

  it('POSITIVE CONTROL — a genuine NARROWED prior is unchanged (drawn from the shipped starters)', () => {
    // All 14 priors across the five shipped starters are narrowed (0.4–0.9,
    // 0.25–0.75, 0.3–0.8 …). This is the population the exemption was written
    // for and it must not move.
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { distribution: 'uniform', range_min: 0.4, range_max: 0.9 },
      }),
    ).toBe(false)
  })

  it('an ignorance prior does NOT override a value the USER supplied', () => {
    // Opposite-direction harm, and the worse one: telling a person the value
    // they supplied is not there. The flag describes the PRIOR; it says nothing
    // about a value that arrived afterwards.
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { distribution: 'uniform', range_min: 0, range_max: 1, prior_is_unquantified: true },
        observedState: { value: 0.42, source: 'user_override' },
      }),
    ).toBe(false)
  })

  it('the flag is read on the PRIOR, not on the node (a node-level flag exempts nothing)', () => {
    // Positive evidence only, and bound to the carrier CEE actually writes.
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior_is_unquantified: true,
        prior: { distribution: 'uniform', range_min: 0.4, range_max: 0.9 },
      } as Record<string, unknown>),
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasObservedData — a value the MODEL invented is not observed data
// ---------------------------------------------------------------------------
//
// WHY. CEE defaults a factor with no stated value to a neutral number and
// stamps it (`adapters/llm/normalisation.ts` → `observed_state.source =
// 'cee_inference'`, `extractionType: 'inferred'`). Witnessed on the deployed
// staging build (UI `489f5fc5`, permalink deploy `6a931cc56bd89d0008ecab16`,
// 2026-08-29): three controllable factors on the shipped market-entry starter
// carried `{ value: 0, source: 'cee_inference', extractionType: 'inferred' }`
// and a fourth carried `{ value: 0.5, … }`.
//
// `hasObservedData` asked only `typeof value === 'number'`, so every one of
// them answered TRUE — and `EvidenceGapBadge`, whose tooltip reads *"No
// observed data for X"*, was suppressed on exactly the factors that have none.
// The predicate that decides whether to say "no observed data" was satisfied by
// the placeholder that means there IS no observed data.
//
// ⚠ POSITIVE EVIDENCE ONLY, AND THE POLARITY IS THE WHOLE DESIGN. CEE's own
// `factor-value-provenance.ts` records getting this backwards: written
// fail-closed, a factor carrying a perfectly real number with no stamp landed
// in the invented tier, and the caller replaced real information with an
// assertion of ignorance it did not have. So this suppresses ONLY where a
// producer positively stamped the value as the model's own estimate. An absent
// or unrecognised `source` keeps the previous answer.
//
// ⚠ THE LITERALS ARE DERIVED, NEVER HAND-LISTED. `classifyValueProvenance` is
// the estate's one classification authority for "who put this number here"
// (`canvas/domain/valueProvenance.ts`); re-typing its `ai` members here would be
// the hand-maintained mirror that module exists to end.
describe('hasObservedData ignores a value the model stamped as its own estimate', () => {
  const AI_SOURCES = VALUE_PROVENANCE_SOURCES.filter(
    (s) => classifyValueProvenance(s)?.kind === 'ai',
  )
  const NON_AI_SOURCES = VALUE_PROVENANCE_SOURCES.filter(
    (s) => classifyValueProvenance(s)?.kind !== 'ai',
  )

  it('POSITIVE CONTROL: the derived source sets are non-empty and disjoint', () => {
    // Without this, both `it.each` blocks below can pass by iterating nothing —
    // a zero-case table is green and proves absolutely nothing.
    expect(AI_SOURCES.length).toBeGreaterThan(0)
    expect(NON_AI_SOURCES.length).toBeGreaterThan(0)
    expect(AI_SOURCES).toContain('cee_inference')
    expect(NON_AI_SOURCES).toContain('brief_extraction')
    expect(AI_SOURCES.filter((s) => NON_AI_SOURCES.includes(s))).toEqual([])
  })

  // ── The defect. Bound by IDENTITY to the producer's own stamp, never to the
  //    magnitude — a genuinely stated 0.5 must not satisfy this (trap 19).
  it.each(AI_SOURCES)(
    'returns FALSE for a number stamped `%s` — the model invented it',
    (source) => {
      expect(
        hasObservedData({
          observedState: { value: 0.5, source, extractionType: 'inferred' },
        }),
      ).toBe(false)
    },
  )

  it('returns FALSE for the exact shape witnessed on the deployed starter', () => {
    // fac_germany, market-entry starter, deploy 6a931cc56bd89d0008ecab16.
    expect(
      hasObservedData({
        observedState: {
          value: 0,
          source: 'cee_inference',
          extractionType: 'inferred',
          factor_type: 'other',
          uncertainty_drivers: ['Not provided'],
        },
      }),
    ).toBe(false)
  })

  // ── THE OPPOSITE-DIRECTION TWIN. A fix that stops hiding gaps must not start
  //    inventing them. Every non-`ai` stamp, and the unstamped case, must still
  //    read as observed — otherwise the badge claims "no observed data" over a
  //    number the user supplied, which is the worse of the two harms.
  it.each(NON_AI_SOURCES)(
    'TWIN: returns TRUE for a number stamped `%s` — a person or the brief owns it',
    (source) => {
      expect(hasObservedData({ observedState: { value: 0.5, source } })).toBe(true)
    },
  )

  it('TWIN: returns TRUE for a number with NO source stamp at all', () => {
    // Absent evidence is not evidence of invention. This is the polarity CEE's
    // own provenance module got wrong first time; it is pinned, not assumed.
    expect(hasObservedData({ observedState: { value: 0.5 } })).toBe(true)
  })

  it('TWIN: returns TRUE for a number carrying an UNRECOGNISED source literal', () => {
    expect(
      hasObservedData({ observedState: { value: 0.5, source: 'some_future_writer' } }),
    ).toBe(true)
  })

  it('TWIN: a user-confirmed 0.5 is observed even though the default is also 0.5', () => {
    // The magnitude is identical to CEE's placeholder. Only the stamp separates
    // them, which is exactly why the stamp — not the number — is the predicate.
    expect(
      hasObservedData({ observedState: { value: 0.5, source: 'user_confirmed' } }),
    ).toBe(true)
  })

  // ── Pre-existing behaviour that must not move.
  it('still returns FALSE when observed_state is absent entirely', () => {
    expect(hasObservedData({})).toBe(false)
    expect(hasObservedData(undefined)).toBe(false)
  })

  it('still returns FALSE when a stamped observed_state carries no numeric value', () => {
    expect(hasObservedData({ observedState: { source: 'user_confirmed' } })).toBe(false)
  })

  it('reads the snake_case spelling the CEE/PLoT wire uses', () => {
    expect(
      hasObservedData({ observed_state: { value: 0.5, source: 'cee_inference' } }),
    ).toBe(false)
    expect(
      hasObservedData({ observed_state: { value: 0.5, source: 'brief_extraction' } }),
    ).toBe(true)
  })
})

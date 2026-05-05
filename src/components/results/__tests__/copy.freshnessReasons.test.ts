/**
 * Tests for the curated freshness/completeness reason-copy table
 * (P0 V5 golden-path repair, Wave 4).
 *
 * Acceptance:
 *   - Every code in the tables resolves to non-empty British-English copy.
 *   - Unknown codes fall through to the generic line — the raw code never
 *     appears verbatim.
 *   - Copy contains no internal terms (`Zod`, `noop`, `patch`, raw IDs,
 *     internal mechanics).
 */

import { describe, it, expect } from 'vitest'

import {
  FRESHNESS_REASON_COPY,
  COMPLETENESS_REASON_COPY,
  freshnessReasonCopy,
  completenessReasonCopy,
} from '../copy/freshnessReasons'

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bnoop\b/i,
  /\bzod\b/i,
  /\bpatch\b/i,
  /\bnormalised\b/i,
  /\bnormalized\b/i,
  /\bfact_type\b/i,
  /\bgraph_hash\b/i,
  /\bhandler\b/i,
  /\bBUDGET_TARGET\b/i,
  /\bset_factor_value\b/i,
  /\bedit_graph\b/i,
  /\bfac_/,
  /\bopt_/,
  /\bgoal_/,
]

describe('freshnessReasonCopy — known codes', () => {
  it('every code in FRESHNESS_REASON_COPY resolves to non-empty British copy', () => {
    for (const [code, copy] of Object.entries(FRESHNESS_REASON_COPY)) {
      expect(copy.length, `code ${code} must have copy`).toBeGreaterThan(0)
      expect(freshnessReasonCopy(code)).toBe(copy)
      // Sentence case (starts with uppercase letter)
      expect(copy[0]).toMatch(/[A-Z']/)
      // No em dashes
      expect(copy).not.toMatch(/—/)
      // Forbidden internal vocabulary
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(copy, `${code}: ${copy}`).not.toMatch(pat)
      }
    }
  })

  it('returns generic fallback for unknown codes — raw code never echoed', () => {
    const out = freshnessReasonCopy('definitely_not_a_known_code_42')
    expect(out).not.toContain('definitely_not_a_known_code_42')
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns generic fallback for null / undefined', () => {
    expect(freshnessReasonCopy(null)).toBe(freshnessReasonCopy(undefined))
    expect(freshnessReasonCopy(null)).toMatch(/freshness/i)
  })
})

describe('completenessReasonCopy — known codes', () => {
  it('every code in COMPLETENESS_REASON_COPY resolves to non-empty British copy', () => {
    for (const [code, copy] of Object.entries(COMPLETENESS_REASON_COPY)) {
      expect(copy.length, `code ${code} must have copy`).toBeGreaterThan(0)
      expect(completenessReasonCopy(code)).toBe(copy)
      expect(copy).not.toMatch(/—/)
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(copy, `${code}: ${copy}`).not.toMatch(pat)
      }
    }
  })

  it('returns generic fallback for unknown codes', () => {
    const out = completenessReasonCopy('made_up_code')
    expect(out).not.toContain('made_up_code')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('coverage — codes the selectors actually emit are all in the table', () => {
  // Wave 3 emits these freshness reason codes in the local-fallback path.
  // Wave 4 emits these completeness reason codes from useResultCompleteness.
  const FRESHNESS_CODES_USED = [
    // From CEE
    'graph_hash_match',
    'graph_hash_diverged',
    'legacy_fact_missing_hash',
    'current_graph_hash_unavailable',
    'no_successful_run_analysis_fact',
    'derivation_failed',
    'invariant_failed',
    // From local fallback
    'local_graph_edited',
    'local_results_match',
    'no_options_yet',
    'no_successful_run_yet',
    'cee_freshness_unknown',
  ]
  const COMPLETENESS_CODES_USED = [
    'win_probability_missing',
    'sensitivity_missing',
    'robustness_unavailable',
    'decision_review_unavailable',
    'expected_outcome_missing',
    'analysis_partial',
  ]

  it('all freshness codes used by the selector have entries in the table', () => {
    for (const code of FRESHNESS_CODES_USED) {
      expect(FRESHNESS_REASON_COPY[code], `missing copy for ${code}`).toBeDefined()
    }
  })

  it('all completeness codes used by the selector have entries in the table', () => {
    for (const code of COMPLETENESS_CODES_USED) {
      expect(
        COMPLETENESS_REASON_COPY[code],
        `missing copy for ${code}`,
      ).toBeDefined()
    }
  })
})

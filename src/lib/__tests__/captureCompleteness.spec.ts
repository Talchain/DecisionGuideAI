/**
 * ⭐⭐ A SILENT `null` AND A DELIBERATE OMISSION LOOK IDENTICAL — and that is
 * why a capability can be dark for months while every bundle looks the same.
 *
 * MEASURED on two real support bundles (18 and 19 Sep 2026), same counts in
 * both: SEVENTEEN diagnostic carriers null, absent or empty — the assembled
 * prompt, the raw LLM response, the pipeline internals, the client logs. A
 * reader cannot tell "no producer writes this" from "this turn had none" from
 * "removed for safety".
 *
 * ⭐ THE ONE GAP THAT WAS FINDABLE PROVES THE DESIGN. The user's brief arrived
 * carrying `[truncated_by: bundle_redaction, 1140 chars total]` — so a reader
 * learns immediately that 86 characters of their own words are missing, and
 * why. That was the ONLY absence that announced itself, and the only one that
 * did not need someone to go looking. This gives every other absence the same
 * property.
 */

import { describe, expect, it } from 'vitest'

import {
  EXPECTED_BUNDLE_PATHS,
  collectAbsentExpected,
  buildDebugRedactionManifest,
} from '../debugRedactionManifest'

describe('capture completeness', () => {
  it('reports a declared path that the bundle does not carry, with what it answers', () => {
    const absent = collectAbsentExpected({ pipeline: {} })
    const zone2 = absent.find((a) => a.path === 'pipeline.zone2_assembly')
    expect(zone2, 'zone2_assembly absent and not reported').toBeDefined()
    // The reader must learn what they LOST, not just that a key is missing.
    expect(zone2!.answers).toContain('context sections')
    // A cause established from evidence is reported; nothing is guessed.
    expect(zone2!.cause).toBe('producer_never_populated')
  })

  it('a PRESENT path is not reported — so the list cannot cry wolf', () => {
    // The discriminating half. Without it the collector could report every
    // declared path unconditionally and the assertion above would still pass.
    const absent = collectAbsentExpected({
      pipeline: { zone2_assembly: { total_chars: 100, section_count: 3 } },
    })
    expect(absent.map((a) => a.path)).not.toContain('pipeline.zone2_assembly')
  })

  it('NULL and EMPTY count as absent — the whole point is that they are indistinguishable', () => {
    for (const bundle of [
      { pipeline: { zone2_assembly: null } },
      { pipeline: { zone2_assembly: {} } },
      { console_logs: [] },
    ]) {
      expect(collectAbsentExpected(bundle).length).toBeGreaterThan(0)
    }
  })

  it('an UNKNOWN cause is reported as unknown, never guessed', () => {
    // `zone1_prompt_id` is declared with no `known_cause`, because nobody has
    // established one. An honest `unknown` beats a plausible cause that sends
    // the next reader to the wrong producer.
    const absent = collectAbsentExpected({})
    const z1 = absent.find((a) => a.path === 'zone1_prompt_id')
    expect(z1!.cause).toBe('unknown')
  })

  it('the manifest ALWAYS emits the key, so empty means checked-and-clean', () => {
    // ⚠ The distinction this file exists for. If the field were omitted when
    // empty, a reader could not tell "everything present" from "check did not
    // run" — recreating the exact ambiguity being removed.
    const m = buildDebugRedactionManifest({ payloads: {} }, [])
    expect(Object.keys(m)).toContain('absent_expected')
    expect(Array.isArray(m.absent_expected)).toBe(true)
  })

  it('every declared path states what it answers, in plain language', () => {
    // A path whose loss nobody can describe is a path nobody will restore.
    for (const e of EXPECTED_BUNDLE_PATHS) {
      expect(e.answers.length, `${e.path} has no description`).toBeGreaterThan(20)
      expect(e.answers, `${e.path} describes a field, not a loss`).not.toMatch(/^the \w+ field$/i)
    }
  })
})

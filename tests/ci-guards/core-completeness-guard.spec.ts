// tests/ci-guards/core-completeness-guard.spec.ts
// =============================================================================
// THE GUARD THAT GUARDS SYSTEM E'S GUARD.
// =============================================================================
//
// System E (`playwright.core.config.ts`) drives the deployed build in a real
// browser. It is ADVISORY BUT NOT OPTIONAL-TO-RUN, and the distinction is the whole
// point: the `Core E2E · System E (advisory)` job in `staging-full-tests.yml` runs on
// EVERY pull request into `staging` and every push to `staging`, and NOTHING schedules
// it. It is `continue-on-error` and absent from the `Staging Gate` aggregator's
// `needs`, so a red there is loud and does not block a merge — a mounted-browser suite
// against a mutable target is not a merge gate.
//
// ⚠ THIS PARAGRAPH PREVIOUSLY SAID "advisory and scheduled — it does NOT run on every
// pull request". BOTH HALVES WERE FALSE at the commit that introduced them: nothing
// scheduled it, and it does run on every PR. (`schedule:` could not have worked here
// anyway — GitHub fires it only on the default branch, `main`.) It is corrected rather
// than deleted because of WHERE it sat: this is the falsification engine describing
// itself, and the next person deciding whether to trust a green run reads exactly this
// line. A false label on a guard is what teaches people to stop looking.
//
// What that posture leaves is one thing that MUST be checked on the merge path itself:
// the completeness guard's own arithmetic. This suite's whole claim is
// "a run that measured nothing cannot report success", and that claim shipped FALSE.
//
// WHAT SHIPPED, AND WHY IT WAS INVISIBLE. `EXPECTED_CORE_SPECS` declared seven names
// while three spec files existed, so a PERFECT run of everything that ships still
// failed the guard with four missing. The only green mode was therefore
// `CORE_PARTIAL=1` — and that flag was consulted BEFORE the zero-ran limb. The two
// composed: every describe skipped + `CORE_PARTIAL=1` exited 0 and printed
// "Ran 0 of 7: (none)". Measured on build 18727b64, 2026-08-28, before the repair.
//
// ⚠ NOTE WHAT COULD NOT HAVE CAUGHT THAT. Not the exit code, not the failure count,
// not CI — CI had never executed these specs at all. A defect in a falsification
// engine does not make one feature wrong; it makes every PASS it ever prints
// meaningless, silently. So the arithmetic is pinned here, where it runs on every PR
// in a few milliseconds and needs no browser and no deployed target.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

import {
  footerCopy, literalRe, readinessVerdict, BLOCKING_VOCAB,
} from '../../e2e/core/lib/harness'
import {
  assertDeclaredSpecsExist,
  assertRunCompleteness,
  CORE_SPEC_DIR,
  EXPECTED_CORE_SPECS,
  PLANNED_CORE_SPECS,
  specFilesOnDisk,
} from '../../e2e/core/lib/manifest'

const SHIPPED = [...EXPECTED_CORE_SPECS]

/** A scratch spec dir. Named per-test so two cases can never share a fixture. */
const tmpDirs: string[] = []
function specDirContaining(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'core-manifest-'))
  tmpDirs.push(dir)
  for (const n of names) writeFileSync(join(dir, `${n}.core.spec.ts`), '// fixture\n')
  // A decoy that must NOT be collected: only `*.core.spec.ts` counts.
  writeFileSync(join(dir, 'notes.md'), 'not a spec\n')
  writeFileSync(join(dir, 'helper.ts'), '// not a spec\n')
  return dir
}
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }) })

describe('System E · the zero-ran limb cannot be suppressed', () => {
  // ⭐ THE REGRESSION PIN. This is the exact defect that shipped: `partial` used to
  // be consulted first and returned before this check could run.
  it('THROWS on a zero-ran run even when CORE_PARTIAL=1 is set', () => {
    expect(() => assertRunCompleteness(SHIPPED, [], true)).toThrow(/ZERO Core specs executed/)
  })

  it('THROWS on a zero-ran run when the guard is armed', () => {
    expect(() => assertRunCompleteness(SHIPPED, [], false)).toThrow(/ZERO Core specs executed/)
  })

  // The message must name the specs, because "expected 3" alone does not tell an
  // operator WHICH measurement is missing.
  it('names the expected specs BY NAME in the zero-ran message', () => {
    let msg = ''
    try { assertRunCompleteness(SHIPPED, [], true) } catch (e) { msg = (e as Error).message }
    for (const name of SHIPPED) expect(msg).toContain(name)
  })

  // ── DISCRIMINATING PAIR ──────────────────────────────────────────────────────
  // The check above must bite on ZERO specifically, not on "CORE_PARTIAL is set".
  // Break it for the named object (nothing ran) -> RED, above. Break it for a
  // DIFFERENT object (a genuine subset ran) -> must stay GREEN, here. Without this
  // second half, deleting the whole `partial` branch would pass every test above,
  // and a legitimate `--grep E1` run would start failing.
  it('ALLOWS a genuine partial run: one spec ran, CORE_PARTIAL=1', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => assertRunCompleteness(SHIPPED, [SHIPPED[0]], true)).not.toThrow()
    expect(log.mock.calls.flat().join(' ')).toContain('CORE_PARTIAL=1')
    log.mockRestore()
  })

  it('REJECTS that same partial run when the guard is ARMED', () => {
    expect(() => assertRunCompleteness(SHIPPED, [SHIPPED[0]], false))
      .toThrow(/DID NOT RUN/)
  })
})

describe('System E · the armed guard is REACHABLE — a perfect run is green', () => {
  // The defect that forced `CORE_PARTIAL=1` to become permanent was that this case
  // was IMPOSSIBLE. If this test ever fails, the declared list has drifted ahead of
  // the shipped files again and the guard is on its way to being switched off.
  it('a run of every declared spec passes with the guard ARMED', () => {
    expect(() => assertRunCompleteness(SHIPPED, [...SHIPPED], false)).not.toThrow()
  })

  it('still reports a spec that ran but was never declared', () => {
    expect(() => assertRunCompleteness(SHIPPED, [...SHIPPED, 'E9-unlisted'], false))
      .toThrow(/RAN BUT NOT EXPECTED/)
  })

  it('still reports a duplicate registration', () => {
    expect(() => assertRunCompleteness(SHIPPED, [...SHIPPED, SHIPPED[0]], false))
      .toThrow(/DUPLICATE REGISTRATION/)
  })
})

describe('System E · the declared list is DERIVED-CHECKED against the files on disk', () => {
  // Non-vacuity: assert the instrument sees something before trusting an absence.
  it('reads the real spec dir and finds the shipped specs', () => {
    const onDisk = specFilesOnDisk(CORE_SPEC_DIR)
    expect(
      onDisk.length,
      `[core] specFilesOnDisk read ZERO specs from ${CORE_SPEC_DIR}. Every claim below would ` +
      `be unsupported — a blind reader and an empty directory produce identical output.`,
    ).toBeGreaterThan(0)
    expect(onDisk).toEqual([...SHIPPED].sort())
  })

  it('collects ONLY *.core.spec.ts — not helpers, not docs', () => {
    expect(specFilesOnDisk(specDirContaining(SHIPPED))).toEqual([...SHIPPED].sort())
  })

  it('PASSES against the repo as it actually ships', () => {
    expect(() => assertDeclaredSpecsExist(CORE_SPEC_DIR)).not.toThrow()
  })

  // The precise shape that shipped: a name declared with no file behind it.
  it('THROWS when a declared spec has no file, and says so specifically', () => {
    const dir = specDirContaining(SHIPPED.slice(1))
    expect(() => assertDeclaredSpecsExist(dir)).toThrow(/DECLARED BUT NO FILE/)
    expect(() => assertDeclaredSpecsExist(dir)).toThrow(new RegExp(SHIPPED[0]))
  })

  it('THROWS when a spec file exists that nothing declared', () => {
    expect(() => assertDeclaredSpecsExist(specDirContaining([...SHIPPED, 'E9-unlisted'])))
      .toThrow(/FILE BUT NOT DECLARED/)
  })

  it('THROWS rather than silently passing when the spec dir does not exist', () => {
    expect(() => assertDeclaredSpecsExist(join(tmpdir(), 'core-manifest-does-not-exist')))
      .toThrow(/DECLARED BUT NO FILE/)
  })
})

describe('System E · footerCopy derives from the product, and fails loud', () => {
  // E2's proceeding-arm assertion is built from this. If it ever returned an empty
  // string, `literalRe('')` would match everything and that assertion would pass
  // against a surface saying nothing at all — vacuous, silently. So the deriver's
  // failure mode is pinned here, in the required suite.
  it('derives the real qualifying sentence from the product source', () => {
    const s = footerCopy('readySubSuccessUnset')
    expect(s.length, '[core] footerCopy returned an empty string — every expectation ' +
      'built on it would be vacuous').toBeGreaterThan(10)
    expect(s).toBe('First pass will be provisional until success is defined')
  })

  it('THROWS on a key that does not exist, rather than returning empty', () => {
    expect(() => footerCopy('noSuchFooterKey')).toThrow(/could not be derived/)
  })

  it('THROWS when the source file is missing, rather than returning empty', () => {
    expect(() => footerCopy('readySubSuccessUnset', join(tmpdir(), 'no-such-constants.ts')))
      .toThrow()
  })

  // The escaper must match the sentence literally — a regex metacharacter in the
  // copy must not silently widen what counts as "qualified".
  it('literalRe matches the sentence literally and not a near-miss', () => {
    const re = literalRe(footerCopy('readySubSuccessUnset'))
    expect(re.test('Analysis available First pass will be provisional until success is defined')).toBe(true)
    expect(re.test('Not ready for analysis yet')).toBe(false)
    expect(literalRe('a.c').test('abc')).toBe(false)
  })
})

describe('System E · the readiness coupling cannot be satisfied by a lie', () => {
  // ⛔ THE REGRESSION PIN FOR THE DEFECT THAT SHIPPED IN THIS PR.
  // The first coupling asserted `(analyseDisabled || reportsGap)` and then `reportsGap`
  // unconditionally. `(A || B) AND B` reduces to `B`, so the button state was measured
  // but never load-bearing, and the LYING row below passed. Every row here is checked
  // on every PR, because the PROCEEDING arm is the one a live run usually cannot reach.
  const QUAL = literalRe(footerCopy('readySubSuccessUnset'))
  const v = (analyseDisabled: boolean, surface: string) =>
    readinessVerdict({ analyseDisabled, surface, qualifying: QUAL, blockingVocab: BLOCKING_VOCAB })
  const CAVEAT = footerCopy('readySubSuccessUnset')

  it('HONEST proceeding — enabled, and the surface qualifies the run', () => {
    const r = v(false, `Analysis available ${CAVEAT}`)
    expect(r.arm).toBe('PROCEEDING')
    expect(r.honest).toBe(true)
  })

  it('HONEST blocking — disabled, and the surface says why', () => {
    const r = v(true, 'Not ready for analysis yet Set a success threshold')
    expect(r.arm).toBe('BLOCKING')
    expect(r.honest).toBe(true)
  })

  // ⭐ THE ROW THE OLD FORMULATION GOT WRONG. It is a lie in the opposite direction
  // from the one E2 originally hunted: the surface claims the model is not ready while
  // the product leaves the run on offer.
  it('DISHONEST — claims "not ready" while the button is ENABLED', () => {
    const r = v(false, 'Not ready for analysis yet')
    expect(r.arm).toBe('PROCEEDING')
    expect(r.honest).toBe(false)
  })

  it('DISHONEST — enabled and the surface says nothing qualifying', () => {
    expect(v(false, 'Analysis available').honest).toBe(false)
  })

  it('DISHONEST — disabled and the surface never says why', () => {
    expect(v(true, 'Analysis available').honest).toBe(false)
  })

  // Non-vacuity: the qualifying pattern must be a real sentence, not an empty regex
  // that matches everything and makes the PROCEEDING arm unfailable.
  it('the derived qualifying pattern cannot match an arbitrary surface', () => {
    expect(QUAL.test('some unrelated readiness copy')).toBe(false)
  })
})

describe('System E · planned specs are documentation, never enforcement', () => {
  // A name in an ENFORCED list is a claim that a spec ran. A spec that does not
  // exist cannot run, so ambition belongs in a list the guard never reads.
  it('no planned spec leaks into the enforced set', () => {
    for (const planned of PLANNED_CORE_SPECS) expect(SHIPPED).not.toContain(planned)
  })

  it('E6 is in NEITHER list — its surfaces were never observed to mount', () => {
    const everywhere = [...SHIPPED, ...PLANNED_CORE_SPECS].join(' ')
    expect(everywhere).not.toMatch(/\bE6\b/)
  })
})

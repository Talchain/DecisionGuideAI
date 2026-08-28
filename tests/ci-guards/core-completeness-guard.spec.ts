// tests/ci-guards/core-completeness-guard.spec.ts
// =============================================================================
// THE GUARD THAT GUARDS SYSTEM E'S GUARD.
// =============================================================================
//
// System E (`playwright.core.config.ts`) drives the deployed build in a real
// browser. It is advisory and scheduled — it does NOT run on every pull request,
// because a mounted-browser suite against a mutable target is not a merge gate.
//
// That is a deliberate trade, and it leaves one thing that MUST still be checked on
// every PR: the completeness guard's own arithmetic. This suite's whole claim is
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

/**
 * Self-test for the DS v5 compliance ratchet guard
 * (tools/ci-guards/check-ds-compliance.mjs).
 *
 * Proves, against ISOLATED fixtures (tools/ci-guards/__fixtures__/ds-compliance),
 * that the ratchet/hard-fail LOGIC works, and that `--update` cannot wind the
 * ratchet backwards silently. The production gate scans `src/` only and never
 * these fixtures; it is now ENFORCING, in ci.yml and — because only that one is a
 * required check — in staging-full-tests.yml's `tsc` job.
 *
 * The token-level false-positive classes that kept this guard advisory for a month
 * (PR refs in comment prose and in string literals) are pinned separately, in
 * tests/ci-guards/ds-token-context.spec.ts.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const GUARD = 'tools/ci-guards/check-ds-compliance.mjs'
const FX = 'tools/ci-guards/__fixtures__/ds-compliance'

/**
 * BOTH streams, on BOTH outcomes. The previous helper used execFileSync, whose
 * return value is stdout only, so anything the guard warned on stderr while still
 * exiting 0 was invisible to a test — which is exactly the shape of a guard that
 * "prints loudly" and is never observed doing it.
 */
function run(args: string[]): { status: number; out: string } {
  const r = spawnSync('node', [GUARD, ...args], { encoding: 'utf8' })
  if (r.error) throw r.error
  return { status: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

describe('DS v5 compliance ratchet guard', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'ds-guard-'))
  const empty = path.join(tmp, 'empty.json')
  writeFileSync(empty, JSON.stringify({ classes: {} }))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('HARD-FAIL: catches net-new gating violations (dirty vs empty baseline) under --enforce', () => {
    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', empty, '--enforce'])
    expect(status).toBe(1)
    expect(out).toMatch(/legacy-tailwind-token/)
    expect(out).toMatch(/production-hex/)
  })

  it('CLEAN: a violation-free tree passes under --enforce', () => {
    const { status } = run(['--root', `${FX}/clean`, '--baseline', empty, '--enforce'])
    expect(status).toBe(0)
  })

  it('RATCHET: current == baseline passes (no net-new)', () => {
    const bl = path.join(tmp, 'dirty-baseline.json')
    run(['--root', `${FX}/dirty`, '--baseline', bl, '--update'])
    const { status } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--enforce'])
    expect(status).toBe(0)
  })

  it('REPORT-ONLY: emoji-icon class never gates, even under --enforce', () => {
    const { status, out } = run(['--root', `${FX}/report-only`, '--baseline', empty, '--enforce'])
    expect(status).toBe(0)
    expect(out).toMatch(/emoji-icon/)
  })

  it('SOAK: default mode (no --enforce) never exits non-zero, even with violations', () => {
    const { status } = run(['--root', `${FX}/dirty`, '--baseline', empty])
    expect(status).toBe(0)
  })

  it('EXCLUSIONS + positive control: ignores debug-path / var() / .module.css hex but still detects an included path', () => {
    // excluded/ holds 3 excluded hex (debug-path, var() fallback, .module.css) PLUS
    // included-sample.tsx. A correct scan counts exactly the 1 included one — proving
    // exclusions work AND the scanner is not silently excluding the whole root.
    const { status, out } = run(['--root', `${FX}/excluded`, '--baseline', empty])
    expect(status).toBe(0)
    expect(out).toMatch(/production-hex \[ratchet\]: 1\b/)
  })

  it('BASELINE HONESTY: --update REFUSES to raise a gating signature count, and names what it refused', () => {
    // A baseline you can wind backwards without saying so is not a ratchet.
    // Bootstrap a CLEAN baseline, then point the same baseline at the DIRTY tree:
    // regenerating would raise gating counts, so the update must refuse.
    const bl = path.join(tmp, 'ratchet-clean.json')
    const boot = run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    expect(boot.status).toBe(0)
    const before = readFileSync(bl, 'utf8')

    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--update'])
    expect(status).toBe(1)
    expect(out).toMatch(/REFUSED/)
    expect(out).toMatch(/may only move DOWNWARD/)
    // It must name the class it refused, not just fail.
    expect(out).toMatch(/production-hex/)
    // And the refusal must not have written the file.
    expect(readFileSync(bl, 'utf8')).toBe(before)
  })

  it('BASELINE HONESTY: --update --force blesses an increase but PRINTS every signature raised', () => {
    const bl = path.join(tmp, 'ratchet-forced.json')
    run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--update', '--force'])
    expect(status).toBe(0)
    expect(out).toMatch(/FORCED past the ratchet assertion/)
    expect(out).toMatch(/production-hex/)
    expect(out).toMatch(/baseline written/)
    // Blessed, therefore now the ratchet floor — and green from here.
    expect(run(['--root', `${FX}/dirty`, '--baseline', bl, '--enforce']).status).toBe(0)
  })

  it('BASELINE HONESTY: a DOWNWARD move is allowed without --force', () => {
    const bl = path.join(tmp, 'ratchet-down.json')
    run(['--root', `${FX}/dirty`, '--baseline', bl, '--update', '--force'])
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    expect(status).toBe(0)
    expect(out).toMatch(/ratchet assertion PASSED/)
  })

  it('MISCONFIG: a missing/unreadable baseline FAILS even in report-only (default) mode', () => {
    const missing = path.join(tmp, 'does-not-exist.json')
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', missing]) // default = report-only
    expect(status).not.toBe(0)
    expect(out).toMatch(/misconfiguration|missing or unreadable/i)
  })

  it('MISCONFIG: a corrupt (unparseable) baseline FAILS even in report-only (default) mode', () => {
    const corrupt = path.join(tmp, 'corrupt.json')
    writeFileSync(corrupt, '{ this is not valid json ]')
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', corrupt]) // default = report-only
    expect(status).not.toBe(0)
    expect(out).toMatch(/misconfiguration|missing or unreadable/i)
  })
})

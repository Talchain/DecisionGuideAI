/**
 * Self-test for the DS v5 compliance ratchet guard
 * (tools/ci-guards/check-ds-compliance.mjs).
 *
 * Proves, against ISOLATED fixtures (tools/ci-guards/__fixtures__/ds-compliance),
 * that the ratchet/hard-fail LOGIC works — even though the production gate ships
 * report-only/soak. The production gate scans `src/` only and never these fixtures.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const GUARD = 'tools/ci-guards/check-ds-compliance.mjs'
const FX = 'tools/ci-guards/__fixtures__/ds-compliance'

function run(args: string[]): { status: number; out: string } {
  try {
    const out = execFileSync('node', [GUARD, ...args], { encoding: 'utf8' })
    return { status: 0, out }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { status: err.status ?? 1, out: (err.stdout ?? '') + (err.stderr ?? '') }
  }
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

  it('MISCONFIG: a missing/unreadable baseline FAILS even in report-only (default) mode', () => {
    const missing = path.join(tmp, 'does-not-exist.json')
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', missing]) // default = report-only
    expect(status).not.toBe(0)
    expect(out).toMatch(/misconfiguration|missing or unreadable/i)
  })
})

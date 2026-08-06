/**
 * ROADMAP 2.666 — `check:vendor` must notice a tarball that matches no pin.
 *
 * `vendor/` carried `talchain-schemas-0.32.0.tgz` and `-0.34.0.tgz` long after
 * the pin moved to 0.38.0, while `vendor/README.md`'s own "Current contents"
 * section listed 0.38.0 alone. The gate could not see it: it derives ONE
 * filename from `package.json` and checks ONLY that file, so every stale
 * tarball beside it is invisible by construction — a guard that verifies the
 * thing it was pointed at and says nothing about the directory it lives in.
 *
 * The two coexisting tarballs are the hazard, not the wasted bytes: a reader
 * (or a script) resolving "the vendored schemas tarball" from a directory
 * listing has three answers and no way to tell which is live.
 *
 * These tests run the REAL script as a subprocess against the REAL repo, so
 * they prove the shipped gate behaves, not that a helper function does. Each
 * plants its own uniquely-named artefact and removes it in `finally`.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')  // tests/ci-guards → repo root
const SCRIPT = resolve(REPO_ROOT, 'scripts', 'check-vendor-sha.mjs')
const VENDOR = resolve(REPO_ROOT, 'vendor')

/** Run the gate. Returns { code, stderr } instead of throwing. */
function runGate(): { code: number; stderr: string } {
  try {
    execFileSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, stdio: 'pipe' })
    return { code: 0, stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer }
    return { code: e.status ?? 1, stderr: e.stderr?.toString() ?? '' }
  }
}

describe('check:vendor — orphaned tarballs', () => {
  it('passes on the repo as committed (positive control)', () => {
    // Without this, every assertion below could be passing because the gate is
    // broken outright rather than because it detected the orphan.
    expect(runGate().code).toBe(0)
  })

  it('vendor/ holds exactly one tarball, and it is the pinned one', () => {
    // The state 2.666 restores, asserted directly so a future re-import of a
    // stale tarball fails here even if someone weakens the script.
    const tarballs = readdirSync(VENDOR).filter((f) => f.endsWith('.tgz'))
    expect(tarballs).toHaveLength(1)
    const pkg = JSON.parse(
      execFileSync(process.execPath, ['-e', 'process.stdout.write(require("fs").readFileSync("package.json","utf8"))'], {
        cwd: REPO_ROOT,
      }).toString(),
    )
    const pinned = String(pkg.dependencies['@talchain/schemas']).match(/vendor\/(.+\.tgz)$/)?.[1]
    expect(pinned).toBeDefined()
    expect(tarballs[0]).toBe(pinned)
  })

  it('FAILS when a tarball matching no pin is present', () => {
    const orphan = resolve(VENDOR, 'talchain-schemas-0.0.0-orphan-probe.tgz')
    try {
      writeFileSync(orphan, 'not a real tarball')
      const { code, stderr } = runGate()
      expect(code).not.toBe(0)
      expect(stderr).toMatch(/orphan/i)
      // Names the offender, so the remediation needs no detective work.
      expect(stderr).toContain('talchain-schemas-0.0.0-orphan-probe.tgz')
    } finally {
      rmSync(orphan, { force: true })
    }
  })

  it('FAILS on an orphaned .sha256 sidecar too', () => {
    // The 2.666 clean-up removed sidecars as well as tarballs. A sidecar left
    // behind is the same ambiguity in a smaller file.
    const orphan = resolve(VENDOR, 'talchain-schemas-0.0.0-orphan-probe.tgz.sha256')
    try {
      writeFileSync(orphan, 'deadbeef')
      const { code, stderr } = runGate()
      expect(code).not.toBe(0)
      expect(stderr).toMatch(/orphan/i)
    } finally {
      rmSync(orphan, { force: true })
    }
  })

  it('leaves the repo as it found it', () => {
    expect(existsSync(resolve(VENDOR, 'talchain-schemas-0.0.0-orphan-probe.tgz'))).toBe(false)
    expect(existsSync(resolve(VENDOR, 'talchain-schemas-0.0.0-orphan-probe.tgz.sha256'))).toBe(false)
    expect(runGate().code).toBe(0)
  })
})

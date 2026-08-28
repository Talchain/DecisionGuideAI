// tests/ci-guards/logger-emits.spec.ts
// =============================================================================
// Controls for the logger-emission BUILD GUARD.
// =============================================================================
//
// ⚠⚠ READ THIS BEFORE TRUSTING THIS FILE FOR ANYTHING.
//
// THIS SPEC CANNOT SEE THE DEFECT IT DESCRIBES. It runs in vitest, which never
// executes the production minify pipeline. A spec asserting that `logger.warn`
// calls `console.warn` would have passed GREEN, in this very directory, on every
// commit throughout the entire life of the bug — because in jsdom it is true.
// The defect existed only in the emitted artefact.
//
// So this file makes NO claim about the deployed logger. Its only job is to keep
// the DETECTOR honest: `scripts/ci/assert-logger-emits.mjs` is what has to be
// right, and this checks that it discriminates. The thing that actually holds
// the defect closed is that guard running against `dist/` in the `build` job of
// "Staging Gate" — not this spec.
//
// The distinction matters because the failure mode being prevented is precisely
// a green test suite standing over a dead instrument.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import {
  scanEmission,
  countBareConsole,
  collectChunks,
  selfTest,
  run,
  VacuousScanError,
  LEVELS,
} from '../../scripts/ci/assert-logger-emits.mjs'

/**
 * The EXACT shape that shipped on staging at 18727b64 — every method compiled
 * down to its level gate and nothing else. Pinned as a HISTORIC RECORD of what
 * the production build actually emitted (CLAUDE.md trap 14b: a corpus of
 * bytes-once-emitted is evidence, append-only, never edited to stay current).
 */
const SHIPPED_DEAD_LOGGER =
  'Bc={debug:0,info:1,warn:2,error:3},zc="warn",Hc=e=>Bc[e]>=Bc[zc],' +
  'Wc={debug:(...e)=>{Hc("debug")},info:(...e)=>{Hc("info")},' +
  'warn:(...e)=>{Hc("warn")},error:(...e)=>{Hc("error")},getLevel:()=>zc}'

/** The shape the fixed build emits, taken from a real `vite build` output. */
const BUILT_LIVE_LOGGER =
  'Au=e=>Pu[e]>=Pu[Ou],Cu=(()=>{try{return"undefined"!=typeof globalThis?globalThis.console:void 0}catch{return}})(),' +
  'ju={debug:(...e)=>{Au("debug")&&Cu?.debug("[DEBUG]",...e)},info:(...e)=>{Au("info")&&Cu?.info("[INFO]",...e)},' +
  'warn:(...e)=>{Au("warn")&&Cu?.warn("[WARN]",...e)},error:(...e)=>{Au("error")&&Cu?.error("[ERROR]",...e)},getLevel:()=>Ou}'

describe('logger-emits guard — detector discrimination', () => {
  // The load-bearing pair. Either half alone proves nothing: a detector that
  // matches everything passes the positive control, and a detector that matches
  // nothing passes the negative one.
  it('DETECTS all four levels in the shape a working build emits', () => {
    const { emitting } = scanEmission(BUILT_LIVE_LOGGER)
    expect([...emitting].sort()).toEqual([...LEVELS].sort())
  })

  it('REJECTS the no-op shape that actually shipped on 18727b64', () => {
    const { emitting } = scanEmission(SHIPPED_DEAD_LOGGER)
    expect([...emitting]).toEqual([])
  })

  it('binds tag to method by IDENTITY, not by presence of the tag', () => {
    // A `[WARN]` tag passed to `.error(` must satisfy NEITHER level. Without
    // this, the guard could be green on a bundle where the levels are crossed.
    const { emitting, mismatches } = scanEmission('x?.error("[WARN]",...e)')
    expect([...emitting]).toEqual([])
    expect(mismatches).toEqual([{ method: 'error', tag: 'WARN' }])
  })

  it('does not accept a bare tag literal with no call around it', () => {
    expect([...scanEmission('const s = "[WARN] heads up"').emitting]).toEqual([])
  })

  it('accepts a plain call as well as an optional call', () => {
    // `target: 'esnext'` preserves `?.` today. A target change must not silently
    // blind the guard into reporting a healthy bundle as dead.
    expect([...scanEmission('x.warn("[WARN]",...e)').emitting]).toEqual(['warn'])
  })

  it('reports a partially dead logger rather than passing on the live half', () => {
    const half =
      'ju={warn:(...e)=>{Au("warn")&&Cu?.warn("[WARN]",...e)},error:(...e)=>{Au("error")}}'
    expect([...scanEmission(half).emitting]).toEqual(['warn'])
  })
})

describe('logger-emits guard — narrowness (the strip must stay on)', () => {
  it('counts a bare console call', () => {
    expect(countBareConsole('console.warn("x")')).toBe(1)
  })

  it('does NOT count a namespaced console call', () => {
    // This is not a nicety. `window.console.log(…)` is how PostHog's call
    // legitimately survives the strip in every build of this app, and it is the
    // same mechanism the logger's own sink now uses. A narrowness check that
    // flagged it would red every honest build until someone loosened it into
    // decoration.
    expect(countBareConsole('window.console.log("x")')).toBe(0)
    expect(countBareConsole('Kc.console.log("x")')).toBe(0)
  })

  it('does not count a console REFERENCE that is never called', () => {
    // Supabase ships `this.logger=console.log`. A reference is not an emission.
    expect(countBareConsole('this.logger=console.log')).toBe(0)
  })
})

describe('logger-emits guard — anti-vacuity', () => {
  it('selfTest passes on the real detector', () => {
    expect(() => selfTest()).not.toThrow()
  })

  it('THROWS rather than passing when there is nothing to scan', () => {
    // An empty dist is exactly the shape a failed or skipped build takes — an
    // ENOSPC prints a clean-looking tail. It must never read as clean.
    expect(() => collectChunks('/nonexistent-dist-for-vacuity-control')).toThrow(
      VacuousScanError
    )
  })

  it('run() exits non-zero on a bundle whose logger is dead', () => {
    // End-to-end through the CLI entry, against the historic dead shape.
    const lines: string[] = []
    // Isolate to a temp dir holding one chunk of the shipped dead logger.
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'logger-guard-'))
    writeFileSync(nodePath.join(dir, 'chunk.js'), SHIPPED_DEAD_LOGGER)

    const code = run({ distDir: dir, log: (m) => lines.push(m), err: (m) => lines.push(m) })

    expect(code).toBe(1)
    expect(lines.join('\n')).toContain('debug, info, warn, error')
  })

  it('run() exits zero on a bundle whose logger emits', () => {
    const lines: string[] = []
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'logger-guard-'))
    writeFileSync(nodePath.join(dir, 'chunk.js'), BUILT_LIVE_LOGGER)

    const code = run({ distDir: dir, log: (m) => lines.push(m), err: (m) => lines.push(m) })

    expect(code).toBe(0)
  })
})

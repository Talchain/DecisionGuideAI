// tests/ci-guards/validators-deterministic.spec.ts
// =============================================================================
// Controls for the generated-validators DETERMINISM GUARD.
// =============================================================================
//
// ⚠ READ THIS BEFORE TRUSTING THIS FILE FOR ANYTHING.
//
// The thing that actually holds the defect closed is
// `scripts/ci/assert-validators-deterministic.mjs` running in the `build` job of
// the required "Staging Gate" check, after `pnpm run build`. Not this spec.
//
// This file's only job is to keep the DETECTOR honest — to prove the comparator
// and the vacuity gate DISCRIMINATE, rather than agreeing with everything. That
// distinction is the whole point: the failure mode being prevented here is a
// probe that compares two empty extractions, agrees perfectly, and proves
// nothing. That exact shape has bitten this estate through shell quoting, where
// `diff` on two empty files exits 0 and reports agreement.
//
// The one test below that IS a real end-to-end claim is marked as such: it runs
// the generator twice for real and compares the bytes.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import {
  ARTEFACTS,
  COMMITTED_DIR,
  VacuousOutputError,
  assertNonTrivial,
  compare,
  generateInto,
  run,
  selfTest,
} from '../../scripts/ci/assert-validators-deterministic.mjs'

const JS_SPEC = ARTEFACTS[0]

/** A string that satisfies the js artefact's floor and markers. */
const REAL_ENOUGH = 'x'.repeat(JS_SPEC.minBytes) + JS_SPEC.markers.join('\n')

describe('validators determinism guard — the vacuity gate', () => {
  // ── THE LOAD-BEARING CONTROL ────────────────────────────────────────────
  // Stated as a pair on purpose. The first half establishes the hazard is real
  // (two nothings DO compare equal); the second half proves the guard refuses to
  // read that as a pass. Either alone is uninformative.
  it('two EMPTY outputs compare equal — the hazard this guard exists to refuse', () => {
    expect(compare('', '').identical).toBe(true)
  })

  it('...and the vacuity gate REJECTS an empty output, so that agreement is never a pass', () => {
    expect(() => assertNonTrivial('t', '', JS_SPEC)).toThrow(VacuousOutputError)
  })

  it('rejects whitespace-only output', () => {
    expect(() => assertNonTrivial('t', '   \n\t  ', JS_SPEC)).toThrow(VacuousOutputError)
  })

  it('rejects output below the byte floor even when it carries every marker', () => {
    // Markers present, size absent — a header with the body truncated away.
    expect(() => assertNonTrivial('t', JS_SPEC.markers.join('\n'), JS_SPEC)).toThrow(
      VacuousOutputError,
    )
  })

  it('rejects output above the byte floor that carries no markers', () => {
    // Size present, substance absent — the complement of the case above. Both
    // halves are needed: a floor alone passes on 5 kB of the wrong thing.
    expect(() => assertNonTrivial('t', 'y'.repeat(JS_SPEC.minBytes + 100), JS_SPEC)).toThrow(
      VacuousOutputError,
    )
  })

  it('rejects a non-string (a failed read, not an empty one)', () => {
    expect(() => assertNonTrivial('t', undefined, JS_SPEC)).toThrow(VacuousOutputError)
  })

  it('ACCEPTS output that clears both the floor and the markers', () => {
    // The positive half. Without it, a gate that rejected everything would pass
    // every test above.
    expect(assertNonTrivial('t', REAL_ENOUGH, JS_SPEC)).toBeGreaterThanOrEqual(JS_SPEC.minBytes)
  })

  it('names the missing marker rather than failing anonymously', () => {
    const nearly = 'x'.repeat(JS_SPEC.minBytes) + JS_SPEC.markers.slice(1).join('\n')
    expect(() => assertNonTrivial('t', nearly, JS_SPEC)).toThrow(JS_SPEC.markers[0])
  })
})

describe('validators determinism guard — the comparator', () => {
  // The discriminating pair. A comparator that returns `identical: true` for
  // everything passes the first; one that returns false for everything passes
  // the second. Only both together show it discriminates.
  it('ACCEPTS byte-identical inputs', () => {
    expect(compare(REAL_ENOUGH, REAL_ENOUGH).identical).toBe(true)
  })

  it('REJECTS inputs differing by a single byte, and reports where', () => {
    const drifted = REAL_ENOUGH.slice(0, 100) + 'Z' + REAL_ENOUGH.slice(101)
    const result = compare(REAL_ENOUGH, drifted)
    expect(result.identical).toBe(false)
    expect(result.index).toBe(100)
  })

  it('REJECTS a pure-suffix difference (a truncated second run)', () => {
    const result = compare(REAL_ENOUGH, REAL_ENOUGH.slice(0, -20))
    expect(result.identical).toBe(false)
  })
})

describe('validators determinism guard — self-test', () => {
  it('passes on the real implementation', () => {
    expect(() => selfTest()).not.toThrow()
  })
})

describe('validators determinism guard — end-to-end', () => {
  // ── A REAL CLAIM, not a detector control. ────────────────────────────────
  // Runs the actual generator twice, into two throwaway directories outside the
  // repo, and compares the bytes. This is the property the `Generated at:`
  // timestamp violated. It is slow-ish (two node subprocesses) and worth it.
  it('the generator produces byte-identical output on two independent runs', () => {
    const dirs = [
      mkdtempSync(nodePath.join(tmpdir(), 'validators-spec-a-')),
      mkdtempSync(nodePath.join(tmpdir(), 'validators-spec-b-')),
    ]
    try {
      const a = generateInto(dirs[0])
      const b = generateInto(dirs[1])
      for (const spec of ARTEFACTS) {
        // Non-vacuity BEFORE agreement, in the test as well as in the guard —
        // otherwise this test could pass on two failed generations.
        expect(assertNonTrivial(`A/${spec.file}`, a[spec.file], spec)).toBeGreaterThan(
          spec.minBytes,
        )
        expect(assertNonTrivial(`B/${spec.file}`, b[spec.file], spec)).toBeGreaterThan(
          spec.minBytes,
        )
        expect(compare(a[spec.file], b[spec.file]).identical).toBe(true)
      }
    } finally {
      for (const d of dirs) rmSync(d, { recursive: true, force: true })
    }
  }, 60_000)

  it('the emitted header carries no clock-shaped value', () => {
    // Bound to the SHAPE that caused the defect, not to the old wording — a
    // future reintroduction is unlikely to reuse the string "Generated at".
    for (const spec of ARTEFACTS) {
      const text = readFileSync(nodePath.join(COMMITTED_DIR, spec.file), 'utf8')
      const header = text.slice(0, 2000)
      expect(header).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    }
  })

  it('the committed artefacts are non-vacuous and match a fresh generation', () => {
    // This is the freshness half — what replaced the timestamp as the staleness
    // signal. It reds on real drift from any cause, including an Ajv upgrade
    // that a schema-content hash would have missed.
    const lines: string[] = []
    const code = run({ log: (m) => lines.push(m), err: (m) => lines.push(m) })
    expect(lines.join('\n')).not.toBe('')
    expect(code).toBe(0)
  }, 60_000)
})

/**
 * THE BAND HEIGHT IS SPELLED TWICE. THIS IS THE THING THAT REDS WHEN THEY DRIFT.
 *
 * `e2e/geometry/overlayNodeOverlap.measure.ts` asserts that no band occupant is
 * taller than the band — an occupant that overflows grows UPWARD out of the
 * reserved strip and back over the canvas, which is the whole defect the band
 * exists to remove, and it does so with every unit test still green because
 * wrapped text is a rendering fact jsdom cannot see.
 *
 * That measure needs the band's height as a NUMBER. It cannot import
 * `OVERLAY_BAND_HEIGHT`: `CanvasOverlayBand.tsx` reaches `FloatingOlumiPanel`
 * and through it most of the React app, and `tsconfig.tooling.json` compiles
 * the e2e tree — measured at +168 diagnostics and a typecheck-ratchet RED in
 * `src/lib/auth/accessValidation.ts`, a file that change never touched.
 * `computeFitPadding.ts` restates `OVERLAY_BAND_SELECTOR` for the same reason
 * and is guarded by `computeFitPadding.overlayBand.spec.ts`; this is that
 * pattern applied to the height.
 *
 * ⚠ WHAT THIS GUARD IS FOR, STATED NARROWLY. It cannot prove 64 is the RIGHT
 * height — that is a design judgement. It proves only that the two spellings
 * AGREE, so retuning the band cannot leave the measure asserting against a
 * stale number. A too-high literal makes the assertion quietly VACUOUS (nothing
 * is ever "too tall"); a too-low one makes it falsely RED. Both read as normal
 * output, which is exactly why a human is not the right instrument here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OVERLAY_BAND_HEIGHT } from '../components/CanvasOverlayBand'

const MEASURE_FILE = resolve(
  __dirname,
  '../../../e2e/geometry/overlayNodeOverlap.measure.ts',
)

/**
 * The literal the measure file compares heights against, bound to the exact
 * declaration shape rather than to "a 64 somewhere in the file" — the file
 * contains other numbers, and a scan that matched any of them would pass for
 * the wrong reason.
 */
const BAND_H_DECLARATION = /const\s+BAND_H\s*=\s*(\d+)/

function readMeasure(): string {
  return readFileSync(MEASURE_FILE, 'utf8')
}

describe('the overlay band height, spelled in two places', () => {
  it('POSITIVE CONTROL: the measure file is readable and non-empty', () => {
    // An absence assertion over a file that failed to load passes by testing
    // nothing (trap 13). A moved or renamed measure file must RED here rather
    // than silently disarm the agreement check below.
    const source = readMeasure()
    expect(
      source.length,
      `${MEASURE_FILE} read as empty — every assertion below would be vacuous`,
    ).toBeGreaterThan(1000)
    expect(source).toContain('OVERLAYNODEOVERLAP')
  })

  it('the measure file declares BAND_H in the form this scan binds to', () => {
    // Separated from the agreement assertion deliberately. If the declaration
    // is reshaped (destructured, renamed, moved into the filter expression),
    // the regex stops matching — and a scan that matches nothing would
    // otherwise report agreement, because there would be no disagreement to
    // find. This is the precondition, pinned in-test.
    const match = readMeasure().match(BAND_H_DECLARATION)
    expect(
      match,
      'no `const BAND_H = <number>` in the measure file — the scan below cannot ' +
        'discriminate, so it must not be trusted. Restore the declaration shape ' +
        'or update this guard deliberately.',
    ).not.toBeNull()
  })

  it('the restated height AGREES with OVERLAY_BAND_HEIGHT', () => {
    const match = readMeasure().match(BAND_H_DECLARATION)
    const restated = Number(match![1])
    expect(
      restated,
      `e2e/geometry/overlayNodeOverlap.measure.ts pins the band at ${restated}px ` +
        `while CanvasOverlayBand exports ${OVERLAY_BAND_HEIGHT}px. One of them ` +
        `was retuned and the other was not: too high and the overflow assertion ` +
        `is vacuous, too low and it is falsely red.`,
    ).toBe(OVERLAY_BAND_HEIGHT)
  })

  it('CONTRAST CONTROL: the scan discriminates — a drifted literal is detected', () => {
    // Proves the agreement above is the code's doing and not the regex quietly
    // failing to find anything. Same shape, different number: it must NOT equal
    // the exported height.
    const drifted = 'const BAND_H = 96'.match(BAND_H_DECLARATION)
    expect(drifted).not.toBeNull()
    expect(Number(drifted![1])).not.toBe(OVERLAY_BAND_HEIGHT)
  })
})

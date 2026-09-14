/**
 * zoomLegibility — the label counter-scale.
 *
 * ⚠ WHAT THIS FILE IS ALLOWED TO CLAIM. jsdom has no layout engine: it cannot
 * measure a glyph, and a passing DOM assertion about a class name proves the
 * class is present and NOTHING about how large the text is on screen. So this
 * file makes no visibility claim. It asserts the ARITHMETIC that decides the
 * rendered size — `declared × counterScale(zoom) × zoom` — and the px table in
 * the PR body is generated from these same numbers. A browser is still the only
 * thing that can witness legibility.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  LABEL_LEGIBLE_ZOOM,
  labelCounterScale,
  renderedLabelPx,
  CANVAS_LABEL_SCALE_VAR,
  MAX_LABEL_COUNTER_SCALE,
} from '../zoomLegibility'

/** DS v5 §2.3, as declared in src/styles/typography.ts. */
/**
 * ⚠ `nodeTitle` 13 → 12 (1 Sep 2026), then 12 → 14 (12 Sep 2026, the canvas
 * raised to the design system's own stated 14px minimum — it was the one surface
 * below its own floor). THE SIZE HERE IS INCIDENTAL; THE CLAIM IS
 * THE COUNTER-SCALE. This table exists so the assertions below can check that
 * each canvas token spells `calc(<n>px*var(--canvas-label-scale,1))` — i.e.
 * that the token CARRIES the scale — and it has to name the current `<n>` to do
 * that exactly. So a size change lands here, and it should: this was the FOURTH
 * guard to red on the type change, after two in `nodeLabelFit.spec.ts` and one
 * in `BaseNode.titleWrap.spec.tsx`.
 *
 * That four separate guards fire on one literal is the system working, not
 * friction — the declared size is a geometry input in this codebase, and the
 * only thing worse than re-deriving four bounds is a font change that silently
 * re-derives none of them. The negative controls below (a token WITHOUT the
 * scale must not match; the 13px regex must not match an 11px token) are
 * untouched, so this file still discriminates on the property it is about.
 */
const DECLARED = { nodeTitle: 14, nodeLabel: 12, edgeLabel: 11 } as const

/** DS v5 §2.4: panel and canvas contexts bottom out at 10px. */
const DS_CANVAS_FLOOR_PX = 10

describe('labelCounterScale — bounded in both directions, by construction', () => {
  it('is the identity at 1:1 — an unzoomed canvas renders the declared scale', () => {
    expect(labelCounterScale(1)).toBe(1)
  })

  it('never counter-scales while the user is zoomed IN', () => {
    // Past 1:1 magnification is the user's own deliberate gesture and text
    // should grow with it. Scaling text DOWN to compensate would fight them.
    for (const z of [1.25, 1.5, 2, 4]) expect(labelCounterScale(z)).toBe(1)
  })

  it('is exactly 1/zoom across the band the product calls legible', () => {
    for (const z of [0.5, 0.6, 0.75, 0.9, 0.99]) {
      expect(labelCounterScale(z)).toBeCloseTo(1 / z, 10)
    }
  })

  it('caps at 1 / LABEL_LEGIBLE_ZOOM below the floor — never unbounded', () => {
    const cap = 1 / LABEL_LEGIBLE_ZOOM
    for (const z of [0.49, 0.3, 0.1, 0.001]) expect(labelCounterScale(z)).toBe(cap)
  })

  it('returns the identity for a zoom that cannot produce a meaningful scale', () => {
    // Infinity or NaN reaching a CSS calc() would blank the label rather than
    // mis-size it — the worse failure, and silent.
    for (const z of [0, -1, NaN, Infinity, -Infinity]) expect(labelCounterScale(z)).toBe(1)
    expect(labelCounterScale(undefined as unknown as number)).toBe(1)
  })

  it('is monotonic non-increasing in zoom — no discontinuity at the boundaries', () => {
    let previous = Infinity
    for (let z = 0.05; z <= 2; z += 0.01) {
      const s = labelCounterScale(z)
      expect(s).toBeLessThanOrEqual(previous + 1e-12)
      previous = s
    }
  })
})

describe('renderedLabelPx — the invariant the DS actually asks for', () => {
  it('THE POINT: rendered px === declared px everywhere in the legible band', () => {
    for (const [name, declared] of Object.entries(DECLARED)) {
      for (const z of [LABEL_LEGIBLE_ZOOM, 0.55, 0.6, 0.72, 0.85, 0.95, 1]) {
        expect(renderedLabelPx(declared, z), `${name} at zoom ${z}`).toBeCloseTo(declared, 10)
      }
    }
  })

  it('every canvas token clears the DS v5 §2.4 canvas floor at the auto-fit settle zoom', () => {
    // `useFitViewOnLayoutVersion` passes LABEL_LEGIBLE_ZOOM as fitView's
    // minZoom, and a post-draft graph clamps there — so this IS the zoom the
    // product parks a fresh user at.
    for (const [name, declared] of Object.entries(DECLARED)) {
      expect(renderedLabelPx(declared, LABEL_LEGIBLE_ZOOM), name)
        .toBeGreaterThanOrEqual(DS_CANVAS_FLOOR_PX)
    }
  })

  it('OPPOSITE-DIRECTION TWIN: WITHOUT the counter-scale the same zoom breaks the floor', () => {
    // The fix must be shown to be load-bearing. This is the measured "before"
    // at the settle zoom, with no counter-scale applied. If this assertion ever
    // fails, the counter-scale has stopped being the thing doing the work.
    //
    // ⚠ Re-stated with the declared sizes: 6.5/5.5/5.0 at 13/11/10, then
    // 6/5.5/5 at 12/11/10, now 7/6/5.5 at 14/12/11. The NUMBERS move with the
    // ramp; the CLAIM does not — every one of them is still under the 10px
    // canvas floor, which is the whole point of the assertion below.
    const before = Object.values(DECLARED).map(px => px * LABEL_LEGIBLE_ZOOM)
    expect(before).toEqual([7, 6, 5.5])
    for (const px of before) expect(px).toBeLessThan(DS_CANVAS_FLOOR_PX)
  })

  it('OPPOSITE-DIRECTION TWIN: zoomed OUT, text never renders larger than declared', () => {
    // The bound in the other direction, and the one that keeps titles inside
    // their cards: a counter-scale with no ceiling would blow node text out of
    // the box as the user zoomed away.
    //
    // ⚠ NOTE THE DOMAIN — `z ≤ 1`, and it is not a convenience. My first draft
    // asserted this for ALL zooms and it failed at 1.01, correctly: above 1:1
    // the scale is the identity and text SHOULD grow with the magnification.
    // An invariant written against the failure mode I was fixing rather than
    // against the spec (CLAUDE.md trap 13d) — the twin below is the other half.
    for (const declared of Object.values(DECLARED)) {
      for (let z = 0.05; z <= 1; z += 0.01) {
        expect(renderedLabelPx(declared, z), `declared ${declared} at zoom ${z}`)
          .toBeLessThanOrEqual(declared + 1e-9)
      }
    }
  })

  it('OPPOSITE-DIRECTION TWIN: zoomed IN, text grows with the magnification', () => {
    // The counter-scale must not silently cancel a deliberate zoom-in.
    for (const declared of Object.values(DECLARED)) {
      expect(renderedLabelPx(declared, 2)).toBeCloseTo(declared * 2, 10)
      expect(renderedLabelPx(declared, 1.5)).toBeCloseTo(declared * 1.5, 10)
    }
  })

  it('degrades gracefully below the floor rather than falling off a cliff', () => {
    // Below LABEL_LEGIBLE_ZOOM the LOD view has hidden most labels; the few that
    // are kept (goal / decision / the leading option) shrink linearly from the
    // capped scale instead of vanishing.
    expect(renderedLabelPx(DECLARED.nodeTitle, 0.45)).toBeCloseTo(12.6)
    expect(renderedLabelPx(DECLARED.nodeTitle, 0.4)).toBeCloseTo(11.2, 6)

    /*
     * ⭐⭐ THE 12 Sep 2026 RAMP REPAYS THE TRADE THE 1 Sep CHANGE ACCEPTED —
     * which is why this block is kept rather than deleted.
     *
     * Below the floor the cap has bitten, so rendered = declared × 2 × zoom and
     * the title crosses DS v5 §2.4's 10px minimum at:
     *
     *     13px → zoom 0.385     12px → zoom 0.417     14px → zoom 0.357
     *
     * The 1 Sep note recorded a real cost: dropping 13 → 12 opened a narrow
     * band, roughly 0.385–0.417, where a title used to satisfy the canvas floor
     * and no longer did, and it took this assertion from 10.4 to 9.6. Raising
     * the declared size to 14 closes that band and moves it the other way — the
     * crossing is now BELOW the old 13px crossing, and the graceful-degradation
     * reading goes 9.6 → 11.2, clearing the 10px floor at a zoom where it
     * previously breached it.
     *
     * ⚠ Note the direction, because the intuition runs the wrong way: a LARGER
     * declared size is SAFER here, not riskier. Rendered size below the floor is
     * `declared × cap × zoom`, so the declared size is a multiplier on the
     * headroom. 11px was rejected on 1 Sep for breaking the floor at 0.45; 14px
     * is the same argument run in the opposite direction.
     *
     * The bound above the floor is unchanged and is still the load-bearing one:
     * at and above `LABEL_LEGIBLE_ZOOM` the cap and the zoom cancel, so a title
     * renders at its DECLARED size. That is now 14px, the design system's stated
     * body minimum, where it used to be 12.
     *
     * This assertion is the thing that will notice if someone shaves the
     * declared size again, so the next person has to come here and re-argue it.
     */
    const floorCrossingZoom = DS_CANVAS_FLOOR_PX / (DECLARED.nodeTitle * MAX_LABEL_COUNTER_SCALE)
    expect(floorCrossingZoom).toBeLessThan(LABEL_LEGIBLE_ZOOM)
  })
})

describe('the seam between this module and the type tokens', () => {
  /**
   * ⛔ A DERIVED GUARD, not a second copy of the answer (CLAUDE.md trap 12).
   *
   * `src/styles/typography.ts` spells the custom property LITERALLY, inside
   * three Tailwind arbitrary values — Tailwind needs the class string whole at
   * build time, so no import can reach in there. That makes it a hand-maintained
   * mirror of `CANVAS_LABEL_SCALE_VAR`, and the failure mode is silent in the
   * worst way: rename the constant and every token quietly resolves to its
   * `var(…, 1)` fallback, the counter-scale stops applying, and not one test
   * goes red. So the guard reads the real file and derives.
   *
   * ⚠ WHAT THIS CANNOT DO, stated rather than glossed: it proves the two files
   * AGREE. It cannot prove the declared sizes are RIGHT — that is DS v5 §2.3's
   * job, and the `DECLARED` table above is the hand-written corpus that notices
   * if they drift. Derivation and corpus are not redundant; ship both.
   */
  const tokenSource = readFileSync(
    resolve(__dirname, '../../../styles/typography.ts'),
    'utf8',
  )

  /**
   * ⚠ THE EXPECTATION IS BUILT AS AN ESCAPED REGEXP, NOT AN INTERPOLATED
   * `var(…)` STRING — and that is not style, it is a guard interaction.
   * `css-var-census` walks the TS AST for `var(--${…})` template literals and
   * treats each as a DYNAMIC reference site; `css-var-resolution.spec` then pins
   * the exact SET of files that carry one. Writing the expectation as
   * `` `…var(${CANVAS_LABEL_SCALE_VAR},1)…` `` made THIS TEST FILE a dynamic site
   * and turned that product guard red — measured, not hypothesised. The fix
   * belongs here: a test must not enter a manifest of product var() sites, and
   * relaxing the guard's pin to accommodate a spec would blunt a guard that
   * exists to notice exactly this kind of new site.
   */
  const expectedFontSize = (declared: number) =>
    new RegExp(`calc\\(${declared}px\\*var\\(${CANVAS_LABEL_SCALE_VAR},1\\)\\)`)

  it.each(Object.entries(DECLARED))(
    '%s carries the counter-scale at its declared %ipx, spelling the exact property name',
    (token, declared) => {
      const line = tokenSource
        .split('\n')
        .find(l => new RegExp(`^\\s{2}${token}:`).test(l))
      expect(line, `token ${token} not found in typography.ts`).toBeDefined()
      expect(line).toMatch(expectedFontSize(declared))
    },
  )

  it('CONTROL: the derived expectation can FAIL — it is not a regex that matches anything', () => {
    // A pattern built by interpolation is one typo away from matching everything
    // it is pointed at. Prove it discriminates before trusting the arms above.
    expect('nodeTitle: \'text-[13px] font-semibold\'').not.toMatch(expectedFontSize(13))
    expect(expectedFontSize(13).test('calc(11px*var(--canvas-label-scale,1))')).toBe(false)
  })

  it('CONTRAST CONTROL: a NON-canvas token is untouched by the counter-scale', () => {
    // Proves the probe above can distinguish, and pins the blast radius: panel
    // and conversation copy must not inherit a canvas zoom compensation.
    const panelMeta = tokenSource.split('\n').find(l => /^\s{2}panelMeta:/.test(l))
    expect(panelMeta).toBeDefined()
    expect(panelMeta).not.toContain(CANVAS_LABEL_SCALE_VAR)
    expect(panelMeta).toContain('text-[11px]')
  })
})

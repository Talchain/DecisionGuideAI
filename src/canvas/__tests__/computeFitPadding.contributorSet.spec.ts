/**
 * THE CONTRIBUTOR SET CANNOT GROW WITHOUT SOMEONE APPLYING THE FOUR CRITERIA.
 *
 * WHY THIS FILE EXISTS. `computeFitPadding`'s header used to promise that *"a
 * future lane adding a free-floating occluder to this function REDs the
 * padding-invariance guard (G2a)"*. **It does not.** G2a is three hardcoded
 * selector strings (`floating-olumi-panel`, its side tab, the restore pill), so
 * a re-admission under any OTHER selector — or via the store rather than a rect
 * — sails past it green. A hand-maintained mirror inside the guard written to
 * prevent hand-maintained mirrors (adversarial review of #786, 19 Aug 2026).
 *
 * So this guard is DERIVED FROM THE BYTES rather than from a list a human must
 * remember to sync: it reads `computeFitPadding.ts`, extracts every selector
 * actually reached by `rectOf(...)` inside the function, and asserts that set
 * equals the exported declaration.
 *
 * ⚠ WHAT IT PROVES AND WHAT IT CANNOT (trap 12d, stated up front). It proves the
 * CODE AND THE DECLARATION AGREE. It can never prove the declaration is RIGHT —
 * whether a given piece of chrome is edge-anchored, non-movable, non-dismissible
 * and persistent is a judgement, and the header labels those four criteria
 * REVIEW-ONLY for exactly that reason. Deriving a guard from a list moves the
 * risk; it does not remove it. What this buys is that the list cannot change
 * silently, which is the half that was missing.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FIT_PADDING_CONTRIBUTORS,
  DOCK_SELECTOR,
  SIDEBAR_SELECTOR,
  TOP_BAR_SELECTOR,
  OVERLAY_BAND_SELECTOR,
} from '../utils/computeFitPadding'

const SOURCE_PATH = resolve(__dirname, '../utils/computeFitPadding.ts')
const SOURCE = readFileSync(SOURCE_PATH, 'utf8')

/** The body of `export function computeFitPadding` — the only scope that matters. */
function computeFitPaddingBody(): string {
  const start = SOURCE.indexOf('export function computeFitPadding(')
  expect(start, 'computeFitPadding must exist — a rename silently empties this guard').toBeGreaterThan(-1)
  // Everything from the signature to the end of file is a superset of the body
  // and contains no other function, so it is a safe (over-inclusive) scope.
  return SOURCE.slice(start)
}

/** Every argument passed to `rectOf(...)` in that body, as written. */
function extractedContributorTokens(): string[] {
  const body = computeFitPaddingBody()
  return [...body.matchAll(/\brectOf\(\s*([^)]*?)\s*\)/g)].map((m) => m[1])
}

/** Resolve an identifier token to the selector it names; string literals pass through. */
const TOKEN_TO_SELECTOR: Record<string, string> = {
  DOCK_SELECTOR,
  SIDEBAR_SELECTOR,
  TOP_BAR_SELECTOR,
  // Added when `CanvasOverlayBand` became a contributor. This guard RED-ed on
  // the band first — naming it, and quoting criteria 1-4 back — and re-pointing
  // it here is the ritual its own failure message prescribes. The criteria are
  // applied and recorded at `OVERLAY_BAND_SELECTOR`'s declaration; the short
  // version is that the BAND is persistent and non-dismissible even though its
  // occupants are neither, which is exactly why the band exists rather than
  // each notice contributing for itself.
  OVERLAY_BAND_SELECTOR,
}

describe('computeFitPadding — the declared contributor set is derived from the bytes', () => {
  it('POSITIVE CONTROL: the extractor finds a non-zero number of rectOf call sites', () => {
    // Trap 13: an extractor that silently matches nothing agrees with every
    // other extractor that matched nothing, and `toEqual` on two empty arrays
    // passes. Assert it can SEE before believing what it says.
    const tokens = extractedContributorTokens()
    expect(tokens.length, 'the extractor read nothing — every assertion below would be vacuous').toBeGreaterThan(0)
    expect(tokens.length).toBe(FIT_PADDING_CONTRIBUTORS.length)
  })

  it('every selector the function actually reaches is one the module DECLARES', () => {
    const reached = extractedContributorTokens().map((token) => {
      const resolved = TOKEN_TO_SELECTOR[token]
      // An inline string literal is a contributor that was never declared —
      // name it in the failure rather than resolving to undefined.
      expect(
        resolved,
        `rectOf(${token}) reaches a selector that is not in FIT_PADDING_CONTRIBUTORS. ` +
          `Adding an occluder here means applying criteria 1-4 in the module header ` +
          `(edge-anchored / not user-movable / not dismissible / persistent) and declaring it.`,
      ).toBeTypeOf('string')
      return resolved
    })
    expect(new Set(reached)).toEqual(new Set(FIT_PADDING_CONTRIBUTORS))
  })

  it('CONTRAST CONTROL: the extractor discriminates — a fourth call site is detected', () => {
    // Proves the assertion above is sensitive to what it claims to measure,
    // without mutating the real file. If this regex could not see a fourth
    // contributor, the guard would agree with itself forever.
    const withExtra = computeFitPaddingBody().replace(
      'const topBar = rectOf(TOP_BAR_SELECTOR)',
      "const smuggled = rectOf('[data-testid=\"floating-olumi-panel\"]')\n    const topBar = rectOf(TOP_BAR_SELECTOR)",
    )
    const tokens = [...withExtra.matchAll(/\brectOf\(\s*([^)]*?)\s*\)/g)].map((m) => m[1])
    expect(tokens.length).toBe(FIT_PADDING_CONTRIBUTORS.length + 1)
    expect(tokens.some((t) => !(t in TOKEN_TO_SELECTOR))).toBe(true)
  })

  it('the function reaches for no STORE — a contributor cannot be smuggled in as state', () => {
    // The rect-based guard above is blind to `useFloatingPanelState.getState()`.
    // computeFitPadding is a pure DOM measurement and must stay one.
    const body = computeFitPaddingBody()
    for (const forbidden of ['getState(', 'useFloatingPanelState', 'useUIStore', 'useCanvasStore']) {
      expect(body.includes(forbidden), `computeFitPadding must not read ${forbidden}`).toBe(false)
    }
  })
})

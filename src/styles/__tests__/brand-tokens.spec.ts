/**
 * Canonical brand-token pins (DS delta audit 2026-07-16, decisions D1 + D3).
 *
 * D1 — info blue. This token previously carried THREE documented values
 * (#52A3C8 in brand.css, #2B7FA2 in DESIGN_SYSTEM.md, #63ADCF in the v5 spec)
 * and the SHIPPED one failed WCAG AA: #52A3C8 computes to 2.83:1 on white,
 * below both the 4.5:1 text threshold and the 3:1 UI-component threshold.
 * #277A9D is now canonical and clears both. This file replaces
 * brand-css-comment-integrity.spec.ts, whose premise (that brand.css must
 * NOT claim compliance, ROADMAP 1.51b) is inverted by the fix: the colour is
 * now genuinely compliant, so the honest pin is the computed ratio itself.
 *
 * MEASURE AGAINST THE REAL GROUND. The first attempt at this fix asserted AA
 * against #FFFFFF ONLY, and picked a value (#2B7FA2) that cleared white by
 * 0.006 — while failing on --bg-panel (4.47:1) and --bg-panel-hover (4.30:1),
 * the surfaces info-blue text is actually painted on. A test that measures the
 * wrong ground cannot see the defect it exists to catch. So:
 *
 *   - The set of TEXT grounds below is asserted against tokens READ FROM
 *     brand.css, not hardcoded hexes. Retint --bg-panel and this test
 *     re-measures against the new panel automatically.
 *   - The canonical hex is read from brand.css too; the ratios are COMPUTED.
 *     Nothing here is a copy of the value it is supposed to police, so it
 *     keeps biting after future retints.
 *   - --bg-canvas is deliberately held to the 3:1 SC 1.4.11 bar, NOT 4.5:1.
 *     Info blue is never used as TEXT on the raw canvas ground (the only
 *     info-blue there is non-text glyphs: the auth spinners, the
 *     StarterDecisions arrow, the selected-edge arrowhead). Requiring 4.5:1
 *     there would darken the brand blue for no text-legibility gain. If that
 *     ever stops being true — if info-blue TEXT lands on the canvas — move
 *     --bg-canvas into TEXT_GROUNDS and retint; do not weaken this file.
 *
 * A positive control proves the computation can detect a FAILING colour, so
 * the assertions cannot pass vacuously.
 *
 * D3 — chart series. All six chart tokens must be mutually distinct, and
 * series 5/6 must not alias any semantic token (they previously aliased
 * --warning and --danger, so a neutral 5th data series rendered in the colour
 * that means "warning" everywhere else). Perceptual separation under
 * protan/deutan is validated out-of-tree and recorded in the PR body; what is
 * pinned HERE is the structural property — ordinal tokens alias nothing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTokenHex } from '../channelTriple.mjs'
import { stripComments } from '../../../tests/helpers/stripSourceComments'

const css = readFileSync(join(__dirname, '../brand.css'), 'utf-8')

/**
 * brand.css with block comments blanked (newline-preserving). `token()` and the
 * "no superseded hex in declarations" pin both scan this, not the raw text: a
 * multiline `^--x:` regex over raw text takes the FIRST match, so a superseded
 * value quoted at line-start inside a design-note comment ABOVE the live
 * declaration would be read as the live value (the silent-wrong-read footgun the
 * shared stripper exists to close). resolveTokenHex already strips internally.
 */
const cssNoComments = stripComments(css, 'brand.css')

/**
 * The RAW declared text of a `--token` in brand.css — not resolved.
 * Used only where the assertion is about the DECLARATION itself (chart-5/6
 * must be literal hexes, aliasing nothing). Every colour READ goes through
 * `resolve()`, because a raw read now returns `rgb(var(--x-rgb))` for most
 * semantic tokens and would be measured as a malformed colour.
 */
function token(name: string): string {
  const m = cssNoComments.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))
  if (!m) throw new Error(`brand.css: --${name} not found`)
  return m[1].trim()
}

/**
 * The literal colour a token resolves to, across all three declaration forms
 * brand.css uses: a literal hex, a `var()` alias (`--primary: var(--info)`),
 * and the channel-triple form (`--info-rgb: 39 122 157; --info:
 * rgb(var(--info-rgb))`) that lets Tailwind emit opacity-modified utilities.
 *
 * Delegated to the shared resolver so all five brand.css parsers read the file
 * identically rather than each carrying its own regex — which is how they
 * would come to disagree. Throws rather than defaulting, so no ratio below can
 * be computed against a silently-wrong colour.
 */
function resolve(name: string): string {
  const hex = resolveTokenHex(css, `--${name}`)
  if (!hex) throw new Error(`brand.css: --${name} does not resolve to a literal colour`)
  return hex
}

const hexToRgb = (hex: string): [number, number, number] => {
  const s = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`expected 6-digit hex, got "${hex}"`)
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** WCAG 2.x relative luminance. */
const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio. */
const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = '#FFFFFF'
const CANONICAL_INFO = '#277A9D'
const AA_TEXT = 4.5
const AA_UI = 3.0

/**
 * Alpha-composite `fg` over `bg`. Several real grounds are translucent panels
 * over the canvas (the OutputsDock is rgba(255,255,255,0.95); edge labels are
 * bg-panel/95), so the ground a reader actually sees is a composite, not a
 * declared token. Computing it here keeps those grounds honest.
 */
const over = (fg: string, alpha: number, bg: string): string => {
  const [f, b] = [hexToRgb(fg), hexToRgb(bg)]
  return (
    '#' +
    [0, 1, 2]
      .map(i => Math.round((f[i] * alpha + b[i] * (1 - alpha)) * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/**
 * Every ground on which `--info` is painted as TEXT, derived from brand.css.
 * Sourced from a full call-site sweep plus live-DOM measurement of the running
 * app (see the D1 section of the PR body for the enumeration and its scope).
 * `--bg-canvas` is deliberately ABSENT — see the file header.
 */
const TEXT_GROUNDS = (): Array<[string, string]> => [
  ['#FFFFFF (legacy white cards)', WHITE],
  ['--bg-panel (dominant text ground)', resolve('bg-panel')],
  ['bg-panel/95 over canvas (dock, edge labels)', over(resolve('bg-panel'), 0.95, resolve('bg-canvas'))],
  ['--bg-panel-hover (the binding ground)', resolve('bg-panel-hover')],
]

describe('D1 — canonical info blue', () => {
  it('POSITIVE CONTROL: the contrast computation detects the superseded failing colour', () => {
    // Without this, "passes AA" could be a vacuous assertion from a broken formula.
    // #52A3C8 is the value this decision replaced; it must measure as failing.
    const superseded = contrastRatio('#52A3C8', WHITE)
    expect(superseded).toBeCloseTo(2.83, 2)
    expect(superseded).toBeLessThan(AA_UI)
  })

  it('--info is the single canonical value', () => {
    expect(resolve('info')).toBe(CANONICAL_INFO)
  })

  it('--info carries its channels as the source of truth, and they agree with the hex', () => {
    // `--info` is no longer a literal hex: it is derived from `--info-rgb` so
    // Tailwind can emit `border-info/30` and friends, which previously emitted
    // NO RULE AT ALL. The channels are now the single source of truth, so the
    // thing that must not drift is the channels-to-hex agreement — assert the
    // DECLARATION FORM as well as the resolved value, or a future edit could
    // reinstate a literal hex and silently un-emit every opacity utility again.
    expect(token('info')).toBe('rgb(var(--info-rgb))')
    expect(token('info-rgb')).toBe('39 122 157')
    expect(resolve('info')).toBe(CANONICAL_INFO)
  })

  it('--primary resolves to the same canonical value (one value, not a copy)', () => {
    expect(resolve('primary').toUpperCase()).toBe(CANONICAL_INFO)
  })

  // THE PIN THIS DECISION EXISTS FOR. Measuring only against WHITE is what let
  // a value through that failed on --bg-panel by 0.03. Each ground is read from
  // brand.css, so a retint of ANY of them re-measures rather than going stale.
  it.each(TEXT_GROUNDS())('clears WCAG AA text 4.5:1 on %s — computed from brand.css, not hardcoded', (_label, ground) => {
    expect(contrastRatio(resolve('info'), ground)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('POSITIVE CONTROL: the TEXT_GROUNDS assertion can actually FAIL', () => {
    // Trap 13: an absence/threshold assertion must first prove it can see a
    // violation. The superseded blue must fail on EVERY ground listed above —
    // if this ever passes, the grounds or the maths have gone vacuous.
    for (const [, ground] of TEXT_GROUNDS()) {
      expect(contrastRatio('#52A3C8', ground)).toBeLessThan(AA_TEXT)
    }
    // ...and so must the value this decision corrected, on the panel grounds
    // it actually missed. This is the regression pin for THIS defect.
    expect(contrastRatio('#2B7FA2', resolve('bg-panel'))).toBeLessThan(AA_TEXT)
    expect(contrastRatio('#2B7FA2', resolve('bg-panel-hover'))).toBeLessThan(AA_TEXT)
  })

  it('clears the 3:1 SC 1.4.11 bar on --bg-canvas, where info blue is glyphs only', () => {
    // Deliberately 3:1, not 4.5:1 — see the file header for why.
    expect(contrastRatio(resolve('info'), resolve('bg-canvas'))).toBeGreaterThanOrEqual(AA_UI)
  })

  it('white text ON an --info fill still clears AA (the primary button)', () => {
    // --info is also a BACKGROUND (bg-primary/bg-info) with --text-on-color on
    // it. Darkening the token helps here, but the pairing must stay pinned so a
    // future LIGHTENING cannot silently break the most-used button in the app.
    expect(contrastRatio(resolve('text-on-color'), resolve('info'))).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('keeps the hover/active progression darker than the base', () => {
    const base = contrastRatio(resolve('info'), WHITE)
    expect(contrastRatio(resolve('info-hover'), WHITE)).toBeGreaterThan(base)
    expect(contrastRatio(resolve('info-active'), WHITE)).toBeGreaterThan(base)
  })

  it('no superseded info-blue hex survives in brand.css declarations', () => {
    // Comments may reference the old values as history; declarations may not.
    // Scan the shared-stripper output so this pin and `token()` agree on what
    // counts as a comment, instead of carrying a second local strip regex.
    const declarations = cssNoComments
      .split('\n')
      .filter(l => l.includes('--'))
      .join('\n')
    expect(declarations).not.toMatch(/#52A3C8/i)
    expect(declarations).not.toMatch(/#63ADCF/i)
  })
})

describe('D3 — chart series are ordinal, not semantic aliases', () => {
  const chart = [1, 2, 3, 4, 5, 6].map(n => resolve(`chart-${n}`).toUpperCase())

  it('all six chart tokens are pairwise distinct', () => {
    expect(new Set(chart).size).toBe(6)
  })

  it('series 5 and 6 are not aliases of any semantic token', () => {
    // The defect: --chart-5 was var(--warning) and --chart-6 was var(--danger),
    // so a neutral data series rendered in a colour that means something.
    const semantic = ['danger', 'success', 'info', 'warning', 'goal', 'option', 'factor']
      .map(n => resolve(n).toUpperCase())
    expect(semantic).not.toContain(chart[4])
    expect(semantic).not.toContain(chart[5])
  })

  it('series 5 and 6 are declared as literal ordinal hues, not var() indirection', () => {
    expect(token('chart-5')).toMatch(/^#[0-9A-F]{6}$/i)
    expect(token('chart-6')).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('series 5 and 6 clear 3:1 against both the canvas and panel grounds', () => {
    for (const c of [resolve('chart-5'), resolve('chart-6')]) {
      expect(contrastRatio(c, resolve('bg-canvas'))).toBeGreaterThanOrEqual(AA_UI)
      expect(contrastRatio(c, resolve('bg-panel'))).toBeGreaterThanOrEqual(AA_UI)
    }
  })
})

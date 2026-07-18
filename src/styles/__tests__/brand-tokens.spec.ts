/**
 * Canonical brand-token pins (DS delta audit 2026-07-16, decisions D1 + D3).
 *
 * D1 — info blue. This token previously carried THREE documented values
 * (#52A3C8 in brand.css, #2B7FA2 in DESIGN_SYSTEM.md, #63ADCF in the v5 spec)
 * and the SHIPPED one failed WCAG AA: #52A3C8 computes to 2.83:1 on white,
 * below both the 4.5:1 text threshold and the 3:1 UI-component threshold.
 * #2B7FA2 is now canonical and clears both. This file replaces
 * brand-css-comment-integrity.spec.ts, whose premise (that brand.css must
 * NOT claim compliance, ROADMAP 1.51b) is inverted by the fix: the colour is
 * now genuinely compliant, so the honest pin is the computed ratio itself.
 *
 * The contrast ratio is COMPUTED from the token, never hardcoded — if someone
 * moves --info to a non-compliant value this test fails on the maths, not on
 * a stale string. A positive control proves the computation can detect a
 * FAILING colour, so the assertion cannot pass vacuously.
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

const css = readFileSync(join(__dirname, '../brand.css'), 'utf-8')

/** Read a `--token: value;` declaration out of brand.css. */
function token(name: string): string {
  const m = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))
  if (!m) throw new Error(`brand.css: --${name} not found`)
  return m[1].trim()
}

/** Resolve one level of `var(--x)` indirection so aliases compare by value. */
function resolve(name: string): string {
  const raw = token(name)
  const alias = raw.match(/^var\(--([a-z0-9-]+)\)$/i)
  return alias ? resolve(alias[1]) : raw
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
const CANONICAL_INFO = '#2B7FA2'
const AA_TEXT = 4.5
const AA_UI = 3.0

describe('D1 — canonical info blue', () => {
  it('POSITIVE CONTROL: the contrast computation detects the superseded failing colour', () => {
    // Without this, "passes AA" could be a vacuous assertion from a broken formula.
    // #52A3C8 is the value this decision replaced; it must measure as failing.
    const superseded = contrastRatio('#52A3C8', WHITE)
    expect(superseded).toBeCloseTo(2.83, 2)
    expect(superseded).toBeLessThan(AA_UI)
  })

  it('--info is the single canonical value', () => {
    expect(token('info').toUpperCase()).toBe(CANONICAL_INFO)
  })

  it('--primary resolves to the same canonical value (one value, not a copy)', () => {
    expect(resolve('primary').toUpperCase()).toBe(CANONICAL_INFO)
  })

  it('clears WCAG AA for text (4.5:1) and UI components (3:1) on white — computed, not asserted', () => {
    const ratio = contrastRatio(token('info'), WHITE)
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT)
    expect(ratio).toBeGreaterThanOrEqual(AA_UI)
  })

  it('keeps the hover/active progression darker than the base', () => {
    const base = contrastRatio(token('info'), WHITE)
    expect(contrastRatio(token('info-hover'), WHITE)).toBeGreaterThan(base)
    expect(contrastRatio(token('info-active'), WHITE)).toBeGreaterThan(base)
  })

  it('no superseded info-blue hex survives in brand.css declarations', () => {
    // Comments may reference the old values as history; declarations may not.
    const declarations = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
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
    for (const c of [token('chart-5'), token('chart-6')]) {
      expect(contrastRatio(c, token('bg-canvas'))).toBeGreaterThanOrEqual(AA_UI)
      expect(contrastRatio(c, token('bg-panel'))).toBeGreaterThanOrEqual(AA_UI)
    }
  })
})

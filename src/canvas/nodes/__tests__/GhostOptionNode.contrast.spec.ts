/**
 * Ghost-option outline — WCAG 1.4.11 non-text contrast pin.
 *
 * THE DEFECT THIS EXISTS FOR: the outline previously read
 * `var(--border-secondary, #d1d5db)`. `--border-secondary` is defined
 * nowhere, so every render fell through to the hardcoded `#d1d5db` — 1.46:1
 * against the node's own fill, a failure of SC 1.4.11's 3:1 bar. The first
 * repair retargeted it to `var(--border-emphasis, #DDD4C4)`, which fixed the
 * dangling reference and moved contrast by NOTHING: #DDD4C4 also measures
 * 1.46:1 against that fill. A pure hue shift, grey → sand, shipped as an
 * accessibility fix. Nothing in the suite could see it, because the only
 * guard in the area asks whether a token EXISTS, never what it MEASURES.
 *
 * So this asserts the measurement, not the spelling. Both sides are DERIVED
 * — the token name and its fallback are parsed out of the component, the
 * declared values out of brand.css — because a hand-copied expectation is
 * this repo's dominant defect class (trap 12). Retarget the outline at any
 * token that fails 3:1 and this goes red with the actual figure.
 *
 * GROUND. A border has two adjacent colours and both are asserted:
 *   · INSIDE  — the node's own `background: var(--bg-panel)` #FEFEFE.
 *     `background-clip` is border-box, so the dash GAPS show this too.
 *   · OUTSIDE — `--bg-canvas` #F4F0EA. Established in a live browser, not
 *     assumed: every ancestor from `.react-flow__node` up through
 *     `.react-flow__viewport`, `.react-flow__pane` and `.react-flow` is
 *     `rgba(0,0,0,0)` (xyflow sets `--xy-background-color-default:
 *     transparent`), so the first opaque ancestor is <body>, which carries
 *     `bg-canvas`. Accumulated opacity through that chain is 1.0 and every
 *     filter is `none`, so raw contrast IS effective contrast here.
 *   · HOVER   — `hover:bg-panel-hover` #FEF9F3 replaces the inside colour on
 *     hover, so it is a third ground the outline has to survive.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTokenHex } from '../../../styles/channelTriple.mjs'

const WCAG_NON_TEXT_MIN = 3

const component = readFileSync(join(__dirname, '../GhostOptionNode.tsx'), 'utf-8')
const brandCss = readFileSync(join(__dirname, '../../../styles/brand.css'), 'utf-8')

/** WCAG 2.x relative luminance + contrast ratio. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Declared colour of a `--token` at :root in brand.css.
 *
 * Delegated to the shared resolver so this guard reads brand.css identically
 * to the other four parsers. It understands the channel-triple form
 * (`--bg-panel-rgb: 254 254 254; --bg-panel: rgb(var(--bg-panel-rgb))`), which
 * is what allows Tailwind to emit opacity-modified utilities; a literal-hex-only
 * regex went red the moment that landed. Still throws on anything it cannot
 * resolve, so no assertion below can go vacuous.
 */
function declared(token: string): string {
  const hex = resolveTokenHex(brandCss, token)
  if (!hex) throw new Error(`${token} does not resolve to a literal colour in brand.css`)
  return hex
}

/** The outline's `var(--token, #fallback)`, parsed out of the component. */
function outlineDeclaration(): { token: string; fallback: string } {
  const m = component.match(/border:\s*'[^']*dashed\s+var\((--[a-z0-9-]+),\s*(#[0-9A-Fa-f]{3,8})\)'/i)
  if (!m) throw new Error('could not find the ghost outline border declaration in GhostOptionNode.tsx')
  return { token: m[1], fallback: m[2] }
}

describe('GhostOptionNode outline — WCAG 1.4.11 non-text contrast', () => {
  const { token, fallback } = outlineDeclaration()

  it('reads a token that brand.css actually declares (positive control)', () => {
    // Without this the parse could silently match nothing and every
    // assertion below would be vacuous (trap 13). It also proves the
    // grounds are real values, not defaults invented by this test.
    expect(token).toMatch(/^--[a-z-]+$/)
    expect(declared(token)).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(declared('--bg-panel')).toBe('#FEFEFE')
    expect(declared('--bg-canvas')).toBe('#F4F0EA')
    expect(declared('--bg-panel-hover')).toBe('#FEF9F3')
  })

  it('carries a fallback that matches the token exactly', () => {
    // A drifted fallback is invisible until the one moment it is needed.
    // NB: these messages deliberately avoid writing `var(` next to an
    // interpolation. The css-var census scans src/** and reads that shape as
    // a dynamic property reference whose name it cannot resolve statically,
    // so the literal would fail tests/ci-guards/css-var-resolution.spec.ts.
    expect(
      fallback.toUpperCase(),
      `the outline's ${token} fallback ${fallback} shadows a token declared as ${declared(token)}`,
    ).toBe(declared(token).toUpperCase())
  })

  it.each([
    ['own fill (--bg-panel, and the dash gaps)', '--bg-panel'],
    ['canvas behind (--bg-canvas, the first opaque ancestor)', '--bg-canvas'],
    ['hover fill (--bg-panel-hover)', '--bg-panel-hover'],
  ])('clears 3:1 against the %s', (_label, ground) => {
    const outline = declared(token)
    const bg = declared(ground)
    const ratio = contrast(outline, bg)
    expect(
      ratio,
      `the outline token ${token} = ${outline} measures ${ratio.toFixed(2)}:1 against ${ground} ` +
        `(${bg}) — SC 1.4.11 needs ${WCAG_NON_TEXT_MIN}:1. This outline is the only thing ` +
        'marking the affordance\'s bounds, so it is measured against every adjacent colour. ' +
        'Pick a token that measures, not one that merely resolves.',
    ).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN)
  })

  it('stays distinguishable from the other dashed border on the canvas', () => {
    // Incomplete nodes render `border-warning border-dashed` (--warning
    // #FFA656). The ghost shares the dashed STYLE channel with them, so hue
    // is all that separates the two — a contrast fix that collapsed this
    // separation would trade an a11y bug for a state-confusion bug.
    const outline = declared(token)
    const warning = declared('--warning')
    expect(outline.toUpperCase()).not.toBe(warning.toUpperCase())
    // Both are read against the same #FEFEFE fill, so a luminance gap is a
    // fair proxy for "these do not read as the same line".
    expect(
      Math.abs(luminance(outline) - luminance(warning)),
      `the ghost outline ${outline} and the incomplete-node dashed border ${warning} ` +
        'are too close in luminance to tell apart',
    ).toBeGreaterThan(0.2)
  })
})

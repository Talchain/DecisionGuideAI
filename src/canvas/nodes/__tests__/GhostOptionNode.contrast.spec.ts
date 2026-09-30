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
 *
 * ⭐ 30 SEP 2026: BOTH DOORS ARE NOW ONE ICON-ONLY BUTTON (`RowEndPromptIcon`,
 * Paul: "icons with hover states"). The outline is no longer an inline
 * `border: '… dashed var(--token, #fallback)'` in each door; it is the Tailwind
 * utility `border-text-light` on the shared icon, over a `bg-panel` fill. So the
 * token is now parsed out of the ICON's class list and resolved through
 * `tailwind.config.js` (the authority for what a utility paints) to brand.css —
 * still derived on both sides, still measured, never spelled. The three grounds
 * are unchanged: the icon's own `bg-panel` fill, the canvas outside it, and its
 * `hover:bg-panel-hover` fill.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { declaredValue, resolveTokenHex, tripleToHex } from '../../../styles/channelTriple.mjs'

const WCAG_NON_TEXT_MIN = 3

const component = readFileSync(join(__dirname, '../GhostOptionNode.tsx'), 'utf-8')
const tierComponent = readFileSync(join(__dirname, '../GhostTierNode.tsx'), 'utf-8')
const icon = readFileSync(join(__dirname, '../shared/RowEndPromptIcon.tsx'), 'utf-8')
const brandCss = readFileSync(join(__dirname, '../../../styles/brand.css'), 'utf-8')

interface Tailwindish {
  theme?: { extend?: { colors?: Record<string, unknown> } }
}
/** Loaded at runtime from a file URL (plain JS, no types — see V5CoachingBlock.colourTokens.spec.ts). */
let tailwindConfig: Tailwindish
beforeAll(async () => {
  const url = pathToFileURL(resolve(process.cwd(), 'tailwind.config.js')).href
  const mod = (await import(/* @vite-ignore */ url)) as { default?: Tailwindish }
  tailwindConfig = mod.default ?? (mod as Tailwindish)
  if (!tailwindConfig?.theme?.extend?.colors) {
    throw new Error(`tailwind.config.js loaded but declared no colours (${url})`)
  }
})

/**
 * Every class the icon button carries, read out of its `className={[ … ].join(' ')}`
 * array. Throws if the array cannot be found, so nothing below can go vacuous.
 */
function iconClasses(): string[] {
  const m = icon.match(/className=\{\[([\s\S]*?)\]\.join\(' '\)\}/)
  if (!m) throw new Error('could not find the icon button className array in RowEndPromptIcon.tsx')
  const literals = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])
  return literals.join(' ').split(/\s+/).filter(Boolean)
}

/** The CSS custom property a Tailwind colour utility suffix (`text-light`, `panel-hover`) paints with. */
function utilityVar(suffix: string): string {
  const colours = tailwindConfig.theme!.extend!.colors!
  for (const [family, value] of Object.entries(colours)) {
    const shades: Record<string, unknown> = typeof value === 'string' ? { DEFAULT: value } : (value as Record<string, unknown>)
    for (const [shade, v] of Object.entries(shades)) {
      const name = shade === 'DEFAULT' ? family : `${family}-${shade}`
      if (name !== suffix || typeof v !== 'string') continue
      const ref = v.match(/var\((--[a-z0-9-]+)\)/)
      if (!ref) throw new Error(`tailwind colour ${suffix} = ${v} names no CSS variable`)
      return ref[1]
    }
  }
  throw new Error(`tailwind.config.js declares no colour utility "${suffix}"`)
}

/** The literal hex a Tailwind colour utility suffix resolves to in brand.css. */
function utilityHex(suffix: string): string {
  const v = utilityVar(suffix)
  const raw = declaredValue(brandCss, v)
  const hex = (raw != null ? tripleToHex(raw) : null) ?? resolveTokenHex(brandCss, v)
  if (!hex) throw new Error(`${v} (from ${suffix}) does not resolve to a literal colour in brand.css`)
  return hex
}

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

/**
 * The icon's outline: the one `border-<colour>` utility in its class list (the
 * bare `border` is the width). Returned as the colour SUFFIX (`text-light`).
 */
function outlineUtility(): string {
  const colourBorders = iconClasses().filter((c) => /^border-[a-z]/.test(c) && !/^border-(solid|dashed|dotted|none|[xytrbl]|[xytrbl]-\d+|\d+)$/.test(c))
  if (colourBorders.length !== 1) throw new Error(`expected ONE border colour utility on the icon, found ${JSON.stringify(colourBorders)}`)
  return colourBorders[0].slice('border-'.length)
}

describe('row-end prompt icon outline — WCAG 1.4.11 non-text contrast', () => {
  it('reads a utility that tailwind.config.js and brand.css actually declare (positive control)', () => {
    // Without this the parse could silently match nothing and every
    // assertion below would be vacuous (trap 13). It also proves the
    // grounds are real values, not defaults invented by this test.
    const classes = iconClasses()
    expect(classes.length).toBeGreaterThan(5)
    expect(outlineUtility()).toMatch(/^[a-z-]+$/)
    expect(utilityHex(outlineUtility())).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(declared('--bg-panel')).toBe('#FEFEFE')
    expect(declared('--bg-canvas')).toBe('#F4F0EA')
    expect(declared('--bg-panel-hover')).toBe('#FEF9F3')
  })

  it('the icon\'s own fill IS the panel ground this file measures against (`bg-panel`, hovering to `bg-panel-hover`)', () => {
    // The inside ground is only --bg-panel if the icon really paints it — read
    // from the icon's classes and resolved through the config, not assumed.
    const classes = iconClasses()
    expect(classes).toContain('bg-panel')
    expect(classes).toContain('hover:bg-panel-hover')
    expect(utilityHex('panel').toUpperCase()).toBe(declared('--bg-panel').toUpperCase())
    expect(utilityHex('panel-hover').toUpperCase()).toBe(declared('--bg-panel-hover').toUpperCase())
  })

  it('the outline utility paints exactly the contract\'s muted token (no fallback left to drift)', () => {
    // The inline `var(--token, #fallback)` this row once policed is gone: a
    // Tailwind utility compiles from the config, so there is no hand-kept
    // fallback. What CAN drift is the utility → token mapping, so that is pinned.
    expect(utilityVar(outlineUtility())).toBe('--text-light-rgb')
    expect(utilityHex(outlineUtility()).toUpperCase()).toBe(declared('--text-light').toUpperCase())
  })

  it.each([
    ['own fill (--bg-panel)', '--bg-panel'],
    ['canvas behind (--bg-canvas, the first opaque ancestor)', '--bg-canvas'],
    ['hover fill (--bg-panel-hover)', '--bg-panel-hover'],
  ])('clears 3:1 against the %s', (_label, ground) => {
    const token = `border-${outlineUtility()}`
    const outline = utilityHex(outlineUtility())
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
    // Incomplete nodes render amber (--warning #FFA656).
    //
    // ⚠ THIS COMMENT SAID "border-warning border-dashed … the ghost shares the
    // dashed STYLE channel with them" UNTIL 1 Sep 2026, AND THAT HALF IS NOW
    // FALSE. The dash was removed from the incomplete treatment as a false claim
    // — `DESIGN_SYSTEM.md` reserves dashed for "outside your control" — so the
    // ghost NO LONGER shares the dashed channel with an incomplete node. The
    // assertion below is unchanged and still load-bearing for a narrower reason:
    // both marks still appear on canvas cards, so a contrast fix that walked the
    // ghost outline into the amber family would still trade an a11y bug for a
    // state-confusion bug. Only the mechanism sentence changed.
    //
    // ⚠ SCOPE, not generalised: this compares the ghost against amber alone. It
    // is NOT a claim that the ghost is distinguishable from every other border
    // on the canvas, and it never was.
    const outline = utilityHex(outlineUtility())
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

/**
 * ⭐ CONTRACT v3.1 T12 — the placeholder's outline is the MUTED token, not body
 * ink. It was `--text-body` (10.45:1 on the panel): the darkest line on the
 * canvas, drawn on a placeholder. `--text-light` still clears SC 1.4.11 on
 * every ground above (measured by the block above, from brand.css), and both
 * ghost doors must speak the same token so the two placeholders read as one
 * affordance. Contract: `--muted`; DS v5 §3.12 (neutral borders are chrome).
 */
describe('ghost outlines — contract v3.1 T12 (muted, not body ink)', () => {
  it('the icon outlines in --text-light', () => {
    expect(outlineUtility()).toBe('text-light')
  })

  it('both doors render the ONE icon, so they cannot speak different tokens — and neither keeps its own border', () => {
    // 30 Sep: "same token, same dash" is now structural — both doors mount
    // `RowEndPromptIcon`. The retired inline outline must be gone from both,
    // not merely overridden, or a door could paint two borders.
    for (const [name, src] of [['GhostOptionNode', component], ['GhostTierNode', tierComponent]] as const) {
      expect(src, `${name} does not import the shared icon`).toMatch(/import \{ RowEndPromptIcon \} from '\.\/shared\/RowEndPromptIcon'/)
      expect(src, `${name} does not render the shared icon`).toContain('<RowEndPromptIcon ')
      expect(src, `${name} still declares its own inline border`).not.toMatch(/border:\s*['`]/)
    }
  })

  it('the icon is ROUND — `rounded-full` (DS §6.2 pill, §9.9 icon-only button), not the card corner', () => {
    // The tile took the card corner (`rounded-sm`, contract v3.1 FRAME-01). The
    // icon is a button, not a card, and DS §9.9 draws icon-only buttons round.
    const classes = iconClasses()
    expect(classes).toContain('rounded-full')
    expect(classes.filter((c) => /^rounded-(sm|md|lg|xl)$/.test(c))).toEqual([])
  })
})

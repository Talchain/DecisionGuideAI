/**
 * `--text-light` WCAG 1.4.3 text-contrast pin.
 *
 * THE DEFECT THIS EXISTS FOR: `--text-light` shipped as #908D8D, which is
 * not a legal TEXT colour at any size — 3.26:1 on `--bg-panel` and 2.90:1 on
 * `--bg-canvas`, against SC 1.4.3's 4.5:1 bar. It was used at ~785 live,
 * user-visible sites across ~190 files, and NONE qualified for the large-text
 * exemption (>=24px, or >=18.66px bold — the largest muted site in the tree
 * is 20px and not bold), so font size could not rescue a single one of them.
 * Nothing in the suite could see it: the css-var guard asks whether a token
 * is DEFINED and whether its hardcoded fallbacks AGREE, never what the value
 * MEASURES. A token can be perfectly self-consistent and still illegal.
 *
 * So this asserts the MEASUREMENT, not the spelling. Both sides are DERIVED
 * from brand.css — the foreground and both grounds are parsed out of the same
 * file the product renders from — because a hardcoded copy of the new hex
 * would pass forever regardless of what the token actually says, which is this
 * repo's dominant defect class (trap 12: the hand-maintained mirror). Retint
 * `--text-light` lighter, or darken `--bg-canvas`, and this goes red with the
 * actual figure.
 *
 * GROUNDS. Two, and both are real surfaces this token is painted on:
 *   · `--bg-panel`  #FEFEFE — panels, cards, inspector, results, node fills.
 *   · `--bg-canvas` #F4F0EA — the <body> behind the react-flow canvas.
 *     Established in a live browser by the GhostOptionNode lane, not assumed:
 *     every ancestor from `.react-flow__node` up through `__viewport`,
 *     `__pane` and `.react-flow` is rgba(0,0,0,0) (xyflow sets
 *     `--xy-background-color-default: transparent`), so the first opaque
 *     ancestor is <body>. Accumulated opacity through that chain is 1.0 and
 *     every filter is `none`, so raw contrast IS effective contrast.
 *   · `--bg-panel-hover` #FEF9F3 is asserted too — it replaces the panel
 *     ground on hover, so muted text has to survive it as a third surface.
 *
 * WHAT THIS DELIBERATELY DOES NOT COVER: sites where an ancestor `opacity`
 * suppresses the text (11 known live sites at opacity-50/60/70 measure
 * 1.9-2.9:1 even after the retint). A colour token cannot fix those — they
 * need the opacity removed — and pretending this guard covers them would be
 * the more dangerous failure. See the retint PR body for the list.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTokenHex } from '../../src/styles/channelTriple.mjs'

/** SC 1.4.3 — normal-size text. Large text (>=24px / >=18.66px bold) may use 3:1. */
const WCAG_TEXT_MIN = 4.5

/**
 * The bar this palette actually holds itself to. Compliance is a CLAIM someone
 * else may re-check with a different tool, so clearing 4.5 by a hairline is not
 * good enough — see the margin test below for the reasoning and the rejected
 * alternative.
 */
const WCAG_TEXT_MARGIN = 4.6

const BRAND_CSS_PATH = join(__dirname, '../../src/styles/brand.css')
const brandCss = readFileSync(BRAND_CSS_PATH, 'utf-8')

/**
 * WCAG 2.x relative luminance + contrast ratio.
 * Lifted verbatim from src/canvas/nodes/__tests__/GhostOptionNode.contrast.spec.ts
 * so both a11y guards measure with ONE implementation, not two that can drift.
 */
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
 * Declared colour of a `--token` at :root in brand.css. Throws rather than
 * defaulting.
 *
 * Resolution is delegated to the SHARED resolver so this guard understands
 * exactly the same declaration forms as the other four brand.css parsers —
 * literal hex, `var()` alias, and the channel-triple form
 * (`--text-light-rgb: 110 107 107; --text-light: rgb(var(--text-light-rgb))`)
 * that lets Tailwind emit opacity-modified utilities. This guard previously
 * matched a literal hex only, so it went red the moment the triple landed:
 * fail-loud, exactly as designed. Teaching it the form does NOT relax it —
 * an unresolvable token still throws, and the ratios are still computed.
 */
function declared(token: string): string {
  const hex = resolveTokenHex(brandCss, token)
  if (!hex) throw new Error(`${token} does not resolve to a literal colour in src/styles/brand.css`)
  return hex
}

/** Every ground `--text-light` is painted on as TEXT, worst case included. */
const GROUNDS = ['--bg-panel', '--bg-canvas', '--bg-panel-hover'] as const

describe('--text-light is a legal text colour (WCAG SC 1.4.3)', () => {
  it('the maths can SEE a failure it is asserting the absence of (positive control)', () => {
    // Without this, every assertion below could be passing because the
    // implementation is broken rather than because the token is compliant
    // (trap 13: an absence assertion must first prove it can see a presence).

    // 1. The KNOWN-BAD historical value must FAIL on both real grounds.
    //    These are the figures committed in GhostOptionNode.tsx's own comment.
    expect(contrast('#908D8D', declared('--bg-panel'))).toBeCloseTo(3.26, 2)
    expect(contrast('#908D8D', declared('--bg-canvas'))).toBeCloseTo(2.9, 2)
    expect(contrast('#908D8D', declared('--bg-panel'))).toBeLessThan(WCAG_TEXT_MIN)

    // 2. A known-good pairing must PASS — proves the function is not simply
    //    returning something small for everything.
    expect(contrast(declared('--text-body'), declared('--bg-panel'))).toBeCloseTo(10.45, 2)

    // 3. The parser must actually be reading brand.css, not silently
    //    defaulting: an undeclared token throws rather than returning a value.
    expect(() => declared('--token-that-does-not-exist')).toThrow()

    // 4. The channel-triple form must resolve to the SAME colour the literal
    //    hex used to declare. `--text-light` is declared as
    //    `rgb(var(--text-light-rgb))` now; if the resolver mis-assembled the
    //    channels, every ratio below would be measured against the wrong
    //    colour and would still look like a pass. This is the one assertion
    //    that pins the new declaration form to a concrete value.
    expect(declared('--text-light')).toBe('#6E6B6B')
    expect(brandCss).toMatch(/--text-light:\s*rgb\(var\(--text-light-rgb\)\)/)
  })

  it.each(GROUNDS)('clears 4.5:1 on %s', (ground) => {
    const fg = declared('--text-light')
    const bg = declared(ground)
    const ratio = contrast(fg, bg)
    expect(
      ratio,
      `--text-light ${fg} on ${ground} ${bg} measures ${ratio.toFixed(2)}:1, ` +
        `below SC 1.4.3's ${WCAG_TEXT_MIN}:1 for normal-size text. None of this token's ` +
        `live sites qualify for the large-text exemption (>=24px, or >=18.66px bold), ` +
        `so there is no size at which this is legal. Darken --text-light, or lighten ${ground}.`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
  })

  it('clears the bar by a MARGIN, not by a hairline', () => {
    // A compliance CLAIM needs more than arithmetic that scrapes over the line.
    // #706D6D is the lightest value clearing 4.5:1 on both grounds, at 4.5149
    // on --bg-canvas — 0.33% over. It was rejected deliberately: a third-party
    // checker rounding differently, or a single step of drift in --bg-canvas,
    // flips "we pass" to "we fail" without anyone touching this token. The
    // shipped #6E6B6B clears by 3.33%, and the two extra steps cost ΔE2000
    // 0.77 — below the ~1.0 just-noticeable difference — so the headroom is
    // bought for nothing perceptible.
    //
    // This is the ONE-SIDED half of the intent. The opposite risk, darkening
    // until muted stops reading as muted, is pinned by the separation test
    // below; together they bracket the token from both directions.
    const fg = declared('--text-light')
    const canvas = declared('--bg-canvas')
    const ratio = contrast(fg, canvas)
    expect(
      ratio,
      `--text-light ${fg} measures ${ratio.toFixed(4)}:1 on --bg-canvas ${canvas} — over ` +
        `SC 1.4.3's ${WCAG_TEXT_MIN}:1, but by less than the ${(WCAG_TEXT_MARGIN - WCAG_TEXT_MIN).toFixed(2)} ` +
        `headroom this palette requires. A margin that thin makes the compliance claim ` +
        `fragile to rounding and to any tweak of --bg-canvas. Darken --text-light slightly.`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MARGIN)
  })

  it('white text on a --text-light FILL also clears 4.5:1 (.priorityBadgeLow)', () => {
    // The token is used as a BACKGROUND in 18 places. Exactly one carries
    // text: .priorityBadgeLow in Conversation.module.css, which composes
    // .priorityBadge's `color: var(--text-on-color)`. Darkening the fill can
    // only help white text — but "can only help" is an argument, not a
    // measurement, and this pairing was failing (3.29:1) before the retint
    // with nobody watching it.
    const ratio = contrast(declared('--text-on-color'), declared('--text-light'))
    expect(
      ratio,
      `--text-on-color on a --text-light fill measures ${ratio.toFixed(2)}:1 — ` +
        `.priorityBadgeLow renders white text on this token.`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
  })

  it('stays visually distinct from --text-body, or the hierarchy collapses', () => {
    // Compliance is bought by darkening muted text TOWARDS body text, so the
    // cost of this fix is the muted/body distinction. Guarded so a future
    // "just darken it a bit more" cannot quietly erase the hierarchy.
    // Threshold is luminance-ratio based (a proxy, deliberately loose) —
    // the ΔE2000 figure is in the PR body; this only catches collapse.
    const light = luminance(declared('--text-light'))
    const body = luminance(declared('--text-body'))
    expect(
      light / body,
      `--text-light and --text-body are now within 1.5x luminance of each other — ` +
        `muted text has stopped reading as muted. Reach for a lighter --text-light, ` +
        `or accept that the palette needs a third rung.`,
    ).toBeGreaterThan(1.5)
  })
})
